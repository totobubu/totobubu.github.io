# NEW FILE: scripts/utils.py
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

# R2 업로드 기능 임포트
try:
    from scripts.r2_config import upload_json_to_r2, download_from_r2, get_r2_public_url
    R2_AVAILABLE = True
except ImportError:
    R2_AVAILABLE = False


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


# ========== R2 통합 함수 ==========

def save_json_with_r2(file_path, data, indent=2, r2_key=None):
    """
    JSON 파일을 로컬과 R2 둘 다에 저장
    
    Args:
        file_path: 로컬 파일 경로
        data: 저장할 데이터
        indent: JSON 들여쓰기
        r2_key: R2 키 (None이면 file_path에서 추출)
    
    Returns:
        bool: 성공 여부
    """
    # 로컬 저장
    local_success = save_json_file(file_path, data, indent)
    
    # R2 업로드
    if R2_AVAILABLE:
        if r2_key is None:
            # file_path에서 public/ 이후 경로 추출
            path_str = str(file_path).replace("\\", "/")
            if "public/" in path_str:
                r2_key = path_str.split("public/", 1)[1]
            else:
                r2_key = Path(file_path).name
        
        r2_success = upload_json_to_r2(data, r2_key, indent)
        return local_success and r2_success
    
    return local_success


def load_json_with_r2(file_path, r2_key=None):
    """
    R2 우선, 실패 시 로컬 파일에서 JSON 로드
    
    Args:
        file_path: 로컬 파일 경로 (fallback용)
        r2_key: R2 키 (None이면 file_path에서 추출)
    
    Returns:
        dict or None: JSON 데이터
    """
    # R2에서 먼저 시도
    if R2_AVAILABLE:
        if r2_key is None:
            path_str = str(file_path).replace("\\", "/")
            if "public/" in path_str:
                r2_key = path_str.split("public/", 1)[1]
            else:
                r2_key = Path(file_path).name
        
        data = download_from_r2(r2_key)
        if data is not None:
            return data
    
    # R2 실패 시 로컬 파일에서 로드
    return load_json_file(file_path)


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
