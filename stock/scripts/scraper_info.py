import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta

# fetch_ticker_info 함수는 변경할 필요가 없으므로 그대로 둡니다.
def fetch_ticker_info(ticker_symbol, company, frequency, group):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        update_time_str = now_kst.strftime('%Y-%m-%d %H:%M:%S KST')

        return {
            # Symbol은 API 응답의 'symbol' 키를 우선적으로 사용하고, 없으면 입력값을 대문자화하여 사용
            "Symbol": info.get('symbol', ticker_symbol).upper(), 
            "longName": info.get('longName', ticker_symbol.upper()),
            "company": company, "frequency": frequency, "group": group,
            "Update": update_time_str,
            "52Week": f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}" if info.get('fiftyTwoWeekLow') else "N/A",
            "Volume": f"{info.get('volume', 0):,}" if info.get('volume') else "N/A",
            "AvgVolume": f"{info.get('averageVolume', 0):,}" if info.get('averageVolume') else "N/A",
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get('navPrice') else "N/A",
            "Yield": f"{(info.get('trailingAnnualDividendYield', 0) * 100):.2f}%" if info.get('trailingAnnualDividendYield') else "N/A",
            "TotalReturn": f"{(info.get('ytdReturn', 0) * 100):.2f}%" if info.get('ytdReturn') else "N/A",
        }
    except Exception as e:
        return None

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
    except Exception as e:
        print(f"Error loading nav.json: {e}")
        exit()
    
    output_dir = 'public/data'
    os.makedirs(output_dir, exist_ok=True)
    
    total_updated_files = 0
    print("\n--- Starting Daily Ticker Info Update ---")
    for ticker, info in all_tickers_info.items():
        # 1. API를 통해 최신 티커 정보를 가져옵니다.
        new_info = fetch_ticker_info(ticker, info['company'], info['frequency'], info['group'])
        if not new_info: 
            print(f"  -> Failed to fetch new info for {ticker}. Skipping.")
            continue

        file_path = os.path.join(output_dir, f"{ticker.lower()}.json")
        
        # 2. ★★★★★ 핵심 수정 부분: 안정적인 파일 읽기 및 데이터 초기화 ★★★★★
        final_data = {} # 기본적으로 빈 딕셔너리로 시작
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                    # 읽어온 데이터가 딕셔너리인 경우에만 final_data로 사용
                    if isinstance(existing_data, dict):
                        final_data = existing_data
                    else:
                        # 딕셔너리가 아니면 (리스트 등) 경고를 남기고 빈 딕셔너리로 초기화
                        print(f"  -> Warning: Existing file for {ticker} is not a dictionary. Initializing fresh.")
            except json.JSONDecodeError:
                # 파일이 손상되었거나 비어있으면 경고를 남기고 빈 딕셔너리로 초기화
                print(f"  -> Warning: Could not decode JSON for {ticker}. Initializing fresh.")
        
        # 3. ★★★★★ tickerInfo 업데이트 및 dividendHistory 유지 ★★★★★
        # 이제 final_data는 항상 딕셔너리임이 보장됩니다.
        final_data['tickerInfo'] = new_info
        
        # 만약 기존에 dividendHistory가 없었다면, 빈 리스트로 초기화해줍니다.
        if 'dividendHistory' not in final_data:
            final_data['dividendHistory'] = []
        
        # 4. 수정된 전체 데이터를 파일에 다시 씁니다.
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
        
        print(f" => Updated Ticker Info for {ticker}")
        total_updated_files += 1
        time.sleep(1) # API 호출 제한을 피하기 위한 딜레이

    print(f"\n--- Ticker Info Update Finished. Total files updated: {total_updated_files} ---")