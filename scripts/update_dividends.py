# scripts\update_dividends.py
import os
import json
import yfinance as yf
from datetime import datetime, timedelta
from tqdm import tqdm
import pandas as pd

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")


def format_dividends(dividends_series):
    """yfinance에서 받은 pandas Series를 JSON 형식에 맞는 리스트로 변환합니다."""
    if dividends_series.empty:
        return []
    return [
        {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
        for date, amount in dividends_series.items()
    ]


def main():
    print("--- Starting Incremental Dividend Data Update (Python/yfinance) ---")

    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: nav.json not found at {NAV_FILE_PATH}")
        return

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    upcoming_count = len(all_tickers_info) - len(active_tickers_info)

    print(f"Found {len(all_tickers_info)} total tickers in nav.json.")
    if upcoming_count > 0:
        print(f"Skipping {upcoming_count} upcoming tickers.")

    success_count = 0
    fail_count = 0
    failed_symbols = []

    for ticker_info in tqdm(active_tickers_info, desc="Updating Dividends"):
        symbol = ticker_info["symbol"]
        sanitized_symbol = symbol.replace(".", "-").lower()
        json_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

        existing_data = {}
        existing_dividends = []
        start_date = datetime.strptime(
            ticker_info.get("ipoDate", "1990-01-01"), "%Y-%m-%d"
        )

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                dividends_list = existing_data.get("backtestData", {}).get(
                    "dividends", []
                )
                if dividends_list:
                    existing_dividends = dividends_list
                    last_dividend_date_str = max(d["date"] for d in dividends_list)
                    last_date = datetime.strptime(last_dividend_date_str, "%Y-%m-%d")
                    start_date = last_date + timedelta(days=1)

        except (FileNotFoundError, json.JSONDecodeError, ValueError):
            tqdm.write(
                f"- [{symbol}] No existing valid data. Fetching full history from {start_date.strftime('%Y-%m-%d')}."
            )

        try:
            if start_date.date() > datetime.now().date():
                tqdm.write(
                    f"  - [{symbol}] Dividend data is already up to date. Skipping fetch."
                )
                success_count += 1
                continue

            ticker = yf.Ticker(symbol)
            all_dividends_series = ticker.dividends

            if not all_dividends_series.empty:
                # [핵심 수정] 시작 날짜와 yfinance 날짜 인덱스를 모두 UTC로 통일하여 비교합니다.
                start_date_utc = pd.to_datetime(start_date).tz_localize("UTC")
                dividends_index_utc = all_dividends_series.index.tz_convert("UTC")

                new_dividends_series = all_dividends_series[
                    dividends_index_utc >= start_date_utc
                ]
            else:
                new_dividends_series = all_dividends_series

            if new_dividends_series.empty:
                tqdm.write(
                    f"  - [{symbol}] No new dividends found since {start_date.strftime('%Y-%m-%d')}."
                )
                success_count += 1
                continue

            new_dividends = format_dividends(new_dividends_series)

            combined_dividends_map = {div["date"]: div for div in existing_dividends}
            for div in new_dividends:
                combined_dividends_map[div["date"]] = div

            final_dividends = sorted(
                combined_dividends_map.values(), key=lambda x: x["date"]
            )

            if "backtestData" not in existing_data:
                existing_data["backtestData"] = {}
            existing_data["backtestData"]["dividends"] = final_dividends

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, indent=2)

            tqdm.write(
                f"  ✅ [{symbol}] Updated with {len(new_dividends)} new dividend records."
            )
            success_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ [{symbol}] Failed to fetch/update dividend data: {e}")
            fail_count += 1
            failed_symbols.append(symbol)

    print("\n--- Dividend Update Summary ---")
    print(f"Success: {success_count}")
    print(f"Failure: {fail_count}")
    if failed_symbols:
        print(f"Failed symbols: {', '.join(failed_symbols)}")


if __name__ == "__main__":
    main()
