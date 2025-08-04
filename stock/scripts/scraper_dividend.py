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
        hist = ticker.history(start=start_date, end=end_date, auto_adjust=False)
        if hist.empty:
            return {}
        
        prices = {}
        try:
            before_date_target = ex_date - timedelta(days=1)
            price_val = hist.loc[:before_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            prices["전일종가"] = f"${price_val:.2f}"
        except (IndexError, KeyError): pass
        try:
            on_date_row = hist.loc[ex_date.strftime('%Y-%m-%d')]
            prices["당일시가"] = f"${on_date_row['Open']:.2f}"
            prices["당일종가"] = f"${on_date_row['Close']:.2f}"
        except (IndexError, KeyError): pass
        try:
            after_date_target = ex_date + timedelta(days=1)
            price_val = hist.loc[after_date_target.strftime('%Y-%m-%d'):].iloc[0]['Close']
            prices["익일종가"] = f"${price_val:.2f}"
        except (IndexError, KeyError): pass

        return prices
    except Exception as e:
        print(f"     Could not fetch price for {ticker_symbol} on {ex_date_str}. Error: {e}")
        return {}

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
                record = { '배당락': ex_date.strftime('%y. %m. %d'), '배당금': f"${row['Dividend']:.4f}" }
                dividend_history.append(record)
        return dividend_history
    except Exception as e:
        print(f"  -> Error fetching dividend history for {ticker_symbol.upper()}: {e}")
        return []

def get_price_on_date(ticker_symbol, target_date):
    try:
        start_date = target_date - timedelta(days=14)
        hist = yf.Ticker(ticker_symbol).history(start=start_date, end=target_date + timedelta(days=1))
        if not hist.empty:
            return hist.iloc[-1]['Close']
    except Exception:
        pass
    return None

def calculate_yield_data(ticker_symbol, history):
    if not history:
        return []

    latest_price = None
    latest_record_with_price = next((record for record in history if record.get('당일종가') and record.get('당일종가') != 'N/A'), None)
    if latest_record_with_price:
        latest_price = float(latest_record_with_price['당일종가'].replace('$', ''))
    else:
        latest_price = get_price_on_date(ticker_symbol, datetime.now())

    if not latest_price or latest_price == 0:
        return []

    now = datetime.now()
    oldest_date = datetime.strptime(history[-1]['배당락'].replace(" ", ""), '%y.%m.%d')
    
    periods = {
        "3개월배당률": 3, "6개월배당률": 6, "1년배당률": 12, "2년배당률": 24,
        "3년배당률": 36, "5년배당률": 60, "10년배당률": 120
    }
    
    yield_data = {}

    for label, months in periods.items():
        cutoff_date = now - timedelta(days=months * 30.44)
        if oldest_date > cutoff_date:
            yield_data[label] = "N/A"
            continue

        period_history = [h for h in history if datetime.strptime(h['배당락'].replace(" ", ""), '%y.%m.%d') >= cutoff_date]
        if not period_history:
            yield_data[label] = "0.00%"
            continue

        total_dividend = sum(float(h['배당금'].replace('$', '')) for h in period_history if h.get('배당금'))
        
        start_of_period_price = get_price_on_date(ticker_symbol, cutoff_date)
        if not start_of_period_price or start_of_period_price == 0:
            yield_data[label] = "N/A"
            continue

        annualized_yield = ((total_dividend / months) * 12 / start_of_period_price) * 100
        yield_data[label] = f"{annualized_yield:.2f}%"

    all_dividends = [float(h['배당금'].replace('$', '')) for h in history if h.get('배당금')]
    if all_dividends:
        max_dividend = max(all_dividends)
        payouts_per_year = len([h for h in history if datetime.strptime(h['배당락'].replace(" ", ""), '%y.%m.%d') >= now - timedelta(days=365)])
        if payouts_per_year == 0: payouts_per_year = 12
        
        max_annual_yield = (max_dividend * payouts_per_year / latest_price) * 100
        yield_data["최고배당률"] = f"{max_annual_yield:.2f}%"
    else:
        yield_data["최고배당률"] = "0.00%"

    return [{k: v} for k, v in yield_data.items()]

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
    
    total_changed_files = 0
    print("\n--- Starting Dividend and Yield Data Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        if not os.path.exists(file_path):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print(f"  -> Warning: Could not read or decode JSON for {ticker}. Skipping."); continue

        existing_ticker_info = existing_data.get('tickerInfo', {})
        existing_history = existing_data.get('dividendHistory', [])
        
        api_history = fetch_dividend_history(ticker)
        
        original_data_str = json.dumps(existing_data, sort_keys=True)
        
        merged_history_map = {item['배당락']: item for item in existing_history}
        api_history_map = {item['배당락']: item for item in api_history}

        all_dates = sorted(list(set(merged_history_map.keys()) | set(api_history_map.keys())), 
                           key=lambda x: datetime.strptime(x.replace(" ", ""), '%y.%m.%d'), reverse=True)

        final_history = []
        for ex_date in all_dates:
            local_item = merged_history_map.get(ex_date, {})
            api_item = api_history_map.get(ex_date, {})
            merged_item = {**api_item, **local_item}

            if '배당금' in merged_item and '당일종가' not in merged_item:
                mdy_date = datetime.strptime(ex_date, '%y. %m. %d').strftime('%m/%d/%Y')
                prices = get_historical_prices(ticker, mdy_date)
                merged_item.update(prices)

            final_history.append(merged_item)
        
        yield_data = calculate_yield_data(ticker, final_history)
        
        final_data_to_save = {
            "tickerInfo": existing_ticker_info, 
            "YieldData": yield_data,
            "dividendHistory": final_history
        }

        if original_data_str != json.dumps(final_data_to_save, sort_keys=True):
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED DIVIDENDS & YIELD for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No changes for {ticker}.")

        time.sleep(1)

    print(f"\n--- Update Finished. Total files updated: {total_changed_files} ---")