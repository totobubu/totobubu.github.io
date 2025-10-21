# scripts\update_dividends.py
import os
import json
import yfinance as yf
from datetime import datetime
from tqdm import tqdm
import pandas as pd

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")


def main():
    print("--- Starting Incremental Dividend Update (Time-Series Mode) ---")
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        return

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    ticker_info_map = {t["symbol"]: t for t in active_tickers_info}
    active_symbols = list(ticker_info_map.keys())

    print(f"Analyzing {len(active_symbols)} active tickers for dividend updates...")

    # yfinance에서 모든 티커의 배당 정보를 한 번에 가져옴
    try:
        data = yf.download(
            active_symbols, actions=True, progress=True, auto_adjust=True, period="max"
        )
        if data.empty or "Dividends" not in data.columns:
            print("No dividend data found from yfinance.")
            return
        all_dividends_df = data["Dividends"]
    except Exception as e:
        print(f"❌ Error fetching bulk dividend data from yfinance: {e}")
        return

    updated_count = 0
    for symbol in tqdm(active_symbols, desc="Merging dividend data"):
        try:
            sanitized_symbol = symbol.replace(".", "-").lower()
            file_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

            with open(file_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)

            backtest_data = existing_data.get("backtestData", [])
            backtest_map = {item["date"]: item for item in backtest_data}

            currency = ticker_info_map.get(symbol, {}).get("currency", "USD")
            # 원본 데이터를 복사하여 비교용으로 보관
            original_backtest_data_str = json.dumps(backtest_data, sort_keys=True)

            if symbol in all_dividends_df.columns:
                symbol_dividends = all_dividends_df[symbol][
                    all_dividends_df[symbol] > 0
                ]

                for date, amount in symbol_dividends.items():
                    date_str = date.strftime("%Y-%m-%d")
                    new_amount = (
                        int(round(amount)) if currency == "KRW" else float(amount)
                    )

                    if date_str not in backtest_map:
                        backtest_map[date_str] = {"date": date_str}

                    # [핵심] amount 필드는 항상 최신 yfinance 값으로 업데이트
                    # amountFixed가 있더라도 amount는 자동 수집 값으로 유지
                    backtest_map[date_str]["amount"] = new_amount

            final_backtest_data = sorted(backtest_map.values(), key=lambda x: x["date"])

            # 변경 사항이 있을 때만 저장
            if original_backtest_data_str != json.dumps(
                final_backtest_data, sort_keys=True
            ):
                existing_data["backtestData"] = final_backtest_data
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(existing_data, f, indent=2, ensure_ascii=False)
                updated_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ Error processing {symbol}: {e}")

    print(f"\n--- Dividend Merge Finished. Total files updated: {updated_count} ---")

if __name__ == "__main__":
    main()