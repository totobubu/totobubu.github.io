import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta

def parse_numeric_value(value_str):
    """'$1,234.56%' 같은 문자열에서 숫자만 추출합니다."""
    if not isinstance(value_str, str):
        return None
    try:
        # 모든 비숫자 문자(소수점 제외)를 제거
        cleaned_str = ''.join(filter(lambda x: x.isdigit() or x == '.', value_str))
        return float(cleaned_str)
    except (ValueError, TypeError):
        return None

def compare_and_add_change(new_info, old_info):
    """이전 정보와 새 정보를 비교하여 'change'와 'previousValue'를 추가합니다."""
    info_with_change = new_info.copy()
    if not old_info:
        return info_with_change
    
    for key, new_value in new_info.items():
        old_value = old_info.get(key)
        
        # 숫자 값만 비교 대상으로 삼음
        new_numeric = parse_numeric_value(new_value)
        old_numeric = parse_numeric_value(old_value)

        if new_numeric is not None and old_numeric is not None:
            change_info = {"previousValue": old_value}
            if new_numeric > old_numeric:
                change_info["change"] = "up"
            elif new_numeric < old_numeric:
                change_info["change"] = "down"
            else:
                change_info["change"] = "equal"
            
            # 원래 키 옆에 새로운 정보 객체를 추가 (예: "marketCapChange")
            info_with_change[f"{key}Change"] = change_info
            
    return info_with_change


def calculate_yield_from_history(info, history):
    if not history:
        return "N/A"
    current_price = info.get('regularMarketPrice') or info.get('previousClose')
    if not current_price or current_price == 0:
        return "N/A"
    one_year_ago = datetime.now() - timedelta(days=365)
    total_dividend_last_year = 0
    for item in history:
        try:
            ex_date_str = item.get('배당락')
            dividend_str = item.get('배당금')
            if not ex_date_str or not dividend_str:
                continue
            ex_date = datetime.strptime(ex_date_str.replace(" ", ""), '%y.%m.%d')
            if ex_date >= one_year_ago:
                amount = float(dividend_str.replace("$", ""))
                total_dividend_last_year += amount
        except (ValueError, TypeError):
            continue
    if total_dividend_last_year == 0:
        return "0.00%"
    yield_percentage = (total_dividend_last_year / current_price) * 100
    return f"{yield_percentage:.2f}%"

def fetch_ticker_info(ticker_symbol, company, frequency, group, dividend_history):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        update_time_str = now_kst.strftime('%Y-%m-%d %H:%M:%S KST')

        manual_yield = calculate_yield_from_history(info, dividend_history)

        earnings_timestamp = info.get('earningsDate')
        earnings_date_str = "N/A"
        if earnings_timestamp:
            earnings_date_str = datetime.fromtimestamp(earnings_timestamp, tz=timezone.utc).astimezone(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')

        return {
            # --- 티커 ---
            "Symbol": info.get('symbol', ticker_symbol).upper(), 
            # --- 종목 이름 ---
            "longName": info.get('longName', ticker_symbol.upper()),
            # --- 회사 ---
            "company": company, 
            # --- 지급주기 ---
            "frequency": frequency, 
            # --- 그룹 ---
            "group": group,
            # --- 업데이트 시간 ---
            "Update": update_time_str,
            # --- 실적 발표일 ---
            "earningsDate": earnings_date_str,

            # --- 기업가치 ---
            "enterpriseValue": f"{info.get('enterpriseValue', 0):,}" if info.get('enterpriseValue') else "N/A",
            # --- 시가총액 ---
            "marketCap": f"{info.get('marketCap', 0):,}" if info.get('marketCap') else "N/A",
            # --- 거래량 ---
            "Volume": f"{info.get('volume', 0):,}" if info.get('volume') else "N/A",
            # --- 평균 거래량 ---
            "AvgVolume": f"{info.get('averageVolume', 0):,}" if info.get('averageVolume') else "N/A",
            # --- 유통 주식수 ---
            "sharesOutstanding": f"{info.get('sharesOutstanding', 0):,}" if info.get('sharesOutstanding') else "N/A",
            # --- 52주 범위 ---
            "52Week": f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}" if info.get('fiftyTwoWeekLow') else "N/A",
            # --- NAV ---
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get('navPrice') else "N/A",
            # --- TR  ---
            "TotalReturn": f"{(info.get('ytdReturn', 0) * 100):.2f}%" if info.get('ytdReturn') else "N/A",
            
            # --- 계산된 연배당률 ---
            "Yield": manual_yield,
            
            # --- 연간 배당금 ---
            "dividendRate": f"${info.get('dividendRate', 0):.2f}" if info.get('dividendRate') else "N/A",
            # --- 배당 성향 ---
            "payoutRatio": f"{(info.get('payoutRatio', 0) * 100):.2f}%" if info.get('payoutRatio') else "N/A",

            
        }
    except Exception as e:
        print(f"  -> Failed to fetch basic info for {ticker_symbol}: {e}")
        return None



if __name__ == "__main__":
    nav_file_path = 'public/nav.json'
    all_tickers_info = {}
    try:
        with open(nav_file_path, 'r', encoding='utf-8') as f:
            for item in json.load(f).get('nav', []):
                if item.get('symbol'): all_tickers_info[item.get('symbol')] = item
    except Exception as e:
        print(f"Error loading nav.json: {e}"); exit()
    
    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    total_updated_files = 0
    print("\n--- Starting Daily Ticker Info Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        existing_history = []
        old_ticker_info = None # 이전 정보를 저장할 변수
        final_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                    if isinstance(existing_data, dict):
                        final_data = existing_data
                        existing_history = existing_data.get('dividendHistory', [])
                        old_ticker_info = existing_data.get('tickerInfo') # 이전 tickerInfo 저장
            except json.JSONDecodeError: pass
        
        group_val = info.get('group')
        new_info = fetch_ticker_info(ticker, info.get('company'), info.get('frequency'), group_val, existing_history)
        
        if not new_info: 
            print(f"  -> Skipping update for {ticker}."); continue
        
        # [핵심] 새 정보와 이전 정보를 비교하여 최종 정보 생성
        info_with_change = compare_and_add_change(new_info, old_ticker_info)
        
        final_data['tickerInfo'] = info_with_change
        if 'dividendHistory' not in final_data:
            final_data['dividendHistory'] = []
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
        
        print(f" => Updated Ticker Info for {ticker}")
        total_updated_files += 1
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. Total files updated: {total_updated_files} ---")