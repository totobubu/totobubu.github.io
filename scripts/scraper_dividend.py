# scripts\scraper_dividend.py
import json
import os
from datetime import datetime, timedelta


def get_historical_prices_from_data(ex_date, historical_prices_map):
    prices = {}
    try:
        before_date_target = ex_date - timedelta(days=1)
        price_data_before = next(
            (
                v
                for k, v in sorted(historical_prices_map.items(), reverse=True)
                if k <= before_date_target.strftime("%Y-%m-%d")
            ),
            None,
        )
        if price_data_before and price_data_before.get("close") is not None:
            prices["전일종가"] = f"${price_data_before['close']:.2f}"

        price_data_on = historical_prices_map.get(ex_date.strftime("%Y-%m-%d"))
        if price_data_on:
            if price_data_on.get("open") is not None:
                prices["당일시가"] = f"${price_data_on['open']:.2f}"
            if price_data_on.get("close") is not None:
                prices["당일종가"] = f"${price_data_on['close']:.2f}"

        after_date_target = ex_date + timedelta(days=1)
        price_data_after = next(
            (
                v
                for k, v in sorted(historical_prices_map.items())
                if k >= after_date_target.strftime("%Y-%m-%d")
            ),
            None,
        )
        if price_data_after and price_data_after.get("close") is not None:
            prices["익일종가"] = f"${price_data_after['close']:.2f}"
    except Exception as e:
        print(f"     Price lookup error for {ex_date}: {e}")
    return prices


def add_yield_to_history(history, historical_prices_map):
    history_with_yield = []
    parsed_history = [
        {
            "date": datetime.strptime(item["배당락"].replace(" ", ""), "%y.%m.%d"),
            "data": item,
        }
        for item in history
    ]

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
                        for past_entry in parsed_history[i:]
                        if past_entry["date"] >= one_year_before
                    )
                    yield_rate = (dividends_in_past_year / opening_price) * 100
                    new_item["배당률"] = f"{yield_rate:.2f}%"
            except (ValueError, TypeError):
                pass
        history_with_yield.append(new_item)
    return history_with_yield


if __name__ == "__main__":
    nav_file_path = "public/nav.json"
    data_dir = "public/data"

    with open(nav_file_path, "r", encoding="utf-8") as f:
        ticker_list = json.load(f).get("nav", [])

    print("\n--- Starting Dividend History Update from Integrated Data Files ---")
    total_changed_files = 0
    for item in ticker_list:
        ticker = item.get("symbol")
        if not ticker:
            continue

        file_path = os.path.join(data_dir, f"{ticker.lower()}.json")
        if not os.path.exists(file_path):
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)

        if (
            "backtestData" not in existing_data
            or "dividends" not in existing_data["backtestData"]
        ):
            print(f"  -> Skipping {ticker}: No backtest dividend data found.")
            continue

        api_dividends = existing_data["backtestData"].get("dividends", [])
        historical_prices_list = existing_data["backtestData"].get("prices", [])
        historical_prices_map = {p["date"]: p for p in historical_prices_list}

        local_history = existing_data.get("dividendHistory", [])

        # [핵심 수정] 'amount' 키가 있는 유효한 데이터만 변환합니다.
        api_history_map = {
            (datetime.fromisoformat(div["date"])).strftime("%y. %m. %d"): {
                "배당금": f"${div['amount']:.4f}"
            }
            for div in api_dividends
            if "amount" in div and isinstance(div["amount"], (int, float))
        }

        local_history_map = {h["배당락"]: h for h in local_history}
        merged_history_map = {**api_history_map, **local_history_map}

        all_dates = sorted(
            list(merged_history_map.keys()),
            key=lambda x: datetime.strptime(x.replace(" ", ""), "%y.%m.%d"),
            reverse=True,
        )

        final_history = []
        for ex_date_str in all_dates:
            item_data = merged_history_map[ex_date_str]
            if "배당락" not in item_data:
                item_data["배당락"] = ex_date_str

            if "배당금" in item_data and "당일종가" not in item_data:
                ex_date_obj = datetime.strptime(
                    ex_date_str.replace(" ", ""), "%y.%m.%d"
                )
                prices = get_historical_prices_from_data(
                    ex_date_obj, historical_prices_map
                )
                item_data.update(prices)

            final_history.append(item_data)

        final_history_with_yield = add_yield_to_history(
            final_history, historical_prices_map
        )

        original_data_str = json.dumps(
            existing_data.get("dividendHistory", []), sort_keys=True
        )
        if original_data_str != json.dumps(final_history_with_yield, sort_keys=True):
            existing_data["dividendHistory"] = final_history_with_yield
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=2)
            print(f" => UPDATED Dividend History for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No changes for {ticker}.")

    print(
        f"\n--- Dividend History Update Finished. Total files updated: {total_changed_files} ---"
    )
