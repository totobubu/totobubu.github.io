"""
public/nav/**/*.json 파일의 각 티커에 holdings 여부를 자동 판단하여 추가하는 일회성 스크립트

판단 기준:
1. ETF 운용사(company)가 있는 경우 holdings 후보
2. 실제 Yahoo Finance API로 holdings 데이터 존재 여부 확인
3. 확인된 경우만 holdings: true 추가
"""

import json
import yfinance as yf
from pathlib import Path
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# ETF 운용사 목록 (holdings를 제공할 가능성이 높은 회사들)
ETF_COMPANIES = {
    'Vanguard', 'BlackRock', 'iShares', 'State Street', 'SPDR', 
    'Invesco', 'Schwab', 'ProShares', 'Direxion', 'First Trust',
    'VanEck', 'WisdomTree', 'Global X', 'ARK', 'PIMCO',
    'JPMorgan', 'Goldman Sachs', 'Fidelity', 'T. Rowe Price',
    'Roundhill', 'YieldMax', 'Defiance', 'Simplify', 'Pacer',
    'Alpha Architect', 'AXS', 'ALPS', 'AdvisorShares',
    'Franklin Templeton', 'Northern Trust', 'Columbia', 'BNY Mellon',
    '삼성자산운용', '미래에셋자산운용', '한국투자신탁운용', 'KB자산운용',
    'NH-Amundi자산운용', '신한자산운용', 'KODEX', 'TIGER', 'KINDEX',
}


def check_holdings_available(ticker_symbol, timeout=5):
    """
    Yahoo Finance에서 실제로 holdings 데이터를 가져올 수 있는지 확인
    
    Returns:
        bool: holdings 데이터 사용 가능 여부
    """
    try:
        ticker = yf.Ticker(ticker_symbol)
        funds_data = ticker.get_funds_data()
        
        if hasattr(funds_data, 'top_holdings'):
            top_holdings = funds_data.top_holdings
            
            # DataFrame이고 비어있지 않으면 True
            if hasattr(top_holdings, 'to_dict') and not top_holdings.empty:
                return True
        
        return False
        
    except Exception as e:
        return False


def should_check_holdings(item, force_recheck=False):
    """
    티커가 holdings 확인이 필요한지 판단
    
    Args:
        item: 티커 정보
        force_recheck: True면 이미 holdings 필드가 있어도 다시 확인
        
    Returns:
        bool: 확인 필요 여부
    """
    # force_recheck가 아니면 이미 holdings 필드가 있으면 건너뛰기
    if not force_recheck and 'holdings' in item:
        return False
    
    # company 필드가 ETF 운용사 목록에 있으면 확인 필요
    company = item.get('company', '')
    if any(etf_company in company for etf_company in ETF_COMPANIES):
        return True
    
    # 한국 ETF는 koName에 특정 키워드가 있으면 확인
    ko_name = item.get('koName', '')
    if any(keyword in ko_name for keyword in ['KODEX', 'TIGER', 'KINDEX', 'PLUS', 'SOL', 'HANARO']):
        return True
    
    return False


def process_single_ticker(item, check_api=True):
    """
    단일 티커 처리
    
    Args:
        item: 티커 정보 dict
        check_api: API로 실제 확인할지 여부
        
    Returns:
        tuple: (원본 item, holdings 여부, 변경 여부)
    """
    symbol = item.get('symbol', '')
    
    # 이미 holdings 필드가 있으면 건너뛰기
    if 'holdings' in item:
        return (item, item['holdings'], False)
    
    # holdings 확인이 필요한지 판단
    if not should_check_holdings(item):
        return (item, False, False)
    
    # API로 실제 확인
    if check_api:
        print(f"  [CHECK] {symbol}: holdings 확인 중...", end=' ')
        has_holdings = check_holdings_available(symbol)
        
        if has_holdings:
            item['holdings'] = True
            print(f"✓ (holdings 추가)")
            return (item, True, True)
        else:
            print(f"✗ (holdings 없음)")
            return (item, False, False)
    else:
        # API 확인 없이 조건만으로 판단 (빠른 모드)
        item['holdings'] = True
        return (item, True, True)


def process_nav_file(file_path, check_api=True, max_workers=3, force_recheck=False):
    """
    단일 nav JSON 파일 처리
    
    Args:
        file_path: JSON 파일 경로
        check_api: API로 실제 확인할지 여부
        max_workers: 병렬 처리 워커 수
        force_recheck: True면 기존 holdings 필드 무시하고 재확인
        
    Returns:
        tuple: (처리 수, 추가 수, 제거 수)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print(f"[SKIP] {file_path}: 배열 형식이 아님")
            return (0, 0, 0)
        
        print(f"\n[FILE] {file_path.relative_to(Path('public/nav'))}")
        print(f"  티커 수: {len(data)}")
        
        check_needed = sum(1 for item in data if should_check_holdings(item, force_recheck))
        print(f"  확인 필요: {check_needed}개")
        
        if check_needed == 0:
            return (0, 0, 0)
        
        modified_count = 0
        added_count = 0
        removed_count = 0
        
        # check_api가 False일 때도 처리해야 함
        if check_needed > 0 and check_api:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # holdings 확인이 필요한 티커만 처리
                futures = {
                    executor.submit(process_single_ticker, item, check_api): i
                    for i, item in enumerate(data)
                    if should_check_holdings(item, force_recheck)
                }
                
                for future in as_completed(futures):
                    idx = futures[future]
                    item, has_holdings, changed = future.result()
                    
                    if changed:
                        data[idx] = item
                        modified_count += 1
                        if has_holdings:
                            added_count += 1
                        else:
                            # holdings가 false인 경우 제거
                            if 'holdings' in item and not item['holdings']:
                                del item['holdings']
                                removed_count += 1
                    
                    # API 요청 제한을 위한 대기
                    if check_api:
                        time.sleep(0.5)
        elif check_needed > 0 and not check_api:
            # 빠른 모드: API 호출 없이 처리
            for i, item in enumerate(data):
                if should_check_holdings(item, force_recheck):
                    item, has_holdings, changed = process_single_ticker(item, check_api=False)
                    if changed:
                        data[i] = item
                        modified_count += 1
                        if has_holdings:
                            added_count += 1
                            print(f"  [ADD] {item.get('symbol')}: holdings = true")
        
        # 변경사항이 있으면 저장
        if modified_count > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            print(f"  [SAVE] {modified_count}개 티커 업데이트 (추가: {added_count}개, 제거: {removed_count}개)")
        
        return (modified_count, added_count, removed_count)
        
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return (0, 0, 0)


def process_all_nav_files(check_api=True, market_filter=None, exclude_korea=False, force_recheck=False):
    """
    모든 nav JSON 파일 처리
    
    Args:
        check_api: API로 실제 확인할지 여부 (False면 조건만으로 판단)
        market_filter: 특정 시장만 처리 (예: 'NYSE', 'NASDAQ')
        exclude_korea: 한국 시장 제외 여부
        force_recheck: 기존 holdings 필드 무시하고 재확인
    """
    nav_dir = Path('public/nav')
    
    if not nav_dir.exists():
        print(f"[ERROR] {nav_dir} 디렉토리가 없습니다.")
        return
    
    # 모든 JSON 파일 찾기
    json_files = list(nav_dir.rglob('*.json'))
    
    # 한국 시장 제외
    if exclude_korea:
        json_files = [f for f in json_files if 'KOSPI' not in str(f) and 'KOSDAQ' not in str(f)]
        print(f"[INFO] 한국 시장(KOSPI, KOSDAQ) 제외")
    
    # 시장 필터링
    if market_filter:
        json_files = [f for f in json_files if market_filter in str(f)]
    
    print(f"[INFO] {len(json_files)}개 파일 발견")
    
    if check_api:
        print(f"[INFO] API 확인 모드 (느림, 정확함)")
    else:
        print(f"[INFO] 빠른 모드 (빠름, ETF 운용사 기준)")
    
    total_modified = 0
    total_added = 0
    total_removed = 0
    
    for file_path in sorted(json_files):
        modified, added, removed = process_nav_file(file_path, check_api=check_api, force_recheck=force_recheck)
        total_modified += modified
        total_added += added
        total_removed += removed
    
    print(f"\n{'='*60}")
    print(f"전체 처리 완료")
    print(f"{'='*60}")
    print(f"[OK] 업데이트: {total_modified}개 티커")
    print(f"[OK] holdings 추가: {total_added}개 티커")
    print(f"[OK] holdings 제거: {total_removed}개 티커")


if __name__ == '__main__':
    import sys
    import os
    
    # 프로젝트 루트로 이동
    script_dir = Path(__file__).parent.parent
    os.chdir(script_dir)
    
    print("=" * 60)
    print("Holdings 자동 감지 및 추가 스크립트")
    print("=" * 60)
    print("\n사용법:")
    print("  python auto_detect_holdings.py [옵션]")
    print("\n옵션:")
    print("  --fast          : 빠른 모드 (API 확인 없이 ETF 운용사만 확인)")
    print("  --api           : API 확인 모드 (실제 holdings 여부 확인, 느림)")
    print("  --recheck       : 기존 holdings 필드 무시하고 재확인")
    print("  --market NYSE   : 특정 시장만 처리")
    print("  --exclude-kr    : 한국 시장(KOSPI, KOSDAQ) 제외")
    print("  --yes           : 자동 확인 (입력 대기 없음)")
    print()
    
    check_api = '--api' in sys.argv
    fast_mode = '--fast' in sys.argv
    auto_yes = '--yes' in sys.argv
    exclude_korea = '--exclude-kr' in sys.argv
    force_recheck = '--recheck' in sys.argv
    
    market_filter = None
    if '--market' in sys.argv:
        idx = sys.argv.index('--market')
        if idx + 1 < len(sys.argv):
            market_filter = sys.argv[idx + 1]
    
    if not check_api and not fast_mode:
        print("모드를 선택하세요:")
        print("  1. 빠른 모드 (ETF 운용사 기준, API 호출 없음)")
        print("  2. API 확인 모드 (실제 holdings 여부 확인, 매우 느림)")
        choice = input("\n선택 (1/2): ")
        
        if choice == '1':
            check_api = False
        elif choice == '2':
            check_api = True
        else:
            print("취소되었습니다.")
            sys.exit(0)
    else:
        check_api = check_api or not fast_mode
    
    if not auto_yes:
        print(f"\n시작하시겠습니까?")
        if check_api:
            print("⚠️  API 확인 모드는 시간이 오래 걸립니다 (수십 분 ~ 몇 시간)")
        
        response = input("계속하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            print("취소되었습니다.")
            sys.exit(0)
    
    print("\n[시작] Holdings 자동 감지 및 추가")
    if force_recheck:
        print("[INFO] 재확인 모드: 기존 holdings 필드를 무시하고 다시 확인합니다")
    process_all_nav_files(check_api=check_api, market_filter=market_filter, exclude_korea=exclude_korea, force_recheck=force_recheck)

