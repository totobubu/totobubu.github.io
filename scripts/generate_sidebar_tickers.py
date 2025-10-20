import os
import json
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
    print("--- Starting to generate rich sidebar-tickers.json from data files ---")

    nav_data = load_json_file(NAV_FILE_PATH)
    popularity_data = load_json_file(POPULARITY_FILE_PATH) or {}

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

        market_cap_raw = None  # [수정] 기본값을 0이 아닌 None으로
        yield_val = "N/A"
        price = None

        if data_file_content and "tickerInfo" in data_file_content:
            info = data_file_content["tickerInfo"]
            market_cap_raw = info.get("marketCap")  # 순수 숫자 또는 None
            yield_val = info.get("Yield", "N/A")
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
                "popularity": popularity_data.get(symbol, 0),
            }
        )

    # [핵심 수정] 정렬 키에서 .get()의 기본값을 사용하여 None을 0으로 처리
    sidebar_tickers.sort(
        key=lambda x: (x.get("popularity", 0), x.get("marketCap") or 0), reverse=True
    )

    save_json_file(OUTPUT_FILE, sidebar_tickers)

    print(
        f"\n🎉 Successfully generated sidebar-tickers.json with {len(sidebar_tickers)} tickers."
    )


if __name__ == "__main__":
    main()
