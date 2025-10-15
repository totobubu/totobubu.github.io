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
    parse_numeric_value,
    format_currency,
    format_large_number,
    format_percent,
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
    try:
        if not info or info.get("regularMarketPrice") is None:
            return None
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        yield_val = (
            ((info.get("trailingAnnualDividendRate", 0) / current_price) * 100)
            if current_price and info.get("trailingAnnualDividendRate")
            else 0
        )
        earnings_ts = info.get("earningsTimestamp")
        earnings_date = (
            datetime.fromtimestamp(earnings_ts).strftime("%Y-%m-%d")
            if earnings_ts
            else "N/A"
        )
        fifty_two_week_range = (
            f"{info.get('fiftyTwoWeekLow')} - {info.get('fiftyTwoWeekHigh')}"
            if info.get("fiftyTwoWeekLow") and info.get("fiftyTwoWeekHigh")
            else "N/A"
        )
        return {
            "englishName": info.get("longName"),
            "earningsDate": earnings_date,
            "enterpriseValue": info.get("enterpriseValue"),
            "marketCap": info.get("marketCap"),
            "Volume": info.get("volume"),
            "AvgVolume": info.get("averageVolume"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "52Week": fifty_two_week_range,
            "Yield": yield_val if yield_val > 0 else 0,
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
        }
    except Exception:
        return None


def format_ticker_info(info_dict):
    currency = info_dict.get("currency", "USD")
    formatted = info_dict.copy()

    for key, value in formatted.items():
        if value is None:
            formatted[key] = "N/A"
            continue

        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding",
        ]:
            # [핵심 수정] format_large_number는 숫자만 반환, 통화 기호는 여기서 제어
            formatted_num = format_large_number(value)
            if formatted_num != "N/A":
                if currency == "KRW":
                    formatted[key] = f"{formatted_num} ₩"
                else:
                    # USD의 경우, format_currency를 사용하여 기호와 숫자를 함께 포맷팅
                    # (단, 축약된 숫자가 아니므로 큰 숫자는 쉼표만 붙음)
                    formatted[key] = format_currency(value, "USD")
            else:
                formatted[key] = "N/A"

        elif key == "dividendRate":
            formatted[key] = format_currency(value, currency)
        elif key == "payoutRatio":
            formatted[key] = format_percent(value)
        elif key == "Yield":
            formatted[key] = (
                f"{value:.2f}%"
                if isinstance(value, (int, float)) and value > 0
                else "N/A"
            )
        elif key == "52Week" and value != "N/A":
            try:
                low, high = map(float, value.split(" - "))
                formatted[key] = (
                    f"{format_currency(low, currency)} - {format_currency(high, currency)}"
                )
            except (ValueError, TypeError):
                formatted[key] = "N/A"
    return formatted


def calculate_changes(new_formatted, old_formatted):
    changes_obj = {}
    if not old_formatted:
        return changes_obj
    new_update_date = new_formatted.get("Update", "").split(" ")[0]
    old_update_date = old_formatted.get("Update", "").split(" ")[0]
    if new_update_date != old_update_date:
        for key, new_val in new_formatted.items():
            old_val = old_formatted.get(key)
            if old_val is None or key in [
                "changes",
                "Update",
                "Symbol",
                "longName",
                "koName",
                "englishName",
                "company",
                "frequency",
                "group",
                "underlying",
                "market",
                "currency",
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
        return old_formatted.get("changes", {})
    return changes_obj


def are_dicts_equal(dict1, dict2):
    keys1 = set(dict1.keys())
    keys2 = set(dict2.keys())
    if keys1 != keys2:
        return False
    for key in keys1:
        val1, val2 = dict1.get(key), dict2.get(key)
        if isinstance(val1, float) and isinstance(val2, float):
            if abs(val1 - val2) > 1e-9:
                return False
        elif val1 != val2:
            return False
    return True


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        return

    print("\n--- Starting Daily Ticker Info Update ---")
    active_tickers_from_nav = [
        item
        for item in nav_data.get("nav", [])
        if item.get("symbol") and not item.get("upcoming")
    ]
    if not active_tickers_from_nav:
        return

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
    now_kst = get_kst_now()
    for info_from_nav in tqdm(
        active_tickers_from_nav, desc="Processing and Saving Data"
    ):
        ticker_symbol = info_from_nav.get("symbol")
        raw_dynamic_info = all_bulk_info.get(ticker_symbol)
        dynamic_info = process_single_ticker_info(raw_dynamic_info)
        if not dynamic_info:
            continue

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_raw_info = existing_data.get("tickerInfoRaw", {})

        new_raw_info = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),
            "longName": info_from_nav.get("longName") or info_from_nav.get("koName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
            "market": info_from_nav.get("market"),
            "currency": info_from_nav.get("currency"),
        }
        new_raw_info.update(dynamic_info)
        if not new_raw_info.get("longName"):
            new_raw_info["longName"] = new_raw_info.get("englishName")

        # 비교 시에는 비교에 불필요한 키를 제외한 두 원본 딕셔너리를 비교
        compare_old = {
            k: v for k, v in old_raw_info.items() if k not in ["Update", "englishName"]
        }
        compare_new = {
            k: v for k, v in new_raw_info.items() if k not in ["Update", "englishName"]
        }

        if are_dicts_equal(compare_old, compare_new):
            continue

        old_formatted_info = existing_data.get("tickerInfo", {})

        new_raw_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
        new_formatted_info = format_ticker_info(
            new_raw_info.copy()
        )  # 원본 보존을 위해 복사본 전달
        new_formatted_info["changes"] = calculate_changes(
            new_formatted_info, old_formatted_info
        )

        existing_data["tickerInfoRaw"] = new_raw_info
        existing_data["tickerInfo"] = new_formatted_info

        if save_json_file(file_path, existing_data, indent=2):
            total_changed_files += 1

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
