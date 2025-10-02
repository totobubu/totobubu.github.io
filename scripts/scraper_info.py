# REFACTORED: scripts/scraper_info.py
import time
import json
import yfinance as yf
from datetime import datetime
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    get_kst_now,
    parse_numeric_value,
    format_currency,
    format_large_number,
    format_percent
)

def fetch_dynamic_ticker_info(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        yield_val = (
            ((info.get("trailingAnnualDividendRate", 0) / current_price) * 100)
            if current_price
            else 0
        )
        earnings_ts = info.get("earningsTimestamp")
        earnings_date = (
            datetime.fromtimestamp(earnings_ts).strftime('%Y-%m-%d')
            if earnings_ts
            else "N/A"
        )

        return {
            "longName": info.get("longName"),
            "earningsDate": earnings_date,
            "enterpriseValue": info.get("enterpriseValue"),
            "marketCap": info.get("marketCap"),
            "Volume": info.get("volume"),
            "AvgVolume": info.get("averageVolume"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "52Week": (
                f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}"
                if info.get("fiftyTwoWeekLow")
                else "N/A"
            ),
            "Yield": yield_val if yield_val > 0 else 0,
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
        }
    except Exception as e:
        print(f"  -> Failed to fetch dynamic info for {ticker_symbol}: {e}")
        return None

def format_ticker_info(info_dict):
    formatted = info_dict.copy()
    for key, value in formatted.items():
        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding"
        ]:
            formatted[key] = format_large_number(value)
        elif key == "dividendRate":
            formatted[key] = format_currency(value)
        elif key == "payoutRatio":
            formatted[key] = format_percent(value)
        elif key == "Yield":
            formatted[key] = (
                f"{value:.2f}%"
                if isinstance(value, (int, float)) and value > 0
                else "N/A"
            )
    return formatted

def calculate_changes(new_info, old_info):
    changes_obj = {}
    if not old_info:
        return changes_obj

    new_update_date = new_info.get("Update", "").split(" ")[0]
    old_update_date = old_info.get("Update", "").split(" ")[0]

    if new_update_date != old_update_date:
        for key, new_val in new_info.items():
            old_val = old_info.get(key)
            if old_val is None or key in [
                "changes",
                "Update",
                "Symbol",
                "longName",
                "company",
                "frequency",
                "group",
                "underlying"
            ]:
                continue
            
            new_numeric, old_numeric = parse_numeric_value(
                new_val
            ), parse_numeric_value(old_val)
            change_status = "equal"
            if new_numeric is not None and old_numeric is not None:
                if new_numeric > old_numeric:
                    change_status = "up"
                elif new_numeric < old_numeric:
                    change_status = "down"
            elif str(new_val) != str(old_val):
                change_status = "up"
            
            if change_status != "equal":
                changes_obj[key] = {"value": old_val, "change": change_status}
    else:
        return old_info.get("changes", {})
    return changes_obj

def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("!!! Error: public/nav.json not found.")
        return

    print("\n--- Starting Daily Ticker Info Update ---")
    total_changed_files = 0
    now_kst = get_kst_now()

    for info_from_nav in nav_data.get("nav", []):
        ticker_symbol = info_from_nav.get("symbol")
        if not ticker_symbol:
            continue
        
        if info_from_nav.get("upcoming"):
            print(f"  -> Skipping {ticker_symbol}: Marked as 'upcoming'.")
            continue

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_ticker_info = existing_data.get("tickerInfo", {})

        dynamic_info = fetch_dynamic_ticker_info(ticker_symbol)
        if not dynamic_info:
            print(f"  -> Skipping update for {ticker_symbol} (fetch failed).")
            continue

        new_info_base = {
            "Symbol": ticker_symbol,
            "longName": info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
        }
        new_info_base.update({k: v for k, v in dynamic_info.items() if v is not None})

        old_comparable = old_ticker_info.copy()
        old_comparable.pop("Update", None)
        old_comparable.pop("changes", None)

        if json.dumps(old_comparable, sort_keys=True, default=str) == json.dumps(
            new_info_base, sort_keys=True, default=str
        ):
            print(f"  -> No data changes for {ticker_symbol}. Skipping file write.")
            continue

        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
        formatted_info = format_ticker_info(final_ticker_info)
        formatted_info["changes"] = calculate_changes(formatted_info, old_ticker_info)
        
        existing_data["tickerInfo"] = formatted_info
        if save_json_file(file_path, existing_data, indent=2):
            print(f" => UPDATED Ticker Info for {ticker_symbol}")
            total_changed_files += 1
        
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---")

if __name__ == "__main__":
    main()