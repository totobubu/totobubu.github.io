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


def fetch_bulk_ticker_info(ticker_symbols):
    """여러 티커의 정보를 yfinance를 통해 한 번에 가져옵니다."""
    print(f"Fetching bulk info for {len(ticker_symbols)} tickers...")
    bulk_data = {}
    try:
        tickers = yf.Tickers(ticker_symbols)
        for symbol, ticker_obj in tqdm(
            tickers.tickers.items(), desc="Fetching Ticker Info"
        ):
            try:
                bulk_data[symbol] = ticker_obj.info
            except Exception as e:
                tqdm.write(f"  - Warning: Failed to get info for {symbol}: {e}")
                bulk_data[symbol] = None
        return bulk_data
    except Exception as e:
        print(f"  -> Critical error during bulk fetch setup: {e}")
        return {}


def process_single_ticker_info(info):
    """yfinance에서 받은 단일 티커의 info 객체를 처리합니다."""
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
        return {
            "longName": info.get("longName"),
            "earningsDate": earnings_date,
            "enterpriseValue": info.get("enterpriseValue"),
            "marketCap": info.get("marketCap"),
            "Volume": info.get("volume"),
            "AvgVolume": info.get("averageVolume"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "52Week": (
                f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}"
                if info.get("fiftyTwoWeekLow") and info.get("fiftyTwoWeekHigh")
                else "N/A"
            ),
            "Yield": yield_val if yield_val > 0 else 0,
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
        }
    except Exception:
        return None


def format_ticker_info(info_dict, currency="USD"):
    formatted = info_dict.copy()
    for key, value in formatted.items():
        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding",
        ]:
            # 한국 원화(KRW)일 경우 format_large_number에 통화 정보 전달
            formatted[key] = format_large_number(
                value, currency if currency == "KRW" else None
            )
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

    # --- [핵심 수정] ---
    # 티커 목록을 100개씩 묶어서 처리하여 과부하를 방지합니다.
    batch_size = 100
    all_bulk_info = {}

    for i in tqdm(
        range(0, len(active_symbols), batch_size),
        desc="Fetching All Ticker Info in Batches",
    ):
        batch = active_symbols[i : i + batch_size]
        # 함수 이름 변경에 맞춰 호출
        batch_info = fetch_bulk_ticker_info_batch(batch)
        all_bulk_info.update(batch_info)
        # 마지막 배치가 아닐 경우에만 지연
        if i + batch_size < len(active_symbols):
            time.sleep(2)  # 각 배치 요청 사이에 2초 지연
    # --- // ---

    total_changed_files = 0
    now_kst = get_kst_now()

    for info_from_nav in tqdm(
        active_tickers_from_nav, desc="Processing and Saving Data"
    ):
        ticker_symbol = info_from_nav.get("symbol")

        raw_dynamic_info = bulk_info.get(ticker_symbol)
        dynamic_info = process_single_ticker_info(raw_dynamic_info)

        if not dynamic_info:
            continue

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_ticker_info = existing_data.get("tickerInfo", {})

        new_info_base = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),
            "longName": info_from_nav.get("koName")
            or info_from_nav.get("longName"),  # koName 우선
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
                if not new_info_base.get(
                    "longName"
                ):  # longName이 비어있으면 영문으로 채움
                    new_info_base["longName"] = new_info_base["englishName"]
            new_info_base.update(
                {k: v for k, v in dynamic_info.items() if v is not None}
            )

        old_comparable = old_ticker_info.copy()
        for key in ["Update", "changes"]:
            old_comparable.pop(key, None)

        # 새로운 데이터에서 비교에 불필요한 키 제거
        new_comparable = new_info_base.copy()

        if json.dumps(old_comparable, sort_keys=True, default=str) == json.dumps(
            new_comparable, sort_keys=True, default=str
        ):
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
