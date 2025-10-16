# scripts\update_dividends.py
import os
import json
import yfinance as yf
from datetime import datetime, timedelta
from tqdm import tqdm
import pandas as pd

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")


def format_dividends(dividends_series, currency="USD"):
    if dividends_series.empty: return []
    formatted_list = []
    for date, amount in dividends_series.items():
        # [핵심 수정] KRW인 경우 정수(int)로, 그 외에는 실수(float)로 변환
        processed_amount = int(round(amount)) if currency == "KRW" else float(amount)
        formatted_list.append({"date": date.strftime('%Y-%m-%d'), "amount": processed_amount})
    return formatted_list

def main():
    print("--- Starting Incremental Dividend Data Update (Batch Mode) ---")
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: nav.json not found at {NAV_FILE_PATH}")
        return

    all_tickers_info = nav_data.get("nav", [])

    # 배당 가능성이 있는 활성 티커만 필터링
    dividend_tickers_info = [
        t for t in all_tickers_info
        if not t.get("upcoming", False)
    ]
    
    # [개선] Ticker 정보를 symbol을 키로 하는 딕셔너리로 변환하여 접근성 향상
    ticker_info_map = {t['symbol']: t for t in dividend_tickers_info}

    print(f"Found {len(all_tickers_info)} total tickers. Analyzing {len(dividend_tickers_info)} potential dividend tickers.")

    # 각 티커별 업데이트 시작 날짜 계산
    tickers_to_fetch = {}
    for symbol, ticker_info in ticker_info_map.items():
        sanitized_symbol = symbol.replace(".", "-").lower()
        json_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")
        start_date = datetime.strptime(ticker_info.get("ipoDate", "1990-01-01"), "%Y-%m-%d").date()

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                dividends_list = existing_data.get("backtestData", {}).get("dividends", [])
                if dividends_list:
                    last_dividend_date_str = max(d["date"] for d in dividends_list)
                    start_date = datetime.strptime(last_dividend_date_str, "%Y-%m-%d").date() + timedelta(days=1)
        except (FileNotFoundError, json.JSONDecodeError, ValueError):
            pass

        if start_date <= datetime.now().date():
            tickers_to_fetch[symbol] = start_date

    if not tickers_to_fetch:
        print("All dividend data is up to date. Nothing to fetch.")
        return

    print(f"Found {len(tickers_to_fetch)} tickers that need dividend updates.")

    # 배치 처리
    batch_size = 100
    ticker_list = list(tickers_to_fetch.keys())
    all_new_dividends = {}

    for i in tqdm(range(0, len(ticker_list), batch_size), desc="Fetching Dividend Batches"):
        batch_symbols = ticker_list[i : i + batch_size]
        start_date_for_batch = min(tickers_to_fetch[s] for s in batch_symbols)

        try:
            data = yf.download(
                batch_symbols,
                start=start_date_for_batch,
                actions=True,
                progress=False,
                auto_adjust=True,
            )

            if not data.empty and "Dividends" in data.columns:
                dividends_df = data["Dividends"]
                for symbol in batch_symbols:
                    # Multi-index DataFrame일 경우를 대비하여 symbol이 컬럼에 있는지 확인
                    if symbol in dividends_df.columns:
                        symbol_dividends = dividends_df[symbol][dividends_df[symbol] > 0]
                        if not symbol_dividends.empty:
                            all_new_dividends[symbol] = symbol_dividends
        except Exception as e:
            tqdm.write(f"  ❌ Error in batch starting with {batch_symbols[0]}: {e}")

    # 파일 저장 로직
    updated_count = 0
    for symbol in tqdm(tickers_to_fetch.keys(), desc="Saving Dividend Data"):
        try:
            sanitized_symbol = symbol.replace(".", "-").lower()
            json_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")
            currency = ticker_info.get("currency", "USD") # currency 정보 가져오기

            existing_data = {}
            existing_dividends = []
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                    existing_dividends = existing_data.get("backtestData", {}).get("dividends", [])
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            new_dividends_series = all_new_dividends.get(symbol)

            if new_dividends_series is None or new_dividends_series.empty:
                continue

            # [핵심 수정 1] 한국 주식(KRW)일 경우 amount를 int로 변환
            # new_dividends = [
            #     {
            #         "date": date.strftime("%Y-%m-%d"),
            #         "amount": int(amount) if currency == "KRW" else float(amount)
            #     }
            #     for date, amount in new_dividends_series.items()
            # ]
            
            new_dividends = format_dividends(new_dividends_series, currency) # currency 전달

            combined_dividends_map = {div["date"]: div for div in existing_dividends}
            for div in new_dividends:
                combined_dividends_map[div["date"]] = div

            final_dividends = sorted(combined_dividends_map.values(), key=lambda x: x["date"])

            if "backtestData" not in existing_data:
                existing_data["backtestData"] = {}
            existing_data["backtestData"]["dividends"] = final_dividends

            # [핵심 수정 2] json.dump에 ensure_ascii=False 추가
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)

            tqdm.write(f"  ✅ [{symbol}] Updated with {len(new_dividends)} new dividend records.")
            updated_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ [{symbol}] Failed to save dividend data: {e}")

    print(f"\n--- Dividend Update Finished. Total files updated: {updated_count} ---")

if __name__ == "__main__":
    main()