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
from concurrent.futures import ProcessPoolExecutor, as_completed
import os

# --- 경로 설정 및 상수 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")

# [개선] 함수 밖으로 이동하여 재사용
DESIRED_KEY_ORDER = [
    "배당락",
    "배당금",
    "배당률",
    "전일종가",
    "당일시가",
    "당일종가",
    "익일종가",
]


# ... get_historical_prices_from_data, add_yield_to_history 함수는 기존과 동일 ...
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
            prev_date = (ex_date - timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_before = historical_prices_map.get(prev_date)
            if price_data_before and price_data_before.get("close") is not None:
                close_price = price_data_before.get("close")
                prices["전일종가"] = (
                    f"{currency_symbol}{int(close_price):,}"
                    if currency == "KRW"
                    else f"{currency_symbol}{close_price:,.2f}"
                )
                break

        for days in range(1, 8):
            next_date = (ex_date + timedelta(days=days)).strftime("%Y-%m-%d")
            price_data_after = historical_prices_map.get(next_date)
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


def add_yield_to_history(history):
    history_with_yield = []
    # 배당락 기준으로 날짜 객체를 만들어 정렬
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
        new_item = current_entry["data"].copy()
        price_raw = new_item.get("_price_raw")
        dividend_raw = new_item.get("_dividend_raw")

        if price_raw and price_raw > 0 and dividend_raw is not None:
            try:
                current_date = current_entry["date"]
                one_year_before = current_date - timedelta(days=365)

                dividends_in_past_year = sum(
                    past_entry["data"].get("_dividend_raw", 0)
                    for past_entry in parsed_history[i::-1]  # 현재부터 과거까지 순회
                    if past_entry["date"] >= one_year_before
                )

                yield_rate = (dividends_in_past_year / price_raw) * 100
                new_item["배당률"] = f"{yield_rate:.2f}%"
            except (ValueError, TypeError):
                pass

        # [개선] 임시 키를 최종 결과에 포함시키지 않음
        new_item.pop("_price_raw", None)
        new_item.pop("_dividend_raw", None)
        history_with_yield.append(new_item)

    # 최종적으로 배당락일 최신순으로 다시 정렬하여 반환
    return sorted(
        history_with_yield,
        key=lambda x: datetime.strptime(x["배당락"].replace(" ", ""), "%y.%m.%d"),
        reverse=True,
    )


def process_ticker(item):
    """단일 티커에 대한 전체 처리 로직. 멀티프로세싱을 위해 분리됨."""
    ticker = item.get("symbol")
    currency = item.get("currency", "USD")

    file_path = os.path.join(DATA_DIR, f"{sanitize_ticker_for_filename(ticker)}.json")
    existing_data = load_json_file(file_path)
    if not existing_data:
        return (ticker, False, "No data file")

    prices_data = existing_data.get("backtestData", {}).get("prices", [])
    dividends_data = existing_data.get("backtestData", {}).get("dividends", [])
    if not dividends_data and not existing_data.get("dividendHistory"):
        return (ticker, False, "No dividend data")

    historical_prices_map = {p["date"]: p for p in prices_data}
    history_map = {
        h["배당락"]: h
        for h in existing_data.get("dividendHistory", [])
        if h.get("배당락")
    }

    for div in dividends_data:
        amount = div.get("amount")
        if amount is None or not isinstance(amount, (int, float)):
            continue

        ex_date_obj = datetime.strptime(div["date"], "%Y-%m-%d")
        ex_date_str = ex_date_obj.strftime("%y. %m. %d")
        entry = history_map.get(ex_date_str, {"배당락": ex_date_str})

        # 임시 raw 값 추가
        if "_dividend_raw" not in entry:
            entry["_dividend_raw"] = amount
            entry["배당금"] = format_currency(amount, currency)
        if "당일종가" not in entry:
            prices = get_historical_prices_from_data(
                ex_date_obj, historical_prices_map, currency
            )
            entry.update(prices)
            price_raw = parse_numeric_value(
                prices.get("당일시가") or prices.get("전일종가")
            )
            if price_raw:
                entry["_price_raw"] = price_raw
        history_map[ex_date_str] = entry

    raw_final_history = list(history_map.values())
    history_with_yield = add_yield_to_history(raw_final_history)

    final_history = [
        {
            key: item_data.get(key)
            for key in DESIRED_KEY_ORDER
            if item_data.get(key) is not None
        }
        for item_data in history_with_yield
    ]

    # [개선] 비교를 위해 기존 데이터를 정렬하여 일관성 유지
    original_history = sorted(
        existing_data.get("dividendHistory", []),
        key=lambda x: x.get("배당락", ""),
        reverse=True,
    )

    total_dividend = sum(
        parse_numeric_value(entry.get("배당금")) or 0 for entry in final_history
    )
    original_total = existing_data.get("dividendTotal")

    # 변경 여부 확인
    is_history_changed = json.dumps(original_history) != json.dumps(final_history)
    is_total_changed = not (
        original_total is not None and abs(original_total - total_dividend) < 1e-9
    )

    if is_history_changed or is_total_changed:
        existing_data["dividendHistory"] = final_history
        existing_data["dividendTotal"] = total_dividend
        if save_json_file(file_path, existing_data):
            return (
                ticker,
                True,
                f"Updated (Total: {format_currency(total_dividend, currency)})",
            )
    return (ticker, False, "No changes")


def main():
    nav_data = load_json_file(os.path.join(PUBLIC_DIR, "nav.json"))
    if not nav_data or "nav" not in nav_data:
        print("Error: public/nav.json not found or is invalid.")
        return

    print("\n--- Starting Dividend History Update & Total Calculation ---")

    # [핵심 수정 1] 배당주만 필터링
    tickers_to_process = [
        t
        for t in nav_data.get("nav", [])
        if t.get("symbol") and not t.get("upcoming") and t.get("frequency") is not None
    ]

    print(f"Found {len(tickers_to_process)} dividend-paying tickers to process.")

    total_changed_files = 0

    # [핵심 수정 2] 멀티프로세싱으로 병렬 처리
    # max_workers를 조절하여 CPU 사용률을 제어할 수 있습니다 (None이면 CPU 코어 수만큼 사용)
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        # 각 티커에 대한 작업을 제출
        futures = [executor.submit(process_ticker, item) for item in tickers_to_process]

        # tqdm으로 진행률 표시
        for future in tqdm(
            as_completed(futures),
            total=len(tickers_to_process),
            desc="Updating Dividend History",
        ):
            try:
                ticker, changed, message = future.result()
                if changed:
                    total_changed_files += 1
                    tqdm.write(f" => {ticker}: {message}")
            except Exception as e:
                # 개별 작업에서 발생한 오류 처리
                tqdm.write(f"  ❌ Error processing a ticker: {e}")

    print(
        f"\n--- Dividend Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
