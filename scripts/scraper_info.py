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
    """지정된 티커 묶음(batch)의 정보를 yfinance를 통해 가져옵니다."""
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
    """yfinance에서 받은 단일 티커의 info 객체를 처리합니다."""
    try:
        if not info or info.get("regularMarketPrice") is None:
            return None
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
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

        # [수정] 52Week 필드에서 통화 기호($) 제거하고 순수 숫자 문자열만 반환
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
    """데이터를 최종 디스플레이 형식(통화 기호, 축약 등)으로 변환합니다."""
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
                # [수정] KRW인 경우에만 뒤에 통화 기호 추가 (USD는 format_currency가 처리)
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
    """두 딕셔너리가 동일한지 비교하는 함수"""
    # 비교에서 제외할 키 목록
    ignore_keys = {"Update", "changes"}

    keys1 = set(dict1.keys()) - ignore_keys
    keys2 = set(dict2.keys()) - ignore_keys

    if keys1 != keys2:
        return False

    for key in keys1:
        # 부동소수점 비교를 위한 처리
        val1, val2 = dict1[key], dict2[key]
        if isinstance(val1, float) and isinstance(val2, float):
            if abs(val1 - val2) > 1e-9:  # 작은 오차는 무시
                return False
        elif val1 != val2:
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

        # 1. nav.json과 yfinance의 원본(raw) 데이터를 합쳐 새로운 베이스 생성
        new_info_base = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),
            "longName": info_from_nav.get("koName") or info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
            "market": info_from_nav.get("market"),
            "currency": info_from_nav.get("currency"),
        }
        if dynamic_info:
            if dynamic_info.get("longName"):
                new_info_base["englishName"] = dynamic_info.pop("longName")
                if not new_info_base.get("longName"):
                    new_info_base["longName"] = new_info_base["englishName"]
            new_info_base.update(
                {k: v for k, v in dynamic_info.items() if v is not None}
            )

        # 2. 새로 생성된 데이터를 최종 포맷으로 변환
        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
        formatted_info = format_ticker_info(
            final_ticker_info, final_ticker_info.get("currency")
        )

        # 3. 새로운 포맷팅된 정보와 이전 포맷팅된 정보를 비교하여 변경사항 계산
        formatted_info["changes"] = calculate_changes(formatted_info, old_ticker_info)

        # 4. [핵심 수정] 변경 여부 비교는 포맷팅된 객체끼리 수행 (Update, changes 키 제외)
        old_comparable = old_ticker_info.copy()
        new_comparable = formatted_info.copy()
        old_comparable.pop("Update", None)
        old_comparable.pop("changes", None)
        new_comparable.pop("Update", None)
        new_comparable.pop("changes", None)

        if json.dumps(old_comparable, sort_keys=True) == json.dumps(
            new_comparable, sort_keys=True
        ):
            continue

        existing_data["tickerInfo"] = formatted_info
        if save_json_file(file_path, existing_data, indent=2):
            total_changed_files += 1

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
