# REFACTORED: scripts/generate_live_data.py

import json
import yfinance as yf
import math  # <--- [핵심 추가 1] math 라이브러리를 임포트합니다.
from utils import load_json_file, save_json_file, get_yfinance_ticker


def generate_live_data():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("Error: public/nav.json not found or is invalid.")
        return

    active_tickers_info = [
        item for item in nav_data.get("nav", []) if not item.get("upcoming")
    ]

    tickers_for_yf = [
        get_yfinance_ticker(item["symbol"], item.get("market"))
        for item in active_tickers_info
    ]

    print("--- Starting Live Data Generation ---")
    print(f"Found {len(tickers_for_yf)} active tickers to fetch.")

    try:
        data = yf.download(tickers=tickers_for_yf, period="1d", progress=True)
        if data.empty:
            print("No data downloaded. Exiting.")
            return

        live_data = []
        close_prices = data.get("Close")  # .get()을 사용하여 'Close'가 없는 경우에 대비

        # close_prices가 Series (티커 1개) 또는 DataFrame (티커 여러개)일 수 있음
        is_single_ticker = "Series" in str(type(close_prices))

        for item in active_tickers_info:
            original_symbol = item["symbol"]
            yf_ticker = get_yfinance_ticker(original_symbol, item.get("market"))

            price = None
            try:
                if is_single_ticker:
                    if yf_ticker == close_prices.name:  # 이름이 일치하는지 확인
                        price = close_prices.iloc[-1]
                elif close_prices is not None and yf_ticker in close_prices.columns:
                    price = close_prices[yf_ticker].iloc[-1]
            except (KeyError, IndexError):
                price = None  # 데이터프레임에 해당 티커가 없거나 데이터가 없는 경우

            # --- [핵심 수정 2] ---
            # yfinance.utils.is_nan(price) 대신 math.isnan(price)를 사용합니다.
            # 또한, price 자체가 None일 경우도 체크해야 합니다.
            if price is not None and not math.isnan(price):
                live_data.append({"symbol": original_symbol, "price": float(price)})
            # --- // ---

        if save_json_file("public/live-data.json", live_data, indent=2):
            print(
                f"\nSuccessfully generated public/live-data.json with {len(live_data)} tickers."
            )

    except Exception as e:
        print(f"\nAn error occurred during yfinance download: {e}")


if __name__ == "__main__":
    generate_live_data()
