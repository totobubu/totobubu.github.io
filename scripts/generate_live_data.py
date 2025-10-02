# NEW FILE: scripts/generate_live_data.py

import yfinance as yf
import json
import time
from utils import load_json_file, save_json_file

def fetch_live_data_batch(tickers):
    """yfinance를 사용해 여러 티커의 실시간 데이터를 일괄적으로 가져옵니다."""
    try:
        data = yf.download(tickers, period="1d", progress=False)
        if data.empty:
            return {}
        
        # yfinance는 단일/복수 티커에 따라 다른 데이터 구조를 반환할 수 있음
        # 일관성을 위해 항상 동일한 구조로 처리
        latest_prices = data['Close'].iloc[-1]
        previous_prices = data['Close'].iloc[-2] if len(data) > 1 else latest_prices
        
        results = {}
        for ticker in tickers:
            try:
                # 단일 티커일 경우 Series, 복수 티커일 경우 latest_prices[ticker]
                price = latest_prices if isinstance(latest_prices, float) else latest_prices.get(ticker)
                prev_price = previous_prices if isinstance(previous_prices, float) else previous_prices.get(ticker)

                if price is not None and prev_price is not None and prev_price > 0:
                    change_percent = ((price - prev_price) / prev_price) * 100
                    results[ticker] = {
                        "symbol": ticker,
                        "price": float(price),
                        "yield": float(change_percent) # 프론트엔드 호환성을 위해 'yield' 사용
                    }
            except (KeyError, TypeError):
                # 해당 티커 데이터가 없는 경우 무시
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
        print("No active tickers found.")
        return

    print(f"Found {len(active_tickers)} active tickers to fetch.")
    
    all_live_data = []
    batch_size = 100 # 한 번에 100개 티커씩 요청
    
    for i in range(0, len(active_tickers), batch_size):
        batch = active_tickers[i:i+batch_size]
        print(f"Fetching batch {i//batch_size + 1}...")
        live_data_batch = fetch_live_data_batch(batch)
        all_live_data.extend(live_data_batch.values())
        time.sleep(1) # API 요청 간 딜레이

    output_path = "public/live-data.json"
    if save_json_file(output_path, all_live_data, indent=None):
         print(f"🎉 Successfully generated {output_path} with {len(all_live_data)} tickers.")

if __name__ == "__main__":
    main()