# scripts\scraper_dividend.py
import json
import os
from datetime import datetime, timedelta


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

        before_date_target = ex_date - timedelta(days=1)
        current_check_date = before_date_target
        for _ in range(7):
            check_date_str = current_check_date.strftime("%Y-%m-%d")
            price_data_before = historical_prices_map.get(check_date_str)
            if price_data_before and price_data_before.get("close") is not None:
                prices["전일종가"] = f"${price_data_before['close']:.2f}"
                break
            current_check_date -= timedelta(days=1)

        after_date_target = ex_date + timedelta(days=1)
        current_check_date = after_date_target
        for _ in range(7):
            check_date_str = current_check_date.strftime("%Y-%m-%d")
            price_data_after = historical_prices_map.get(check_date_str)
            if price_data_after and price_data_after.get("close") is not None:
                prices["익일종가"] = f"${price_data_after['close']:.2f}"
                break
            current_check_date += timedelta(days=1)
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


if __name__ == "__main__":
    nav_file_path = "public/nav.json"
    data_dir = "public/data"
    DESIRED_KEY_ORDER = [
        "배당락",
        "배당금",
        "전일종가",
        "당일시가",
        "당일종가",
        "익일종가",
        "배당률",
    ]

    try:
        with open(nav_file_path, "r", encoding="utf-8") as f:
            ticker_list = json.load(f).get("nav", [])
    except FileNotFoundError:
        print(f"Error: {nav_file_path} not found.")
        exit()

    print("\n--- Starting Dividend History Update ---")
    total_changed_files = 0
    for item in ticker_list:
        ticker = item.get("symbol")
        if not ticker:
            continue
        file_path = os.path.join(data_dir, f"{ticker.lower()}.json")
        if not os.path.exists(file_path):
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            try:
                existing_data = json.load(f)
            except json.JSONDecodeError:
                continue

        prices_data = existing_data.get("backtestData", {}).get("prices", [])
        dividends_data = existing_data.get("backtestData", {}).get("dividends", [])
        if not dividends_data and not existing_data.get("dividendHistory"):
            print(f"  -> Skipping {ticker}: No dividend data available.")
            continue

        historical_prices_map = {p["date"]: p for p in prices_data}

        # 1. 기존 dividendHistory를 날짜 키 맵으로 변환 (사용자 데이터 보존)
        history_map = {
            h["배당락"]: h
            for h in existing_data.get("dividendHistory", [])
            if h.get("배당락")
        }

        # 2. backtestData.dividends를 순회하며 history_map을 업데이트
        for div in dividends_data:
            if "amount" not in div or not isinstance(div["amount"], (int, float)):
                continue

            ex_date_obj = datetime.strptime(div["date"], "%Y-%m-%d")
            ex_date_str = ex_date_obj.strftime("%y. %m. %d")

            # 3. 새로운 배당금 정보와 주가 정보를 함께 준비
            new_entry = {"배당락": ex_date_str, "배당금": f"${repr(div['amount'])}"}
            prices = get_historical_prices_from_data(ex_date_obj, historical_prices_map)
            new_entry.update(prices)

            # 4. 기존 항목이 있다면 그 위에 덮어쓰고, 없다면 새로 추가
            if ex_date_str in history_map:
                history_map[ex_date_str].update(new_entry)
            else:
                history_map[ex_date_str] = new_entry

        # 5. 최종 데이터 가공
        raw_final_history = list(history_map.values())
        history_with_yield = add_yield_to_history(raw_final_history)

        final_history = []
        for item in history_with_yield:
            ordered_item = {key: item[key] for key in DESIRED_KEY_ORDER if key in item}
            final_history.append(ordered_item)

        original_data_str = json.dumps(
            existing_data.get("dividendHistory", []), sort_keys=True
        )
        new_data_str = json.dumps(final_history, sort_keys=True)

        if original_data_str != new_data_str:
            existing_data["dividendHistory"] = final_history
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=4)
            print(f" => UPDATED Dividend History for {ticker}")
            total_changed_files += 1
        else:
            print(f"  -> No changes for {ticker}.")

    print(
        f"\n--- Dividend History Update Finished. Total files updated: {total_changed_files} ---"
    )
