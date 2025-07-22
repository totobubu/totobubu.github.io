import time
import json
import os
import yfinance as yf
from datetime import datetime, timedelta

# get_historical_prices, fetch_dividend_history 함수는 변경할 필요가 없으므로 그대로 둡니다.
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
            open_price_val = on_date_row['Open']
            on_price_val = on_date_row['Close']
            open_price = f"${open_price_val:.2f}"
            on_price = f"${on_price_val:.2f}"
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
        
        # ★★★★★ 안정성 강화: 파일 읽기 및 데이터 초기화 ★★★★★
        if not os.path.exists(file_path):
            # 파일이 없으면 처리할 대상이 아니므로 건너뜀
            continue
            
        final_data = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                # 읽어온 데이터가 딕셔너리인 경우에만 사용
                if isinstance(existing_data, dict):
                    final_data = existing_data
                else:
                    print(f"  -> Warning: Existing file for {ticker} is not a dictionary. Skipping update.")
                    continue # 잘못된 파일은 건너뛰어 데이터를 보호
        except json.JSONDecodeError:
            print(f"  -> Warning: Could not decode JSON for {ticker}. Skipping update.")
            continue # 손상된 파일은 건너뜀
        # ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

        # 기존 파일에서 tickerInfo와 dividendHistory를 안전하게 가져옵니다.
        final_ticker_info = final_data.get('tickerInfo', {})
        final_history = final_data.get('dividendHistory', [])
        
        # API를 통해 새로운 배당 정보를 가져옵니다.
        new_dividend_history = fetch_dividend_history(ticker)
        if not new_dividend_history:
            print(f"  -> No new dividend data from API for {ticker}.")
            continue # API에서 가져온 데이터가 없으면 다음으로 넘어감
        
        has_changed = False
        
        # 새로운 항목 추가 로직
        existing_api_dates = {item['배당락'] for item in final_history if '배당금' in item}
        new_entries_to_add = [item for item in new_dividend_history if item['배당락'] not in existing_api_dates]
        
        if new_entries_to_add:
            has_changed = True
            print(f"  -> Found {len(new_entries_to_add)} new dividend entries for {ticker}.")
            final_history.extend(new_entries_to_add)

        # 데이터 보강 로직
        enriched_count = 0
        new_dividends_map = {item['배당락']: item for item in new_dividend_history}
        for item in final_history:
            if '배당금' not in item:
                continue
            
            if any(item.get(price_key, 'N/A') == 'N/A' for price_key in ['전일종가', '당일시가', '당일종가', '익일종가']):
                if item['배당락'] in new_dividends_map:
                    new_info_item = new_dividends_map[item['배당락']]
                    update_payload = {
                        '전일종가': new_info_item.get('전일종가', 'N/A'),
                        '당일시가': new_info_item.get('당일시가', 'N/A'),
                        '당일종가': new_info_item.get('당일종가', 'N/A'),
                        '익일종가': new_info_item.get('익일종가', 'N/A'),
                    }
                    if any(item.get(k) != v for k, v in update_payload.items()):
                        item.update(update_payload)
                        has_changed = True
                        enriched_count += 1

        if enriched_count > 0:
            print(f"  -> Enriched {enriched_count} entries with price data for {ticker}.")
        
        if has_changed:
            final_history.sort(key=lambda x: datetime.strptime(x['배당락'], '%y. %m. %d'), reverse=True)
            # 최종 데이터를 저장할 때, 기존 tickerInfo와 업데이트된 dividendHistory를 합칩니다.
            final_data_to_save = {"tickerInfo": final_ticker_info, "dividendHistory": final_history}
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED DIVIDENDS for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No dividend changes for {ticker}.")

        time.sleep(1)

    print(f"\n--- Dividend History Update Finished. Total files updated: {total_changed_files} ---")