import yfinance as yf
import json
import os
from datetime import datetime

DATA_DIR = "public/data"
NAV_FILE_PATH = "public/nav.json"


def update_dividend_data(symbol):
    file_path = os.path.join(DATA_DIR, f"{symbol.lower()}.json")

    try:
        if not os.path.exists(file_path):
            print(f"- Skipping {symbol}: Data file not found.")
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        ticker = yf.Ticker(symbol)
        # yfinance는 배당락일(ex-dividend date)을 반환합니다.
        # 실제 지급일은 보통 며칠~몇 주 뒤지만, 백테스팅에서는 배당락일 기준 재투자가 더 일반적입니다.
        # 여기서는 배당락일=지급일로 간주하고 저장합니다.
        dividends_df = ticker.dividends

        if dividends_df.empty:
            print(f"- No dividend data found for {symbol}.")
            return True

        new_dividends = []
        for date, amount in dividends_df.items():
            new_dividends.append(
                {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
            )

        # yfinance는 전체 기간을 가져오므로, 항상 덮어쓰기
        if "backtestData" not in data:
            data["backtestData"] = {}

        data["backtestData"]["dividends"] = new_dividends

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(
            f"✅ [${symbol}] Dividend data updated successfully. Found ${len(new_dividends)} records."
        )
        return True

    except Exception as e:
        print(f"❌ [${symbol}] Failed to update dividend data: {e}")
        return False


if __name__ == "__main__":
    with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
        nav_data = json.load(f)

    active_symbols = [
        item["symbol"] for item in nav_data["nav"] if not item.get("upcoming")
    ]
    symbols_to_update = list(set(active_symbols + ["SPY"]))

    print(
        f"--- Starting Dividend Data Update using yfinance for ${len(symbols_to_update)} symbols ---"
    )

    success_count = 0
    for symbol in symbols_to_update:
        if update_dividend_data(symbol):
            success_count += 1

    print(
        f"\nUpdate complete. Success: ${success_count}, Failure: ${len(symbols_to_update) - success_count}"
    )
