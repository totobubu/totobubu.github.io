import time
import json
import os
import yfinance as yf
from datetime import datetime, timedelta

def get_historical_prices(ticker_symbol, ex_date_str):
    try:
        ex_date = datetime.strptime(ex_date_str, '%m/%d/%Y')
        start_date = ex_date - timedelta(days=7)
        end_date = ex_date + timedelta(days=2)
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(start=start_date, end=end_date)
        if hist.empty: return {"before_price": "N/A", "on_price": "N/A"}
        on_price, before_price = "N/A", "N/A"
        try:
            on_price_val = hist.loc[:ex_date.strftime('%Y-%m-%d')].iloc[-1]['Close']
            on_price = f"${on_price_val:.2f}"
        except IndexError: pass
        try:
            before_date_target = ex_date - timedelta(days=1)
            before_price_val = hist.loc[:before_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            before_price = f"${before_price_val:.2f}"
        except IndexError: pass
        return {"before_price": before_price, "on_price": on_price}
    except Exception as e:
        print(f"     Could not fetch price for {ticker_symbol}. Error: {e}")
        return {"before_price": "N/A", "on_price": "N/A"}

def fetch_dividend_history(ticker_symbol):
    print(f"Fetching Dividend History for {ticker_symbol.upper()}...")
    try:
        ticker = yf.Ticker(ticker_symbol)
        dividends_df = ticker.dividends.to_frame()
        dividend_history = []
        if not dividends_df.empty:
            dividends_df = dividends_df.reset_index()
            dividends_df.columns = ['ExDate', 'Dividend']
            for index, row in dividends_df.iterrows():
                ex_date = row['ExDate'].to_pydatetime().replace(tzinfo=None)
                if ex_date < datetime.now() - timedelta(days=365 * 10): continue
                ex_date_str_mdy = ex_date.strftime('%m/%d/%Y')
                dividend_amount = row['Dividend']
                prices = get_historical_prices(ticker_symbol, ex_date_str_mdy)
                record = {
                    '배당락': ex_date.strftime('%y. %m. %d'),
                    '배당금': f"${dividend_amount:.4f}",
                    '전일가': prices['before_price'],
                    '당일가': prices['on_price'],
                }
                dividend_history.append(record)
        return dividend_history
    except Exception as e:
        print(f"  -> Error fetching dividend history for {ticker_symbol.upper()}: {e}")
        return []

if __name__ == "__main__":
    nav_file_path = 'public/nav.json'
    all_tickers_info = {}
    try:
        with open(nav_file_path, 'r', encoding='utf-8') as f:
            ticker_list = json.load(f).get('nav', [])
            for item in ticker_list:
                ticker = item.get('name')
                if ticker: all_tickers_info[ticker] = item
    except Exception as e:
        print(f"Error loading nav.json: {e}")
        exit()

    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    total_changed_files = 0
    print("\n--- Starting Dividend and Price Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        if not os.path.exists(file_path):
            print(f"  -> No existing file for {ticker}. Skipping dividend update. Run info scraper first.")
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        
        final_ticker_info = existing_data.get('tickerInfo', {})
        new_dividend_history = fetch_dividend_history(ticker)
        if not new_dividend_history: continue
        
        has_changed = False
        final_history = existing_data.get('dividendHistory', [])
        
        existing_dates = {item['배당락'] for item in final_history}
        new_entries_to_add = [item for item in new_dividend_history if item['배당락'] not in existing_dates]
        if new_entries_to_add:
            has_changed = True
            print(f"  -> Found {len(new_entries_to_add)} new dividend entries for {ticker}.")
            final_history.extend(new_entries_to_add)

        enriched_count = 0
        new_dividends_map = {item['배당락']: item for item in new_dividend_history}
        for item in final_history:
            if item.get('전일가', 'N/A') == 'N/A':
                if item['배당락'] in new_dividends_map:
                    new_info_item = new_dividends_map[item['배당락']]
                    if item.get('전일가') != new_info_item.get('전일가') or item.get('당일가') != new_info_item.get('당일가'):
                        item.update({'전일가': new_info_item.get('전일가', 'N/A'), '당일가': new_info_item.get('당일가', 'N/A')})
                        has_changed = True
                        enriched_count += 1
        if enriched_count > 0:
            print(f"  -> Enriched {enriched_count} entries with price data for {ticker}.")
        
        if has_changed:
            final_history.sort(key=lambda x: datetime.strptime(x['배당락'], '%y. %m. %d'), reverse=True)
            final_data_to_save = {"tickerInfo": final_ticker_info, "dividendHistory": final_history}
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED DIVIDENDS for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No dividend changes for {ticker}.")

        time.sleep(1)

    print(f"\n--- Dividend History Update Finished. Total files updated: {total_changed_files} ---")
