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
    try:
        if not info or info.get("regularMarketPrice") is None:
            return None
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        # [수정] trailingAnnualDividendRate가 None일 경우 0으로 처리
        yield_val = (
            ((info.get("trailingAnnualDividendRate") or 0 / current_price) * 100)
            if current_price
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
            # [핵심 수정] format_large_number에 currency를 전달하여 올바른 단위로 축약
            formatted_num = format_large_number(value, currency)
            if formatted_num != "N/A":
                # 통화 기호는 항상 앞에 붙임
                currency_symbol = "₩" if currency == "KRW" else "$"
                formatted[key] = f"{currency_symbol}{formatted_num}"
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


def calculate_changes(new_raw, old_raw):
    """순수 숫자 데이터를 기반으로 변경 사항을 계산합니다."""
    changes_obj = {}
    if not old_raw:
        return {}

    try:
        new_dt = datetime.strptime(new_raw.get("Update", "").split(" ")[0], "%Y-%m-%d")
        old_dt = datetime.strptime(old_raw.get("Update", "").split(" ")[0], "%Y-%m-%d")
        if (new_dt - old_dt).days < 1:
            return old_raw.get("changes", {})
    except (ValueError, TypeError):  # 날짜 파싱 실패 시 변경사항 새로 계산
        pass

    for key, new_val in new_raw.items():
        old_val = old_raw.get(key)
        if old_val is None or not isinstance(new_val, (int, float)):
            continue

        change_status = "equal"
        if new_val > old_val:
            change_status = "up"
        elif new_val < old_val:
            change_status = "down"

        if change_status != "equal":
            changes_obj[key] = {"value": old_val, "change": change_status}

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
            "longName": info_from_nav.get("longName") or info_from_nav.get("koName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
            "market": info_from_nav.get("market"),
            "currency": info_from_nav.get("currency"),
        }
        new_info.update(dynamic_info)
        new_info["Update"] = now_kst_str

        # changes 계산 및 보존
        changes = {}
        if (
            old_info
            and old_info.get("Update", "").split(" ")[0] != now_kst_str.split(" ")[0]
        ):
            for key, new_val in new_info.items():
                old_val = old_info.get(key)
                if old_val is not None and isinstance(new_val, (int, float)):
                    if new_val > old_val:
                        changes[key] = {"value": old_val, "change": "up"}
                    elif new_val < old_val:
                        changes[key] = {"value": old_val, "change": "down"}
        elif old_info:
            changes = old_info.get("changes", {})
        new_info["changes"] = changes

        # 변경 여부 확인
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
