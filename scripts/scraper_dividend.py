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
    currency_symbol = "₩" if currency == "KRW" else "$"
    try:
        target_date_str = ex_date.strftime("%Y-%m-%d")
        price_data_on = historical_prices_map.get(target_date_str)
        if price_data_on:
            open_price, close_price = price_data_on.get("open"), price_data_on.get(
                "close"
            )
            if open_price is not None:
                prices["당일시가"] = (
                    f"{currency_symbol}{int(open_price):,}"
                    if currency == "KRW"
                    else f"{currency_symbol}{open_price:,.2f}"
                )
            if close_price is not None:
                prices["당일종가"] = (
                    f"{currency_symbol}{int(close_price):,}"
                    if currency == "KRW"
                    else f"{currency_symbol}{close_price:,.2f}"
                )

        for days in range(1, 8):
            prev_date_str = (ex_date - timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_before = historical_prices_map.get(prev_date_str)
            if price_data_before and price_data_before.get("close") is not None:
                close_price = price_data_before.get("close")
                prices["전일종가"] = (
                    f"{currency_symbol}{int(close_price):,}"
                    if currency == "KRW"
                    else f"{currency_symbol}{close_price:,.2f}"
                )
                break

        for days in range(1, 8):
            next_date_str = (ex_date + timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_after = historical_prices_map.get(next_date_str)
            if price_data_after and price_data_after.get("close") is not None:
                close_price = price_data_after.get("close")
                prices["익일종가"] = (
                    f"{currency_symbol}{int(close_price):,}"
                    if currency == "KRW"
                    else f"{currency_symbol}{close_price:,.2f}"
                )
                break
    except Exception as e:
        print(f"     Price lookup error for {ex_date.strftime('%Y-%m-%d')}: {e}")
    return prices


def calculate_yields(history):
    if not history:
        return []

    # 날짜 객체로 변환하여 시간순으로 정렬 (오래된 -> 최신)
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
        price_raw = parse_numeric_value(item.get("당일시가") or item.get("전일종가"))
        dividend_raw = parse_numeric_value(item.get("배당금"))

        if price_raw and price_raw > 0 and dividend_raw is not None:
            one_year_before = current_entry["date"] - timedelta(days=365)

            # 1년간의 배당금 합계 계산
            dividends_in_past_year = sum(
                parse_numeric_value(past_entry["data"].get("배당금", "0"))
                for past_entry in parsed_history[i::-1]
                if past_entry["date"] >= one_year_before
            )

            yield_rate = (dividends_in_past_year / price_raw) * 100
            item["배당률"] = f"{yield_rate:.2f}%"

    # 최종적으로 다시 최신순으로 정렬하여 반환
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

    # 1. dividendHistory를 기준으로 삼아 Map 생성 (데이터 보존)
    history_map = {h["배당락"]: h for h in original_history if h.get("배당락")}

    # 2. backtestData.dividends를 순회하며 history_map에 없는 새로운 배당만 추가
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

    # 3. 모든 배당 항목을 순회하며 비어있는 가격 정보만 채워넣기
    historical_prices_map = {p["date"]: p for p in prices_data}
    for ex_date_str, entry in history_map.items():
        if "당일종가" not in entry and "전일종가" not in entry:
            try:
                ex_date_obj = datetime.strptime(
                    ex_date_str.replace(" ", ""), "%y.%m.%d"
                )
                prices = get_historical_prices_from_data(
                    ex_date_obj, historical_prices_map, currency
                )
                entry.update(prices)
            except ValueError:
                continue

    # 4. 배당률 계산
    updated_history_list = calculate_yields(list(history_map.values()))

    # 5. 키 순서 정리
    final_history = [
        {
            key: item_data.get(key)
            for key in DESIRED_KEY_ORDER
            if item_data.get(key) is not None
        }
        for item_data in updated_history_list
    ]

    # 6. 변경 여부 최종 확인 후 저장
    original_history_str = json.dumps(original_history, sort_keys=True)
    new_history_str = json.dumps(final_history, sort_keys=True)

    if original_history_str != new_history_str:
        total_dividend = sum(
            parse_numeric_value(entry.get("배당금")) or 0 for entry in final_history
        )
        existing_data["dividendHistory"] = final_history
        existing_data["dividendTotal"] = total_dividend
        if save_json_file(file_path, existing_data):
            tqdm.write(
                f" => UPDATED Dividend History for {ticker} (Total: {format_currency(total_dividend, currency)})"
            )
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
