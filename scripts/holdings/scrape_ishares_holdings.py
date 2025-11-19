"""
iShares ETF Holdings 자동 수집 스크립트

JSON API를 사용하여 Product ID를 찾고 CSV를 다운로드합니다.
채권 ETF는 제외하고, 실제 holdings가 있는 ETF만 처리합니다.
"""

import re
import time
import requests
import sys
import io
from datetime import datetime
from pathlib import Path

# Windows 인코딩 문제 해결
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# iShares JSON API URL
ISHARES_API_URL = "https://www.ishares.com/us/product-screener/product-screener-v3.1.jsn?dcrPath=/templatedata/config/product-screener-v3/data/en/us-ishares/ishares-product-screener-backend-config&siteEntryPassthrough=true"

# 제외할 자산 클래스 (채권 등)
EXCLUDED_ASSET_CLASSES = [
    'Fixed Income',  # 채권
    'Cash',  # 현금
]

# API 데이터 캐시
_api_cache = None

def load_ishares_api_data():
    """
    iShares JSON API 데이터 로드 (캐시 사용)
    
    Returns:
        dict: ETF 데이터
    """
    global _api_cache
    
    if _api_cache is not None:
        return _api_cache
    
    print("[INFO] iShares JSON API 로딩 중...")
    
    try:
        response = requests.get(ISHARES_API_URL, timeout=15)
        
        if response.status_code == 200:
            _api_cache = response.json()
            print(f"[OK] API 데이터 로드 완료 (총 {len(_api_cache)}개 상품)")
            return _api_cache
        else:
            print(f"[ERROR] API 호출 실패: {response.status_code}")
            return {}
            
    except Exception as e:
        print(f"[ERROR] API 오류: {e}")
        return {}


def find_etf_info(ticker):
    """
    티커로 iShares ETF 정보 찾기
    
    Args:
        ticker: ETF 티커
    
    Returns:
        dict: {
            'product_id': str,
            'slug': str,
            'fund_name': str,
            'asset_class': str,
            'is_bond': bool
        } 또는 None
    """
    api_data = load_ishares_api_data()
    
    if not api_data:
        return None
    
    for product_id, etf_data in api_data.items():
        if not isinstance(etf_data, dict):
            continue
        
        etf_ticker = etf_data.get('localExchangeTicker', '')
        if etf_ticker.upper() == ticker.upper():
            product_url = etf_data.get('productPageUrl', '')
            fund_name = etf_data.get('fundName', '')
            asset_class = etf_data.get('aladdinAssetClass', '')
            
            slug = None
            if product_url:
                match = re.search(r'/us/products/(\d+)/([a-z0-9-]+)', product_url)
                if match:
                    _, slug = match.groups()
            
            is_bond = asset_class in EXCLUDED_ASSET_CLASSES
            
            return {
                'product_id': str(product_id),
                'slug': slug,
                'fund_name': fund_name,
                'asset_class': asset_class,
                'is_bond': is_bond
            }
    
    return None


def download_ishares_csv(ticker, product_id, slug):
    """
    iShares Holdings CSV 다운로드
    
    Args:
        ticker: ETF 티커
        product_id: Product ID
        slug: URL slug
    
    Returns:
        str: CSV 내용 또는 None
    """
    if not slug:
        print(f"  [SKIP] Slug 없음")
        return None
    
    url = f"https://www.ishares.com/us/products/{product_id}/{slug}/1467271812596.ajax?fileType=csv&fileName={ticker}_holdings&dataType=fund"
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200 and len(response.text) > 100:
            return response.text
        else:
            return None
            
    except Exception as e:
        print(f"  [ERROR] 다운로드 오류: {e}")
        return None


def parse_ishares_csv(csv_content):
    """
    iShares CSV 파싱
    
    Args:
        csv_content: CSV 문자열
    
    Returns:
        tuple: (as_of_date, holdings_list)
    """
    lines = csv_content.strip().split('\n')
    
    # 날짜 추출 (두 번째 줄: Fund Holdings as of,"Nov 04, 2025")
    as_of_date = None
    for line in lines[:10]:
        if 'Fund Holdings as of' in line or 'as of' in line.lower():
            match = re.search(r'"([^"]+)"', line)
            if match:
                as_of_date = match.group(1)
                break
    
    # 헤더 찾기
    header_idx = None
    for i, line in enumerate(lines):
        if 'Ticker' in line and 'Name' in line:
            header_idx = i
            break
    
    if header_idx is None:
        return None, []
    
    # 헤더 파싱
    headers = [h.strip().strip('"') for h in lines[header_idx].split(',')]
    
    # 데이터 행 파싱
    holdings = []
    for i in range(header_idx + 1, len(lines)):
        line = lines[i].strip()
        
        # 빈 줄이나 특수 문자로 시작하는 줄 건너뛰기
        if not line or line.startswith('?') or line.startswith('"Following') or line.startswith('"The content'):
            break
        
        # CSV 파싱 (따옴표 처리)
        values = []
        current = ''
        in_quotes = False
        
        for char in line:
            if char == '"':
                in_quotes = not in_quotes
            elif char == ',' and not in_quotes:
                values.append(current.strip())
                current = ''
            else:
                current += char
        values.append(current.strip())
        
        if len(values) < len(headers):
            continue
        
        # 딕셔너리로 변환
        row_data = {}
        for j, header in enumerate(headers):
            if j < len(values):
                row_data[header.lower()] = values[j].strip('"')
        
        # 티커와 이름이 있는 경우만 추가
        ticker = row_data.get('ticker', '')
        name = row_data.get('name', '')
        weight = row_data.get('weight (%)', '')
        
        if ticker and name and ticker != '-':
            holdings.append({
                'ticker': ticker,
                'name': name,
                'weight': weight
            })
    
    return as_of_date, holdings


def scrape_ishares_etfs(tickers):
    """
    여러 iShares ETF Holdings 수집
    
    Args:
        tickers: 티커 리스트
    
    Returns:
        dict: {ticker: {'date': str, 'holdings': list}}
    """
    results = {}
    skipped = []
    failed = []
    
    print(f"\n[START] {len(tickers)}개 iShares ETF Holdings 수집")
    print("=" * 60)
    
    for ticker in tickers:
        print(f"\n[{ticker}]")
        
        # ETF 정보 찾기
        etf_info = find_etf_info(ticker)
        
        if not etf_info:
            print(f"  [SKIP] API에서 찾을 수 없음")
            skipped.append(ticker)
            continue
        
        print(f"  Fund: {etf_info['fund_name']}")
        print(f"  Asset Class: {etf_info['asset_class']}")
        
        # 채권 ETF 제외
        if etf_info['is_bond']:
            print(f"  [SKIP] 채권 ETF (holdings 추적 불필요)")
            skipped.append(ticker)
            continue
        
        # CSV 다운로드
        csv_content = download_ishares_csv(ticker, etf_info['product_id'], etf_info['slug'])
        
        if not csv_content:
            print(f"  [FAIL] CSV 다운로드 실패")
            failed.append(ticker)
            continue
        
        # CSV 파싱
        as_of_date, holdings = parse_ishares_csv(csv_content)
        
        if not holdings:
            print(f"  [SKIP] Holdings 데이터 없음")
            skipped.append(ticker)
            continue
        
        print(f"  [OK] {len(holdings)}개 Holdings 수집")
        if as_of_date:
            print(f"  Date: {as_of_date}")
        
        # 처음 3개 출력
        for i, holding in enumerate(holdings[:3]):
            print(f"    {i+1}. {holding['ticker']}: {holding['name']} ({holding['weight']})")
        
        results[ticker] = {
            'date': as_of_date,
            'holdings': holdings
        }
        
        time.sleep(1)  # Rate limiting
    
    # 결과 요약
    print("\n" + "=" * 60)
    print("수집 결과")
    print("=" * 60)
    print(f"[OK] 성공: {len(results)}개")
    print(f"[SKIP] 건너뛰기: {len(skipped)}개 (채권 ETF 등)")
    print(f"[FAIL] 실패: {len(failed)}개")
    
    if results:
        print(f"\n성공 티커: {', '.join(results.keys())}")
    if skipped:
        print(f"건너뛴 티커: {', '.join(skipped[:10])}{'...' if len(skipped) > 10 else ''}")
    if failed:
        print(f"실패 티커: {', '.join(failed)}")
    
    return results


def save_batch_file(results):
    """
    배치 파일 저장 (add_roundhill_holdings.py에서 사용)
    
    Args:
        results: scrape_ishares_etfs 결과
    
    Returns:
        str: 배치 파일 경로
    """
    if not results:
        return None
    
    # 파일명: ishares_YYMMDD_csv.txt
    date_str = datetime.now().strftime('%y%m%d')
    filename = f"ishares_{date_str}_csv.txt"
    filepath = Path("public/holdings") / filename
    
    # 디렉토리 생성
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # 배치 파일 작성
    with open(filepath, 'w', encoding='utf-8') as f:
        for ticker, data in results.items():
            f.write(f"{ticker}\n")
            
            # 날짜 형식 변환: "Nov 04, 2025" -> "11/04/2025"
            date_str_formatted = data['date']
            if date_str_formatted:
                try:
                    parsed_date = datetime.strptime(date_str_formatted, '%b %d, %Y')
                    date_str_formatted = parsed_date.strftime('%m/%d/%Y')
                except:
                    pass
            
            f.write(f"as of {date_str_formatted}\n")
            f.write("\n")
            f.write("Ticker\tName\tWeight\tShares\tMarket Value\n")
            
            for holding in data['holdings']:
                f.write(f"{holding['ticker']}\t{holding['name']}\t{holding['weight']}\t\t\n")
            
            f.write("\n")
            f.write("-" * 26 + "\n")
            f.write("\n")
    
    print(f"\n[SAVE] 배치 파일 저장: {filepath}")
    return str(filepath)


if __name__ == "__main__":
    import sys
    
    # 명령줄 인자 파싱
    tickers = []
    
    if '--all' in sys.argv:
        # failed_holdings_tickers.txt에서 iShares 티커만 추출
        failed_file = Path(__file__).parent / 'failed_holdings_tickers.txt'
        
        if failed_file.exists():
            with open(failed_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[4:]  # 헤더 건너뛰기
                all_failed = [line.strip() for line in lines if line.strip()]
            
            # API 로드
            api_data = load_ishares_api_data()
            
            # iShares ETF 필터링
            for ticker in all_failed:
                info = find_etf_info(ticker)
                if info:
                    tickers.append(ticker)
            
            print(f"\n[INFO] 실패 티커 중 iShares ETF: {len(tickers)}개")
        else:
            print("[WARNING] failed_holdings_tickers.txt 파일을 찾을 수 없습니다.")
            print("[WARNING] scripts/holdings/ 디렉토리에 파일이 없습니다. 처리할 티커가 없어 종료합니다.")
            print("[INFO] 이 스크립트는 fetch_holdings.py 실행 후 생성된 failed_holdings_tickers.txt 파일을 사용합니다.")
            sys.exit(0)  # 에러가 아닌 정상 종료로 처리
    elif len(sys.argv) > 1:
        # 개별 티커 지정
        tickers = [arg.upper() for arg in sys.argv[1:] if not arg.startswith('--')]
    else:
        # 기본 테스트 티커
        tickers = ['IBIT', 'IVV']
    
    if not tickers:
        print("[ERROR] 처리할 티커가 없습니다.")
        print("\n사용법:")
        print("  python scrape_ishares_holdings.py IBIT IVV  # 개별 티커")
        print("  python scrape_ishares_holdings.py --all     # 실패 티커 중 iShares만")
        sys.exit(1)
    
    # Holdings 수집
    results = scrape_ishares_etfs(tickers)
    
    # 배치 파일 저장
    if results:
        batch_file = save_batch_file(results)
        
        if batch_file:
            print("\n" + "=" * 60)
            print("다음 명령으로 데이터를 등록하세요:")
            print("=" * 60)
            print(f"  python scripts/holdings/add_roundhill_holdings.py --batch {batch_file}")

