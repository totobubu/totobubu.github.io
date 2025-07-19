import time
import json
import os
import yfinance as yf
from datetime import datetime, timedelta

# --- get_historical_prices 함수 (타임머신 버그 수정) ---
def get_historical_prices(ticker_symbol, ex_date_str):
    try:
        ex_date = datetime.strptime(ex_date_str, '%m/%d/%Y')
        
        # 1. 오늘 날짜를 시간대 정보 없이 가져옴
        today = datetime.now().replace(tzinfo=None)

        # 2. 조회하려는 날짜가 오늘보다 미래인지 확인
        if ex_date.replace(tzinfo=None) > today:
            # 배당락일이 아직 오지 않았다면, 전일종가만 조회 시도
            before_date_target = ex_date - timedelta(days=1)
            # 전일조차 아직 오지 않았다면, 아무것도 조회하지 않음
            if before_date_target.replace(tzinfo=None) > today:
                return {"before_price": "N/A", "on_price": "N/A"}
        
        # 주가 조회 기간 설정 (이전과 동일)
        start_date = ex_date - timedelta(days=7)
        end_date = ex_date + timedelta(days=2)
        
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(start=start_date, end=end_date)
        if hist.empty: return {"before_price": "N/A", "on_price": "N/A"}

        # 3. 정확한 날짜의 인덱스를 찾아 종가를 가져오는 방식으로 변경
        on_price, before_price = "N/A", "N/A"
        
        # 당일종가 조회
        try:
            # 정확히 ex_date 날짜의 인덱스가 있는지 확인
            on_price_val = hist.loc[hist.index.strftime('%Y-%m-%d') == ex_date.strftime('%Y-%m-%d')]['Close'].iloc[0]
            on_price = f"${on_price_val:.2f}"
        except (KeyError, IndexError): pass

        # 전일종가 조회
        try:
            before_date_target = ex_date - timedelta(days=1)
            # 정확히 before_date_target 날짜의 인덱스가 있는지 확인
            before_price_val = hist.loc[hist.index.strftime('%Y-%m-%d') == before_date_target.strftime('%Y-%m-%d')]['Close'].iloc[0]
            before_price = f"${before_price_val:.2f}"
        except (KeyError, IndexError): pass

        return {"before_price": before_price, "on_price": on_price}
    except Exception as e:
        # print(f"     Could not fetch price for {ticker_symbol}. Error: {e}")
        return {"before_price": "N/A", "on_price": "N/A"}
        
# --- 2. yfinance 전용 범용 스크래퍼 ---
def scrape_with_yfinance(ticker_symbol, company, frequency, group):
    print(f"Scraping {ticker_symbol.upper()} (Group: {group}) using yfinance API...")
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        from datetime import timezone
        now_utc = datetime.now(timezone.utc)
        korea_timezone = timezone(timedelta(hours=9))
        now_kst = now_utc.astimezone(korea_timezone)
        update_time_str = now_kst.strftime('%Y-%m-%d %H:%M:%S KST')

        full_name = info.get('longName', ticker_symbol.upper())
        ticker_info = {
            "name": ticker_symbol.upper(), "fullname": full_name, "company": company,
            "frequency": frequency, "group": group, "Update": update_time_str,
            "52Week": f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}" if info.get('fiftyTwoWeekLow') else "N/A",
            "Volume": f"{info.get('volume', 0):,}" if info.get('volume') else "N/A",
            "AvgVolume": f"{info.get('averageVolume', 0):,}" if info.get('averageVolume') else "N/A",
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get('navPrice') else "N/A",
            "Yield": f"{(info.get('trailingAnnualDividendYield', 0) * 100):.2f}%" if info.get('trailingAnnualDividendYield') else "N/A",
            "TotalReturn": f"{(info.get('ytdReturn', 0) * 100):.2f}%" if info.get('ytdReturn') else "N/A",
        }
        
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
                    '당일종가': prices['on_price'],
                }
                dividend_history.append(record)
        
        return {"tickerInfo": ticker_info, "dividendHistory": dividend_history}
    except Exception as e:
        print(f"  -> Error scraping {ticker_symbol.upper()} with yfinance: {e}")
        return None    
    
# --- 3. 메인 실행 로직 ---
if __name__ == "__main__":
    nav_file_path = 'public/nav.json'
    all_tickers_info = {}
    try:
        with open(nav_file_path, 'r', encoding='utf-8') as f:
            ticker_list = json.load(f).get('nav', [])
            for item in ticker_list:
                ticker = item.get('name')
                if ticker:
                    all_tickers_info[ticker] = {
                        "company": item.get('company', 'N/A'),
                        "frequency": item.get('frequency', 'N/A'),
                        "group": item.get('group', 'N/A')
                    }
        print(f"Successfully loaded {len(all_tickers_info)} tickers from {nav_file_path}")
    except Exception as e:
        print(f"An unexpected error occurred while loading {nav_file_path}: {e}")
        exit()

    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n--- Starting All Scrapes with Price Re-validation ---")
    
    total_changed_files = 0
    
    for ticker, info in all_tickers_info.items():
        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        existing_data = None
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
            except Exception as e:
                print(f"  -> Warning: Could not read existing file for {ticker}. Error: {e}")
        
        new_scraped_data = scrape_with_yfinance(ticker, info['company'], info['frequency'], info['group'])
        if not new_scraped_data:
            # print(f"  -> No data scraped from yfinance for {ticker}. Skipping update.")
            continue
            
        new_ticker_info = new_scraped_data.get('tickerInfo', {})
        new_dividend_history = new_scraped_data.get('dividendHistory', [])
        
        has_changed = False
        
        if not existing_data:
            final_history = new_dividend_history
            if final_history:
                has_changed = True
        else:
            final_history = existing_data.get('dividendHistory', [])
            
            existing_info_compare = {k: v for k, v in existing_data.get('tickerInfo', {}).items() if k != 'Update'}
            new_info_compare = {k: v for k, v in new_ticker_info.items() if k != 'Update'}
            if existing_info_compare != new_info_compare:
                has_changed = True
                print(f"  -> Ticker info for {ticker} has changed.")

            new_dividends_map = {item['배당락']: item for item in new_dividend_history}
            enriched_or_revalidated_count = 0
            today = datetime.now()

            for item in final_history:
                ex_date_str = item.get('배당락')
                if not ex_date_str: continue

                try:
                    ex_date = datetime.strptime(ex_date_str, '%y. %m. %d')
                except ValueError:
                    continue

                should_revalidate = (today - ex_date).days <= 3
                
                if item.get('전일종가', 'N/A') == 'N/A' or should_revalidate:
                    print(f"  -> {'Re-validating' if should_revalidate else 'Enriching'} price data for {ticker} on {ex_date_str}...")
                    
                    ex_date_for_price = ex_date.strftime('%m/%d/%Y')
                    prices = get_historical_prices(ticker, ex_date_for_price)
                    
                    old_before_price = item.get('전일종가')
                    old_on_price = item.get('당일종가')
                    
                    if old_before_price != prices['before_price'] or old_on_price != prices['on_price']:
                        item.update({
                            '전일종가': prices['before_price'],
                            '당일종가': prices['on_price'],
                        })
                        has_changed = True
                        enriched_or_revalidated_count += 1
            
            if enriched_or_revalidated_count > 0:
                print(f"  -> Enriched/Re-validated {enriched_or_revalidated_count} entries for {ticker}.")

            existing_dates = {item['배당락'] for item in final_history}
            new_entries_to_add = [item for item in new_dividend_history if item['배당락'] not in existing_dates]
            if new_entries_to_add:
                has_changed = True
                print(f"  -> Found {len(new_entries_to_add)} new dividend entries for {ticker}.")
                final_history.extend(new_entries_to_add)

        if has_changed:
            final_history.sort(key=lambda x: datetime.strptime(x['배당락'], '%y. %m. %d'), reverse=True)
            final_data_to_save = {"tickerInfo": new_ticker_info, "dividendHistory": final_history}
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED and saved data for {ticker} to {file_path}")
            total_changed_files += 1
        else:
            print(f"  -> No changes detected for {ticker}. Skipping file write.")
            
        time.sleep(1)

    print("\n--- ALL TASKS FINISHED ---")
    print(f"Total files updated: {total_changed_files}")
