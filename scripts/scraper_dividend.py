# scripts\scraper_dividend.py
import json
from datetime import datetime, timedelta
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    parse_numeric_value,
    format_currency,
)
from tqdm import tqdm


def get_historical_prices_from_data(ex_date, historical_prices_map, currency="USD"):
    prices = {}
    try:
        # [핵심 수정] 모든 가격 포맷팅을 format_currency 함수에 위임
        target_date_str = ex_date.strftime("%Y-%m-%d")
        price_data_on = historical_prices_map.get(target_date_str)
        if price_data_on:
            if price_data_on.get("open") is not None:
                prices["당일시가"] = format_currency(
                    price_data_on.get("open"), currency
                )
            if price_data_on.get("close") is not None:
                prices["당일종가"] = format_currency(
                    price_data_on.get("close"), currency
                )

        for days in range(1, 8):
            prev_date_str = (ex_date - timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_before = historical_prices_map.get(prev_date_str)
            if price_data_before and price_data_before.get("close") is not None:
                prices["전일종가"] = format_currency(
                    price_data_before.get("close"), currency
                )
                break

        for days in range(1, 8):
            next_date_str = (ex_date + timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_after = historical_prices_map.get(next_date_str)
            if price_data_after and price_data_after.get("close") is not None:
                prices["익일종가"] = format_currency(
                    price_data_after.get("close"), currency
                )
                break
    except Exception as e:
        print(f"     Price lookup error: {e}")
    return prices


def calculate_yields(history):
    if not history:
        return []

    parsed_history = sorted(
        [
            {
                "date": datetime.strptime(item["배당락"].replace(" ", ""), "%y.%m.%d"),
                "data": item,
            }
            for item in history
            if item.get("배당락")
        ],
        key=lambda x: x["date"],
    )

    for i, current_entry in enumerate(parsed_history):
        item = current_entry["data"]
        price_raw = item.get("_price_raw")
        dividend_raw = item.get("_dividend_raw")

        if price_raw and price_raw > 0 and dividend_raw is not None:
            one_year_before = current_entry["date"] - timedelta(days=365)
            dividends_in_past_year = sum(
                past_entry["data"].get("_dividend_raw", 0)
                for past_entry in parsed_history[i::-1]
                if past_entry["date"] >= one_year_before
            )
            yield_rate = (dividends_in_past_year / price_raw) * 100
            item["배당률"] = f"{yield_rate:.2f}%"

    return sorted(
        history,
        key=lambda x: datetime.strptime(x["배당락"].replace(" ", ""), "%y.%m.%d"),
        reverse=True,
    )


def process_ticker(item, DESIRED_KEY_ORDER):
    ticker = item.get("symbol")
    currency = item.get("currency", "USD")
    if not ticker:
        return False

    file_path = f"public/data/{sanitize_ticker_for_filename(ticker)}.json"
    existing_data = load_json_file(file_path)
    if not existing_data:
        return False

    prices_data = existing_data.get("backtestData", {}).get("prices", [])
    dividends_data = existing_data.get("backtestData", {}).get("dividends", [])
    original_history = existing_data.get("dividendHistory", [])

    historical_prices_map = {p["date"]: p for p in prices_data}
    history_map = {h["배당락"]: h for h in original_history if h.get("배당락")}

    if dividends_data:
        for div in dividends_data:
            amount = div.get("amount")
            if amount is None:
                continue

            ex_date_obj = datetime.strptime(div["date"], "%Y-%m-%d")
            ex_date_str = ex_date_obj.strftime("%y. %m. %d")

            if ex_date_str not in history_map:
                history_map[ex_date_str] = {
                    "배당락": ex_date_str,
                    "배당금": format_currency(amount, currency),
                }

    for ex_date_str, entry in history_map.items():
        if "당일종가" not in entry and "전일종가" not in entry:
            try:
                ex_date_obj = datetime.strptime(
                    ex_date_str.replace(" ", ""), "%y.%m.%d"
                )
                prices, raw_prices = get_historical_prices_from_data(
                    ex_date_obj, historical_prices_map, currency
                )
                entry.update(prices)
                entry["_price_raw"] = raw_prices.get("open_raw") or raw_prices.get(
                    "prev_close_raw"
                )
            except ValueError:
                continue
        else:
            entry["_price_raw"] = parse_numeric_value(
                entry.get("당일시가") or entry.get("전일종가")
            )

        entry["_dividend_raw"] = parse_numeric_value(entry.get("배당금"))

    history_with_yield = calculate_yields(list(history_map.values()))
    final_history = [
        {
            key: item_data.get(key)
            for key in DESIRED_KEY_ORDER
            if item_data.get(key) is not None
        }
        for item_data in history_with_yield
    ]

    original_history_str = json.dumps(
        original_history, sort_keys=True, ensure_ascii=False
    )
    new_history_str = json.dumps(final_history, sort_keys=True, ensure_ascii=False)

    if original_history_str != new_history_str:
        total_dividend = sum(parse_numeric_value(entry.get("배당금")) or 0 for entry in final_history)
        
        # [핵심 수정] dividendTotal을 정수로 저장 (KRW인 경우)
        if currency == "KRW":
            existing_data["dividendTotal"] = int(total_dividend)
        else:
            existing_data["dividendTotal"] = total_dividend
            
        existing_data["dividendHistory"] = final_history
        if save_json_file(file_path, existing_data):
            tqdm.write(f" => UPDATED Dividend History for {ticker} (Total: {format_currency(total_dividend, currency)})")
            return True
    return False

def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("Error: public/nav.json not found or is invalid.")
        return

    print("\n--- Starting Dividend History Update & Total Calculation ---")
    active_tickers_info = [
        t for t in nav_data.get("nav", []) if t.get("symbol") and not t.get("upcoming")
    ]
    total_changed_files = 0
    DESIRED_KEY_ORDER = [
        "배당락",
        "배당금",
        "배당률",
        "전일종가",
        "당일시가",
        "당일종가",
        "익일종가",
    ]

    for item in tqdm(active_tickers_info, desc="Updating Dividend History"):
        if process_ticker(item, DESIRED_KEY_ORDER):
            total_changed_files += 1

    print(
        f"\n--- Dividend Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
