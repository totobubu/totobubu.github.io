# scripts\scraper_dividend.py
import json
from datetime import datetime, timedelta
from utils import load_json_file, save_json_file, sanitize_ticker_for_filename


def get_historical_prices_from_data(ex_date, historical_prices_map):
    prices = {}
    try:
        target_date_str = ex_date.strftime("%Y-%m-%d")
        price_data_on = historical_prices_map.get(target_date_str)
        if price_data_on:
            if price_data_on.get("open") is not None:
                prices["당일시가"] = f"${price_data_on['open']:.2f}"
            if price_data_on.get("close") is not None:
                prices["당일종가"] = f"${price_data_on['close']:.2f}"

        for days_before in range(1, 8):
            check_date = ex_date - timedelta(days=days_before)
            price_data_before = historical_prices_map.get(
                check_date.strftime("%Y-%m-%d")
            )
            if price_data_before and price_data_before.get("close") is not None:
                prices["전일종가"] = f"${price_data_before['close']:.2f}"
                break

        for days_after in range(1, 8):
            check_date = ex_date + timedelta(days=days_after)
            price_data_after = historical_prices_map.get(
                check_date.strftime("%Y-%m-%d")
            )
            if price_data_after and price_data_after.get("close") is not None:
                prices["익일종가"] = f"${price_data_after['close']:.2f}"
                break
    except Exception as e:
        print(f"     Price lookup error for {ex_date.strftime('%Y-%m-%d')}: {e}")
    return prices


def add_yield_to_history(history):
    history_with_yield = []
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
        current_item = current_entry["data"]
        new_item = current_item.copy()
        opening_price_str = new_item.get("당일시가")
        if opening_price_str and opening_price_str != "N/A":
            try:
                opening_price = float(opening_price_str.replace("$", ""))
                if opening_price > 0:
                    current_date = current_entry["date"]
                    one_year_before = current_date - timedelta(days=365)
                    dividends_in_past_year = sum(
                        float(past_entry["data"].get("배당금", "$0").replace("$", ""))
                        for past_entry in parsed_history[i::-1]
                        if past_entry["date"] >= one_year_before
                    )
                    yield_rate = (dividends_in_past_year / opening_price) * 100
                    new_item["배당률"] = f"{yield_rate:.2f}%"
            except (ValueError, TypeError):
                pass
        history_with_yield.append(new_item)
    return sorted(
        history_with_yield,
        key=lambda x: datetime.strptime(x["배당락"].replace(" ", ""), "%y.%m.%d"),
        reverse=True,
    )


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("Error: public/nav.json not found or is invalid.")
        return

    print("\n--- Starting Dividend History Update & Total Calculation ---")

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    upcoming_count = len(all_tickers_info) - len(active_tickers_info)

    print(f"Found {len(all_tickers_info)} total tickers in nav.json.")
    if upcoming_count > 0:
        print(f"Skipping {upcoming_count} upcoming tickers.")

    total_changed_files = 0
    DESIRED_KEY_ORDER = [
        "배당락",
        "배당금",
        "전일종가",
        "당일시가",
        "당일종가",
        "익일종가",
        "배당률",
    ]

    for item in active_tickers_info:
        ticker = item.get("symbol")
        if not ticker:
            continue

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker)}.json"
        existing_data = load_json_file(file_path)
        if not existing_data:
            continue

        prices_data = existing_data.get("backtestData", {}).get("prices", [])
        dividends_data = existing_data.get("backtestData", {}).get("dividends", [])

        if not dividends_data and not existing_data.get("dividendHistory"):
            print(f"  -> Skipping {ticker}: No dividend data available.")
            continue

        historical_prices_map = {p["date"]: p for p in prices_data}
        history_map = {
            h["배당락"]: h
            for h in existing_data.get("dividendHistory", [])
            if h.get("배당락")
        }

        for div in dividends_data:
            if "amount" not in div or not isinstance(div["amount"], (int, float)):
                continue

            ex_date_obj = datetime.strptime(div["date"], "%Y-%m-%d")
            ex_date_str = ex_date_obj.strftime("%y. %m. %d")
            entry = history_map.get(ex_date_str, {"배당락": ex_date_str})

            if "배당금" not in entry:
                entry["배당금"] = f"${repr(div['amount'])}"
            if "당일종가" not in entry:
                prices = get_historical_prices_from_data(
                    ex_date_obj, historical_prices_map
                )
                entry.update(prices)
            history_map[ex_date_str] = entry

        raw_final_history = list(history_map.values())
        history_with_yield = add_yield_to_history(raw_final_history)
        final_history = [
            {key: item_data[key] for key in DESIRED_KEY_ORDER if key in item_data}
            for item_data in history_with_yield
        ]

        original_history_str = json.dumps(
            existing_data.get("dividendHistory", []), sort_keys=True
        )
        new_history_str = json.dumps(final_history, sort_keys=True)

        total_dividend = sum(
            float(entry.get("배당금", "$0").replace("$", ""))
            for entry in final_history
            if entry.get("배당금")
        )
        original_total = existing_data.get("dividendTotal")
        is_total_changed = not (
            original_total is not None and abs(original_total - total_dividend) < 1e-9
        )

        if original_history_str != new_history_str or is_total_changed:
            existing_data["dividendHistory"] = final_history
            existing_data["dividendTotal"] = total_dividend
            if save_json_file(file_path, existing_data):
                print(
                    f" => UPDATED Dividend History for {ticker} (Total: ${total_dividend:.4f})"
                )
                total_changed_files += 1
        else:
            print(f"  -> No changes for {ticker}.")

    print(
        f"\n--- Dividend Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
