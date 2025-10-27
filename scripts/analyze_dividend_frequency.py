# scripts/analyze_dividend_frequency.py
import os
import json
from datetime import datetime
from collections import Counter
from tqdm import tqdm

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
    # [핵심 수정] 최소 2회 이상의 배당 기록이 있어야 간격 계산이 가능
    if len(dividend_dates) < 2:
        return None, None

    intervals = [
        (dividend_dates[i] - dividend_dates[i - 1]).days
        for i in range(1, len(dividend_dates))
    ]
    if not intervals:
        return None, None

    def get_interval_group(days):
        if 4 <= days <= 10:
            return 7  # 매주
        if 25 <= days <= 35:
            return 30  # 매월
        if 81 <= days <= 101:
            return 91  # 분기
        if 335 <= days <= 395:
            return 365  # 매년
        return None

    grouped_intervals = [get_interval_group(i) for i in intervals]
    valid_groups = [g for g in grouped_intervals if g is not None]

    if not valid_groups:
        return None, None

    # 가장 빈번하게 나타나는 간격을 찾음
    mode_interval = Counter(valid_groups).most_common(1)[0][0]

    frequency_map = {
        7: "매주",
        30: "매월",
        91: "분기",
        365: "매년",
    }
    frequency = frequency_map.get(mode_interval)

    group = None
    # 분기 배당일 경우, 최근 4회의 배당 월을 그룹으로 지정
    if frequency == "분기" and len(dividend_dates) >= 4:
        recent_months = sorted(list(set([d.month for d in dividend_dates[-4:]])))
        if len(recent_months) == 4:
            group = "".join([MONTH_INITIALS.get(m, "?") for m in recent_months])

    return frequency, group


def main():
    print("--- Starting Dividend Frequency Analysis (Recent 5 Payouts) ---")

    nav_sources = {}
    all_tickers_from_nav = []
    # nav 소스 파일들을 모두 순회하며 티커 목록을 만듦
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
            except (IOError, json.JSONDecodeError) as e:
                print(f"Warning: Could not read or parse {file_path}: {e}")

    print(
        f"Found {len(all_tickers_from_nav)} tickers from nav source files to analyze."
    )

    updates_to_apply = {}
    for ticker_info in tqdm(all_tickers_from_nav, desc="Analyzing dividend data"):
        symbol = ticker_info.get("symbol")

        # [수정] YieldMax와 upcoming 종목은 분석에서 제외
        if (
            not symbol
            or ticker_info.get("company") == "YieldMax"
            or ticker_info.get("upcoming")
        ):
            continue

        sanitized_symbol = symbol.replace(".", "-").lower()
        data_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

        try:
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            backtest_data = data.get("backtestData", [])
            # 실지급된 배당(amount 또는 amountFixed) 내역만 추출하여 날짜순으로 정렬
            dividend_entries = sorted(
                [
                    item
                    for item in backtest_data
                    if item.get("amount") is not None
                    or item.get("amountFixed") is not None
                ],
                key=lambda x: x["date"],
            )

            if not dividend_entries:
                continue

            # --- [핵심 수정] ---
            # 최신 5회의 배당 기록만 사용하여 분석
            recent_dividend_dates = [
                datetime.strptime(d["date"], "%Y-%m-%d") for d in dividend_entries[-5:]
            ]
            # --- [수정 끝] ---

            frequency, group = analyze_frequency_and_group(recent_dividend_dates)

            if frequency:
                updates_to_apply[symbol] = {"frequency": frequency, "group": group}

        except (FileNotFoundError, json.JSONDecodeError):
            continue

    # 변경 사항을 nav 소스 파일에 적용
    changed_file_count, updated_ticker_count = 0, 0
    for file_path, tickers in nav_sources.items():
        has_changed = False
        for ticker in tickers:
            symbol = ticker.get("symbol")
            if symbol in updates_to_apply:
                update_info = updates_to_apply[symbol]

                # 기존 정보와 달라졌을 경우에만 업데이트
                is_freq_updated = ticker.get("frequency") != update_info["frequency"]
                is_group_updated = ticker.get("group") != update_info["group"]

                if is_freq_updated or is_group_updated:
                    ticker["frequency"] = update_info["frequency"]
                    if update_info["group"]:
                        ticker["group"] = update_info["group"]
                    # 새로운 그룹 정보가 없으면 기존 그룹 정보 삭제
                    elif "group" in ticker:
                        del ticker["group"]

                    has_changed = True
                    updated_ticker_count += 1

        if has_changed:
            try:
                # 변경된 파일만 다시 저장
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(tickers, f, indent=4, ensure_ascii=False)
                changed_file_count += 1
            except IOError as e:
                print(f"❌ Error writing updates to {file_path}: {e}")

    print(
        f"\n🎉 Analysis complete. Updated {updated_ticker_count} tickers in {changed_file_count} files."
    )
    if len(all_tickers_from_nav) > 0 and updated_ticker_count == 0:
        print(" (No new frequency information to update.)")


if __name__ == "__main__":
    main()
