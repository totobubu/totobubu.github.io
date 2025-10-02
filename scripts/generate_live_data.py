# REFACTORED: scripts/generate_live_data.py
import yfinance as yf
import json
import time
from utils import load_json_file, save_json_file

def fetch_live_data_batch(tickers):
    if not tickers:
        return {}
    try:
        data = yf.download(tickers, period="1d", progress=False)
        if data.empty:
            return {}
        
        latest_prices = data['Close'].iloc[-1]
        previous_prices = data['Close'].iloc[-2] if len(data) > 1 else latest_prices
        
        results = {}
        for ticker in tickers:
            try:
                price = latest_prices if isinstance(latest_prices, (float, int)) else latest_prices.get(ticker)
                prev_price = previous_prices if isinstance(previous_prices, (float, int)) else previous_prices.get(ticker)

                if price is not None and prev_price is not None and prev_price > 0:
                    change_percent = ((price - prev_price) / prev_price) * 100
                    results[ticker] = {
                        "symbol": ticker,
                        "price": float(price),
                        "yield": float(change_percent)
                    }
            except (KeyError, TypeError):
                continue
        return results
    except Exception as e:
        print(f"  -> yfinance batch fetch error: {e}")
        return {}


def main():
    print("\n--- Starting Live Data Generation ---")
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("Error: public/nav.json not found or is invalid.")
        return

    active_tickers = [item["symbol"] for item in nav_data.get("nav", []) if not item.get("upcoming")]
    
    if not active_tickers:
        print("No active tickers to fetch.")
        save_json_file("public/live-data.json", [], indent=None)
        return

    print(f"Found {len(active_tickers)} active tickers to fetch.")
    
    all_live_data = []
    batch_size = 100
    
    for i in range(0, len(active_tickers), batch_size):
        batch = active_tickers[i:i+batch_size]
        print(f"Fetching batch {i//batch_size + 1}/{ (len(active_tickers) + batch_size - 1) // batch_size }...")
        live_data_batch = fetch_live_data_batch(batch)
        all_live_data.extend(live_data_batch.values())
        time.sleep(1)

    output_path = "public/live-data.json"
    if save_json_file(output_path, all_live_data, indent=None):
         print(f"🎉 Successfully generated {output_path} with {len(all_live_data)} tickers.")

if __name__ == "__main__":
    main()