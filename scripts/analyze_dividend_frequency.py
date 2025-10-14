import os
import json
from datetime import datetime, timedelta
from collections import Counter
from tqdm import tqdm

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

MONTH_INITIALS = {
    1: "J",
    2: "F",
    3: "M",
    4: "A",
    5: "M",
    6: "J",
    7: "J",
    8: "A",
    9: "S",
    10: "O",
    11: "N",
    12: "D",
}


def analyze_frequency_and_group(dividend_dates):
    """배당 날짜 리스트를 기반으로 배당 간격을 분석하여 빈도와 그룹을 결정합니다."""
    if len(dividend_dates) < 3:
        return None, None

    intervals = [
        (dividend_dates[i] - dividend_dates[i - 1]).days
        for i in range(1, len(dividend_dates))
    ]

    if not intervals:
        return None, None

    def get_interval_group(days):
        if 4 <= days <= 10:
            return 7
        if 25 <= days <= 35:
            return 30
        if 81 <= days <= 101:
            return 91
        if 335 <= days <= 395:
            return 365
        return None

    grouped_intervals = [get_interval_group(i) for i in intervals]

    if not any(grouped_intervals):
        return None, None

    mode_interval = Counter(g for g in grouped_intervals if g is not None).most_common(
        1
    )[0][0]

    frequency = None
    if mode_interval == 7:
        frequency = "매주"
    elif mode_interval == 30:
        frequency = "매월"
    elif mode_interval == 91:
        frequency = "분기"
    elif mode_interval == 365:
        frequency = "매년"

    group = None
    if frequency == "분기" and len(dividend_dates) >= 4:
        recent_months = sorted(list(set([d.month for d in dividend_dates[-4:]])))
        if len(recent_months) == 4:
            group = "".join([MONTH_INITIALS[m] for m in recent_months])

    return frequency, group


def main():
    print("--- Starting Dividend Frequency and Group Analysis (Interval-based) ---")

    nav_sources = {}
    all_tickers_from_nav = []

    market_dirs = [
        d for d in os.listdir(NAV_DIR) if os.path.isdir(os.path.join(NAV_DIR, d))
    ]
    for market in market_dirs:
        market_path = os.path.join(NAV_DIR, market)
        files = [f for f in os.listdir(market_path) if f.endswith(".json")]
        for filename in files:
            file_path = os.path.join(market_path, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    tickers = json.load(f)
                    nav_sources[file_path] = tickers
                    all_tickers_from_nav.extend(tickers)
            except (IOError, json.JSONDecodeError):
                print(f"Warning: Could not read or parse {file_path}")

    print(
        f"Found {len(all_tickers_from_nav)} tickers from nav source files to analyze."
    )

    updates_to_apply = {}
    for ticker_info in tqdm(all_tickers_from_nav, desc="Analyzing dividend data"):
        symbol = ticker_info.get("symbol")
        company = ticker_info.get("company")  # 회사 정보 가져오기

        # [핵심 수정] YieldMax 종목이거나 심볼이 없으면 분석에서 제외
        if not symbol or company == "YieldMax":
            continue

        sanitized_symbol = symbol.replace(".", "-").lower()
        data_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

        try:
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            dividends = data.get("backtestData", {}).get("dividends", [])
            if not dividends:
                continue

            dividend_dates = sorted(
                [datetime.strptime(d["date"], "%Y-%m-%d") for d in dividends]
            )

            frequency, group = analyze_frequency_and_group(dividend_dates)

            if frequency:
                updates_to_apply[symbol] = {"frequency": frequency, "group": group}

        except (FileNotFoundError, json.JSONDecodeError):
            continue

    changed_file_count = 0
    updated_ticker_count = 0
    for file_path, tickers in nav_sources.items():
        has_changed = False
        for ticker in tickers:
            symbol = ticker.get("symbol")
            if symbol in updates_to_apply:
                update_info = updates_to_apply[symbol]

                is_freq_updated = ticker.get("frequency") != update_info["frequency"]
                is_group_updated = (
                    update_info["group"] and ticker.get("group") != update_info["group"]
                )

                if is_freq_updated or is_group_updated:
                    ticker["frequency"] = update_info["frequency"]
                    if update_info["group"]:
                        ticker["group"] = update_info["group"]
                    elif "group" in ticker:
                        del ticker["group"]
                    has_changed = True
                    updated_ticker_count += 1

        if has_changed:
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(tickers, f, indent=4, ensure_ascii=False)
                changed_file_count += 1
            except IOError as e:
                print(f"❌ Error writing updates to {file_path}: {e}")

    print(
        f"\n🎉 Analysis complete. Updated {updated_ticker_count} tickers in {changed_file_count} files."
    )
    print(" (YieldMax tickers were skipped from automatic analysis)")


if __name__ == "__main__":
    main()
