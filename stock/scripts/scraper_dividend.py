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
                record = {
                    '배당락': ex_date.strftime('%y. %m. %d'),
                    '배당금': f"${row['Dividend']:.4f}"
                }
                dividend_history.append(record)
        return dividend_history
    except Exception as e:
        print(f"  -> Error fetching dividend history for {ticker_symbol.upper()}: {e}")
        return []

def add_yield_to_history(history):
    history_with_yield = []
    
    # 날짜 파싱을 미리 해두어 성능 최적화
    parsed_history = []
    for item in history:
        try:
            parsed_history.append({
                "date": datetime.strptime(item['배당락'].replace(" ", ""), '%y.%m.%d'),
                "data": item
            })
        except (ValueError, KeyError):
            continue # 날짜 형식이 잘못된 데이터는 건너뜀

    for i, current_entry in enumerate(parsed_history):
        current_item = current_entry['data']
        new_item = current_item.copy()
        
        opening_price_str = new_item.get('당일시가')
        
        if opening_price_str and opening_price_str != 'N/A':
            try:
                opening_price = float(opening_price_str.replace('$', ''))
                if opening_price > 0:
                    current_date = current_entry['date']
                    one_year_before = current_date - timedelta(days=365)
                    
                    dividends_in_past_year = 0
                    
                    # 현재 항목을 기준으로 '과거' 1년간의 배당금 합산
                    for past_entry in parsed_history[i:]:
                        past_date = past_entry['date']
                        if past_date < one_year_before:
                            break # 1년보다 더 오래된 데이터는 중단
                        
                        dividend_str = past_entry['data'].get('배당금')
                        if dividend_str:
                            dividends_in_past_year += float(dividend_str.replace('$', ''))
                    
                    yield_rate = (dividends_in_past_year / opening_price) * 100
                    new_item['배당률'] = f"{yield_rate:.2f}%"

            except (ValueError, TypeError):
                pass
        
        history_with_yield.append(new_item)
        
    return history_with_yield


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
    print("\n--- Starting Dividend Data Update ---")
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        if not os.path.exists(file_path):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print(f"  -> Warning: Could not read/decode JSON for {ticker}. Skipping."); continue

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
        
        final_history_with_yield = add_yield_to_history(final_history)
        
        final_data_to_save = {
            "tickerInfo": existing_ticker_info,
            "dividendHistory": final_history_with_yield
        }

        if original_data_str != json.dumps(final_data_to_save, sort_keys=True):
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED DIVIDENDS for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No changes for {ticker}.")

        time.sleep(1)

    print(f"\n--- Dividend Update Finished. Total files updated: {total_changed_files} ---")