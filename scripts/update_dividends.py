# scripts\update_dividends.py
import yfinance as yf
import json
import os
import time
from datetime import datetime

DATA_DIR = "public/data"
NAV_FILE_PATH = "public/nav.json"


def update_dividend_data(symbol, retries=3, delay=5):
    # [핵심 수정] 파일 경로를 위해 티커를 정규화합니다.
    sanitized_symbol = symbol.replace(".", "-")
    file_path = os.path.join(DATA_DIR, f"{sanitized_symbol.lower()}.json")

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
                if "backtestData" not in data:
                    data["backtestData"] = {}
                data["backtestData"]["dividends"] = []
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                return True

            new_dividends = []
            for date, amount in dividends_df.items():
                new_dividends.append(
                    {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
                )

            if "backtestData" not in data:
                data["backtestData"] = {}
            data["backtestData"]["dividends"] = new_dividends
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            print(
                f"✅ [{symbol}] Dividend data updated. Found {len(new_dividends)} records."
            )
            return True

        except Exception as e:
            print(f"❌ [{symbol}] Attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                print(f"    Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"❌ [{symbol}] All retries failed. Skipping.")
                return False

    return False


if __name__ == "__main__":
    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(
            f"Error: {NAV_FILE_PATH} not found. Please run 'npm run generate-nav' first."
        )
        exit()

    active_symbols = [
        item["symbol"] for item in nav_data["nav"] if not item.get("upcoming")
    ]
    symbols_to_update = list(set(active_symbols + ["SPY"]))

    print(
        f"--- Starting Dividend Data Update (Python/yfinance) for {len(symbols_to_update)} symbols ---"
    )

    success_count = 0
    for symbol in symbols_to_update:
        if update_dividend_data(symbol):
            success_count += 1

    print(
        f"\nUpdate complete. Success: {success_count}, Failure: {len(symbols_to_update) - success_count}"
    )
