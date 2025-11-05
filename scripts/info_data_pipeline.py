#!/usr/bin/env python3
# scripts/info_data_pipeline.py
"""
정보성 데이터 통합 파이프라인
- 한 번의 실행으로 yfinance를 활용한 모든 정보성 데이터 업데이트
- 개별 스크립트를 순차 실행하는 것보다 효율적
"""

import os
import json
import time
import yfinance as yf
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from tqdm import tqdm
from collections import Counter
import pandas as pd

# 공통 유틸리티
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    get_kst_now,
    should_skip_update_timestamp,
)

# 경로 설정
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")
US_HOLIDAYS_PATH = os.path.join(PUBLIC_DIR, "holidays", "us_holidays.json")
KR_HOLIDAYS_PATH = os.path.join(PUBLIC_DIR, "holidays", "kr_holidays.json")

# 글로벌 상태 (한 번만 로드)
nav_data = None
ticker_info_map = {}
active_symbols = []
us_holidays = set()
kr_holidays = set()


# ============================================================================
# 초기화
# ============================================================================
def initialize():
    """공통 데이터 로드 (한 번만 실행)"""
    global nav_data, ticker_info_map, active_symbols, us_holidays, kr_holidays
    
    print("=" * 80)
    print("🚀 정보성 데이터 통합 파이프라인 시작")
    print("=" * 80)
    
    # nav.json 로드
    print("\n[1/3] nav.json 로드 중...")
    nav_data = load_json_file(NAV_FILE_PATH)
    if not nav_data:
        print("❌ nav.json을 찾을 수 없습니다.")
        return False
    
    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    ticker_info_map = {t["symbol"]: t for t in active_tickers_info}
    active_symbols = list(ticker_info_map.keys())
    
    print(f"   ✓ 활성 티커 {len(active_symbols)}개 로드 완료")
    
    # 휴일 데이터 로드
    print("\n[2/3] 휴일 데이터 로드 중...")
    us_holidays = set(h["date"] for h in load_json_file(US_HOLIDAYS_PATH) or [])
    kr_holidays = set(h["date"] for h in load_json_file(KR_HOLIDAYS_PATH) or [])
    print(f"   ✓ 미국 휴일: {len(us_holidays)}일, 한국 휴일: {len(kr_holidays)}일")
    
    # 데이터 디렉토리 확인
    print("\n[3/3] 데이터 디렉토리 확인 중...")
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"   ✓ 데이터 디렉토리: {DATA_DIR}")
    
    print("\n✅ 초기화 완료\n")
    return True


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
            sanitized_symbol = sanitize_ticker_for_filename(symbol)
            file_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")
            
            # 마지막 배당일 조회
            last_div_date_str = get_last_dividend_date(file_path)
            
            # 다운로드 시작일 설정
            if last_div_date_str:
                start_date = datetime.strptime(last_div_date_str, "%Y-%m-%d") + timedelta(days=1)
                start_date_str = start_date.strftime("%Y-%m-%d")
            else:
                start_date_str = ticker_info_map.get(symbol, {}).get("ipoDate", "1990-01-01")
            
            # 이미 최신이면 건너뛰기
            if datetime.strptime(start_date_str, "%Y-%m-%d").date() > datetime.now().date():
                continue
            
            # yfinance에서 배당 데이터 다운로드
            ticker_obj = yf.Ticker(symbol)
            new_dividends_df = ticker_obj.dividends[ticker_obj.dividends.index >= start_date_str]
            
            if new_dividends_df.empty:
                continue
            
            # 기존 데이터와 병합
            existing_data = load_json_file(file_path) or {"backtestData": []}
            backtest_data = existing_data.get("backtestData", [])
            backtest_map = {item["date"]: item for item in backtest_data}
            original_data_str = json.dumps(backtest_data, sort_keys=True)
            currency = ticker_info_map.get(symbol, {}).get("currency", "USD")
            
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
    
    print(f"\n✅ 배당 데이터 업데이트 완료: {updated_count}개 파일 변경\n")
    return updated_count


# ============================================================================
# Step 2: 티커 정보 업데이트 (scraper_info)
# ============================================================================
def fetch_bulk_ticker_info_batch(ticker_symbols_batch):
    """여러 티커의 정보를 배치로 가져오기"""
    bulk_data = {}
    try:
        tickers = yf.Tickers(ticker_symbols_batch)
        for symbol, ticker_obj in tickers.tickers.items():
            try:
                bulk_data[symbol] = ticker_obj.info
            except Exception:
                bulk_data[symbol] = None
        return bulk_data
    except Exception as e:
        print(f"  ❌ 배치 가져오기 오류: {e}")
        return {symbol: None for symbol in ticker_symbols_batch}


def process_single_ticker_info(info):
    """티커 정보 가공"""
    if not info:
        return {}
    
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
        "regularMarketPrice": info.get("regularMarketPrice"),
        "englishName": info.get("longName"),
        "earningsDate": earnings_date,
        "enterpriseValue": info.get("enterpriseValue"),
        "marketCap": info.get("marketCap"),
        "Volume": info.get("volume"),
        "AvgVolume": info.get("averageVolume"),
        "sharesOutstanding": info.get("sharesOutstanding"),
        "52Week": fifty_two_week_range,
        "Yield": yield_val,
        "dividendRate": info.get("dividendRate"),
        "payoutRatio": info.get("payoutRatio"),
    }


def update_ticker_info():
    """티커 정보 업데이트 + marketCap을 backtestData에 추가 (통합)"""
    print("\n" + "=" * 80)
    print("📋 STEP 2: 티커 정보 + 시가총액 업데이트 (통합)")
    print("=" * 80)
    
    batch_size = 100
    all_bulk_info = {}
    
    # 배치로 정보 가져오기
    for i in tqdm(range(0, len(active_symbols), batch_size), desc="티커 정보 배치 수집"):
        batch = active_symbols[i : i + batch_size]
        batch_info = fetch_bulk_ticker_info_batch(batch)
        all_bulk_info.update(batch_info)
        if i + batch_size < len(active_symbols):
            time.sleep(1)
    
    total_changed_files = 0
    marketcap_added_count = 0
    now_kst_str = get_kst_now().strftime("%Y-%m-%d %H:%M:%S KST")
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # 개별 티커 처리
    for symbol in tqdm(active_symbols, desc="티커 정보 + 시가총액 처리"):
        try:
            info_from_nav = ticker_info_map[symbol]
            raw_dynamic_info = all_bulk_info.get(symbol)
            dynamic_info = process_single_ticker_info(raw_dynamic_info)
            
            file_path = os.path.join(DATA_DIR, f"{sanitize_ticker_for_filename(symbol)}.json")
            existing_data = load_json_file(file_path) or {"tickerInfo": {}, "backtestData": []}
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
            
            # 변경사항 추적
            changes = {}
            old_update = old_info.get("Update") if old_info else None
            if old_info and old_update and old_update.split(" ")[0] != now_kst_str.split(" ")[0]:
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
            compare_old = {k: v for k, v in old_info.items() if k not in ["Update", "changes"]}
            compare_new = {k: v for k, v in new_info.items() if k not in ["Update", "changes"]}
            
            data_changed = json.dumps(compare_old, sort_keys=True) != json.dumps(compare_new, sort_keys=True)
            
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
                
                if today_entry and "marketCap" not in today_entry:
                    today_entry["marketCap"] = market_cap
                    backtest_data_changed = True
                    marketcap_added_count += 1
            
            # 정책: 데이터 변경이 없고 3시간 이내 업데이트면 Update 필드 유지
            if should_skip_update_timestamp(old_info.get("Update"), data_changed):
                new_info["Update"] = old_info.get("Update")  # 기존 Update 유지
                # 데이터 변경이 없고 marketCap도 추가 안됐으면 저장하지 않음
                if not data_changed and not backtest_data_changed:
                    continue
            
            # 데이터 변경이 있거나, marketCap이 추가되거나, 3시간 초과 시 저장
            if data_changed or backtest_data_changed or not should_skip_update_timestamp(old_info.get("Update"), data_changed):
                existing_data["tickerInfo"] = new_info
                save_json_file(file_path, existing_data)
                total_changed_files += 1
        
        except Exception as e:
            tqdm.write(f"  ❌ {symbol} 처리 중 오류: {e}")
    
    print(f"\n✅ 티커 정보 업데이트 완료: {total_changed_files}개 파일 변경")
    print(f"   💰 시가총액 추가: {marketcap_added_count}개\n")
    return total_changed_files


# ============================================================================
# Step 3: 배당 빈도 분석 (analyze_dividend_frequency)
# ============================================================================
MONTH_INITIALS = {
    1: "J", 2: "F", 3: "M", 4: "A", 5: "M", 6: "J",
    7: "J", 8: "A", 9: "S", 10: "O", 11: "N", 12: "D",
}


def analyze_frequency_and_group(dividend_dates):
    """배당 빈도와 그룹 분석"""
    if len(dividend_dates) < 2:
        return None, None
    
    intervals = [(dividend_dates[i] - dividend_dates[i - 1]).days for i in range(1, len(dividend_dates))]
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
        group = "".join(MONTH_INITIALS[m] for m, _ in sorted(top_months, key=lambda x: x[0]))
    
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
        
        file_path = os.path.join(DATA_DIR, f"{sanitize_ticker_for_filename(symbol)}.json")
        data = load_json_file(file_path)
        
        if not data or "backtestData" not in data:
            continue
        
        dividend_entries = [
            item for item in data["backtestData"]
            if ("amount" in item or "amountFixed" in item) and not item.get("forecasted")
        ]
        
        if len(dividend_entries) < 2:
            continue
        
        dividend_dates = [datetime.strptime(item["date"], "%Y-%m-%d") for item in dividend_entries]
        frequency, group = analyze_frequency_and_group(dividend_dates)
        
        if frequency and group:
            if ticker_info.get("frequency") != frequency or ticker_info.get("group") != group:
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
    
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    updated_count = 0
    
    for filename in tqdm(files, desc="미래 배당일 예측"):
        file_path = os.path.join(DATA_DIR, filename)
        data = load_json_file(file_path)
        
        if not data or "backtestData" not in data or "tickerInfo" not in data:
            continue
        
        ticker_info = data["tickerInfo"]
        if ticker_info.get("upcoming") or not ticker_info.get("frequency"):
            continue
        
        original_data_str = json.dumps(data["backtestData"], sort_keys=True)
        
        # forecasted 제거
        cleaned_backtest_data = [item for item in data["backtestData"] if not item.get("forecasted")]
        
        known_entries = [
            item for item in cleaned_backtest_data
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
    start_time = time.time()
    
    # 초기화
    if not initialize():
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

