# REFACTORED: scripts\update_dividends.py
import yfinance as yf
import time
from utils import load_json_file, save_json_file, sanitize_ticker_for_filename


def update_dividend_data_for_ticker(symbol, retries=3, delay=5):
    file_path = f"public/data/{sanitize_ticker_for_filename(symbol)}.json"

    for attempt in range(retries):
        try:
            data = load_json_file(file_path)
            if data is None:
                print(f"- Skipping {symbol}: Data file not found.")
                return False

            ticker = yf.Ticker(symbol)
            dividends_df = ticker.dividends

            new_dividends = []
            if not dividends_df.empty:
                for date, amount in dividends_df.items():
                    new_dividends.append(
                        {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
                    )

            if "backtestData" not in data:
                data["backtestData"] = {}
            data["backtestData"]["dividends"] = new_dividends

            if save_json_file(file_path, data, indent=2):
                print(
                    f"✅ [{symbol}] Dividend data updated. Found {len(new_dividends)} records."
                )
            return True

        except Exception as e:
            print(f"❌ [{symbol}] Attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                print(f"❌ [{symbol}] All retries failed. Skipping.")
                return False
    return False


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print(
            "Error: public/nav.json not found. Please run 'npm run generate-nav' first."
        )
        return

    active_symbols = [
        item["symbol"] for item in nav_data["nav"] if not item.get("upcoming")
    ]
    symbols_to_update = list(set(active_symbols + ["SPY"]))

    print(
        f"--- Starting Dividend Data Update (Python/yfinance) for {len(symbols_to_update)} symbols ---"
    )

    success_count = sum(
        1 for symbol in symbols_to_update if update_dividend_data_for_ticker(symbol)
    )

    print(
        f"\nUpdate complete. Success: {success_count}, Failure: {len(symbols_to_update) - success_count}"
    )


if __name__ == "__main__":
    main()
