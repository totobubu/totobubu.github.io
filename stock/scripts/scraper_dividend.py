import time
import json
import os
import yfinance as yf
from datetime import datetime, timedelta

def get_historical_prices(ticker_symbol, ex_date_str):
    """
    배당락일(ex_date)을 기준으로 4가지 주요 가격 정보를 가져옵니다.
    - 전일가: 배당락일 전 영업일의 종가
    - 시작가: 배당락일 당일의 시가
    - 당일가: 배당락일 당일의 종가
    - 배당후: 배당락일 다음 영업일의 종가
    """
    try:
        ex_date = datetime.strptime(ex_date_str, '%m/%d/%Y')
        
        # 데이터 조회를 위한 충분한 기간 설정 (주말, 휴일 고려)
        start_date = ex_date - timedelta(days=7)
        end_date = ex_date + timedelta(days=7) # 배당후 가격을 위해 조회 기간 확대
        
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(start=start_date, end=end_date)
        
        if hist.empty:
            return {"before_price": "N/A", "open_price": "N/A", "on_price": "N/A", "after_price": "N/A"}

        # 기본값 설정
        before_price, open_price, on_price, after_price = "N/A", "N/A", "N/A", "N/A"

        # 1. 전일가 (배당락일 전날 종가)
        try:
            # 배당락일 -1일 이전의 가장 마지막 거래일 데이터를 찾음
            before_date_target = ex_date - timedelta(days=1)
            price_val = hist.loc[:before_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            before_price = f"${price_val:.2f}"
        except IndexError:
            pass # 해당 날짜 데이터가 없으면 N/A 유지

        # 2. 시작가 및 당일가 (배당락일 시가/종가)
        try:
            # 배당락일 당일 또는 그 이전의 가장 마지막 거래일 데이터를 찾음
            on_date_row = hist.loc[:ex_date.strftime('%Y-%m-%d')].iloc[-1]
            open_price_val = on_date_row['Open']
            on_price_val = on_date_row['Close']
            open_price = f"${open_price_val:.2f}"
            on_price = f"${on_price_val:.2f}"
        except IndexError:
            pass # 해당 날짜 데이터가 없으면 N/A 유지

        # 4. 배당후 (배당락일 다음날 종가)
        try:
            # 배당락일 +1일 이후의 가장 마지막 거래일 데이터를 찾음
            after_date_target = ex_date + timedelta(days=1)
            price_val = hist.loc[:after_date_target.strftime('%Y-%m-%d')].iloc[-1]['Close']
            after_price = f"${price_val:.2f}"
        except IndexError:
            pass # 해당 날짜 데이터가 없으면 N/A 유지
            
        return {
            "before_price": before_price,
            "open_price": open_price,
            "on_price": on_price,
            "after_price": after_price,
        }
        
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
                if ex_date < datetime.now() - timedelta(days=365 * 10):
                    continue
                
                ex_date_str_mdy = ex_date.strftime('%m/%d/%Y')
                dividend_amount = row['Dividend']
                
                prices = get_historical_prices(ticker_symbol, ex_date_str_mdy)
                
                # record 객체에 새로운 가격 필드 추가
                record = {
                    '배당락': ex_date.strftime('%y. %m. %d'),
                    '배당금': f"${dividend_amount:.4f}",
                    '전일가': prices['before_price'],
                    '시작가': prices['open_price'], # 시작가 추가
                    '당일가': prices['on_price'],
                    '배당후': prices['after_price'], # 배당후 추가
                }
                dividend_history.append(record)
        return dividend_history
    except Exception as e:
        print(f"  -> Error fetching dividend history for {ticker_symbol.upper()}: {e}")
        return []

if __name__ == "__main__":
    # --- 이하 메인 로직은 대부분 동일하나, 데이터 보강 로직이 강화되었습니다 ---
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
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        
        final_ticker_info = existing_data.get('tickerInfo', {})
        new_dividend_history = fetch_dividend_history(ticker)
        if not new_dividend_history:
            continue
        
        has_changed = False
        final_history = existing_data.get('dividendHistory', [])
        
        # 새 배당 이력 추가 로직
        existing_dates = {item['배당락'] for item in final_history}
        new_entries_to_add = [item for item in new_dividend_history if item['배당락'] not in existing_dates]
        if new_entries_to_add:
            has_changed = True
            print(f"  -> Found {len(new_entries_to_add)} new dividend entries for {ticker}.")
            final_history.extend(new_entries_to_add)

        # 기존 데이터에 누락된 가격 정보 보강 로직 (강화)
        enriched_count = 0
        new_dividends_map = {item['배당락']: item for item in new_dividend_history}
        for item in final_history:
            # 가격 정보 중 하나라도 'N/A'이면 전체를 업데이트 시도
            if any(item.get(price_key, 'N/A') == 'N/A' for price_key in ['전일가', '시작가', '당일가', '배당후']):
                if item['배당락'] in new_dividends_map:
                    new_info_item = new_dividends_map[item['배당락']]
                    
                    # 업데이트할 내용
                    update_payload = {
                        '전일가': new_info_item.get('전일가', 'N/A'),
                        '시작가': new_info_item.get('시작가', 'N/A'),
                        '당일가': new_info_item.get('당일가', 'N/A'),
                        '배당후': new_info_item.get('배당후', 'N/A'),
                    }
                    
                    # 실제로 변경된 내용이 있을 때만 업데이트
                    if any(item.get(k) != v for k, v in update_payload.items()):
                        item.update(update_payload)
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

        time.sleep(1) # API 호출 제한을 피하기 위한 딜레이

    print(f"\n--- Dividend History Update Finished. Total files updated: {total_changed_files} ---")