import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta

def fetch_ticker_info(ticker_symbol, company, frequency, group):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        update_time_str = now_kst.strftime('%Y-%m-%d %H:%M:%S KST')

        return {
            "Symbol": info.get('symbol', ticker_symbol).upper(), 
            "longName": info.get('longName', ticker_symbol.upper()),
            "company": company, 
            "frequency": frequency, 
            "group": group,
            "Update": update_time_str,
            "52Week": f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}" if info.get('fiftyTwoWeekLow') else "N/A",
            "Volume": f"{info.get('volume', 0):,}" if info.get('volume') else "N/A",
            "AvgVolume": f"{info.get('averageVolume', 0):,}" if info.get('averageVolume') else "N/A",
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get('navPrice') else "N/A",
            "TotalReturn": f"{(info.get('ytdReturn', 0) * 100):.2f}%" if info.get('ytdReturn') else "N/A",
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
                if ticker:
                    all_tickers_info[ticker] = item
    except Exception as e:
        print(f"Error loading nav.json: {e}")
        exit()
    
    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    total_updated_files = 0
    print("\n--- Starting Daily Ticker Info Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        final_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                    if isinstance(existing_data, dict):
                        final_data = existing_data
            except json.JSONDecodeError:
                print(f"  -> Warning: Could not decode JSON for {ticker}. Initializing fresh.")
        
        new_info = fetch_ticker_info(ticker, info['company'], info['frequency'], info['group'])
        if not new_info: 
            print(f"  -> Skipping update for {ticker}.")
            continue
        
        final_data['tickerInfo'] = new_info
        if 'dividendHistory' not in final_data:
            final_data['dividendHistory'] = []
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
        
        print(f" => Updated Ticker Info for {ticker}")
        total_updated_files += 1
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. Total files updated: {total_updated_files} ---")