#!/usr/bin/env python3
# scripts/info_data_pipeline.py
"""
정보성 데이터 통합 파이프라인
- 한 번의 실행으로 yfinance를 활용한 모든 정보성 데이터 업데이트
- 개별 스크립트를 순차 실행하는 것보다 효율적
"""

import json
import time
import math
import requests
import yfinance as yf
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from tqdm import tqdm
from collections import Counter
import pandas as pd

# 공통 유틸리티
from utils import (
    DATA_DIR,
    PUBLIC_DIR,
    load_json_file,
    save_json_file,
    get_kst_now,
    should_skip_update_timestamp,
    get_data_file_path,
    get_base_symbol,
)

# 경로 설정
NAV_FILE_PATH = PUBLIC_DIR / "nav.json"
US_HOLIDAYS_PATH = PUBLIC_DIR / "holidays" / "us_holidays.json"
KR_HOLIDAYS_PATH = PUBLIC_DIR / "holidays" / "kr_holidays.json"

# 글로벌 상태 (한 번만 로드)
nav_data = None
ticker_info_map = {}
active_symbols = []
us_holidays = set()
kr_holidays = set()
custom_suffix_fallbacks = {}

SUFFIX_FALLBACKS = {
    ".KS": [".KQ"],
    ".KQ": [".KS"],
}
symbol_suffix_overrides = {}

# --- Rate limit configuration (half-speed throttling) ---
INFO_BATCH_SIZE = 50  # 이전 100
INFO_BATCH_DELAY_SEC = 2.0  # 이전 1초 간격보다 2배 대기
INFO_SYMBOL_DELAY_SEC = 0.05  # 개별 심볼 후 짧은 휴식
DIVIDEND_SYMBOL_DELAY_SEC = 0.2  # 배당 수집시 요청 간 딜레이


def replace_symbol_suffix(symbol, new_suffix):
    """심볼 접미사를 안전하게 교체"""
    if not new_suffix:
        return symbol
    suffix = new_suffix if new_suffix.startswith(".") else f".{new_suffix}"
    if "." in symbol:
        base = symbol[: symbol.rfind(".")]
    else:
        base = symbol
    return f"{base}{suffix}"


def iter_symbol_candidates(symbol):
    """원본 + 대체 접미사를 순회"""
    seen = set()
    override = symbol_suffix_overrides.get(symbol)
    if override:
        seen.add(override)
        yield override
    if symbol not in seen:
        seen.add(symbol)
        yield symbol

    for alt_suffix in custom_suffix_fallbacks.get(symbol, []):
        candidate = replace_symbol_suffix(symbol, alt_suffix)
        if candidate not in seen:
            seen.add(candidate)
            yield candidate

    for suffix, alternatives in SUFFIX_FALLBACKS.items():
        if symbol.endswith(suffix):
            for alt_suffix in alternatives:
                candidate = replace_symbol_suffix(symbol, alt_suffix)
                if candidate not in seen:
                    seen.add(candidate)
                    yield candidate
            break


def record_symbol_override(original_symbol, resolved_symbol):
    """대체 접미사를 캐시"""
    if original_symbol != resolved_symbol:
        symbol_suffix_overrides[original_symbol] = resolved_symbol


def fetch_dividends_with_suffix_fallback(symbol, start_date_str):
    """접미사를 바꿔가며 배당 데이터 시도"""
    last_exception = None
    last_series = None

    for candidate in iter_symbol_candidates(symbol):
        try:
            ticker_obj = yf.Ticker(candidate)
            dividends = ticker_obj.dividends
            filtered = dividends[dividends.index >= start_date_str]
        except Exception as exc:
            last_exception = exc
            continue

        last_series = filtered
        if not filtered.empty:
            if candidate != symbol:
                tqdm.write(f"  ↺ {symbol} → {candidate} 배당 데이터 사용")
            record_symbol_override(symbol, candidate)
            return filtered

    if last_series is not None:
        return last_series
    if last_exception:
        raise last_exception
    return pd.Series(dtype="float64")


def fetch_ticker_info_with_suffix_fallback(symbol):
    """접미사 대체로 티커 정보 재시도"""
    last_exception = None

    for candidate in iter_symbol_candidates(symbol):
        try:
            info = yf.Ticker(candidate).info
        except Exception as exc:
            last_exception = exc
            continue

        if info:
            if candidate != symbol:
                tqdm.write(f"  ↺ {symbol} → {candidate} 티커 정보 사용")
            record_symbol_override(symbol, candidate)
            return info

    if last_exception:
        raise last_exception
    return {}


# ============================================================================
# 초기화
# ============================================================================
def initialize(market_filter=None):
    """
    공통 데이터 로드 (한 번만 실행)

    Args:
        market_filter: "KR" 또는 "US" 또는 None (전체)
    """
    global nav_data, ticker_info_map, active_symbols, us_holidays, kr_holidays
    global custom_suffix_fallbacks

    print("=" * 80)
    print("🚀 정보성 데이터 통합 파이프라인 시작")
    if market_filter:
        print(f"   필터: {market_filter} 티커만 처리")
    print("=" * 80)

    # nav.json 로드
    print("\n[1/3] nav.json 로드 중...")
    nav_data = load_json_file(NAV_FILE_PATH)
    if not nav_data:
        print("❌ nav.json을 찾을 수 없습니다.")
        return False

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]

    # 시장 필터링
    if market_filter:
        if market_filter.upper() == "KR":
            active_tickers_info = [
                t
                for t in active_tickers_info
                if t.get("currency") == "KRW"
                or t.get("market") in ["KOSPI", "KOSDAQ", "KONEX"]
            ]
        elif market_filter.upper() == "US":
            active_tickers_info = [
                t
                for t in active_tickers_info
                if t.get("currency") == "USD"
                or t.get("market") in ["NYSE", "NASDAQ", "AMEX"]
            ]

    ticker_info_map = {}
    custom_suffix_fallbacks = {}
    for entry in active_tickers_info:
        yf_symbol = (entry.get("yfSymbol") or entry.get("symbol") or "").upper()
        base_symbol = get_base_symbol(yf_symbol) or entry.get("symbol")
        if not base_symbol:
            continue
        ticker_info_map[base_symbol] = {
            **entry,
            "symbol": base_symbol,
            "yfSymbol": yf_symbol,
        }

    active_symbols = list(ticker_info_map.keys())

    print(f"   ✓ 활성 티커 {len(active_symbols)}개 로드 완료")

    # 휴일 데이터 로드
    print("\n[2/3] 휴일 데이터 로드 중...")
    us_holidays = set(h["date"] for h in load_json_file(US_HOLIDAYS_PATH) or [])
    kr_holidays = set(h["date"] for h in load_json_file(KR_HOLIDAYS_PATH) or [])
    print(f"   ✓ 미국 휴일: {len(us_holidays)}일, 한국 휴일: {len(kr_holidays)}일")

    # 데이터 디렉토리 확인
    print("\n[3/3] 데이터 디렉토리 확인 중...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"   ✓ 데이터 디렉토리: {DATA_DIR}")

    print("\n✅ 초기화 완료\n")
    return True


# ============================================================================
# ISIN 유틸 함수
# ============================================================================
# Step 1: 배당 데이터 업데이트 (update_dividends)
# ============================================================================
def get_last_dividend_date(file_path):
    """JSON 파일에서 마지막 배당 지급일 찾기"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        backtest_data = data.get("backtestData", [])
        dividend_dates = [
            item["date"]
            for item in backtest_data
            if "amount" in item or "amountFixed" in item
        ]
        if dividend_dates:
            return max(dividend_dates)
        return None
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def update_dividends():
    """배당 데이터 증분 업데이트"""
    print("\n" + "=" * 80)
    print("📊 STEP 1: 배당 데이터 업데이트")
    print("=" * 80)

    updated_count = 0

    for symbol in tqdm(active_symbols, desc="배당 데이터 수집"):
        try:
            ticker_meta = ticker_info_map.get(symbol, {})
            yahoo_symbol = ticker_meta.get("yfSymbol") or ticker_meta.get("symbol")
            if not yahoo_symbol:
                continue
            file_path = get_data_file_path(yahoo_symbol, ticker_meta.get("market"))

            # 마지막 배당일 조회
            last_div_date_str = get_last_dividend_date(file_path)

            # 다운로드 시작일 설정
            if last_div_date_str:
                start_date = datetime.strptime(
                    last_div_date_str, "%Y-%m-%d"
                ) + timedelta(days=1)
                start_date_str = start_date.strftime("%Y-%m-%d")
            else:
                start_date_str = ticker_meta.get("ipoDate", "1990-01-01")

            # 이미 최신이면 건너뛰기
            if (
                datetime.strptime(start_date_str, "%Y-%m-%d").date()
                > datetime.now().date()
            ):
                continue

            # yfinance에서 배당 데이터 다운로드 (접미사 자동 보정)
            new_dividends_df = fetch_dividends_with_suffix_fallback(
                yahoo_symbol, start_date_str
            )

            if new_dividends_df.empty:
                continue

            # 기존 데이터와 병합
            existing_data = load_json_file(file_path) or {"backtestData": []}
            backtest_data = existing_data.get("backtestData", [])
            backtest_map = {item["date"]: item for item in backtest_data}
            original_data_str = json.dumps(backtest_data, sort_keys=True)
            currency = ticker_meta.get("currency", "USD")

            for date, amount in new_dividends_df.items():
                date_str = date.strftime("%Y-%m-%d")
                new_amount = int(round(amount)) if currency == "KRW" else float(amount)

                if date_str not in backtest_map:
                    backtest_map[date_str] = {"date": date_str}

                backtest_map[date_str]["amount"] = new_amount

            final_backtest_data = sorted(backtest_map.values(), key=lambda x: x["date"])

            # 변경사항이 있을 때만 저장
            if original_data_str != json.dumps(final_backtest_data, sort_keys=True):
                existing_data["backtestData"] = final_backtest_data
                save_json_file(file_path, existing_data, indent=4)
                updated_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ {symbol} 처리 중 오류: {e}")

        if DIVIDEND_SYMBOL_DELAY_SEC:
            time.sleep(DIVIDEND_SYMBOL_DELAY_SEC)

    print(f"\n✅ 배당 데이터 업데이트 완료: {updated_count}개 파일 변경\n")
    return updated_count


# ============================================================================
# Step 2: 티커 정보 업데이트 (scraper_info)
# ============================================================================
def fetch_bulk_ticker_info_batch(symbol_pairs_batch):
    """여러 티커의 정보를 배치로 가져오기"""
    bulk_data = {}
    try:
        symbol_fetch_map = {}
        for base_symbol, yahoo_symbol in symbol_pairs_batch:
            if not yahoo_symbol:
                continue
            fetch_symbol = symbol_suffix_overrides.get(yahoo_symbol, yahoo_symbol)
            symbol_fetch_map[base_symbol] = fetch_symbol
        unique_fetch_symbols = list(set(symbol_fetch_map.values()))
        tickers = yf.Tickers(unique_fetch_symbols)

        for original_symbol, fetch_symbol in symbol_fetch_map.items():
            ticker_obj = tickers.tickers.get(fetch_symbol)
            if not ticker_obj:
                bulk_data[original_symbol] = None
                continue
            try:
                bulk_data[original_symbol] = ticker_obj.info
            except Exception:
                bulk_data[original_symbol] = None
        return bulk_data
    except Exception as e:
        print(f"  ❌ 배치 가져오기 오류: {e}")
        return {base_symbol: None for base_symbol, _ in symbol_pairs_batch}


def process_single_ticker_info(info):
    """티커 정보 가공"""
    if not info:
        return {}

    def normalize_number(value):
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int,)):
            return value
        if isinstance(value, float):
            if not pd.notna(value):
                return None
            if value.is_integer():
                return int(value)
            return round(value, 6)
        try:
            parsed = float(value)
            if math.isnan(parsed) or math.isinf(parsed):
                return None
            if parsed.is_integer():
                return int(parsed)
            return round(parsed, 6)
        except Exception:
            return value

    current_price = info.get("regularMarketPrice") or info.get("previousClose")
    yield_val = (
        (info.get("trailingAnnualDividendRate", 0) / current_price)
        if current_price and info.get("trailingAnnualDividendRate")
        else None
    )

    earnings_ts = info.get("earningsTimestamp")
    earnings_date = (
        datetime.fromtimestamp(earnings_ts).strftime("%Y-%m-%d")
        if earnings_ts
        else None
    )

    fifty_two_week_range = (
        f"{info.get('fiftyTwoWeekLow')} - {info.get('fiftyTwoWeekHigh')}"
        if info.get("fiftyTwoWeekLow") and info.get("fiftyTwoWeekHigh")
        else None
    )

    return {
        "regularMarketPrice": normalize_number(info.get("regularMarketPrice")),
        "englishName": info.get("longName"),
        "earningsDate": earnings_date,
        "enterpriseValue": normalize_number(info.get("enterpriseValue")),
        "marketCap": normalize_number(info.get("marketCap")),
        "Volume": normalize_number(info.get("volume")),
        "AvgVolume": normalize_number(info.get("averageVolume")),
        "sharesOutstanding": normalize_number(info.get("sharesOutstanding")),
        "52Week": fifty_two_week_range,
        "Yield": normalize_number(yield_val),
        "dividendRate": normalize_number(info.get("dividendRate")),
        "payoutRatio": normalize_number(info.get("payoutRatio")),
        "isin": info.get("isin"),
    }


def update_ticker_info():
    """티커 정보 업데이트 + marketCap을 backtestData에 추가 (통합)"""
    print("\n" + "=" * 80)
    print("📋 STEP 2: 티커 정보 + 시가총액 업데이트 (통합)")
    print("=" * 80)

    batch_size = INFO_BATCH_SIZE
    all_bulk_info = {}

    # 배치로 정보 가져오기
    for i in tqdm(
        range(0, len(active_symbols), batch_size), desc="티커 정보 배치 수집"
    ):
        batch_keys = active_symbols[i : i + batch_size]
        symbol_pairs = []
        for base_symbol in batch_keys:
            ticker_meta = ticker_info_map.get(base_symbol, {})
            yahoo_symbol = ticker_meta.get("yfSymbol") or ticker_meta.get("symbol")
            symbol_pairs.append((base_symbol, yahoo_symbol))
        batch_info = fetch_bulk_ticker_info_batch(symbol_pairs)
        all_bulk_info.update(batch_info)
        if i + batch_size < len(active_symbols):
            time.sleep(INFO_BATCH_DELAY_SEC)

    total_changed_files = 0
    marketcap_added_count = 0
    now_kst_str = get_kst_now().strftime("%Y-%m-%d %H:%M:%S KST")
    today_str = datetime.now().strftime("%Y-%m-%d")

    # 개별 티커 처리
    for symbol in tqdm(active_symbols, desc="티커 정보 + 시가총액 처리"):
        try:
            info_from_nav = ticker_info_map[symbol]
            yahoo_symbol = info_from_nav.get("yfSymbol") or info_from_nav.get("symbol")
            raw_dynamic_info = all_bulk_info.get(symbol)
            if not raw_dynamic_info:
                raw_dynamic_info = fetch_ticker_info_with_suffix_fallback(yahoo_symbol)
            dynamic_info = process_single_ticker_info(raw_dynamic_info)

            file_path = get_data_file_path(yahoo_symbol, info_from_nav.get("market"))
            existing_data = load_json_file(file_path) or {
                "tickerInfo": {},
                "backtestData": [],
            }
            old_info = existing_data.get("tickerInfo", {})

            new_info = {
                "Symbol": symbol,
                "koName": info_from_nav.get("koName"),
                "longName": info_from_nav.get("longName"),
                "company": info_from_nav.get("company"),
                "frequency": info_from_nav.get("frequency"),
                "group": info_from_nav.get("group"),
                "underlying": info_from_nav.get("underlying"),
                "market": info_from_nav.get("market"),
                "currency": info_from_nav.get("currency"),
                "Update": now_kst_str,
            }
            new_info.update(dynamic_info)

            isin_value = (
                dynamic_info.get("isin")
                or old_info.get("isin")
                or info_from_nav.get("isin")
            )
            if isin_value:
                new_info["isin"] = isin_value
                if info_from_nav.get("isin") != isin_value:
                    info_from_nav["isin"] = isin_value
            # 기존 이벤트(예: frequencyChanges, weekdayChanges, splits 등)는 보존
            existing_events = existing_data.get("tickerInfo", {}).get("events", {})
            if existing_events:
                new_info["events"] = existing_events

            # 변경사항 추적
            changes = {}
            old_update = old_info.get("Update") if old_info else None
            if (
                old_info
                and old_update
                and old_update.split(" ")[0] != now_kst_str.split(" ")[0]
            ):
                for key, new_val in dynamic_info.items():
                    old_val = old_info.get(key)
                    if old_val is not None and isinstance(new_val, (int, float)):
                        if new_val > old_val:
                            changes[key] = {"value": old_val, "change": "up"}
                        elif new_val < old_val:
                            changes[key] = {"value": old_val, "change": "down"}
            elif old_info:
                changes = old_info.get("changes", {})
            new_info["changes"] = changes

            # 변경 여부 확인
            compare_old = {
                k: v for k, v in old_info.items() if k not in ["Update", "changes"]
            }
            compare_new = {
                k: v for k, v in new_info.items() if k not in ["Update", "changes"]
            }

            data_changed = json.dumps(compare_old, sort_keys=True) != json.dumps(
                compare_new, sort_keys=True
            )

            # [추가] marketCap을 backtestData에도 추가 (중복 API 호출 제거)
            market_cap = dynamic_info.get("marketCap")
            backtest_data_changed = False
            if market_cap:
                backtest_data = existing_data.get("backtestData", [])
                today_entry = None
                for entry in backtest_data:
                    if entry.get("date") == today_str:
                        today_entry = entry
                        break

                # 오늘 날짜가 없으면 가장 최근 항목 찾기
                if not today_entry:
                    sorted_data = sorted(
                        backtest_data, key=lambda x: x.get("date", ""), reverse=True
                    )
                    if sorted_data:
                        today_entry = sorted_data[0]  # 가장 최근 항목

                if today_entry and "marketCap" not in today_entry:
                    today_entry["marketCap"] = market_cap
                    backtest_data_changed = True
                    marketcap_added_count += 1

            # 전체 변경 여부 = tickerInfo 변경 또는 backtestData 변경
            any_data_changed = data_changed or backtest_data_changed

            # 정책: 데이터 변경이 없으면 Update 필드 유지하고 저장 안함
            if should_skip_update_timestamp(old_info.get("Update"), any_data_changed):
                new_info["Update"] = old_info.get("Update")  # 기존 Update 유지
                continue  # 데이터 변경이 없으면 저장하지 않음

            # 데이터 변경이 있으면 Update 필드 갱신하고 저장
            existing_data["tickerInfo"] = new_info
            save_json_file(file_path, existing_data)
            total_changed_files += 1

        except Exception as e:
            tqdm.write(f"  ❌ {symbol} 처리 중 오류: {e}")

        if INFO_SYMBOL_DELAY_SEC:
            time.sleep(INFO_SYMBOL_DELAY_SEC)

    print(f"\n✅ 티커 정보 업데이트 완료: {total_changed_files}개 파일 변경")
    print(f"   💰 시가총액 추가: {marketcap_added_count}개\n")
    return total_changed_files


# ============================================================================
# Step 3: 배당 빈도 분석 (analyze_dividend_frequency)
# ============================================================================
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
    """배당 빈도와 그룹 분석"""
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
            return 7
        if 25 <= days <= 35:
            return 30
        if 81 <= days <= 101:
            return 91
        if 335 <= days <= 395:
            return 365
        return None

    grouped_intervals = [get_interval_group(days) for days in intervals]
    grouped_intervals = [g for g in grouped_intervals if g is not None]

    if not grouped_intervals:
        return None, None

    most_common_interval = Counter(grouped_intervals).most_common(1)[0][0]

    frequency_map = {7: "매주", 30: "매월", 91: "분기", 365: "매년"}
    frequency = frequency_map.get(most_common_interval)

    if most_common_interval == 7:
        weekday_counts = Counter(d.weekday() for d in dividend_dates)
        most_common_weekday = weekday_counts.most_common(1)[0][0]
        weekday_map = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금"}
        group = weekday_map.get(most_common_weekday)
    else:
        month_counts = Counter(d.month for d in dividend_dates)
        top_months = sorted(month_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        group = "".join(
            MONTH_INITIALS[m] for m, _ in sorted(top_months, key=lambda x: x[0])
        )

    return frequency, group


def analyze_dividend_frequency():
    """배당 빈도 분석 및 nav.json 업데이트"""
    print("\n" + "=" * 80)
    print("📅 STEP 3: 배당 빈도 분석")
    print("=" * 80)

    updated_count = 0

    for ticker_info in tqdm(nav_data.get("nav", []), desc="배당 빈도 분석"):
        symbol = ticker_info.get("symbol")
        if not symbol or ticker_info.get("upcoming"):
            continue

        file_path = get_data_file_path(symbol, ticker_info.get("market"))
        data = load_json_file(file_path)

        if not data or "backtestData" not in data:
            continue

        dividend_entries = [
            item
            for item in data["backtestData"]
            if ("amount" in item or "amountFixed" in item)
            and not item.get("forecasted")
        ]

        if len(dividend_entries) < 2:
            continue

        dividend_dates = [
            datetime.strptime(item["date"], "%Y-%m-%d") for item in dividend_entries
        ]
        frequency, group = analyze_frequency_and_group(dividend_dates)

        if (
            frequency
            and group
            and (
                ticker_info.get("frequency") != frequency
                or ticker_info.get("group") != group
            )
        ):
            ticker_info["frequency"] = frequency
            ticker_info["group"] = group
            updated_count += 1

    # nav.json 저장
    save_json_file(NAV_FILE_PATH, nav_data)
    print(f"\n✅ 배당 빈도 분석 완료: {updated_count}개 티커 업데이트\n")
    return updated_count


# ============================================================================
# Step 4: 미래 배당일 예측 (project_future_dividends)
# ============================================================================
def get_previous_business_day(date, holiday_set):
    """이전 영업일 찾기"""
    current_date = date
    while True:
        weekday = current_date.weekday()
        date_str = current_date.strftime("%Y-%m-%d")
        if weekday < 5 and date_str not in holiday_set:
            return current_date
        current_date -= timedelta(days=1)


def project_future_dividends():
    """미래 배당일 예측"""
    print("\n" + "=" * 80)
    print("🔮 STEP 4: 미래 배당일 예측")
    print("=" * 80)

    today = datetime.now()
    limit_date = today + relativedelta(months=6)

    files = list(DATA_DIR.glob("*.json"))
    updated_count = 0

    for file_path in tqdm(files, desc="미래 배당일 예측"):
        data = load_json_file(file_path)

        if not data or "backtestData" not in data or "tickerInfo" not in data:
            continue

        ticker_info = data["tickerInfo"]
        if ticker_info.get("upcoming") or not ticker_info.get("frequency"):
            continue

        original_data_str = json.dumps(data["backtestData"], sort_keys=True)

        # forecasted 제거
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

        while True:
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

            if next_date < today:
                continue

            if next_date >= limit_date:
                break

            adjusted_date = get_previous_business_day(next_date, holiday_set)
            date_str = adjusted_date.strftime("%Y-%m-%d")

            if date_str not in existing_dates:
                future_projections.append({"date": date_str, "forecasted": True})
                existing_dates.add(date_str)

        if not future_projections:
            continue

        final_backtest_data = cleaned_backtest_data + future_projections
        final_backtest_data.sort(key=lambda x: x["date"])
        data["backtestData"] = final_backtest_data

        if original_data_str != json.dumps(data["backtestData"], sort_keys=True):
            save_json_file(file_path, data)
            updated_count += 1

    print(f"\n✅ 미래 배당일 예측 완료: {updated_count}개 파일 업데이트\n")
    return updated_count


# ============================================================================
# 메인 실행
# ============================================================================
def main():
    """통합 파이프라인 실행"""
    import os

    start_time = time.time()

    # 환경변수에서 시장 필터 읽기
    market_filter = os.environ.get("MARKET_FILTER", "").strip() or None

    # 초기화
    if not initialize(market_filter):
        return

    # Step 1: 배당 데이터 업데이트
    dividend_updates = update_dividends()

    # Step 2: 티커 정보 + 시가총액 업데이트 (통합, 중복 API 호출 제거)
    info_updates = update_ticker_info()

    # Step 3: 배당 빈도 분석
    frequency_updates = analyze_dividend_frequency()

    # Step 4: 미래 배당일 예측
    projection_updates = project_future_dividends()

    # 완료
    elapsed_time = time.time() - start_time
    print("\n" + "=" * 80)
    print("🎉 정보성 데이터 통합 파이프라인 완료 (최적화됨)")
    print("=" * 80)
    print(f"📊 배당 데이터: {dividend_updates}개 파일 업데이트")
    print(f"📋 티커 정보 + 시가총액: {info_updates}개 파일 업데이트")
    print(f"📅 배당 빈도: {frequency_updates}개 티커 업데이트")
    print(f"🔮 배당일 예측: {projection_updates}개 파일 업데이트")
    print(f"⏱️  총 소요 시간: {elapsed_time:.2f}초")
    print(f"✨ 최적화: 중복 API 호출 제거로 성능 향상")
    print("=" * 80)


if __name__ == "__main__":
    main()
