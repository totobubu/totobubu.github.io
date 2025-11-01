"""
ETF Holdings 데이터 수집 및 JSON 파일 업데이트 스크립트

이 스크립트는:
1. nav.json에서 holdings: true인 ETF만 선택적으로 처리합니다
2. Yahoo Finance에서 ETF의 Top Holdings 정보를 가져옵니다
3. public/data/{ticker}.json의 backtestData에 holdings를 추가/업데이트합니다
4. 각 날짜의 backtestData 항목에 holdings를 포함시켜 시계열로 관리합니다

사용법:
  - 특정 티커: python fetch_holdings.py SPY
  - 모든 holdings 티커: python fetch_holdings.py
  
holdings 추적 티커 추가:
  nav.json에서 해당 티커에 "holdings": true 필드를 추가하세요.
"""

import yfinance as yf
import json
import os
from datetime import datetime
from pathlib import Path
import time
import requests
from bs4 import BeautifulSoup
import re


def sanitize_ticker_for_filename(ticker):
    """티커를 파일명으로 변환 (점을 하이픈으로 변경)"""
    return ticker.replace('.', '-').lower()


def fetch_yieldmax_holdings(ticker_symbol):
    """
    YieldMax ETF 웹사이트에서 Top 10 Holdings 정보를 직접 스크래핑합니다.
    
    Args:
        ticker_symbol: ETF 티커 심볼 (예: APLY, NVDY)
        
    Returns:
        holdings 리스트 또는 None
    """
    try:
        ticker_lower = ticker_symbol.lower()
        url = f"https://yieldmaxetfs.com/our-etfs/{ticker_lower}/"
        
        print(f"[INFO] YieldMax 웹사이트 접속 중: {url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # "Top 10 Holdings" 섹션 찾기
        holdings_section = soup.find('h2', string=re.compile(r'Top \d+ Holdings', re.IGNORECASE))
        
        if not holdings_section:
            print(f"[WARNING] {ticker_symbol}: 'Top Holdings' 섹션을 찾을 수 없습니다.")
            return None
        
        # 테이블 찾기
        table = holdings_section.find_next('table')
        
        if not table:
            print(f"[WARNING] {ticker_symbol}: Holdings 테이블을 찾을 수 없습니다.")
            return None
        
        holdings_list = []
        rows = table.find_all('tr')
        
        # 헤더 행 건너뛰기
        for row in rows[1:]:
            cols = row.find_all('td')
            
            if len(cols) < 6:
                continue
            
            try:
                security_name = cols[0].get_text(strip=True)
                cusip = cols[1].get_text(strip=True)
                weight_text = cols[5].get_text(strip=True)
                
                # 비중 파싱 (예: "19.33%" -> 19.33)
                weight_match = re.search(r'([\d.]+)%', weight_text)
                if not weight_match:
                    continue
                
                weight = float(weight_match.group(1))
                
                # 자산 타입 분류
                asset_type = classify_yieldmax_asset(security_name, cusip)
                
                holdings_list.append({
                    'symbol': cusip,
                    'name': security_name,
                    'weight': round(weight, 2),
                    'type': asset_type
                })
                
            except (ValueError, IndexError) as e:
                print(f"[DEBUG] 행 파싱 오류: {e}")
                continue
        
        if holdings_list:
            print(f"[OK] {ticker_symbol}: {len(holdings_list)}개의 YieldMax holdings 데이터 수집 성공")
            return holdings_list
        else:
            print(f"[WARNING] {ticker_symbol}: 파싱된 holdings 데이터가 없습니다.")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] {ticker_symbol}: 웹사이트 접속 실패 - {str(e)}")
        return None
    except Exception as e:
        print(f"[ERROR] {ticker_symbol}: YieldMax holdings 수집 실패 - {str(e)}")
        return None


def classify_yieldmax_asset(security_name, cusip):
    """
    YieldMax 자산의 타입을 분류합니다.
    
    Args:
        security_name: 자산 이름
        cusip: CUSIP 코드
        
    Returns:
        자산 타입 문자열
    """
    name_upper = security_name.upper()
    cusip_upper = cusip.upper()
    
    # 옵션 계약 (AAPL 251219C00255000, AAPL US 12/19/25 C255 등)
    if (re.search(r'\d{6}[CP]\d{8}', cusip_upper) or  # 옵션 CUSIP 패턴
        re.search(r' C\d+', name_upper) or re.search(r' P\d+', name_upper) or  # 콜/풋 가격
        'CALL' in name_upper or 'PUT' in name_upper):
        return 'option'
    
    # 스왑 계약
    if 'SWAP' in name_upper or 'TRS' in name_upper:
        return 'swap'
    
    # 국채
    if 'TREASURY' in name_upper or 'T-BILL' in name_upper or 'T-NOTE' in name_upper:
        if 'NOTE' in name_upper or 'BOND' in name_upper:
            return 'treasury_note'
        elif 'BILL' in name_upper:
            return 'treasury_bill'
        return 'treasury'
    
    # 현금 및 기타
    if 'CASH' in name_upper or cusip_upper == 'CASH&OTHER':
        return 'cash'
    
    # 머니마켓 펀드
    if 'GOVERNMENT OBLIGATIONS' in name_upper or 'MONEY MARKET' in name_upper:
        return 'money_market'
    
    # 주식
    if any(exchange in cusip_upper for exchange in [' US ', 'NYSE', 'NASDAQ']):
        return 'equity'
    
    return 'other'


def is_roundhill_etf(ticker_symbol):
    """
    Roundhill ETF인지 확인합니다.
    
    Args:
        ticker_symbol: 티커 심볼
        
    Returns:
        bool: Roundhill ETF이면 True
    """
    # Roundhill ETF 목록 (수동 입력으로 처리)
    roundhill_tickers = [
        'NFLW', 'AAPW', 'TSLW', 'NVDW', 'MSFW', 'GOOW', 'AMZW', 'METW',
        'PLTW', 'COIW', 'HOOW', 'MSTW', 'BRKW', 'AMDW', 'AVGW', 'ARMW',
        'BABW', 'COSW', 'UBEW', 'GDXW', 'GLDW', 'WPAY',
        'XDTE', 'QDTE', 'RDTE', 'XPAY', 'YBTC', 'YETH', 'MAGY',
        'METV', 'MAGS', 'CHAT', 'BETZ', 'NERD', 'OZEM', 'WEED', 'MAGC',
        'UX', 'HUMN', 'MEME', 'WEEK', 'XDIV', 'MAGX'
    ]
    
    return ticker_symbol.upper() in roundhill_tickers


def is_yieldmax_etf(ticker_symbol):
    """
    YieldMax ETF인지 확인합니다.
    
    Args:
        ticker_symbol: 티커 심볼
        
    Returns:
        bool: YieldMax ETF이면 True
    """
    # YieldMax ETF 목록 (nav.json에서 provider가 'yieldmax'인 것들)
    # 또는 간단하게 URL 존재 여부로 확인
    yieldmax_tickers = [
        'APLY', 'NVDY', 'TSLY', 'MSTY', 'CONY', 'GOOY', 'AMZY', 'NFLY',
        'OARK', 'YMAX', 'YMAG', 'CRSH', 'DIPS', 'FIAT', 'WNTR', 'YQQQ',
        'SLTY', 'ULTY', 'FEAT', 'FIVY', 'QDTY', 'RDTY', 'SDTY',
        'ABNY', 'AIYY', 'AMDY', 'BABO', 'BRKC', 'CRCO', 'CVNY', 'DISO',
        'DRAY', 'FBY', 'GDXY', 'GMEY', 'HIYY', 'HOOY', 'JPMO', 'MARO',
        'MRNY', 'MSFO', 'PYPY', 'RBLY', 'RDYY', 'SMCY', 'SNOY', 'TSMY',
        'XOMO', 'XYZY', 'YBIT', 'CHPY', 'GPTY', 'LFGY', 'BIGY', 'RNTY', 'SOXY'
    ]
    
    return ticker_symbol.upper() in yieldmax_tickers


def fetch_etf_holdings(ticker_symbol):
    """
    ETF Holdings 정보를 가져옵니다.
    - Roundhill ETF: 수동 입력으로 처리 (건너뜀)
    - YieldMax ETF: 공식 웹사이트에서 스크래핑
    - 기타 ETF: Yahoo Finance 사용
    
    Args:
        ticker_symbol: ETF 티커 심볼
        
    Returns:
        holdings 리스트 또는 None
    """
    # Roundhill ETF는 수동 입력으로 처리
    if is_roundhill_etf(ticker_symbol):
        print(f"[SKIP] {ticker_symbol}: Roundhill ETF - 수동 입력으로 처리하세요")
        print(f"[INFO] 사용: python scripts/add_roundhill_holdings.py {ticker_symbol} \"날짜\"")
        return None
    
    # YieldMax ETF인 경우 공식 웹사이트에서 스크래핑
    if is_yieldmax_etf(ticker_symbol):
        print(f"[INFO] {ticker_symbol}: YieldMax ETF 감지 - 공식 웹사이트에서 데이터 수집")
        holdings = fetch_yieldmax_holdings(ticker_symbol)
        if holdings:
            return holdings
        print(f"[INFO] {ticker_symbol}: YieldMax 웹사이트 실패, Yahoo Finance로 폴백")
    
    # Yahoo Finance 사용 (일반 ETF 또는 YieldMax 폴백)
    try:
        ticker = yf.Ticker(ticker_symbol)
        
        # 최신 yfinance API 사용: get_funds_data()
        try:
            funds_data = ticker.get_funds_data()
            
            # top_holdings 속성 확인
            if hasattr(funds_data, 'top_holdings'):
                top_holdings = funds_data.top_holdings
                
                # top_holdings가 DataFrame인 경우
                if hasattr(top_holdings, 'to_dict'):
                    holdings_list = []
                    
                    # DataFrame을 반복하면서 데이터 추출
                    for symbol, row in top_holdings.iterrows():
                        name = row.get('Name', '')
                        holding_percent = row.get('Holding Percent', 0)
                        
                        holdings_list.append({
                            'symbol': symbol,
                            'name': name,
                            'weight': round(float(holding_percent) * 100, 2) if holding_percent else 0
                        })
                    
                    if holdings_list:
                        print(f"[OK] {ticker_symbol}: {len(holdings_list)}개의 holdings 데이터 수집 성공 (Yahoo Finance)")
                        return holdings_list
        except Exception as e:
            print(f"[DEBUG] get_funds_data() 실패: {e}")
        
        print(f"[WARNING] {ticker_symbol}: Holdings 데이터를 찾을 수 없습니다.")
        return None
        
    except Exception as e:
        print(f"[ERROR] {ticker_symbol}: Holdings 데이터 수집 실패 - {str(e)}")
        return None


def compare_holdings(holdings1, holdings2):
    """
    두 holdings 데이터가 동일한지 비교
    
    Args:
        holdings1: 첫 번째 holdings 리스트
        holdings2: 두 번째 holdings 리스트
        
    Returns:
        bool: 동일하면 True
    """
    if holdings1 is None or holdings2 is None:
        return False
    
    if len(holdings1) != len(holdings2):
        return False
    
    # symbol 기준으로 정렬하여 비교
    sorted1 = sorted(holdings1, key=lambda x: x.get('symbol', ''))
    sorted2 = sorted(holdings2, key=lambda x: x.get('symbol', ''))
    
    for h1, h2 in zip(sorted1, sorted2):
        if (h1.get('symbol') != h2.get('symbol') or
            h1.get('name') != h2.get('name') or
            abs(h1.get('weight', 0) - h2.get('weight', 0)) > 0.01):  # 0.01% 차이 허용
            return False
    
    return True


def update_json_with_holdings(ticker_symbol, data_dir='public/data', force_update=False):
    """
    JSON 파일의 backtestData에 holdings 데이터를 추가/업데이트합니다.
    직전 데이터와 동일한 경우 추가하지 않습니다.
    
    Args:
        ticker_symbol: ETF 티커 심볼
        data_dir: JSON 파일이 있는 디렉토리
        force_update: True면 기존 holdings를 덮어씀 (기본값: False)
        
    Returns:
        성공 여부 (bool)
    """
    try:
        # 파일 경로 설정
        sanitized_ticker = sanitize_ticker_for_filename(ticker_symbol)
        json_path = Path(data_dir) / f"{sanitized_ticker}.json"
        
        if not json_path.exists():
            print(f"[WARNING] {ticker_symbol}: JSON 파일이 존재하지 않습니다 - {json_path}")
            return False
        
        # 기존 JSON 읽기
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Holdings 데이터 가져오기
        holdings_data = fetch_etf_holdings(ticker_symbol)
        
        if holdings_data is None:
            return False
        
        # 현재 날짜
        today = datetime.now().strftime('%Y-%m-%d')
        
        # backtestData가 없으면 생성
        if 'backtestData' not in data:
            data['backtestData'] = []
        
        # 날짜순 정렬 (오래된 것부터)
        data['backtestData'].sort(key=lambda x: x.get('date', ''))
        
        # holdings가 있는 가장 최근 항목 찾기 (오늘 이전)
        latest_holdings = None
        latest_holdings_date = None
        for entry in reversed(data['backtestData']):
            entry_date = entry.get('date', '')
            if entry_date < today and 'holdings' in entry:
                latest_holdings = entry['holdings']
                latest_holdings_date = entry_date
                break
        
        # 직전 데이터와 비교
        if latest_holdings and compare_holdings(latest_holdings, holdings_data):
            print(f"[SKIP] {ticker_symbol}: {today} holdings가 직전({latest_holdings_date})과 동일하여 건너뜀")
            return True  # 성공으로 처리 (에러는 아님)
        
        # 오늘 날짜의 backtestData 항목 찾기
        existing_entry = None
        for entry in data['backtestData']:
            if entry.get('date') == today:
                existing_entry = entry
                break
        
        if existing_entry is not None:
            # 이미 holdings가 있는지 확인 (수동 입력된 데이터 보호)
            if 'holdings' in existing_entry and not force_update:
                print(f"[SKIP] {ticker_symbol}: {today}에 이미 holdings 데이터가 있습니다 (수동 입력 보호)")
                print(f"[INFO] 강제 업데이트하려면: python fetch_holdings.py {ticker_symbol} --force")
                return True  # 성공으로 처리
            
            # holdings가 없거나 force_update=True면 추가/업데이트
            if 'holdings' in existing_entry and force_update:
                print(f"[FORCE] {ticker_symbol}: 기존 holdings 데이터를 강제로 덮어씁니다")
            
            existing_entry['holdings'] = holdings_data
            if latest_holdings_date:
                print(f"[UPDATE] {ticker_symbol}: {today} backtestData에 holdings 업데이트 (변화 있음, 직전: {latest_holdings_date})")
            else:
                print(f"[UPDATE] {ticker_symbol}: {today} backtestData에 holdings 업데이트")
        else:
            # 새 항목 생성 (주가 데이터는 나중에 업데이트됨)
            new_entry = {
                'date': today,
                'holdings': holdings_data
            }
            data['backtestData'].append(new_entry)
            # 날짜순 정렬
            data['backtestData'].sort(key=lambda x: x.get('date', ''))
            if latest_holdings_date:
                print(f"[ADD] {ticker_symbol}: {today} backtestData에 holdings 추가 (변화 있음, 직전: {latest_holdings_date})")
            else:
                print(f"[ADD] {ticker_symbol}: {today} backtestData에 holdings 추가 (최초)")
        
        # 기존 holdings 대분류가 있으면 제거 (마이그레이션)
        if 'holdings' in data:
            del data['holdings']
            print(f"[MIGRATE] {ticker_symbol}: 기존 holdings 대분류 제거")
        
        # JSON 파일 저장
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        # holdings가 있는 backtestData 항목 수 계산
        holdings_count = sum(1 for entry in data['backtestData'] if 'holdings' in entry)
        print(f"[SAVE] {ticker_symbol}: JSON 파일 저장 완료 (총 {holdings_count}개 날짜에 holdings 데이터)")
        return True
        
    except Exception as e:
        print(f"[ERROR] {ticker_symbol}: JSON 업데이트 실패 - {str(e)}")
        return False


def process_single_ticker(ticker_symbol, data_dir='public/data', force_update=False):
    """단일 티커 처리"""
    print(f"\n{'='*60}")
    print(f"처리 중: {ticker_symbol}")
    print(f"{'='*60}")
    
    success = update_json_with_holdings(ticker_symbol, data_dir, force_update=force_update)
    
    if success:
        print(f"[OK] {ticker_symbol} 처리 완료")
    else:
        print(f"[ERROR] {ticker_symbol} 처리 실패")
    
    return success


def load_nav_data(nav_path='public/nav.json'):
    """nav.json에서 holdings 추적 대상 티커 목록 가져오기"""
    try:
        with open(nav_path, 'r', encoding='utf-8') as f:
            nav_data = json.load(f)
        
        # holdings: true인 티커만 필터링
        holdings_tickers = [
            item['symbol'] 
            for item in nav_data.get('nav', []) 
            if item.get('holdings', False) is True
        ]
        
        return holdings_tickers
    except Exception as e:
        print(f"[ERROR] nav.json 로드 실패: {e}")
        return []


def process_all_tickers(data_dir='public/data'):
    """nav.json에서 holdings: true인 티커만 처리"""
    
    # nav.json에서 holdings 티커 목록 로드
    holdings_tickers = load_nav_data()
    
    if not holdings_tickers:
        print(f"[WARNING] nav.json에 holdings: true인 티커가 없습니다.")
        print(f"[INFO] nav.json에 'holdings': true를 추가하세요.")
        return
    
    print(f"\n[INFO] nav.json에서 {len(holdings_tickers)}개의 holdings 추적 티커 발견")
    print(f"[INFO] 티커 목록: {', '.join(holdings_tickers)}")
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    failed_tickers = []  # 실패한 티커 목록
    
    for ticker in holdings_tickers:
        # JSON 파일이 존재하는지 확인
        sanitized_ticker = sanitize_ticker_for_filename(ticker)
        json_path = Path(data_dir) / f"{sanitized_ticker}.json"
        
        if not json_path.exists():
            print(f"\n[SKIP] {ticker}: JSON 파일이 없습니다 - {json_path}")
            skip_count += 1
            continue
        
        success = process_single_ticker(ticker, data_dir)
        
        if success:
            success_count += 1
        else:
            fail_count += 1
            failed_tickers.append(ticker)
        
        # API 요청 제한을 위한 대기
        time.sleep(1)
    
    print(f"\n{'='*60}")
    print(f"전체 처리 완료")
    print(f"{'='*60}")
    print(f"[OK] 성공: {success_count}개")
    print(f"[ERROR] 실패: {fail_count}개")
    print(f"[SKIP] 건너뜀: {skip_count}개")
    print(f"[INFO] 총: {len(holdings_tickers)}개")
    
    # 실패한 티커 목록 저장
    if failed_tickers:
        failed_log_path = Path('scripts') / 'failed_holdings_tickers.txt'
        with open(failed_log_path, 'w', encoding='utf-8') as f:
            f.write(f"실패한 티커 목록 ({len(failed_tickers)}개)\n")
            f.write(f"생성 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*60 + "\n\n")
            for ticker in sorted(failed_tickers):
                f.write(f"{ticker}\n")
        
        print(f"\n[INFO] 실패한 티커 목록이 저장되었습니다: {failed_log_path}")
        print(f"[INFO] 실패 원인: Yahoo Finance API는 모든 ETF의 holdings를 제공하지 않습니다.")
        print(f"[INFO] 샘플: {', '.join(failed_tickers[:10])}")


if __name__ == '__main__':
    import sys
    
    # 스크립트 디렉토리의 상위 디렉토리로 이동 (프로젝트 루트)
    script_dir = Path(__file__).parent.parent
    os.chdir(script_dir)
    
    print("=" * 60)
    print("ETF Holdings 데이터 수집 스크립트")
    print("=" * 60)
    
    # --force 플래그 확인
    force_update = '--force' in sys.argv or '-f' in sys.argv
    if force_update:
        print("[INFO] 강제 업데이트 모드: 기존 holdings 데이터를 덮어씁니다")
        sys.argv = [arg for arg in sys.argv if arg not in ['--force', '-f']]
    
    if len(sys.argv) > 1:
        # 특정 티커 처리
        ticker = sys.argv[1].upper()
        process_single_ticker(ticker, force_update=force_update)
    else:
        # 모든 티커 처리
        print("\n모든 ETF의 holdings 데이터를 수집합니다...")
        print("특정 티커만 처리하려면: python fetch_holdings.py TICKER")
        print("강제 업데이트하려면: python fetch_holdings.py TICKER --force")
        print()
        
        response = input("계속하시겠습니까? (y/n): ")
        if response.lower() == 'y':
            process_all_tickers()
        else:
            print("취소되었습니다.")

