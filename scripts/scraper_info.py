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

        # [핵심 수정] tqdm으로 루프를 감싸서 진행률을 표시합니다.
        for symbol, ticker_obj in tqdm(
            tickers.tickers.items(), desc="Fetching Ticker Info"
        ):
            try:
                # 개별 티커의 .info 접근 시 실제 데이터 fetching이 발생합니다.
                bulk_data[symbol] = ticker_obj.info
            except Exception as e:
                # 개별 티커 정보 가져오기 실패 시 경고 출력
                # tqdm.write를 사용하면 진행률 표시줄을 방해하지 않고 메시지를 출력할 수 있습니다.
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


def format_ticker_info(info_dict, currency="USD"):  # currency 인자 추가
    formatted = info_dict.copy()
    for key, value in formatted.items():
        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding",
        ]:
            formatted[key] = format_large_number(value, currency)  # currency 전달
        elif key == "dividendRate":
            formatted[key] = format_currency(value)
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

    bulk_info = fetch_bulk_ticker_info(active_symbols)

    total_changed_files = 0
    now_kst = get_kst_now()

    # tqdm을 메인 루프에도 적용하여 파일 저장 진행률을 보여줍니다.
    for info_from_nav in tqdm(
        active_tickers_from_nav, desc="Processing and Saving Data"
    ):
        ticker_symbol = info_from_nav.get("symbol")

        raw_dynamic_info = bulk_info.get(ticker_symbol)
        dynamic_info = process_single_ticker_info(raw_dynamic_info)

        if not dynamic_info:
            # tqdm.write(f"  -> Skipping update for {ticker_symbol} (fetch failed or invalid data).")
            continue

        currency = info_from_nav.get(
            "currency", "USD"
        )  # nav.json에서 currency 정보 가져오기

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_ticker_info = existing_data.get("tickerInfo", {})

        new_info_base = {
            "Symbol": ticker_symbol,
            "longName": info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
        }
        new_info_base.update({k: v for k, v in dynamic_info.items() if v is not None})

        old_comparable = old_ticker_info.copy()
        old_comparable.pop("Update", None)
        old_comparable.pop("changes", None)

        if json.dumps(old_comparable, sort_keys=True, default=str) == json.dumps(
            new_info_base, sort_keys=True, default=str
        ):
            # tqdm.write(f"  -> No data changes for {ticker_symbol}. Skipping file write.")
            continue

        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
        formatted_info = format_ticker_info(
            final_ticker_info, currency
        )  # currency 전달

        formatted_info["changes"] = calculate_changes(formatted_info, old_ticker_info)

        existing_data["tickerInfo"] = formatted_info
        if save_json_file(file_path, existing_data, indent=2):
            # tqdm.write(f" => UPDATED Ticker Info for {ticker_symbol}")
            total_changed_files += 1

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
