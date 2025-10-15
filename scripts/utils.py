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
    """JSON 데이터를 파일에 저장합니다. 한글이 깨지지 않도록 ensure_ascii=False를 사용합니다."""
    try:
        # [핵심 수정] ensure_ascii=False 옵션을 모든 json 저장에 적용합니다.
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


def format_large_number(value):
    if value is None or not isinstance(value, (int, float)):
        return "N/A"
    num = float(value)
    if abs(num) >= 1.0e12:
        return f"{num / 1.0e12:.2f}T"
    if abs(num) >= 1.0e9:
        return f"{num / 1.0e9:.2f}B"
    if abs(num) >= 1.0e6:
        return f"{num / 1.0e6:.2f}M"
    if abs(num) >= 1.0e3:
        return f"{num / 1.0e3:.2f}K"
    return str(int(num)) if num == int(num) else str(num)


def format_currency(value, currency="USD", show_symbol=True):
    if value is None or not isinstance(value, (int, float)):
        return "N/A"

    symbol = "₩" if currency == "KRW" else "$"
    symbol_str = symbol if show_symbol else ""

    if currency == "KRW":
        return f"{symbol_str}{int(value):,}"
    else:
        # 소수점 불필요한 0 제거 로직 개선
        if value == int(value):
            return f"{symbol_str}{int(value):,}"
        else:
            return f"{symbol_str}{value:,.6f}".rstrip("0").rstrip(".")


def format_percent(value):
    if value is None or not isinstance(value, (int, float)):
        return "N/A"
    return f"{value * 100:.2f}%"
