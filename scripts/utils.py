# NEW FILE: scripts/utils.py
import json
import os
from datetime import datetime, timedelta, timezone


def load_json_file(file_path):
    """지정된 경로의 JSON 파일을 읽어 파이썬 객체로 반환합니다."""
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return None


def save_json_file(file_path, data, indent=4):
    """주어진 데이터를 지정된 경로에 JSON 파일로 저장합니다."""
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        return True
    except Exception as e:
        print(f"Error saving {file_path}: {e}")
        return False


def sanitize_ticker_for_filename(ticker_symbol):
    """파일 경로에 사용하기 위해 티커 심볼을 정규화합니다. (예: 'BRK.B' -> 'brk-b')"""
    return ticker_symbol.replace(".", "-").lower()


def get_kst_now():
    """한국 시간(KST) 기준 현재 시각을 반환합니다."""
    return datetime.now(timezone(timedelta(hours=9)))


def parse_numeric_value(value):
    """문자열, 숫자 등 다양한 형태의 값을 float으로 파싱합니다."""
    if value is None or not isinstance(value, (str, int, float)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned_str = (
            str(value).replace("$", "").replace(",", "").replace("%", "").strip()
        )
        return float(cleaned_str)
    except (ValueError, TypeError):
        return None


def format_currency(value, currency="USD"):
    if value is None:
        return "N/A"
    symbol = "₩" if currency == "KRW" else "$"
    if currency == "KRW":
        return f"{symbol}{value:,.0f}"
    return f"{symbol}{value:.2f}"


def format_large_number(value):
    """큰 숫자에 쉼표를 추가하여 포맷팅합니다."""
    return f"{value:,}" if isinstance(value, (int, float)) else "N/A"


def format_percent(value):
    """숫자를 퍼센트 형식의 문자열로 포맷팅합니다."""
    return f"{(value * 100):.2f}%" if isinstance(value, (int, float)) else "N/A"
