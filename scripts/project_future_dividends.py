# scripts/project_future_dividends.py

import os
import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
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


def save_json_file(file_path, data):
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"Error saving file {file_path}: {e}")
        return False


def get_previous_business_day(date, holiday_set):
    current_date = date
    while True:
        weekday = current_date.weekday()
        date_str = current_date.strftime("%Y-%m-%d")
        if weekday < 5 and date_str not in holiday_set:
            return current_date
        current_date -= timedelta(days=1)


def main():
    print("--- Starting to Project Future FORECASTED Dividend Dates ---")

    us_holidays = set(h["date"] for h in load_json_file(US_HOLIDAYS_PATH) or [])
    kr_holidays = set(h["date"] for h in load_json_file(KR_HOLIDAYS_PATH) or [])

    # --- [핵심 수정 1] 오늘 날짜를 기준으로 과거/미래를 판단 ---
    today = datetime.now()
    limit_date = today + relativedelta(months=6)

    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    updated_count = 0

    for filename in tqdm(files, desc="Projecting future dividends"):
        file_path = os.path.join(DATA_DIR, filename)
        data = load_json_file(file_path)

        if not data or "backtestData" not in data or "tickerInfo" not in data:
            continue

        ticker_info = data["tickerInfo"]
        if ticker_info.get("upcoming") or not ticker_info.get("frequency"):
            continue

        original_backtest_data_str = json.dumps(data["backtestData"], sort_keys=True)

        cleaned_backtest_data = [
            item for item in data["backtestData"] if not item.get("forecasted")
        ]

        known_entries = [
            item
            for item in cleaned_backtest_data
            if "amount" in item or "amountFixed" in item or item.get("expected")
        ]

        if not known_entries:
            continue

        last_known_date_str = max(item["date"] for item in known_entries)
        next_date = datetime.strptime(last_known_date_str, "%Y-%m-%d")

        frequency = ticker_info["frequency"]
        group = ticker_info.get("group")
        currency = ticker_info.get("currency", "USD")
        holiday_set = kr_holidays if currency == "KRW" else us_holidays

        future_projections = []
        existing_dates = {item["date"] for item in cleaned_backtest_data}

        while True:  # 무한 루프로 변경 후 내부에서 break 조건 처리
            if frequency == "매주":
                next_date += timedelta(days=7)
                if group in ["월", "화", "수", "목", "금"]:
                    day_map = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4}
                    target_weekday = day_map[group]
                    days_ahead = target_weekday - next_date.weekday()
                    next_date += timedelta(days=days_ahead)
            elif frequency == "매월":
                next_date += relativedelta(months=1)
            elif frequency == "분기":
                next_date += relativedelta(months=3)
            elif frequency == "매년":
                next_date += relativedelta(years=1)
            else:
                break

            # --- [핵심 수정 2] 계산된 날짜가 오늘보다 과거이면 건너뛰고 다음 예측으로 넘어감 ---
            if next_date < today:
                continue

            # 6개월 제한 날짜를 넘어가면 루프 종료
            if next_date >= limit_date:
                break

            adjusted_date = get_previous_business_day(next_date, holiday_set)
            date_str = adjusted_date.strftime("%Y-%m-%d")

            if date_str not in existing_dates:
                future_projections.append({"date": date_str, "forecasted": True})
                existing_dates.add(date_str)

        # 예측된 데이터가 없으면 다음 파일로 넘어감
        if not future_projections:
            continue

        final_backtest_data = cleaned_backtest_data + future_projections
        final_backtest_data.sort(key=lambda x: x["date"])
        data["backtestData"] = final_backtest_data

        if original_backtest_data_str != json.dumps(
            data["backtestData"], sort_keys=True
        ):
            if save_json_file(file_path, data):
                updated_count += 1

    print(f"\n--- Projection Finished. Total files updated: {updated_count} ---")


if __name__ == "__main__":
    main()
