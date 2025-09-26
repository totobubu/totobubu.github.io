# scripts\scraper_info.py
import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta

# [수정] subprocess는 더 이상 필요 없으므로 import 제거


def parse_numeric_value(value_str):
    if value_str is None or not isinstance(value_str, (str, int, float)):
        return None
    if isinstance(value_str, (int, float)):
        return float(value_str)
    try:
        cleaned_str = (
            str(value_str).replace("$", "").replace(",", "").replace("%", "").strip()
        )
        return float(cleaned_str)
    except (ValueError, TypeError):
        return None


def format_currency(value, sign="$"):
    return f"{sign}{value:,.2f}" if isinstance(value, (int, float)) else "N/A"


def format_large_number(value):
    return f"{value:,}" if isinstance(value, (int, float)) else "N/A"


def format_percent(value):
    return f"{(value * 100):.2f}%" if isinstance(value, (int, float)) else "N/A"


def fetch_dynamic_ticker_info(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        yield_val = (
            ((info.get("trailingAnnualDividendRate", 0) / current_price) * 100)
            if current_price
            else 0
        )
        earnings_date_str = "N/A"
        if info.get("earningsTimestamp"):
            earnings_date_str = (
                datetime.fromtimestamp(info.get("earningsTimestamp"), tz=timezone.utc)
                .astimezone(timezone(timedelta(hours=9)))
                .strftime("%Y-%m-%d")
            )

        return {
            "longName": info.get("longName"),
            "earningsDate": earnings_date_str,
            "enterpriseValue": info.get("enterpriseValue"),
            "marketCap": info.get("marketCap"),
            "totalAssets": info.get("totalAssets"),
            "Volume": info.get("volume"),
            "AvgVolume": info.get("averageVolume"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "52Week": (
                f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}"
                if info.get("fiftyTwoWeekLow")
                else "N/A"
            ),
            "NAV": info.get("navPrice"),
            "TotalReturn": info.get("ytdReturn"),
            "Yield": yield_val if yield_val > 0 else 0,
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
        }
    except Exception as e:
        print(f"  -> Failed to fetch dynamic info for {ticker_symbol}: {e}")
        return None


if __name__ == "__main__":
    # [핵심 수정] 스크립트 시작 시 npm run generate-nav를 호출하던 부분을 완전히 삭제합니다.
    # try:
    #     project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    #     subprocess.run("npm run generate-nav", check=True, shell=True, cwd=project_root)
    # except Exception as e:
    #     print(f"!!! Failed to run 'npm run generate-nav'. Error: {e}")
    #     exit()

    nav_file_path = "public/nav.json"
    output_dir = "public/data"

    # 워크플로우에서 nav.json이 이미 생성되었음을 가정하고 바로 파일을 읽습니다.
    try:
        with open(nav_file_path, "r", encoding="utf-8") as f:
            all_tickers_info_list = json.load(f).get("nav", [])
    except FileNotFoundError:
        print(
            f"!!! Error: {nav_file_path} not found. Make sure 'npm run generate-nav' runs before this script."
        )
        exit()

    print("\n--- Starting Daily Ticker Info Update ---")
    total_changed_files = 0
    now_kst = datetime.now(timezone(timedelta(hours=9)))

    for info_from_nav in all_tickers_info_list:
        ticker_symbol = info_from_nav.get("symbol")
        if not ticker_symbol:
            continue

        file_path = os.path.join(output_dir, f"{ticker_symbol.lower()}.json")
        existing_data = {}
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                try:
                    existing_data = json.load(f)
                except json.JSONDecodeError:
                    pass

        old_ticker_info = existing_data.get("tickerInfo", {})

        last_update_str = old_ticker_info.get("Update")
        if last_update_str:
            try:
                last_update_time = datetime.strptime(
                    last_update_str, "%Y-%m-%d %H:%M:%S KST"
                ).replace(tzinfo=timezone(timedelta(hours=9)))
                if now_kst - last_update_time < timedelta(hours=3):
                    print(
                        f"  -> Skipping {ticker_symbol}: Updated within the last 3 hours."
                    )
                    continue
            except ValueError:
                pass

        dynamic_info_from_yf_raw = fetch_dynamic_ticker_info(ticker_symbol)
        if not dynamic_info_from_yf_raw:
            print(f"  -> Skipping update for {ticker_symbol} (fetch failed).")
            continue

        old_comparable = old_ticker_info.copy()
        old_comparable.pop("Update", None)
        old_comparable.pop("changes", None)

        new_info_base = {
            "Symbol": info_from_nav.get("symbol"),
            "longName": info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
            "underlying": info_from_nav.get("underlying"),
        }
        for key, value in dynamic_info_from_yf_raw.items():
            if value is not None:
                new_info_base[key] = value

        new_comparable = new_info_base.copy()

        if json.dumps(old_comparable, sort_keys=True, default=str) == json.dumps(
            new_comparable, sort_keys=True, default=str
        ):
            print(f"  -> No data changes for {ticker_symbol}. Skipping file write.")
            continue

        total_changed_files += 1
        final_ticker_info = new_info_base.copy()
        final_ticker_info["Update"] = now_kst.strftime("%Y-%m-%d %H:%M:%S KST")

        for key, value in final_ticker_info.items():
            if key in [
                "enterpriseValue",
                "marketCap",
                "totalAssets",
                "Volume",
                "AvgVolume",
                "sharesOutstanding",
            ]:
                final_ticker_info[key] = format_large_number(value)
            elif key in ["NAV", "dividendRate"]:
                final_ticker_info[key] = format_currency(value)
            elif key in ["TotalReturn", "payoutRatio"]:
                final_ticker_info[key] = format_percent(value)
            elif key == "Yield":
                final_ticker_info[key] = (
                    f"{value:.2f}%"
                    if isinstance(value, (int, float)) and value > 0
                    else "N/A"
                )

        changes_obj = {}
        new_update_date = final_ticker_info.get("Update", "").split(" ")[0]
        old_update_date = old_ticker_info.get("Update", "").split(" ")[0]
        if new_update_date != old_update_date:
            for key, new_value in final_ticker_info.items():
                if key in [
                    "changes",
                    "Symbol",
                    "longName",
                    "company",
                    "frequency",
                    "group",
                    "Update",
                ]:
                    continue
                old_value = old_ticker_info.get(key)
                if old_value is None:
                    continue
                change_status = "equal"
                new_numeric, old_numeric = parse_numeric_value(
                    new_value
                ), parse_numeric_value(old_value)
                if new_numeric is not None and old_numeric is not None:
                    if new_numeric > old_numeric:
                        change_status = "up"
                    elif new_numeric < old_numeric:
                        change_status = "down"
                elif str(new_value) != str(old_value):
                    change_status = "up"
                if change_status != "equal":
                    changes_obj[key] = {"value": old_value, "change": change_status}
        else:
            changes_obj = old_ticker_info.get("changes", {})

        final_ticker_info["changes"] = changes_obj
        final_data_to_save = {
            "tickerInfo": final_ticker_info,
            "dividendHistory": existing_data.get("dividendHistory", []),
            "backtestData": existing_data.get("backtestData", {}),
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)
        print(f" => UPDATED Ticker Info for {ticker_symbol}")
        time.sleep(1)

    print(
        f"\n--- Ticker Info Update Finished. Total files updated: {total_changed_files} ---"
    )
