import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta

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
            # --- 유동 주식수 ---
            "floatShares": f"{info.get('floatShares', 0):,}" if info.get('floatShares') else "N/A",
            # --- 암묵적 유통주식수 ---
            "impliedSharesOutstanding": f"{info.get('impliedSharesOutstanding', 0):,}" if info.get('impliedSharesOutstanding') else "N/A",
            # --- 52주 범위 ---
            "52Week": f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}" if info.get('fiftyTwoWeekLow') else "N/A",

            # --- NAV ---
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get('navPrice') else "N/A",
            # --- TR  ---
            "TotalReturn": f"{(info.get('ytdReturn', 0) * 100):.2f}%" if info.get('ytdReturn') else "N/A",
            
            # --- 계산된 연배당률 ---
            "Yield": manual_yield,
            # --- 배당 수익률 ---
            "dividendYield": f"{(info.get('dividendYield', 0) * 100):.2f}%" if info.get('dividendYield') else "N/A",
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
            ticker_list = json.load(f).get('nav', [])
            for item in ticker_list:
                ticker = item.get('symbol')
                if ticker: all_tickers_info[ticker] = item
    except Exception as e:
        print(f"Error loading nav.json: {e}"); exit()
    
    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    total_updated_files = 0
    print("\n--- Starting Daily Ticker Info Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        existing_history = []
        final_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                    if isinstance(existing_data, dict):
                        final_data = existing_data
                        existing_history = existing_data.get('dividendHistory', [])
            except json.JSONDecodeError: pass
        
        group_val = info.get('group')
        new_info = fetch_ticker_info(ticker, info.get('company'), info.get('frequency'), group_val, existing_history)
        
        if not new_info: 
            print(f"  -> Skipping update for {ticker}."); continue
        
        final_data['tickerInfo'] = new_info
        if 'dividendHistory' not in final_data:
            final_data['dividendHistory'] = []
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
        
        print(f" => Updated Ticker Info for {ticker}")
        total_updated_files += 1
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. Total files updated: {total_updated_files} ---")