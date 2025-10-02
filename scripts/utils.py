# NEW FILE: scripts/utils.py
import json
import os
from datetime import datetime, timedelta, timezone


def load_json_file(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return None


def save_json_file(file_path, data, indent=4):
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        return True
    except Exception as e:
        print(f"Error saving {file_path}: {e}")
        return False


def sanitize_ticker_for_filename(ticker_symbol):
    return ticker_symbol.replace(".", "-").lower()


def get_kst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def parse_numeric_value(value):
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


def format_currency(value, sign="$"):
    return f"{sign}{value:,.2f}" if isinstance(value, (int, float)) else "N/A"


def format_large_number(value):
    return f"{value:,}" if isinstance(value, (int, float)) else "N/A"


def format_percent(value):
    return f"{(value * 100):.2f}%" if isinstance(value, (int, float)) else "N/A"
