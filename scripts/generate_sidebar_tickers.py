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
POPULARITY_FILE_PATH = os.path.join(PUBLIC_DIR, "popularity.json")
SIDEBAR_DIR = os.path.join(PUBLIC_DIR, "sidebar")

# 각 카테고리별 설정
CATEGORIES = {
    "us-etfs": {
        "file": "sidebar-tickers-us-etfs.json",
        "filter": lambda t: t.get("currency") == "USD" and t.get("isEtf") == True,
    },
    "us-stocks": {
        "file": "sidebar-tickers-us-stocks.json",
        "filter": lambda t: t.get("currency") == "USD" and not t.get("isEtf"),
    },
    "kr-etfs": {
        "file": "sidebar-tickers-kr-etfs.json",
        "filter": lambda t: t.get("currency") == "KRW" and t.get("isEtf") == True,
    },
    "kr-stocks": {
        "file": "sidebar-tickers-kr-stocks.json",
        "filter": lambda t: t.get("currency") == "KRW" and not t.get("isEtf"),
    },
}

MAX_TICKERS = 50  # 각 카테고리당 최대 티커 수
POPULARITY_LIMIT = 20  # popularity 기준 상위 티커 수


def enrich_ticker_data(ticker_info):
    """ticker 정보에 data 파일의 정보를 추가합니다."""
    symbol = ticker_info.get("symbol")
    day_order = {"월": 1, "화": 2, "수": 3, "목": 4, "금": 5}
    
    file_path = os.path.join(DATA_DIR, f"{sanitize_ticker_for_filename(symbol)}.json")
    data_file_content = load_json_file(file_path)

    market_cap_raw = None
    yield_val = None
    price = None

    if data_file_content and "tickerInfo" in data_file_content:
        info = data_file_content["tickerInfo"]
        market_cap_raw = info.get("marketCap")
        yield_val = info.get("Yield")
        price = info.get("regularMarketPrice")

    return {
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
        "isEtf": ticker_info.get("isEtf"),
        "popularity": 0,  # 나중에 업데이트됨
    }


def select_top_tickers(all_tickers, popularity_dict):
    """
    popularity 상위 20개 + marketCap 상위 30개를 선택하여 총 50개 반환
    popularity가 20개 미만이면 marketCap으로 50개까지 채움
    """
    # popularity 값 업데이트
    for ticker in all_tickers:
        symbol = ticker["symbol"]
        ticker["popularity"] = popularity_dict.get(symbol, 0)

    # popularity가 있는 티커들을 popularity 순으로 정렬
    popular_tickers = [t for t in all_tickers if t["popularity"] > 0]
    popular_tickers.sort(key=lambda x: x["popularity"], reverse=True)

    # 상위 20개 선택 (없으면 있는 만큼만)
    top_popular = popular_tickers[:POPULARITY_LIMIT]
    selected_symbols = {t["symbol"] for t in top_popular}

    # 나머지 티커들 (popularity에 포함되지 않은 것들)
    remaining_tickers = [t for t in all_tickers if t["symbol"] not in selected_symbols]

    # marketCap 순으로 정렬
    remaining_tickers.sort(key=lambda x: (x.get("marketCap") or 0), reverse=True)

    # 50개가 될 때까지 추가
    needed = MAX_TICKERS - len(top_popular)
    top_by_marketcap = remaining_tickers[:needed]

    # 결합
    result = top_popular + top_by_marketcap

    return result


def main():
    print("--- Starting to generate category-specific sidebar ticker files ---")

    # nav.json 로드
    nav_data = load_json_file(NAV_FILE_PATH)
    if not nav_data or "nav" not in nav_data:
        print("❌ Error: nav.json not found or is invalid.")
        return

    # popularity.json 로드
    popularity_dict = load_json_file(POPULARITY_FILE_PATH) or {}
    print(f"✓ Loaded {len(popularity_dict)} popularity entries")

    all_tickers_from_nav = nav_data.get("nav", [])

    # 모든 티커 데이터 enrichment
    print("\n📊 Enriching ticker data...")
    all_enriched_tickers = []
    for ticker_info in tqdm(all_tickers_from_nav, desc="Processing tickers"):
        symbol = ticker_info.get("symbol")
        if not symbol or ticker_info.get("upcoming"):
            continue
        
        enriched = enrich_ticker_data(ticker_info)
        all_enriched_tickers.append(enriched)

    # 카테고리별로 처리
    print("\n📂 Generating category-specific files...")
    for category_name, config in CATEGORIES.items():
        print(f"\n  Processing {category_name}...")
        
        # 카테고리에 맞는 티커 필터링
        category_tickers = [t for t in all_enriched_tickers if config["filter"](t)]
        print(f"    - Total tickers in category: {len(category_tickers)}")

        # 상위 50개 선택
        top_tickers = select_top_tickers(category_tickers, popularity_dict)
        print(f"    - Selected top {len(top_tickers)} tickers")
        
        # popularity 있는 티커 수 카운트
        popular_count = sum(1 for t in top_tickers if t["popularity"] > 0)
        print(f"    - Popular tickers: {popular_count}")
        print(f"    - MarketCap-based tickers: {len(top_tickers) - popular_count}")

        # 파일 저장
        output_path = os.path.join(SIDEBAR_DIR, config["file"])
        save_json_file(output_path, top_tickers)
        print(f"    ✓ Saved to {config['file']}")

    print(
        f"\n🎉 Successfully generated all sidebar ticker files!"
    )


if __name__ == "__main__":
    main()
