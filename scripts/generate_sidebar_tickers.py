import os
import json
import yfinance as yf
import pandas as pd
from tqdm import tqdm
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    parse_numeric_value,
)

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")
POPULARITY_FILE_PATH = os.path.join(PUBLIC_DIR, "popularity.json")
OUTPUT_FILE = os.path.join(PUBLIC_DIR, "sidebar-tickers.json")


def main():
    print(
        "--- Starting to generate rich sidebar-tickers.json (including live prices) ---"
    )

    nav_data = load_json_file(NAV_FILE_PATH)
    popularity_data = load_json_file(POPULARITY_FILE_PATH) or {}

    if not nav_data or "nav" not in nav_data:
        print("❌ Error: nav.json not found or is invalid.")
        return

    active_tickers_info = [
        t
        for t in nav_data.get("nav", [])
        if t.get("symbol") and not t.get("upcoming", False)
    ]

    # 1. 실시간 주가 일괄 조회
    active_symbols = [t["symbol"] for t in active_tickers_info]
    print(f"Fetching live prices for {len(active_symbols)} active tickers...")
    price_data = yf.download(
        active_symbols, period="1d", progress=True, auto_adjust=True
    )

    live_prices = {}
    if not price_data.empty and "Close" in price_data:
        last_prices = price_data["Close"].iloc[-1]
        live_prices = {
            ticker: price for ticker, price in last_prices.items() if pd.notna(price)
        }
    print(f"  -> Successfully fetched prices for {len(live_prices)} tickers.")

    # 2. 모든 정보를 종합하여 최종 데이터 생성
    sidebar_tickers = []
    day_order = {"월": 1, "화": 2, "수": 3, "목": 4, "금": 5}

    for ticker_info in tqdm(active_tickers_info, desc="Aggregating all sidebar data"):
        symbol = ticker_info.get("symbol")
        if not symbol:
            continue

        file_path = os.path.join(
            DATA_DIR, f"{sanitize_ticker_for_filename(symbol)}.json"
        )
        data_file_content = load_json_file(file_path)

        market_cap = 0
        yield_val_raw = 0.0

        if data_file_content and "tickerInfo" in data_file_content:
            info = data_file_content["tickerInfo"]
            market_cap_raw = info.get("marketCap")  # 순수 숫자
            market_cap = market_cap_raw if market_cap_raw is not None else 0
            yield_val_raw = info.get("Yield", 0.0)  # 순수 숫자 (비율)

        sidebar_tickers.append(
            {
                "symbol": symbol,
                "koName": ticker_info.get("koName"),
                "longName": ticker_info.get("longName"),
                "company": ticker_info.get("company"),
                "logo": ticker_info.get("logo"),
                "frequency": ticker_info.get("frequency"),
                "group": ticker_info.get("group"),
                "yield": (
                    f"{yield_val_raw:.2f}%"
                    if isinstance(yield_val_raw, (int, float)) and yield_val_raw > 0
                    else "N/A"
                ),
                "price": live_prices.get(symbol),  # [핵심] 실시간 주가 추가
                "groupOrder": day_order.get(ticker_info.get("group"), 999),
                "currency": ticker_info.get("currency"),
                "underlying": ticker_info.get("underlying"),
                "market": ticker_info.get("market"),
                "marketCap": market_cap,
                "popularity": popularity_data.get(symbol, 0),
            }
        )

    # 최종 정렬
    sidebar_tickers.sort(
        key=lambda x: (x.get("popularity", 0), x.get("marketCap", 0), x["symbol"]),
        reverse=True,
    )

    save_json_file(OUTPUT_FILE, sidebar_tickers)

    print(
        f"\n🎉 Successfully generated single rich sidebar-tickers.json with {len(sidebar_tickers)} tickers."
    )


if __name__ == "__main__":
    main()
