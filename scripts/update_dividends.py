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


def main():
    print("--- Starting Incremental Dividend Data Update (Batch Mode) ---")
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: nav.json not found at {NAV_FILE_PATH}")
        return

    all_tickers_info = nav_data.get("nav", [])

    # [핵심 수정 1] 배당이 있을 가능성이 있는 티커만 필터링
    # upcoming이 아니고, (frequency가 null이 아니거나 or 아직 frequency가 설정되지 않은 티커)
    dividend_tickers_info = [
        t
        for t in all_tickers_info
        if not t.get("upcoming", False) and t.get("frequency") is not None
    ]

    print(
        f"Found {len(all_tickers_info)} total tickers. Analyzing {len(dividend_tickers_info)} potential dividend tickers."
    )

    # 각 티커별로 필요한 시작 날짜를 미리 계산
    tickers_to_fetch = {}
    for ticker_info in dividend_tickers_info:
        symbol = ticker_info["symbol"]
        sanitized_symbol = symbol.replace(".", "-").lower()
        json_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")
        start_date = datetime.strptime(
            ticker_info.get("ipoDate", "1990-01-01"), "%Y-%m-%d"
        ).date()

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                dividends_list = existing_data.get("backtestData", {}).get(
                    "dividends", []
                )
                if dividends_list:
                    last_dividend_date_str = max(d["date"] for d in dividends_list)
                    last_date = datetime.strptime(
                        last_dividend_date_str, "%Y-%m-%d"
                    ).date()
                    start_date = last_date + timedelta(days=1)
        except (FileNotFoundError, json.JSONDecodeError, ValueError):
            pass  # 파일이 없으면 ipoDate 기준

        if start_date <= datetime.now().date():
            tickers_to_fetch[symbol] = start_date

    if not tickers_to_fetch:
        print("All dividend data is up to date. Nothing to fetch.")
        return

    print(f"Found {len(tickers_to_fetch)} tickers that need dividend updates.")

    # [핵심 수정 2] 배치 처리
    batch_size = 100
    ticker_list = list(tickers_to_fetch.keys())
    all_new_dividends = {}

    for i in tqdm(
        range(0, len(ticker_list), batch_size), desc="Fetching Dividend Batches"
    ):
        batch_symbols = ticker_list[i : i + batch_size]
        start_date_for_batch = min(tickers_to_fetch[s] for s in batch_symbols)

        try:
            # yf.download을 사용하여 배당금('Dividends')만 가져옴
            data = yf.download(
                batch_symbols,
                start=start_date_for_batch,
                actions=True,  # dividends, splits 포함
                progress=False,
                auto_adjust=True,  # FutureWarning 방지
            )

            if not data.empty and "Dividends" in data:
                dividends_df = data["Dividends"]
                for symbol in batch_symbols:
                    # 각 티커의 배당 데이터 추출 (0 이상인 것만)
                    symbol_dividends = dividends_df[symbol][dividends_df[symbol] > 0]
                    if not symbol_dividends.empty:
                        all_new_dividends[symbol] = symbol_dividends
        except Exception as e:
            tqdm.write(f"  ❌ Error in batch starting with {batch_symbols[0]}: {e}")

    # [핵심 수정 3] 파일 저장 로직
    success_count = 0
    fail_count = 0
    failed_symbols = []

    for ticker_info in tqdm(dividend_tickers_info, desc="Saving Dividend Data"):
        symbol = ticker_info["symbol"]
        if symbol not in tickers_to_fetch:  # 업데이트가 필요 없는 티커는 건너뜀
            success_count += 1
            continue

        try:
            sanitized_symbol = symbol.replace(".", "-").lower()
            json_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

            existing_data = {}
            existing_dividends = []
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                    existing_dividends = existing_data.get("backtestData", {}).get(
                        "dividends", []
                    )
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            new_dividends_series = all_new_dividends.get(symbol)

            if new_dividends_series is None or new_dividends_series.empty:
                # tqdm.write(f"  - [{symbol}] No new dividends found.")
                success_count += 1
                continue

            new_dividends = [
                {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
                for date, amount in new_dividends_series.items()
            ]

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
            tqdm.write(f"  ❌ [{symbol}] Failed to save dividend data: {e}")
            fail_count += 1
            failed_symbols.append(symbol)

    print("\n--- Dividend Update Summary ---")
    print(f"Success: {success_count}")
    print(f"Failure: {fail_count}")
    if failed_symbols:
        print(f"Failed symbols: {', '.join(failed_symbols)}")


if __name__ == "__main__":
    main()
