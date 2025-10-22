# scripts/scraper_info.py
import time
import json
import yfinance as yf
from datetime import datetime
from tqdm import tqdm
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    get_kst_now,
)


def fetch_bulk_ticker_info_batch(ticker_symbols_batch):
    bulk_data = {}
    try:
        tickers = yf.Tickers(ticker_symbols_batch)
        for symbol, ticker_obj in tickers.tickers.items():
            try:
                bulk_data[symbol] = ticker_obj.info
            except Exception:
                bulk_data[symbol] = None
        return bulk_data
    except Exception as e:
        print(f"  -> Critical error during batch fetch: {e}")
        return {symbol: None for symbol in ticker_symbols_batch}


def process_single_ticker_info(info):
    if not info or info.get("regularMarketPrice") is None:
        return None

    current_price = info.get("regularMarketPrice") or info.get("previousClose")
    yield_val = (
        (info.get("trailingAnnualDividendRate", 0) / current_price)
        if current_price and info.get("trailingAnnualDividendRate")
        else None
    )

    earnings_ts = info.get("earningsTimestamp")
    earnings_date = (
        datetime.fromtimestamp(earnings_ts).strftime("%Y-%m-%d")
        if earnings_ts
        else None
    )

    fifty_two_week_range = (
        f"{info.get('fiftyTwoWeekLow')} - {info.get('fiftyTwoWeekHigh')}"
        if info.get("fiftyTwoWeekLow") and info.get("fiftyTwoWeekHigh")
        else None
    )

    return {
        "regularMarketPrice": info.get("regularMarketPrice"),
        "englishName": info.get("longName"),
        "earningsDate": earnings_date,
        "enterpriseValue": info.get("enterpriseValue"),
        "marketCap": info.get("marketCap"),
        "Volume": info.get("volume"),
        "AvgVolume": info.get("averageVolume"),
        "sharesOutstanding": info.get("sharesOutstanding"),
        "52Week": fifty_two_week_range,
        "Yield": yield_val,
        "dividendRate": info.get("dividendRate"),
        "payoutRatio": info.get("payoutRatio"),
    }


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data:
        return

    print("\n--- Starting Daily Ticker Info Update (RAW DATA) ---")
    active_tickers_from_nav = [
        item for item in nav_data.get("nav", []) if not item.get("upcoming")
    ]
    active_symbols = [item["symbol"] for item in active_tickers_from_nav]

    batch_size = 100
    all_bulk_info = {}
    for i in tqdm(
        range(0, len(active_symbols), batch_size),
        desc="Fetching All Ticker Info in Batches",
    ):
        batch = active_symbols[i : i + batch_size]
        batch_info = fetch_bulk_ticker_info_batch(batch)
        all_bulk_info.update(batch_info)
        if i + batch_size < len(active_symbols):
            time.sleep(1)

    total_changed_files = 0
    now_kst_str = get_kst_now().strftime("%Y-%m-%d %H:%M:%S KST")

    for info_from_nav in tqdm(
        active_tickers_from_nav, desc="Processing Raw Ticker Info"
    ):
        ticker_symbol = info_from_nav.get("symbol")
        raw_dynamic_info = all_bulk_info.get(ticker_symbol)
        dynamic_info = process_single_ticker_info(raw_dynamic_info)
        if not dynamic_info:
            continue

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_info = existing_data.get("tickerInfo", {})

        new_info = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),
            "longName": info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
            "market": info_from_nav.get("market"),
            "currency": info_from_nav.get("currency"),
            "Update": now_kst_str,
        }
        new_info.update(dynamic_info)

        changes = {}
        if (
            old_info
            and old_info.get("Update", "").split(" ")[0] != now_kst_str.split(" ")[0]
        ):
            for key, new_val in dynamic_info.items():
                old_val = old_info.get(key)
                if old_val is not None and isinstance(new_val, (int, float)):
                    if new_val > old_val:
                        changes[key] = {"value": old_val, "change": "up"}
                    elif new_val < old_val:
                        changes[key] = {"value": old_val, "change": "down"}
        elif old_info:
            changes = old_info.get("changes", {})
        new_info["changes"] = changes

        compare_old = {
            k: v for k, v in old_info.items() if k not in ["Update", "changes"]
        }
        compare_new = {
            k: v for k, v in new_info.items() if k not in ["Update", "changes"]
        }

        if json.dumps(compare_old, sort_keys=True) == json.dumps(
            compare_new, sort_keys=True
        ):
            continue

        existing_data["tickerInfo"] = new_info
        if save_json_file(file_path, existing_data):
            total_changed_files += 1

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
