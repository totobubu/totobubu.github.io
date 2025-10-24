# scripts\update_dividends.py
import os
import json
import yfinance as yf
from tqdm import tqdm
import pandas as pd

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")


def main():
    print("--- Starting Incremental Dividend & Split Update (Time-Series Mode) ---")
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

    print(
        f"Analyzing {len(active_symbols)} active tickers for dividend & split updates..."
    )

    try:
        data = yf.download(
            active_symbols, actions=True, progress=True, auto_adjust=True, period="max"
        )
        if data.empty:
            print("No data found from yfinance.")
            return

        # 'Dividends'와 'Stock Splits' 열이 있는지 확인
        has_dividends = "Dividends" in data.columns
        has_splits = "Stock Splits" in data.columns

        if not has_dividends and not has_splits:
            print("No dividend or split data columns found.")
            return

        all_actions_df = data
    except Exception as e:
        print(f"❌ Error fetching bulk action data from yfinance: {e}")
        return

    updated_count = 0
    for symbol in tqdm(active_symbols, desc="Merging dividend & split data"):
        try:
            sanitized_symbol = symbol.replace(".", "-").lower()
            file_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

            with open(file_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)

            backtest_data = existing_data.get("backtestData", [])
            backtest_map = {item["date"]: item for item in backtest_data}

            currency = ticker_info_map.get(symbol, {}).get(
                "currency", "KRW" if symbol.endswith((".KS", ".KQ")) else "USD"
            )
            original_backtest_data_str = json.dumps(backtest_data, sort_keys=True)

            # --- 배당금 병합 ---
            if has_dividends and symbol in all_actions_df["Dividends"].columns:
                symbol_dividends = all_actions_df["Dividends"][symbol][
                    all_actions_df["Dividends"][symbol] > 0
                ]
                for date, amount in symbol_dividends.items():
                    date_str = date.strftime("%Y-%m-%d")
                    new_amount = (
                        int(round(amount)) if currency == "KRW" else float(amount)
                    )
                    if date_str not in backtest_map:
                        backtest_map[date_str] = {"date": date_str}
                    backtest_map[date_str]["amount"] = new_amount

            # --- [핵심 추가] 액면 분할/병합 데이터 병합 ---
            if has_splits and symbol in all_actions_df["Stock Splits"].columns:
                symbol_splits = all_actions_df["Stock Splits"][symbol][
                    all_actions_df["Stock Splits"][symbol] > 0
                ]
                for date, ratio in symbol_splits.items():
                    date_str = date.strftime("%Y-%m-%d")
                    if date_str not in backtest_map:
                        backtest_map[date_str] = {"date": date_str}
                    # yfinance는 분할 후 1주가 몇 주가 되는지를 반환 (e.g., 2:1 분할 -> ratio=2.0)
                    # 이를 "numerator:denominator" 형식으로 변환 (e.g., "2:1")
                    # 병합은 1:2 -> ratio=0.5 -> "1:2"
                    if ratio > 1:  # 분할
                        backtest_map[date_str]["split"] = f"{int(ratio)}:1"
                    else:  # 병합 또는 역분할
                        backtest_map[date_str]["split"] = f"1:{int(1/ratio)}"
            # --- // ---

            final_backtest_data = sorted(backtest_map.values(), key=lambda x: x["date"])

            if original_backtest_data_str != json.dumps(
                final_backtest_data, sort_keys=True
            ):
                existing_data["backtestData"] = final_backtest_data
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(existing_data, f, indent=2, ensure_ascii=False)
                updated_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ Error processing {symbol}: {e}")

    print(
        f"\n--- Dividend & Split Merge Finished. Total files updated: {updated_count} ---"
    )


if __name__ == "__main__":
    main()
