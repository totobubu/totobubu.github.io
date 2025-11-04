# NEW FILE: scripts/utils.py
import json
import re
from datetime import datetime, timezone, timedelta


def get_kst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def load_json_file(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def save_json_file(file_path, data, indent=2):
    try:
        # JSON 순서 보장: tickerInfo → backtestData → 기타
        if isinstance(data, dict):
            ordered_data = {}
            # 1순위: tickerInfo
            if "tickerInfo" in data:
                ordered_data["tickerInfo"] = data["tickerInfo"]
            # 2순위: dividendTotal (있는 경우)
            if "dividendTotal" in data:
                ordered_data["dividendTotal"] = data["dividendTotal"]
            # 3순위: backtestData
            if "backtestData" in data:
                ordered_data["backtestData"] = data["backtestData"]
            # 나머지 필드들
            for key in data:
                if key not in ["tickerInfo", "dividendTotal", "backtestData"]:
                    ordered_data[key] = data[key]
            data = ordered_data

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"  -> Error saving file {file_path}: {e}")
        return False


def sanitize_ticker_for_filename(ticker):
    return ticker.replace(".", "-").lower()


def parse_numeric_value(value_str):
    if value_str is None:
        return None
    if isinstance(value_str, (int, float)):
        return float(value_str)
    value_str = str(value_str).strip()
    cleaned_str = re.sub(r"[^0-9.-]", "", value_str)
    if not cleaned_str or cleaned_str == ".":
        return None
    try:
        return float(cleaned_str)
    except ValueError:
        return None


def should_skip_update_timestamp(old_update_str, data_changed):
    """
    Update 필드를 변경할지 여부를 결정합니다.

    Args:
        old_update_str: 기존 Update 필드 값 (예: "2024-01-01 12:00:00 KST")
        data_changed: 실제 데이터 변경 여부 (bool)

    Returns:
        bool: True면 Update 필드를 변경하지 않음 (skip), False면 Update 필드 변경

    정책:
    - 데이터 변경이 있으면 항상 Update 필드 갱신 (False 반환)
    - 데이터 변경이 없고, 마지막 업데이트가 3시간 이내면 Update 필드 유지 (True 반환)
    - 데이터 변경이 없고, 마지막 업데이트가 3시간 초과면 Update 필드 갱신 (False 반환)
    """
    # 데이터 변경이 있으면 항상 Update 필드 갱신
    if data_changed:
        return False

    # 기존 Update 필드가 없으면 갱신
    if not old_update_str:
        return False

    try:
        # "2024-01-01 12:00:00 KST" 형식에서 시간 파싱
        update_time_str = old_update_str.replace(" KST", "").strip()
        old_update_time = datetime.strptime(update_time_str, "%Y-%m-%d %H:%M:%S")

        # KST 시간대로 변환 (UTC+9)
        kst_tz = timezone(timedelta(hours=9))
        old_update_time = old_update_time.replace(tzinfo=kst_tz)

        # 현재 KST 시간
        now_kst = get_kst_now()

        # 시간 차이 계산
        time_diff = now_kst - old_update_time

        # 3시간 이내면 Update 필드 유지 (skip)
        if time_diff <= timedelta(hours=3):
            return True

        # 3시간 초과면 Update 필드 갱신
        return False

    except (ValueError, AttributeError):
        # 파싱 실패 시 안전하게 갱신
        return False
