import yfinance as yf
import json
import os
import time # 재시도를 위한 time 모듈 import
from datetime import datetime

DATA_DIR = "public/data"
NAV_FILE_PATH = "public/nav.json"

def update_dividend_data(symbol, retries=3, delay=5): # 재시도 횟수와 딜레이 추가
    file_path = os.path.join(DATA_DIR, f"{symbol.lower()}.json")
    
    # [핵심 수정] 재시도 로직 추가
    for attempt in range(retries):
        try:
            if not os.path.exists(file_path):
                print(f"- Skipping {symbol}: Data file not found.")
                return False

            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            ticker = yf.Ticker(symbol)
            dividends_df = ticker.dividends

            if dividends_df.empty:
                print(f"- No dividend data found for {symbol}.")
                if "backtestData" not in data: data["backtestData"] = {}
                data["backtestData"]["dividends"] = []
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                return True

            new_dividends = []
            for date, amount in dividends_df.items():
                new_dividends.append({"date": date.strftime("%Y-%m-%d"), "amount": float(amount)})

            if "backtestData" not in data: data["backtestData"] = {}
            data["backtestData"]["dividends"] = new_dividends
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            print(f"✅ [{symbol}] Dividend data updated. Found {len(new_dividends)} records.")
            return True # 성공 시 즉시 함수 종료

        except Exception as e:
            # 재시도 가능한 에러인지 확인 (예: 네트워크 관련 에러)
            print(f"❌ [{symbol}] Attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                print(f"    Retrying in {delay} seconds...")
                time.sleep(delay) # 다음 시도 전 딜레이
            else:
                print(f"❌ [{symbol}] All retries failed. Skipping.")
                return False # 모든 재시도 실패 시 최종 실패 처리

    return False # 루프가 비정상적으로 끝난 경우


if __name__ == "__main__":
    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {NAV_FILE_PATH} not found. Please run 'npm run generate-nav' first.")
        exit()

    active_symbols = [item["symbol"] for item in nav_data["nav"] if not item.get("upcoming")]
    symbols_to_update = list(set(active_symbols + ["SPY"]))

    print(f"--- Starting Dividend Data Update (Python/yfinance) for {len(symbols_to_update)} symbols ---")

    success_count = 0
    for symbol in symbols_to_update:
        if update_dividend_data(symbol):
            success_count += 1

    print(f"\nUpdate complete. Success: {success_count}, Failure: {len(symbols_to_update) - success_count}")