# REFACTORED: scripts/scraper_info.py

import time
import json
import yfinance as yf
from datetime import datetime
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    get_kst_now,
    parse_numeric_value,
    format_currency,
    format_large_number,
    format_percent,
    get_yfinance_ticker,  # <--- [핵심 추가 1] get_yfinance_ticker 함수를 import 합니다.
)


def fetch_dynamic_ticker_info(yfinance_ticker):
    try:
        ticker = yf.Ticker(yfinance_ticker)
        info = ticker.info
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        yield_val = (
            ((info.get("trailingAnnualDividendRate", 0) / current_price) * 100)
            if current_price
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
                if info.get("fiftyTwoWeekLow")
                else "N/A"
            ),
            "Yield": yield_val if yield_val > 0 else 0,
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
        }
    except Exception as e:
        # 에러 로그에 어떤 티커로 조회했는지 명시
        print(f"  -> Failed to fetch dynamic info for {yfinance_ticker}: {e}")
        return None


def format_ticker_info(info_dict):
    formatted = info_dict.copy()
    for key, value in formatted.items():
        if key in [
            "enterpriseValue",
            "marketCap",
            "Volume",
            "AvgVolume",
            "sharesOutstanding",
        ]:
            formatted[key] = format_large_number(value)
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
                "market",
                "currency",
            ]:  # 비교 제외 필드 추가
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
                changes_obj[key] = {
                    "value": str(old_val),
                    "change": change_status,
                }  # 이전 값을 문자열로 저장
    else:
        return old_info.get("changes", {})
    return changes_obj


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print("!!! Error: public/nav.json not found.")
        return

    print("\n--- Starting Daily Ticker Info Update ---")
    total_changed_files = 0
    now_kst = get_kst_now()

    for info_from_nav in nav_data.get("nav", []):
        ticker_symbol = info_from_nav.get("symbol")
        market = info_from_nav.get("market")
        if not ticker_symbol:
            continue

        # --- [핵심 수정 2] 야후 파이낸스용 티커 생성 ---
        yfinance_ticker = get_yfinance_ticker(ticker_symbol, market)

        file_path = f"public/data/{sanitize_ticker_for_filename(ticker_symbol)}.json"
        existing_data = load_json_file(file_path) or {}
        old_ticker_info = existing_data.get("tickerInfo", {})

        # API 호출 시 yfinance_ticker 사용
        dynamic_info = fetch_dynamic_ticker_info(yfinance_ticker)
        # --- // ---

        if not dynamic_info:
            print(f"  -> Skipping update for {ticker_symbol} (fetch failed).")
            continue

        # --- [핵심 수정] ---
        # new_info_base를 구성할 때, nav.json의 koName과 longName을 모두 가져옵니다.
        # API 결과(dynamic_info)의 longName이 nav.json의 longName을 덮어쓰도록 순서를 조정합니다.
        new_info_base = {
            "Symbol": ticker_symbol,
            "koName": info_from_nav.get("koName"),  # koName 추가
            "longName": info_from_nav.get("longName"),  # nav의 longName을 기본값으로
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
        }
        # API에서 가져온 정보로 덮어쓰되, None이 아닌 값만 사용
        new_info_base.update({k: v for k, v in dynamic_info.items() if v is not None})
        # --- // ---

        # 비교를 위해 이전 데이터에서 불필요한 키 제거
        old_comparable = old_ticker_info.copy()
        for key in ["Update", "changes"]:
            old_comparable.pop(key, None)

        # JSON 문자열로 변환하여 비교 (더 안전한 방법)
        if json.dumps(old_comparable, sort_keys=True) == json.dumps(
            new_info_base, sort_keys=True
        ):
            print(f"  -> No data changes for {ticker_symbol}. Skipping file write.")
            continue

        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")

        # 포맷팅은 changes 계산 전에 수행
        formatted_info = format_ticker_info(final_ticker_info)

        # changes 계산 (포맷팅된 새 정보 vs 포맷팅된 이전 정보)
        formatted_old_info = format_ticker_info(old_ticker_info)
        formatted_info["changes"] = calculate_changes(
            formatted_info, formatted_old_info
        )

        existing_data["tickerInfo"] = formatted_info
        if save_json_file(file_path, existing_data, indent=2):
            print(f" => UPDATED Ticker Info for {ticker_symbol}")
            total_changed_files += 1

        time.sleep(0.5)  # API 호출 간격 약간 줄임

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )


if __name__ == "__main__":
    main()
