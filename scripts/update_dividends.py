# scripts/update_dividends.py

import os
import json
import yfinance as yf
from datetime import datetime, timedelta
from tqdm import tqdm
import pandas as pd

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")


def get_last_dividend_date(file_path):
    """
    JSON 파일에서 마지막 배당 지급일을 찾아서 반환합니다.
    'amount' 또는 'amountFixed'가 있는 날짜 중 가장 최신 날짜를 찾습니다.
    """
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


def main():
    print("--- Starting Incremental Dividend Update (Optimized) ---")
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print("❌ nav.json not found. Aborting.")
        return

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    ticker_info_map = {t["symbol"]: t for t in active_tickers_info}
    active_symbols = list(ticker_info_map.keys())

    print(f"Analyzing {len(active_symbols)} active tickers for dividend updates...")

    updated_count = 0
    # [핵심 수정] 티커별로 개별 처리하여 증분 업데이트 로직 적용
    for symbol in tqdm(active_symbols, desc="Fetching and merging new dividends"):
        try:
            sanitized_symbol = symbol.replace(".", "-").lower()
            file_path = os.path.join(DATA_DIR, f"{sanitized_symbol}.json")

            # 1. 마지막 배당일 조회
            last_div_date_str = get_last_dividend_date(file_path)

            # 2. 다운로드 시작일 설정
            if last_div_date_str:
                start_date = datetime.strptime(
                    last_div_date_str, "%Y-%m-%d"
                ) + timedelta(days=1)
                start_date_str = start_date.strftime("%Y-%m-%d")
            else:
                # 데이터가 아예 없는 경우, IPO 날짜나 기본값 사용
                start_date_str = ticker_info_map.get(symbol, {}).get(
                    "ipoDate", "1990-01-01"
                )

            # 이미 최신이면 건너뛰기
            if (
                datetime.strptime(start_date_str, "%Y-%m-%d").date()
                > datetime.now().date()
            ):
                continue

            # 3. yfinance에서 해당 티커의 새로운 배당 데이터만 다운로드
            ticker_obj = yf.Ticker(symbol)
            new_dividends_df = ticker_obj.dividends[
                ticker_obj.dividends.index >= start_date_str
            ]

            if new_dividends_df.empty:
                continue

            # 4. 기존 데이터와 병합
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                existing_data = {"backtestData": []}

            backtest_data = existing_data.get("backtestData", [])
            backtest_map = {item["date"]: item for item in backtest_data}
            original_backtest_data_str = json.dumps(backtest_data, sort_keys=True)
            currency = ticker_info_map.get(symbol, {}).get("currency", "USD")

            for date, amount in new_dividends_df.items():
                date_str = date.strftime("%Y-%m-%d")
                new_amount = int(round(amount)) if currency == "KRW" else float(amount)

                if date_str not in backtest_map:
                    backtest_map[date_str] = {"date": date_str}

                # 항상 최신 yfinance 값으로 'amount' 필드를 업데이트
                backtest_map[date_str]["amount"] = new_amount

            final_backtest_data = sorted(backtest_map.values(), key=lambda x: x["date"])

            # 5. 변경 사항이 있을 때만 파일 저장
            if original_backtest_data_str != json.dumps(
                final_backtest_data, sort_keys=True
            ):
                existing_data["backtestData"] = final_backtest_data
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(existing_data, f, indent=4, ensure_ascii=False)
                updated_count += 1

        except Exception as e:
            tqdm.write(f"  ❌ Error processing {symbol}: {e}")

    print(f"\n--- Dividend Merge Finished. Total files updated: {updated_count} ---")


if __name__ == "__main__":
    main()
