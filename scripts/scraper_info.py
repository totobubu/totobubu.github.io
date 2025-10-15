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
        fifty_two_week_range = "N/A"
        if info.get("fiftyTwoWeekLow") and info.get("fiftyTwoWeekHigh"):
            fifty_two_week_range = (
                f"{info.get('fiftyTwoWeekLow')} - {info.get('fiftyTwoWeekHigh')}"
            )
        return {
            "longName": info.get("longName"),
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


def format_ticker_info(info_dict, currency="USD"):
    formatted = info_dict.copy()
    currency_symbol = "₩" if currency == "KRW" else "$"
    for key, value in formatted.items():
        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding",
        ]:
            formatted_num = format_large_number(value)
            if formatted_num != "N/A":
                formatted[key] = (
                    f"{formatted_num}{' ₩' if currency == 'KRW' else ''}".strip()
                )
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
                if currency == "KRW":
                    formatted[key] = (
                        f"{currency_symbol}{int(low):,} - {currency_symbol}{int(high):,}"
                    )
                else:
                    formatted[key] = (
                        f"{currency_symbol}{low:,.2f} - {currency_symbol}{high:,.2f}"
                    )
            except (ValueError, TypeError):
                formatted[key] = "N/A"
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
        return old_info.get("changes", {})
    return changes_obj


def are_dicts_equal(dict1, dict2):
    ignore_keys = {"Update", "changes"}
    keys1 = {k for k in dict1 if k not in ignore_keys}
    keys2 = {k for k in dict2 if k not in ignore_keys}
    if keys1 != keys2:
        return False
    for key in keys1:
        val1, val2 = dict1.get(key), dict2.get(key)
        num1 = parse_numeric_value(val1)
        num2 = parse_numeric_value(val2)
        if num1 is not None and num2 is not None:
            if abs(num1 - num2) > 1e-6:
                return False
        elif str(val1) != str(val2):
            return False
    return True


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("!!! Error: public/nav.json not found.")
        return

    print("\n--- Starting Daily Ticker Info Update ---")
    active_tickers_from_nav = [
        item
        for item in nav_data.get("nav", [])
        if item.get("symbol") and not item.get("upcoming")
    ]
    if not active_tickers_from_nav:
        print("No active tickers to update.")
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
            time.sleep(2)

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
        old_ticker_info = existing_data.get("tickerInfo", {})

        new_info_base = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),
            "longName": info_from_nav.get(
                "longName"
            ),  # [수정] longName은 nav.json에서 직접 가져옴
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
            "market": info_from_nav.get("market"),  # [핵심 수정] market 정보 추가
            "currency": info_from_nav.get("currency"),  # [핵심 수정] currency 정보 추가
        }
        if dynamic_info:
            # yfinance의 longName은 englishName으로 별도 저장
            if dynamic_info.get("longName"):
                new_info_base["englishName"] = dynamic_info.pop("longName")
            # nav.json에 longName이 없는 경우에만 englishName으로 채움
            if not new_info_base.get("longName"):
                new_info_base["longName"] = new_info_base.get("englishName")

            new_info_base.update(
                {k: v for k, v in dynamic_info.items() if v is not None}
            )

        # [핵심 수정] 비교는 포맷팅 전 원본 데이터끼리 수행
        old_comparable_raw = old_ticker_info.copy()
        for key in [
            "Update",
            "changes",
            "Yield",
            "payoutRatio",
            "dividendRate",
            "52Week",
            "sharesOutstanding",
            "AvgVolume",
            "Volume",
            "marketCap",
            "enterpriseValue",
        ]:
            old_comparable_raw.pop(key, None)
        new_comparable_raw = new_info_base.copy()
        for key in [
            "Yield",
            "payoutRatio",
            "dividendRate",
            "52Week",
            "sharesOutstanding",
            "AvgVolume",
            "Volume",
            "marketCap",
            "enterpriseValue",
        ]:
            new_comparable_raw.pop(key, None)

        if json.dumps(old_comparable_raw, sort_keys=True) == json.dumps(
            new_comparable_raw, sort_keys=True
        ):
            # 숫자 데이터만 따로 비교
            if are_dicts_equal(old_ticker_info, new_info_base):
                continue

        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
        formatted_info = format_ticker_info(
            final_ticker_info, final_ticker_info.get("currency")
        )
        formatted_info["changes"] = calculate_changes(formatted_info, old_ticker_info)

        existing_data["tickerInfo"] = formatted_info
        if save_json_file(file_path, existing_data, indent=2):
            total_changed_files += 1

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
