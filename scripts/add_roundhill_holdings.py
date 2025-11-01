"""
Roundhill ETF Holdings 수동 등록 스크립트

Roundhill 웹사이트에서 복사한 Holdings 데이터를 JSON에 등록합니다.

사용법:
  1. 단일 ETF - 클립보드에서 읽기 (추천)
     python scripts/add_roundhill_holdings.py AAPW "2/19/25"
     
     준비: Roundhill 웹사이트에서 Holdings 테이블 복사 (Ctrl+C)
     https://www.roundhillinvestments.com/etf/aapw/
  
  2. 단일 ETF - 파일에서 읽기
     python scripts/add_roundhill_holdings.py AAPW "2/19/25" holdings.txt
  
  3. 단일 ETF - 직접 입력
     python scripts/add_roundhill_holdings.py AAPW "2/19/25" --stdin

  4. 전체 파일 일괄 처리 (추천!)
     python scripts/add_roundhill_holdings.py --batch roundhill_251101.txt
     
     파일 형식:
       TICKER1
       as of 날짜
       [Holdings 테이블 데이터]
       --------------------------
       TICKER2
       as of 날짜
       [Holdings 테이블 데이터]
       --------------------------

Roundhill ETF 목록:
  - WeeklyPay™: AAPW, NFLW, TSLW, NVDW, MSFW, GOOW, AMZW, METW, 등
  - Income: XDTE, QDTE, RDTE, XPAY, YBTC, YETH, MAGY
  - Thematic: METV, MAGS, CHAT, BETZ, NERD, OZEM, WEED
  - 총 41개 Roundhill ETF
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import re


def parse_date(date_str):
    """
    다양한 날짜 형식을 YYYY-MM-DD로 변환
    
    예시:
      2/19/25 -> 2025-02-19
      02/19/2025 -> 2025-02-19
      2025-02-19 -> 2025-02-19
    """
    date_str = date_str.strip()
    
    # 이미 YYYY-MM-DD 형식
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    
    # M/D/YY 또는 MM/DD/YYYY 형식
    parts = date_str.split('/')
    if len(parts) == 3:
        month, day, year = parts
        
        # 2자리 년도를 4자리로 변환
        if len(year) == 2:
            year = f"20{year}"
        
        # 월/일을 2자리로 패딩
        month = month.zfill(2)
        day = day.zfill(2)
        
        return f"{year}-{month}-{day}"
    
    raise ValueError(f"날짜 형식을 인식할 수 없습니다: {date_str}")


def classify_asset(security_name, identifier):
    """
    자산 타입 자동 분류
    
    Args:
        security_name: 자산 이름
        identifier: CUSIP 또는 식별자
        
    Returns:
        자산 타입 문자열
    """
    name_upper = security_name.upper()
    id_upper = identifier.upper()
    
    # 스왑 계약
    if 'SWAP' in name_upper or 'TRS' in name_upper or 'TRS' in id_upper:
        return 'swap'
    
    # 옵션 계약
    if (re.search(r'\d{6}[CP]\d{8}', id_upper) or
        re.search(r' C\d+', name_upper) or re.search(r' P\d+', name_upper) or
        'CALL' in name_upper or 'PUT' in name_upper):
        return 'option'
    
    # 국채
    if 'TREASURY' in name_upper or 'T-BILL' in name_upper or 'T-NOTE' in name_upper:
        if 'NOTE' in name_upper or 'BOND' in name_upper:
            return 'treasury_note'
        elif 'BILL' in name_upper:
            return 'treasury_bill'
        return 'treasury'
    
    # 현금 및 기타
    if 'CASH' in name_upper or id_upper == 'CASH&OTHER':
        return 'cash'
    
    # 머니마켓 펀드
    if 'GOVERNMENT OBLIGATIONS' in name_upper or 'MONEY MARKET' in name_upper:
        return 'money_market'
    
    # 주식 (CUSIP이 9자리 숫자+문자)
    if re.match(r'^[0-9]{9}$', id_upper) or len(id_upper) == 9:
        return 'equity'
    
    return 'other'


def parse_holdings_data(data_text):
    """
    TSV 형식의 holdings 데이터를 파싱
    
    입력 예시:
    Ticker\tName\tIdentifier\tETF Weight\tShares\tMarket Value
    037833100 TRS 031926 NM\tAPPLE INC WEEKLYPAY SWAP NM\t037833100 TRS 031926 NM\t100.17%\t195,925\t$52,972,242
    """
    lines = [line.strip() for line in data_text.strip().split('\n') if line.strip()]
    
    if len(lines) < 2:
        raise ValueError("데이터가 너무 적습니다. 최소 헤더 + 1개 행이 필요합니다.")
    
    # 첫 줄이 헤더인지 확인
    first_line = lines[0].lower()
    has_header = any(keyword in first_line for keyword in ['ticker', 'name', 'weight', 'identifier'])
    
    data_lines = lines[1:] if has_header else lines
    
    holdings = []
    
    for line in data_lines:
        # 탭으로 분리 (또는 여러 공백)
        parts = re.split(r'\t+', line)
        
        # 형식 1: Ticker, Name, Identifier, ETF Weight, Shares, Market Value (6컬럼)
        # 형식 2: Name, Weight (2컬럼)
        
        if len(parts) < 2:
            continue  # 최소 2컬럼 필요
        
        try:
            # 형식 감지
            if len(parts) == 2:
                # 형식 2: Name, Weight (Ticker 없음 - MAGS, WEED, MAGC 등)
                name = parts[0].strip()
                weight_text = parts[1].strip()
                ticker = None  # Ticker는 Name에서 추출 시도
                identifier = None
                shares_text = None
                market_value_text = None
            else:
                # 형식 1: Ticker, Name, Identifier, ETF Weight, Shares, Market Value
                ticker = parts[0].strip()           # Ticker 컬럼 (AAPL 등)
                name = parts[1].strip()             # Name 컬럼
                identifier = parts[2].strip() if len(parts) > 2 else ticker
                weight_text = parts[3].strip() if len(parts) > 3 else "0%"
                shares_text = parts[4].strip() if len(parts) > 4 else None
                market_value_text = parts[5].strip() if len(parts) > 5 else None
            
            # Weight 파싱 (100.17% -> 100.17)
            weight_match = re.search(r'([\d.]+)%?', weight_text.replace(',', ''))
            if not weight_match:
                print(f"[SKIP] Weight 파싱 실패: {line}")
                continue
            
            weight = float(weight_match.group(1))
            
            # Shares 파싱 (195,925 -> 195925)
            shares = None
            if shares_text:
                shares_clean = shares_text.replace(',', '').replace('$', '').strip()
                try:
                    shares = int(float(shares_clean))
                except ValueError:
                    pass  # Shares가 숫자가 아니면 무시
            
            # Market Value 파싱 ($52,972,242 -> 52972242)
            market_value = None
            if market_value_text:
                market_value_clean = market_value_text.replace(',', '').replace('$', '').strip()
                try:
                    market_value = float(market_value_clean)
                except ValueError:
                    pass  # Market Value가 숫자가 아니면 무시
            
            # Ticker가 없는 경우 (형식 2) Name을 symbol로 사용
            if not ticker:
                # Name에서 티커 추출 시도 (예: "NVIDIA" -> "NVDA")
                # 또는 Name을 그대로 symbol로 사용
                ticker = name
                identifier = name
            
            # 자산 타입 분류 (Name과 Identifier 둘 다 사용)
            asset_type = classify_asset(name, identifier or ticker)
            
            # 기초 자산 추출 (스왑의 경우)
            underlying = None
            if asset_type == 'swap':
                # "APPLE INC WEEKLYPAY SWAP" -> "AAPL"
                underlying_match = re.search(r'^([A-Z]+)\s+INC', name.upper())
                if underlying_match:
                    underlying = underlying_match.group(1)[:4]  # 최대 4자리
            
            # symbol은 Ticker 사용 (AAPL, FGXXX 등)
            holding = {
                'symbol': ticker,  # Ticker 컬럼 또는 Name
                'name': name,
                'weight': round(weight, 2),
                'type': asset_type
            }
            
            # 선택적 필드 추가
            if shares is not None:
                holding['shares'] = shares
            
            if market_value is not None:
                holding['market_value'] = market_value
            
            if underlying:
                holding['underlying'] = underlying
            
            holdings.append(holding)
            
        except Exception as e:
            print(f"[ERROR] 행 파싱 실패: {line}")
            print(f"  오류: {e}")
            continue
    
    return holdings


def update_json_file(ticker, date, holdings):
    """
    JSON 파일에 holdings 데이터 추가
    
    Args:
        ticker: 티커 심볼
        date: 날짜 (YYYY-MM-DD)
        holdings: holdings 리스트
    """
    from fetch_holdings import sanitize_ticker_for_filename
    
    # 파일 경로
    sanitized = sanitize_ticker_for_filename(ticker)
    json_path = Path('public/data') / f"{sanitized}.json"
    
    if not json_path.exists():
        print(f"[ERROR] JSON 파일이 존재하지 않습니다: {json_path}")
        return False
    
    # JSON 읽기
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # backtestData 확인
    if 'backtestData' not in data:
        data['backtestData'] = []
    
    # 날짜순 정렬
    data['backtestData'].sort(key=lambda x: x.get('date', ''))
    
    # 해당 날짜의 항목 찾기
    existing_entry = None
    for entry in data['backtestData']:
        if entry.get('date') == date:
            existing_entry = entry
            break
    
    # 100% 이상인 경우 분리
    leverage_holdings = [h for h in holdings if h['type'] in ['swap']]
    regular_holdings = [h for h in holdings if h['type'] not in ['swap']]
    
    if existing_entry:
        # 기존 항목 업데이트
        if regular_holdings:
            existing_entry['holdings'] = regular_holdings
        if leverage_holdings:
            existing_entry['leverage_exposure'] = leverage_holdings
        
        action = "UPDATE"
    else:
        # 새 항목 생성
        new_entry = {
            'date': date
        }
        
        if regular_holdings:
            new_entry['holdings'] = regular_holdings
        if leverage_holdings:
            new_entry['leverage_exposure'] = leverage_holdings
        
        data['backtestData'].append(new_entry)
        data['backtestData'].sort(key=lambda x: x.get('date', ''))
        
        action = "ADD"
    
    # JSON 저장
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"\n[{action}] {ticker}: {date}에 holdings 데이터 등록 완료")
    print(f"  - 일반 holdings: {len(regular_holdings)}개")
    if leverage_holdings:
        print(f"  - 레버리지 익스포저: {len(leverage_holdings)}개")
    print(f"  - 총 익스포저: {sum(h['weight'] for h in holdings):.2f}%")
    
    return True


def parse_batch_file(file_path):
    """
    전체 Roundhill holdings 파일을 파싱하여 ETF별로 분리
    
    파일 형식:
      TICKER1
      as of 날짜
      [Holdings 데이터]
      --------------------------
      TICKER2
      as of 날짜
      [Holdings 데이터]
      --------------------------
    
    Args:
        file_path: 배치 파일 경로
        
    Returns:
        [(ticker, date, data_text), ...] 리스트
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # -------------------------- 로 분리
    sections = content.split('--------------------------')
    
    etf_data_list = []
    
    for section in sections:
        section = section.strip()
        if not section:
            continue
        
        lines = section.split('\n')
        
        # 티커 찾기 (첫 줄)
        ticker = None
        date_str = None
        data_start_idx = 0
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            
            # 티커 (단독 라인, 대문자 4자 정도)
            if not ticker and line_stripped and re.match(r'^[A-Z]{2,6}$', line_stripped):
                ticker = line_stripped
                continue
            
            # 날짜 (as of ...)
            if not date_str:
                date_match = re.search(r'as of\s+(.+)', line, re.IGNORECASE)
                if date_match:
                    date_str = date_match.group(1).strip()
                    data_start_idx = i + 1
                    continue
        
        if ticker and date_str:
            # 나머지 데이터 추출
            data_lines = lines[data_start_idx:]
            data_text = '\n'.join(data_lines)
            
            if data_text.strip():
                etf_data_list.append((ticker, date_str, data_text))
                print(f"[PARSE] {ticker}: {date_str}")
    
    return etf_data_list


def process_batch_file(file_path):
    """
    배치 파일의 모든 ETF holdings를 일괄 처리
    
    Args:
        file_path: 배치 파일 경로
    """
    print("="*80)
    print("Roundhill ETF Holdings 일괄 등록")
    print("="*80)
    print(f"\n파일: {file_path}\n")
    
    # 파일 파싱
    etf_data_list = parse_batch_file(file_path)
    
    if not etf_data_list:
        print("[ERROR] 파싱된 ETF 데이터가 없습니다.")
        return
    
    print(f"\n총 {len(etf_data_list)}개 ETF 발견\n")
    
    # 프로젝트 루트로 이동
    script_dir = Path(__file__).parent.parent
    import os
    os.chdir(script_dir)
    
    success_count = 0
    fail_count = 0
    
    for ticker, date_str, data_text in etf_data_list:
        print(f"\n{'='*60}")
        print(f"처리 중: {ticker}")
        print(f"{'='*60}")
        
        try:
            # 날짜 파싱
            date = parse_date(date_str)
            print(f"날짜: {date_str} -> {date}")
            
            # Holdings 데이터 파싱
            holdings = parse_holdings_data(data_text)
            
            if not holdings:
                print(f"[SKIP] {ticker}: 파싱된 holdings가 없습니다.")
                fail_count += 1
                continue
            
            print(f"파싱 완료: {len(holdings)}개 holdings")
            
            # JSON 업데이트
            success = update_json_file(ticker, date, holdings)
            
            if success:
                success_count += 1
                print(f"✅ {ticker} 완료")
            else:
                fail_count += 1
                print(f"❌ {ticker} 실패")
        
        except Exception as e:
            print(f"[ERROR] {ticker} 처리 실패: {e}")
            fail_count += 1
            continue
    
    # 최종 요약
    print("\n" + "="*80)
    print("일괄 처리 완료")
    print("="*80)
    print(f"성공: {success_count}개")
    print(f"실패: {fail_count}개")
    print(f"총합: {len(etf_data_list)}개")


def main():
    """메인 실행 함수"""
    # --batch 모드 확인
    if len(sys.argv) >= 3 and sys.argv[1] == '--batch':
        batch_file = sys.argv[2]
        if not Path(batch_file).exists():
            print(f"[ERROR] 파일이 존재하지 않습니다: {batch_file}")
            sys.exit(1)
        
        process_batch_file(batch_file)
        return
    
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    ticker = sys.argv[1].upper()
    date_str = sys.argv[2]
    
    # 날짜 파싱
    try:
        date = parse_date(date_str)
        print(f"날짜: {date_str} -> {date}")
    except ValueError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    
    # 데이터 읽기
    if len(sys.argv) > 3 and sys.argv[3] != '--stdin':
        # 파일에서 읽기
        file_path = Path(sys.argv[3])
        if not file_path.exists():
            print(f"[ERROR] 파일이 존재하지 않습니다: {file_path}")
            sys.exit(1)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data_text = f.read()
        
        print(f"파일에서 읽기: {file_path}")
    
    elif len(sys.argv) > 3 and sys.argv[3] == '--stdin':
        # 표준 입력에서 읽기
        print("데이터를 입력하세요 (Ctrl+Z then Enter to finish on Windows, Ctrl+D on Unix):")
        data_text = sys.stdin.read()
    
    else:
        # 클립보드에서 읽기 시도
        try:
            import pyperclip
            data_text = pyperclip.paste()
            print("클립보드에서 읽기")
        except ImportError:
            print("[ERROR] pyperclip 모듈이 설치되어 있지 않습니다.")
            print("설치: pip install pyperclip")
            print("\n또는 파일을 사용하세요:")
            print(f"  python {sys.argv[0]} {ticker} {date_str} holdings.txt")
            sys.exit(1)
    
    if not data_text.strip():
        print("[ERROR] 데이터가 비어있습니다.")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"Roundhill ETF Holdings 등록: {ticker}")
    print(f"{'='*60}\n")
    
    # 데이터 파싱
    try:
        holdings = parse_holdings_data(data_text)
        
        if not holdings:
            print("[ERROR] 파싱된 holdings가 없습니다.")
            sys.exit(1)
        
        print(f"파싱 완료: {len(holdings)}개 holdings\n")
        
        # 파싱 결과 출력
        print("파싱된 데이터:")
        print("-" * 100)
        print(f"{'No':<4} {'Name':<40} {'Symbol':<10} {'Weight':>8} {'Shares':>12} {'Market Value':>15} {'Type':<12}")
        print("-" * 100)
        for i, h in enumerate(holdings, 1):
            name_short = h['name'][:38] + '..' if len(h['name']) > 40 else h['name']
            shares_str = f"{h.get('shares', 0):,}" if 'shares' in h else '-'
            mv_str = f"${h.get('market_value', 0):,.0f}" if 'market_value' in h else '-'
            print(f"{i:<4} {name_short:<40} {h['symbol']:<10} {h['weight']:7.2f}% {shares_str:>12} {mv_str:>15} {h['type']:<12}")
        print("-" * 100)
        
        # 확인
        total_weight = sum(h['weight'] for h in holdings)
        total_shares = sum(h.get('shares', 0) for h in holdings)
        total_market_value = sum(h.get('market_value', 0) for h in holdings)
        
        print(f"\n총 익스포저: {total_weight:.2f}%")
        if total_shares > 0:
            print(f"총 Shares: {total_shares:,}")
        if total_market_value > 0:
            print(f"총 Market Value: ${total_market_value:,.2f}")
        
        # JSON 업데이트
        print("\nJSON 파일 업데이트 중...")
        
        # 프로젝트 루트로 이동
        script_dir = Path(__file__).parent.parent
        import os
        os.chdir(script_dir)
        
        success = update_json_file(ticker, date, holdings)
        
        if success:
            print(f"\n✅ 성공! {ticker} 데이터가 등록되었습니다.")
        else:
            print(f"\n❌ 실패")
            sys.exit(1)
    
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

