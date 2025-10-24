import os
import json
from datetime import datetime, timedelta
from collections import Counter
from tqdm import tqdm

# utils.py가 있다면 import, 없다면 필요한 함수를 여기에 직접 정의
try:
    from utils import load_json_file, save_json_file, sanitize_ticker_for_filename
except ImportError:
    # utils.py가 없는 경우를 위한 폴백 함수들
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


def get_dividend_interval(dates):
    """배당 날짜 리스트를 기반으로 평균 배당 간격을 계산합니다."""
    if len(dates) < 2:
        return None

    intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]

    # 간격을 그룹화하여 가장 빈번한 간격 유형 찾기
    def get_interval_group(days):
        if 4 <= days <= 10:
            return 7  # 주간
        if 25 <= days <= 35:
            return 30  # 월간
        if 81 <= days <= 101:
            return 91  # 분기
        if 335 <= days <= 395:
            return 365  # 연간
        return None

    grouped = [get_interval_group(i) for i in intervals]
    if not any(grouped):
        return None

    # 최빈값 계산
    mode_interval = Counter(g for g in grouped if g is not None).most_common(1)[0][0]
    return timedelta(days=mode_interval)


def main():
    print("--- Starting to Project Future Expected Dividend Dates ---")
    data_dir = "public/data"
    files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
    updated_count = 0

    for filename in tqdm(files, desc="Projecting future dividends"):
        file_path = os.path.join(data_dir, filename)
        data = load_json_file(file_path)

        if not data or "backtestData" not in data or "tickerInfo" not in data:
            continue

        # 'upcoming' 종목은 건너뛰기
        if data["tickerInfo"].get("upcoming"):
            continue

        backtest_data = data["backtestData"]

        # 1. 기존 'expected' 데이터 제거
        original_len = len(backtest_data)
        backtest_data = [item for item in backtest_data if not item.get("expected")]

        # 2. 배당 내역 추출 및 마지막 배당일 찾기
        dividend_entries = sorted(
            [
                item
                for item in backtest_data
                if item.get("amount") is not None or item.get("amountFixed") is not None
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

        while True:
            next_date += interval
            if next_date > one_year_later:
                break

            # 주말(토:5, 일:6)이면 금요일로 조정
            weekday = next_date.weekday()
            if weekday == 5:  # 토요일
                next_date -= timedelta(days=1)
            elif weekday == 6:  # 일요일
                next_date -= timedelta(days=2)

            future_projections.append(
                {"date": next_date.strftime("%Y-%m-%d"), "expected": True}
            )

        if not future_projections:
            continue

        # 5. 데이터 병합 및 저장
        new_backtest_data = backtest_data + future_projections

        # 날짜순으로 정렬하고 중복 제거
        final_data_map = {item["date"]: item for item in new_backtest_data}
        final_backtest_data = sorted(final_data_map.values(), key=lambda x: x["date"])

        # 변경 사항이 있을 경우에만 파일 쓰기
        if len(final_backtest_data) > original_len or any(
            p.get("expected") for p in final_backtest_data
        ):
            data["backtestData"] = final_backtest_data
            if save_json_file(file_path, data):
                updated_count += 1

    print(f"\n--- Projection Finished. Total files updated: {updated_count} ---")


if __name__ == "__main__":
    main()
