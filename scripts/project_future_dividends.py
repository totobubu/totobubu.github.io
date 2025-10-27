# scripts/project_future_dividends.py

import os
import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta  # 월/분기 계산을 위해 추가
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


# [수정] 이전 영업일 찾는 함수 (주말/공휴일 회피)
def get_previous_business_day(date, holiday_set):
    current_date = date
    while True:
        weekday = current_date.weekday()  # 월요일=0, 일요일=6
        date_str = current_date.strftime("%Y-%m-%d")
        if weekday < 5 and date_str not in holiday_set:
            return current_date
        current_date -= timedelta(days=1)


def main():
    print("--- Starting to Project Future Dividend Dates (Corrected Logic) ---")

    # 공휴일 데이터 로드
    us_holidays = set(h["date"] for h in load_json_file(US_HOLIDAYS_PATH) or [])
    kr_holidays = set(h["date"] for h in load_json_file(KR_HOLIDAYS_PATH) or [])

    # [핵심 수정] 오늘로부터 6개월 후까지만 날짜를 생성하도록 제한
    limit_date = datetime.now() + relativedelta(months=6)

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

        # 1. [핵심 수정] 기존에 자동 생성된 'expected' 항목만 제거
        #    'amount', 'amountFixed'가 있는 항목과 사용자가 직접 추가한 'expected'는 유지됩니다.
        #    이를 위해 amount/amountFixed가 없는 'expected'만 제거합니다.
        original_backtest_data_str = json.dumps(data["backtestData"], sort_keys=True)
        cleaned_backtest_data = [
            item
            for item in data["backtestData"]
            if not (
                item.get("expected")
                and "amount" not in item
                and "amountFixed" not in item
            )
        ]

        # 2. [핵심 수정] 가장 마지막 배당 관련 날짜 찾기 (실지급일, 공시된 예정일 모두 포함)
        known_entries = [
            item
            for item in cleaned_backtest_data
            if "amount" in item or "amountFixed" in item or item.get("expected")
        ]

        if not known_entries:
            continue

        last_known_date_str = max(item["date"] for item in known_entries)
        next_date = datetime.strptime(last_known_date_str, "%Y-%m-%d")

        # 3. [핵심 수정] 미래 예상일 생성 로직
        frequency = ticker_info["frequency"]
        group = ticker_info.get("group")
        currency = ticker_info.get("currency", "USD")
        holiday_set = kr_holidays if currency == "KRW" else us_holidays

        future_projections = []
        # 이미 존재하는 모든 날짜를 Set으로 관리하여 중복 생성 방지
        existing_dates = {item["date"] for item in cleaned_backtest_data}

        while next_date < limit_date:
            # 4. [핵심 수정] 빈도별 다음 날짜 계산
            if frequency == "매주":
                next_date += timedelta(days=7)
                if group in ["월", "화", "수", "목", "금"]:
                    # group에 명시된 요일로 조정 (예: 수요일 배당이면 항상 수요일 근처로)
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
                break  # 지원하지 않는 빈도

            if next_date >= limit_date:
                break

            # 주말/공휴일이면 이전 영업일로 조정
            adjusted_date = get_previous_business_day(next_date, holiday_set)
            date_str = adjusted_date.strftime("%Y-%m-%d")

            # 중복이 아닐 경우에만 추가
            if date_str not in existing_dates:
                future_projections.append({"date": date_str, "expected": True})
                existing_dates.add(date_str)

        if not future_projections:
            continue

        # 5. 데이터 병합 및 저장
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
