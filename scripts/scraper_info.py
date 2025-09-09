import time
import json
import os
import yfinance as yf
from datetime import datetime, timezone, timedelta
import subprocess


def parse_numeric_value(value_str):
    if not isinstance(value_str, str):
        return None
    try:
        return float("".join(filter(lambda x: x.isdigit() or x == ".", value_str)))
    except (ValueError, TypeError):
        return None


def compare_and_add_change(new_info, old_info):
    # old_info가 없으면, 비교할 대상이 없으므로 new_info만 반환 (Change 객체 없음)
    if not old_info:
        return new_info

    try:
        # 날짜(YYYY-MM-DD) 부분만 추출
        new_update_date_str = new_info.get("Update", "").split(" ")[0]
        old_update_date_str = old_info.get("Update", "").split(" ")[0]

        # [핵심 로직] 두 날짜가 동일한지 비교
        if new_update_date_str == old_update_date_str:
            print(
                f"     -> Update is on the same day ({new_update_date_str}). Preserving previous '...Change' objects."
            )

            # 1. 새로 가져온 정보(new_info)로 시작
            result_info = new_info.copy()

            # 2. 이전 정보(old_info)에서 모든 '...Change' 객체를 찾아 그대로 복사
            for key, value in old_info.items():
                if key.endswith("Change"):
                    result_info[key] = value

            # 3. 최종적으로 조합된 객체 반환
            return result_info

    except (ValueError, IndexError) as e:
        print(
            f"     -> Could not parse update dates ({e}). Proceeding with normal comparison."
        )
        pass

    # 날짜가 다르거나 파싱 실패 시, 모든 필드를 비교하여 ...Change 필드를 새로 계산
    print(f"     -> New day detected. Re-calculating all '...Change' objects.")
    info_with_change = new_info.copy()
    for key, new_value in new_info.items():
        # ...Change 필드는 건너뛰고 값 필드만 비교
        if key.endswith("Change"):
            continue

        old_value = old_info.get(key)
        new_numeric, old_numeric = parse_numeric_value(new_value), parse_numeric_value(
            old_value
        )
        change_info = {"previousValue": old_value}

        if new_numeric is not None and old_numeric is not None:
            if new_numeric > old_numeric:
                change_info["change"] = "up"
            elif new_numeric < old_numeric:
                change_info["change"] = "down"
            else:
                change_info["change"] = "equal"
        else:
            change_info["change"] = "up" if new_value != old_value else "equal"

        info_with_change[f"{key}Change"] = change_info

    return info_with_change


def calculate_yield_from_history(info, history):
    if not history:
        return "N/A"
    current_price = info.get("regularMarketPrice") or info.get("previousClose")
    if not current_price or current_price == 0:
        return "N/A"
    one_year_ago = datetime.now() - timedelta(days=365)
    total_dividend_last_year = 0
    for item in history:
        try:
            ex_date = datetime.strptime(
                item.get("배당락", "").replace(" ", ""), "%y.%m.%d"
            )
            if ex_date >= one_year_ago:
                total_dividend_last_year += float(
                    item.get("배당금", "$0").replace("$", "")
                )
        except (ValueError, TypeError):
            continue
    return (
        f"{(total_dividend_last_year / current_price) * 100:.2f}%"
        if total_dividend_last_year > 0
        else "0.00%"
    )


def fetch_ticker_info(ticker_symbol, company, frequency, group, dividend_history):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        manual_yield = calculate_yield_from_history(info, dividend_history)
        earnings_date_str = "N/A"
        if info.get("earningsTimestamp"):
            earnings_date_str = (
                datetime.fromtimestamp(info.get("earningsTimestamp"), tz=timezone.utc)
                .astimezone(now_kst.tzinfo)
                .strftime("%Y-%m-%d")
            )

        return {
            "Symbol": info.get("symbol", ticker_symbol).upper(),
            "longName": info.get("longName", ticker_symbol.upper()),
            "company": company,
            "frequency": frequency,
            "group": group,
            "Update": now_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
            "earningsDate": earnings_date_str,
            "enterpriseValue": (
                f"{info.get('enterpriseValue', 0):,}"
                if info.get("enterpriseValue")
                else "N/A"
            ),
            "marketCap": (
                f"{info.get('marketCap', 0):,}" if info.get("marketCap") else "N/A"
            ),
            "totalAssets": (
                f"${info.get('totalAssets', 0):,}" if info.get("totalAssets") else "N/A"
            ),
            "Volume": f"{info.get('volume', 0):,}" if info.get("volume") else "N/A",
            "AvgVolume": (
                f"{info.get('averageVolume', 0):,}"
                if info.get("averageVolume")
                else "N/A"
            ),
            "sharesOutstanding": (
                f"{info.get('sharesOutstanding', 0):,}"
                if info.get("sharesOutstanding")
                else "N/A"
            ),
            "52Week": (
                f"${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}"
                if info.get("fiftyTwoWeekLow")
                else "N/A"
            ),
            "NAV": f"${info.get('navPrice', 0):.2f}" if info.get("navPrice") else "N/A",
            "TotalReturn": (
                f"{(info.get('ytdReturn', 0) * 100):.2f}%"
                if info.get("ytdReturn")
                else "N/A"
            ),
            "Yield": manual_yield,
            "dividendRate": (
                f"${info.get('dividendRate', 0):.2f}"
                if info.get("dividendRate")
                else "N/A"
            ),
            "payoutRatio": (
                f"{(info.get('payoutRatio', 0) * 100):.2f}%"
                if info.get("payoutRatio")
                else "N/A"
            ),
        }
    except Exception as e:
        print(f"  -> Failed to fetch basic info for {ticker_symbol}: {e}")
        return None


if __name__ == "__main__":
    try:
        print("--- Running 'npm run generate-nav' to update nav.json ---")
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        subprocess.run("npm run generate-nav", check=True, shell=True, cwd=project_root)
        print("--- nav.json has been successfully updated. ---")
    except Exception as e:
        print(f"!!! Failed to run 'npm run generate-nav'. Error: {e}")
        exit()

    nav_file_path = "public/nav.json"
    data_dir = "public/data"
    os.makedirs(data_dir, exist_ok=True)

    with open(nav_file_path, "r", encoding="utf-8") as f:
        all_tickers_info_list = json.load(f).get("nav", [])

    print("\n--- Starting Daily Ticker Info Update ---")
    for info in all_tickers_info_list:
        ticker = info.get("symbol")
        if not ticker:
            continue

        file_path = os.path.join(data_dir, f"{ticker.lower()}.json")

        existing_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except json.JSONDecodeError:
                pass

        existing_history = existing_data.get("dividendHistory", [])
        old_ticker_info = existing_data.get("tickerInfo")

        new_info = fetch_ticker_info(
            ticker,
            info.get("company"),
            info.get("frequency"),
            info.get("group"),
            existing_history,
        )
        if not new_info:
            print(f"  -> Skipping update for {ticker}.")
            continue

        info_with_change = compare_and_add_change(new_info, old_ticker_info)

        final_data_to_save = {
            "tickerInfo": info_with_change,
            "dividendHistory": existing_data.get("dividendHistory", []),
            "backtestData": existing_data.get(
                "backtestData", {"prices": [], "dividends": []}
            ),
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(final_data_to_save, f, ensure_ascii=False, indent=2)

        print(f" => Updated Ticker Info for {ticker}")
        time.sleep(1)

    print(f"\n--- Ticker Info Update Finished. ---")
