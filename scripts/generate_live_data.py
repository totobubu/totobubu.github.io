# scripts/generate_live_data.py
import os
import json
import yfinance as yf
import pandas as pd
from tqdm import tqdm

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")
OUTPUT_FILE = os.path.join(PUBLIC_DIR, "live-data.json")


def main():
    print("--- Starting Live Data Generation ---")

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: nav.json not found at {NAV_FILE_PATH}")
        return

    active_tickers = [
        t["symbol"]
        for t in nav_data.get("nav", [])
        if t.get("symbol") and not t.get("upcoming", False)
    ]

    if not active_tickers:
        print("No active tickers to fetch.")
        return

    print(f"Found {len(active_tickers)} active tickers to fetch.")

    batch_size = 100
    all_live_data = []

    # yf.download는 progress bar를 자체적으로 제공하므로 tqdm을 여기에 사용할 수 있음
    data = yf.download(active_tickers, period="1d", progress=True, auto_adjust=True)

    if not data.empty and "Close" in data:
        close_prices = data["Close"]
        # 단일 티커일 경우와 멀티 티커일 경우를 모두 처리
        last_prices = (
            close_prices.iloc[-1]
            if isinstance(close_prices, pd.DataFrame)
            else close_prices
        )

        for ticker in active_tickers:
            price = last_prices.get(ticker)
            if pd.notna(price):
                all_live_data.append({"symbol": ticker, "price": price})

    # Yield 정보 추가
    for item in tqdm(all_live_data, desc="Adding yield data"):
        file_path = os.path.join(
            DATA_DIR, f"{item['symbol'].replace('.', '-').lower()}.json"
        )
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                ticker_data = json.load(f)
                yield_value = ticker_data.get("tickerInfo", {}).get("Yield")

                # [핵심 수정] Yield 값의 타입을 확인하여 처리
                if isinstance(yield_value, str) and "%" in yield_value:
                    # 값이 '5.12%'와 같은 문자열일 경우
                    yield_val = float(yield_value.replace("%", "").strip())
                elif isinstance(yield_value, (int, float)):
                    # 값이 5.12와 같은 숫자일 경우
                    yield_val = float(yield_value)
                else:
                    yield_val = 0.0

                item["yield"] = yield_val
        except (FileNotFoundError, ValueError, KeyError, AttributeError):
            item["yield"] = 0.0

    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_live_data, f, indent=2, ensure_ascii=False)
        print(
            f"\nSuccessfully generated {OUTPUT_FILE} with {len(all_live_data)} tickers."
        )
    except IOError as e:
        print(f"❌ Error writing to {OUTPUT_FILE}: {e}")


if __name__ == "__main__":
    main()
