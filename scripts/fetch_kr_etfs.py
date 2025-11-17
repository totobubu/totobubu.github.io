import os
import sys
import json
import FinanceDataReader as fdr
from tqdm import tqdm
from utils import load_json_file, save_json_file

# Windows 콘솔 한글 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python 3.7 이전 버전
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

# 한국 ETF 티커 목록 (심볼만 입력)
PREDEFINED_ETF_TEXT = """
TIGER미국S&P500
KODEX200
TIGER차이나전기차SOLACTIVE
ACE미국빅테크TOP7

"""


def parse_predefined_list():
    """입력된 ETF 이름/코드 목록 파싱"""
    etfs = []
    lines = PREDEFINED_ETF_TEXT.strip().split("\n")
    for line in lines:
        line = line.strip()
        if line:
            etfs.append(line)
    return etfs


def search_kr_etfs(search_queries):
    """
    FinanceDataReader로 한국 ETF 검색
    
    Args:
        search_queries: 검색할 ETF 이름 또는 코드 목록
    
    Returns:
        list: 찾은 ETF 정보 [{symbol, name, code, market}]
    """
    print("FinanceDataReader로 한국 ETF 정보 가져오는 중...")
    
    # KOSPI ETF 목록
    try:
        kospi_etf = fdr.StockListing("ETF/KR")
        print(f"  -> 총 {len(kospi_etf)}개 한국 ETF 발견")
    except Exception as e:
        print(f"[ERROR] ETF 목록 조회 실패: {e}")
        return []
    
    found_etfs = []
    not_found = []
    
    print("\nETF 검색 중...")
    for query in tqdm(search_queries, desc="Searching"):
        query_upper = query.upper()
        
        # 1. 코드로 정확히 일치하는 것 찾기
        exact_match = kospi_etf[kospi_etf['Code'] == query]
        if not exact_match.empty:
            row = exact_match.iloc[0]
            found_etfs.append({
                'code': row['Code'],
                'name': row['Name'],
                'market': 'KOSPI' if row['Code'][0] in ['1', '2', '3'] else 'KOSDAQ'
            })
            continue
        
        # 2. 이름으로 검색 (부분 일치)
        name_match = kospi_etf[kospi_etf['Name'].str.contains(query, case=False, na=False)]
        if not name_match.empty:
            if len(name_match) == 1:
                # 하나만 찾으면 자동 선택
                row = name_match.iloc[0]
                found_etfs.append({
                    'code': row['Code'],
                    'name': row['Name'],
                    'market': 'KOSPI' if row['Code'][0] in ['1', '2', '3'] else 'KOSDAQ'
                })
            else:
                # 여러 개 찾으면 첫 번째 선택 (가장 관련도 높음)
                print(f"\n  ⚠️ '{query}': {len(name_match)}개 발견, 첫 번째 선택")
                for idx, row in name_match.head(5).iterrows():
                    print(f"      - {row['Code']}: {row['Name']}")
                
                row = name_match.iloc[0]
                found_etfs.append({
                    'code': row['Code'],
                    'name': row['Name'],
                    'market': 'KOSPI' if row['Code'][0] in ['1', '2', '3'] else 'KOSDAQ'
                })
            continue
        
        # 3. 못 찾음
        not_found.append(query)
    
    # 결과 출력
    print(f"\n✅ 찾은 ETF: {len(found_etfs)}개")
    for etf in found_etfs:
        print(f"   - {etf['code']}: {etf['name']} ({etf['market']})")
    
    if not_found:
        print(f"\n❌ 못 찾은 ETF: {len(not_found)}개")
        for query in not_found:
            print(f"   - {query}")
    
    return found_etfs


def save_new_etfs_to_nav(new_etf_list):
    """새로운 ETF를 nav 파일에 추가"""
    if not new_etf_list:
        print("  -> 추가할 ETF가 없습니다.")
        return
    
    print(f"\n{len(new_etf_list)}개 ETF를 nav 파일에 추가 중...")
    files_to_update = {}
    total_added_count = 0
    market_counts = {"KOSPI": 0, "KOSDAQ": 0}
    
    for etf in tqdm(new_etf_list, desc="Processing"):
        code = etf['code']
        name = etf['name']
        market = etf['market']
        
        # KOSPI는 .KS, KOSDAQ는 .KQ 접미사
        suffix = '.KS' if market == 'KOSPI' else '.KQ'
        symbol = f"{code}{suffix}"
        
        # 파일 경로 결정
        first_char = code[0].lower()
        if not ("a" <= first_char <= "z" or "0" <= first_char <= "9"):
            first_char = "etc"
        
        file_path = os.path.join(NAV_DIR, market, f"{first_char}.json")
        
        # 파일 읽기 또는 초기화
        if file_path not in files_to_update:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    files_to_update[file_path] = {
                        ticker["symbol"]: ticker for ticker in json.load(f)
                    }
            except (FileNotFoundError, json.JSONDecodeError):
                files_to_update[file_path] = {}
        
        # symbol에서 접미사 분리
        base_symbol = code  # 접미사 없는 base symbol
        yf_symbol = symbol  # 접미사 포함된 symbol을 yfSymbol로 사용
        
        # base_symbol으로 중복 체크
        if base_symbol not in files_to_update[file_path]:
            new_ticker_info = {
                "symbol": base_symbol,
                "yfSymbol": yf_symbol,
                "market": market,
                "currency": "KRW",
                "koName": name,
                "longName": name,
                "sharesOutstanding": None  # 추후 검토 필요 (FinanceDataReader 미제공)
            }
            
            files_to_update[file_path][base_symbol] = new_ticker_info
            total_added_count += 1
            market_counts[market] += 1
    
    if total_added_count == 0:
        print("  -> 모든 ETF가 이미 존재합니다.")
        return
    
    # 파일 저장
    print(f"\n📁 업데이트할 파일:")
    for file_path, tickers_dict in files_to_update.items():
        sorted_tickers = sorted(tickers_dict.values(), key=lambda x: x["symbol"])
        save_json_file(file_path, sorted_tickers)
        rel_path = os.path.relpath(file_path, ROOT_DIR)
        added_count = sum(1 for t in sorted_tickers if t["symbol"] in [f"{e['code']}.{'KS' if e['market']=='KOSPI' else 'KQ'}" for e in new_etf_list])
        print(f"  ✓ {rel_path} (+{added_count} ETFs)")
    
    print(f"\n📊 시장별 분포:")
    print(f"  - KOSPI: {market_counts['KOSPI']}개 ETF")
    print(f"  - KOSDAQ: {market_counts['KOSDAQ']}개 ETF")


def main():
    print("\n" + "="*70)
    print("  한국 ETF 자동 추가 스크립트")
    print("="*70)
    
    # 기존 심볼 목록 가져오기
    existing_symbols = {
        t["symbol"]
        for m in os.listdir(NAV_DIR)
        if os.path.isdir(os.path.join(NAV_DIR, m))
        for f in os.listdir(os.path.join(NAV_DIR, m))
        if f.endswith(".json")
        if (d := load_json_file(os.path.join(NAV_DIR, m, f)))
        for t in d
    }
    print(f"기존 심볼: {len(existing_symbols)}개")
    
    # 1. 사전 정의된 목록 파싱
    search_queries = parse_predefined_list()
    print(f"검색할 ETF: {len(search_queries)}개")
    
    if not search_queries:
        print("\n⚠️ PREDEFINED_ETF_TEXT에 ETF 이름을 입력하세요.")
        print("예시:")
        print('"""')
        print("TIGER미국S&P500")
        print("KODEX200")
        print("ARIRANG고배당주")
        print('"""')
        return
    
    # 2. ETF 검색
    found_etfs = search_kr_etfs(search_queries)
    
    if not found_etfs:
        print("\n❌ 찾은 ETF가 없습니다.")
        return
    
    # 3. 새로운 ETF만 필터링
    new_etfs = []
    for etf in found_etfs:
        suffix = '.KS' if etf['market'] == 'KOSPI' else '.KQ'
        symbol = f"{etf['code']}{suffix}"
        if symbol not in existing_symbols:
            new_etfs.append(etf)
    
    print(f"\n새로운 ETF: {len(new_etfs)}개")
    
    # 4. nav 파일에 추가
    if new_etfs:
        save_new_etfs_to_nav(new_etfs)
    else:
        print("  -> 모든 ETF가 이미 존재합니다.")
    
    print("\n" + "="*70)
    print("🎉 완료!")
    print("="*70)
    print("다음 명령어를 실행하여 변경사항을 적용하세요:")
    print("  npm run generate-nav")


if __name__ == "__main__":
    main()

