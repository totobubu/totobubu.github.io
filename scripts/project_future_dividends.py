# scripts/project_future_dividends.py

import os
import json
from datetime import datetime, timedelta
from collections import Counter
from tqdm import tqdm

# --- 경로 설정 ---
PUBLIC_DIR = "public"
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
US_HOLIDAYS_PATH = os.path.join(PUBLIC_DIR, "holidays", "us_holidays.json")
KR_HOLIDAYS_PATH = os.path.join(PUBLIC_DIR, "holidays", "kr_holidays.json")


# --- 유틸리티 함수 ---
def load_json_file(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def save_json_file(file_path, data, indent=2):
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
        return True
    except IOError:
        return False


# 배당 간격 계산 함수 (기존과 유사)
def get_dividend_interval(dates):
    if len(dates) < 2:
        return None
    intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]

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

    grouped = [get_interval_group(i) for i in intervals]
    if not any(grouped):
        return None
    mode_interval = Counter(g for g in grouped if g is not None).most_common(1)[0][0]
    return timedelta(days=mode_interval)


# [신규] 이전 영업일 찾는 함수
def get_previous_business_day(date, holiday_set):
    current_date = date
    while True:
        weekday = current_date.weekday()
        date_str = current_date.strftime("%Y-%m-%d")
        # 주말(토:5, 일:6)이 아니고 공휴일이 아니면 반환
        if weekday < 5 and date_str not in holiday_set:
            return current_date
        current_date -= timedelta(days=1)


def main():
    print("--- Starting to Project Future Forecasted Dividend Dates ---")

    # 공휴일 데이터 로드
    us_holidays = set(h["date"] for h in load_json_file(US_HOLIDAYS_PATH) or [])
    kr_holidays = set(h["date"] for h in load_json_file(KR_HOLIDAYS_PATH) or [])

    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    updated_count = 0

    for filename in tqdm(files, desc="Projecting future dividends"):
        file_path = os.path.join(DATA_DIR, filename)
        data = load_json_file(file_path)

        if not data or "backtestData" not in data or "tickerInfo" not in data:
            continue
        if data["tickerInfo"].get("upcoming"):
            continue

        currency = data["tickerInfo"].get("currency", "USD")
        holiday_set = kr_holidays if currency == "KRW" else us_holidays

        backtest_data = data["backtestData"]

        # 1. [수정] 기존 'forecasted' 데이터만 제거 ('scheduled'는 보존)
        original_data_str = json.dumps(backtest_data, sort_keys=True)
        backtest_data = [item for item in backtest_data if not item.get("forecasted")]

        # 2. 배당 내역 추출 및 마지막 배당일 찾기
        dividend_entries = sorted(
            [
                item
                for item in backtest_data
                if "amount" in item or "amountFixed" in item
            ],
            key=lambda x: x["date"],
        )

        if not dividend_entries:
            continue

        last_dividend_date_str = dividend_entries[-1]["date"]
        last_dividend_date = datetime.strptime(last_dividend_date_str, "%Y-%m-%d")

        # 3. 배당 주기 계산 (최근 1년 데이터 사용)
        one_year_ago = last_dividend_date - timedelta(days=365)
        recent_dividend_dates = [
            datetime.strptime(d["date"], "%Y-%m-%d")
            for d in dividend_entries
            if datetime.strptime(d["date"], "%Y-%m-%d") >= one_year_ago
        ]

        interval = get_dividend_interval(recent_dividend_dates)
        if not interval:
            continue

        # 4. 미래 예상일 생성 (향후 1년)
        future_projections = []
        next_date = last_dividend_date
        one_year_later = datetime.now() + timedelta(days=365)

        # [신규] 이미 존재하는 모든 날짜(확정, 예정, 예상)를 set으로 관리하여 중복 방지
        existing_dates = {item["date"] for item in backtest_data}

        while True:
            next_date += interval
            if next_date > one_year_later:
                break

            # [수정] 주말/공휴일 조정
            adjusted_date = get_previous_business_day(next_date, holiday_set)
            date_str = adjusted_date.strftime("%Y-%m-%d")

            if date_str not in existing_dates:
                # [수정] "forecasted": true 플래그 사용
                future_projections.append({"date": date_str, "forecasted": True})
                existing_dates.add(date_str)

        if not future_projections:
            continue

        # 5. 데이터 병합 및 저장
        data["backtestData"].extend(future_projections)
        data["backtestData"].sort(key=lambda x: x["date"])

        # 변경 사항이 있을 경우에만 파일 쓰기
        if original_data_str != json.dumps(data["backtestData"], sort_keys=True):
            if save_json_file(file_path, data):
                updated_count += 1

    print(f"\n--- Projection Finished. Total files updated: {updated_count} ---")


if __name__ == "__main__":
    main()
