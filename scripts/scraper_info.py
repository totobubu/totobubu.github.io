# scripts\scraper_info.py
import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta
import subprocess


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
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        current_price = info.get("regularMarketPrice") or info.get("previousClose")
        yield_val = (
            (info.get("trailingAnnualDividendRate", 0) / current_price) * 100
            if current_price
            else 0
        )
        earnings_date_str = "N/A"
        if info.get("earningsTimestamp"):
            earnings_date_str = (
                datetime.fromtimestamp(info.get("earningsTimestamp"), tz=timezone.utc)
                .astimezone(now_kst.tzinfo)
                .strftime("%Y-%m-%d")
            )

        return {
            "Update": now_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
            "longName": info.get("longName"),  # 포맷팅 없이 원본 값 그대로 반환
            "earningsDate": earnings_date_str,
            "enterpriseValue": format_large_number(info.get("enterpriseValue")),
            "marketCap": format_large_number(info.get("marketCap")),
            "totalAssets": format_large_number(info.get("totalAssets")),
            "Volume": format_large_number(info.get("volume")),
            "AvgVolume": format_large_number(info.get("averageVolume")),
            "sharesOutstanding": format_large_number(info.get("sharesOutstanding")),
            "52Week": (
                f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}"
                if info.get("fiftyTwoWeekLow")
                else "N/A"
            ),
            "NAV": format_currency(info.get("navPrice")),
            "TotalReturn": format_percent(info.get("ytdReturn")),
            "Yield": f"{yield_val:.2f}%" if yield_val > 0 else "N/A",
            "dividendRate": format_currency(info.get("dividendRate")),
            "payoutRatio": format_percent(info.get("payoutRatio")),
        }
    except Exception as e:
        print(f"  -> Failed to fetch dynamic info for {ticker_symbol}: {e}")
        return None


if __name__ == "__main__":
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        subprocess.run("npm run generate-nav", check=True, shell=True, cwd=project_root)
    except Exception as e:
        print(f"!!! Failed to run 'npm run generate-nav'. Error: {e}")
        exit()

    nav_file_path = "public/nav.json"
    output_dir = "public/data"

    with open(nav_file_path, "r", encoding="utf-8") as f:
        all_tickers_info_list = json.load(f).get("nav", [])

    print("\n--- Starting Daily Ticker Info Update ---")
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

        dynamic_info_from_yf = fetch_dynamic_ticker_info(ticker_symbol)
        if not dynamic_info_from_yf:
            print(f"  -> Skipping update for {ticker_symbol}.")
            continue

        # [핵심 로직 수정]
        # 1. nav.json의 고정 정보를 기준으로 최종 tickerInfo 객체를 생성
        final_ticker_info = {
            "Symbol": info_from_nav.get("symbol"),
            "longName": info_from_nav.get("longName"),
            "company": info_from_nav.get("company"),
            "frequency": info_from_nav.get("frequency"),
            "group": info_from_nav.get("group"),
        }

        # 2. yfinance에서 가져온 데이터 중, 값이 None이 아닌 것만 final_ticker_info에 추가/덮어쓰기
        for key, value in dynamic_info_from_yf.items():
            if value is not None:
                final_ticker_info[key] = value

        changes_obj = {}
        try:
            new_update_date = final_ticker_info.get("Update", "").split(" ")[0]
            old_update_date = old_ticker_info.get("Update", "").split(" ")[0]

            if new_update_date == old_update_date:
                print(
                    f"     -> Update is on the same day. Preserving previous changes."
                )
                changes_obj = old_ticker_info.get("changes", {})
            else:
                print(f"     -> New day detected. Re-calculating all changes.")
                for key, new_value in final_ticker_info.items():
                    if key in [
                        "changes",
                        "Symbol",
                        "longName",
                        "company",
                        "frequency",
                        "group",
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
        except (IndexError, ValueError, AttributeError):
            pass

        final_ticker_info["changes"] = changes_obj

        final_data_to_save = {
            "tickerInfo": final_ticker_info,
            "dividendHistory": existing_data.get("dividendHistory", []),
            "backtestData": existing_data.get("backtestData", {}),
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)

        print(f" => Updated Ticker Info for {ticker_symbol}")
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. ---")
