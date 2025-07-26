import time
import json
import os
import yfinance as yf
from datetime import datetime, timedelta

def get_historical_prices(ticker_symbol, ex_date_str):
    try:
        ex_date = datetime.strptime(ex_date_str, '%m/%d/%Y')
        start_date = ex_date - timedelta(days=7)
        end_date = ex_date + timedelta(days=7)
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(start=start_date, end=end_date)
        if hist.empty:
            return {"before_price": "N/A", "open_price": "N/A", "on_price": "N/A", "after_price": "N/A"}
        before_price, open_price, on_price, after_price = "N/A", "N/A", "N/A", "N/A"
        try:
            before_date_target = ex_date - timedelta(days=1)
            price_val = hist.loc[:before_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            before_price = f"${price_val:.2f}"
        except IndexError: pass
        try:
            on_date_row = hist.loc[:ex_date.strftime('%Y-%m-%d')].iloc[-1]
            open_price = f"${on_date_row['Open']:.2f}"
            on_price = f"${on_date_row['Close']:.2f}"
        except IndexError: pass
        try:
            after_date_target = ex_date + timedelta(days=1)
            price_val = hist.loc[:after_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            after_price = f"${price_val:.2f}"
        except IndexError: pass
        return {"before_price": before_price, "open_price": open_price, "on_price": on_price, "after_price": after_price}
    except Exception as e:
        print(f"     Could not fetch price for {ticker_symbol}. Error: {e}")
        return {"before_price": "N/A", "open_price": "N/A", "on_price": "N/A", "after_price": "N/A"}

def fetch_dividend_history(ticker_symbol):
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
                    '전일종가': prices['before_price'],
                    '당일시가': prices['open_price'],
                    '당일종가': prices['on_price'],
                    '익일종가': prices['after_price'],
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
                ticker = item.get('symbol')
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
            continue
            
        final_data = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                if isinstance(existing_data, dict):
                    final_data = existing_data
                else:
                    print(f"  -> Warning: Existing file for {ticker} is not a dictionary. Skipping.")
                    continue
        except json.JSONDecodeError:
            print(f"  -> Warning: Could not decode JSON for {ticker}. Skipping.")
            continue

        final_ticker_info = final_data.get('tickerInfo', {})
        final_history = final_data.get('dividendHistory', [])
        
        new_dividend_history = fetch_dividend_history(ticker)
        if not new_dividend_history:
            print(f"  -> No dividend data from API for {ticker}.")
            continue
        
        has_changed = False
        
        new_dividends_map = {item['배당락']: item for item in new_dividend_history}
        processed_api_dates = set()
        
        for existing_item in final_history:
            ex_date = existing_item.get('배당락')
            if not ex_date:
                continue

            if ex_date in new_dividends_map:
                api_item = new_dividends_map[ex_date]
                
                is_placeholder = '배당금' not in existing_item
                values_differ = any(existing_item.get(k) != v for k, v in api_item.items())

                if is_placeholder or values_differ:
                    print(f"  -> Updating dividend on {ex_date} for {ticker}.")
                    existing_item.update(api_item)
                    has_changed = True
                
                processed_api_dates.add(ex_date)

        newly_added_count = 0
        for ex_date, api_item in new_dividends_map.items():
            if ex_date not in processed_api_dates:
                final_history.append(api_item)
                has_changed = True
                newly_added_count += 1
        
        if newly_added_count > 0:
            print(f"  -> Found {newly_added_count} brand new dividend entries for {ticker}.")

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