import os
import json
import yfinance as yf
from tqdm import tqdm
import pandas as pd
# [핵심 추가] 병렬 처리를 위한 라이브러리 import
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")

# [핵심 추가] 단일 종목을 처리하는 함수를 별도로 분리
def process_symbol(symbol_data):
    symbol, all_dividends_df, ticker_info_map = symbol_data
    try:
        sanitized_symbol = symbol.replace(".", "-").lower()
        file_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

        with open(file_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)

        backtest_data = existing_data.get("backtestData", [])
        backtest_map = {item["date"]: item for item in backtest_data}
        
        currency = ticker_info_map.get(symbol, {}).get("currency", "USD")
        original_backtest_data_str = json.dumps(backtest_data, sort_keys=True)

        if symbol in all_dividends_df.columns:
            symbol_dividends = all_dividends_df[symbol][all_dividends_df[symbol] > 0]

            for date, amount in symbol_dividends.items():
                date_str = date.strftime("%Y-%m-%d")
                new_amount = int(round(amount)) if currency == "KRW" else float(amount)

                if date_str not in backtest_map:
                    backtest_map[date_str] = {"date": date_str}

                backtest_map[date_str]["amount"] = new_amount

        final_backtest_data = sorted(backtest_map.values(), key=lambda x: x["date"])

        if original_backtest_data_str != json.dumps(final_backtest_data, sort_keys=True):
            existing_data["backtestData"] = final_backtest_data
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)
            # 변경된 경우 symbol을 반환
            return symbol
    except Exception as e:
        # 에러가 발생한 경우 에러 메시지와 함께 symbol 반환
        return (symbol, str(e))
    
    # 변경되지 않은 경우 None 반환
    return None


def main():
    print("--- Starting Incremental Dividend Update (Time-Series Mode) ---")
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: {NAV_FILE_PATH} not found.")
        return

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    ticker_info_map = {t["symbol"]: t for t in active_tickers_info}
    active_symbols = list(ticker_info_map.keys())

    print(f"Analyzing {len(active_symbols)} active tickers for dividend updates...")

    try:
        data = yf.download(
            active_symbols, 
            actions=True, 
            progress=True, 
            auto_adjust=True, 
            period="max",
            timeout=30 # 타임아웃 시간 30초로 설정
        )
        if data.empty or "Dividends" not in data.columns:
            print("No dividend data found from yfinance.")
            return
        all_dividends_df = data["Dividends"]
    except Exception as e:
        print(f"❌ Error fetching bulk dividend data from yfinance: {e}")
        return

    updated_count = 0
    error_count = 0
    
    # [핵심 수정] 병렬 처리 실행
    # 각 프로세스에 전달할 데이터 묶음 생성
    tasks = [(symbol, all_dividends_df, ticker_info_map) for symbol in active_symbols]

    # ProcessPoolExecutor를 사용하여 병렬로 작업 처리
    with ProcessPoolExecutor() as executor:
        # tqdm을 사용하여 진행 상황 표시
        results = list(tqdm(executor.map(process_symbol, tasks), total=len(tasks), desc="Merging dividend data"))

    for result in results:
        if result is not None:
            if isinstance(result, tuple): # 에러가 반환된 경우
                symbol, error_msg = result
                tqdm.write(f"  ❌ Error processing {symbol}: {error_msg}")
                error_count += 1
            else: # 성공적으로 업데이트된 경우
                updated_count += 1

    print(f"\n--- Dividend Merge Finished. ---")
    print(f"✅ Successfully updated: {updated_count} files")
    if error_count > 0:
        print(f"❌ Failed to process: {error_count} files")


if __name__ == "__main__":
    main()