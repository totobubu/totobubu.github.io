# scripts/generate_sidebar_tickers.py
import os
import json
from tqdm import tqdm
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
)


ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")
OUTPUT_FILE = os.path.join(PUBLIC_DIR, "sidebar-tickers.json")


def main():
    print("--- Starting to generate rich sidebar-tickers.json from data files ---")

    nav_data = load_json_file(NAV_FILE_PATH)

    if not nav_data or "nav" not in nav_data:
        print("❌ Error: nav.json not found or is invalid.")
        return

    all_tickers_from_nav = nav_data.get("nav", [])
    sidebar_tickers = []
    day_order = {"월": 1, "화": 2, "수": 3, "목": 4, "금": 5}

    for ticker_info in tqdm(all_tickers_from_nav, desc="Aggregating all sidebar data"):
        symbol = ticker_info.get("symbol")
        if not symbol or ticker_info.get("upcoming"):
            continue

        file_path = os.path.join(
            DATA_DIR, f"{sanitize_ticker_for_filename(symbol)}.json"
        )
        data_file_content = load_json_file(file_path)

        market_cap_raw = None
        yield_val = None
        price = None

        if data_file_content and "tickerInfo" in data_file_content:
            info = data_file_content["tickerInfo"]
            market_cap_raw = info.get("marketCap")
            yield_val = info.get("Yield")
            price = info.get("regularMarketPrice")

        sidebar_tickers.append(
            {
                "symbol": symbol,
                "koName": ticker_info.get("koName"),
                "longName": ticker_info.get("longName"),
                "company": ticker_info.get("company"),
                "logo": ticker_info.get("logo"),
                "frequency": ticker_info.get("frequency"),
                "group": ticker_info.get("group"),
                "yield": yield_val,
                "price": price,
                "groupOrder": day_order.get(ticker_info.get("group"), 999),
                "currency": ticker_info.get("currency"),
                "underlying": ticker_info.get("underlying"),
                "market": ticker_info.get("market"),
                "marketCap": market_cap_raw,
                "popularity": 0,  # popularity.json은 별도 파이프라인에서 처리
            }
        )

    sidebar_tickers.sort(key=lambda x: (x.get("marketCap") or 0), reverse=True)

    save_json_file(OUTPUT_FILE, sidebar_tickers)

    print(
        f"\n🎉 Successfully generated sidebar-tickers.json with {len(sidebar_tickers)} tickers."
    )


if __name__ == "__main__":
    main()
