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

# 공통 유틸리티 import
import sys
sys.path.insert(0, os.path.join(ROOT_DIR, "scripts", "utils"))
from data_file_path import get_data_file_path, find_existing_data_file


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
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        with open(NAV_FILE_PATH, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print("❌ nav.json not found. Aborting.")
        return

    all_tickers_info = nav_data.get("nav", [])
    active_tickers_info = [t for t in all_tickers_info if not t.get("upcoming", False)]
    
    # 커맨드라인 인자로 특정 티커 지정 가능
    import sys
    target_tickers = []
    if len(sys.argv) > 1:
        target_tickers = [arg.upper() for arg in sys.argv[1:]]
        print(f"--- [Specific Mode] Dividend Update for: {', '.join(target_tickers)} ---")
        active_tickers_info = [t for t in active_tickers_info if t["symbol"] in target_tickers]
        if not active_tickers_info:
            print(f"❌ 지정한 티커를 nav.json에서 찾을 수 없습니다: {', '.join(target_tickers)}")
            return
    else:
        print("--- [Full Mode] Incremental Dividend Update (Optimized) ---")
    
    print(f"Analyzing {len(active_tickers_info)} active tickers for dividend updates...")

    updated_count = 0
    # 한국 시장 접미사 추적
    korean_suffix_report = {
        "successful_with_original": [],  # [{symbol, suffix, dividends_count}]
        "successful_with_alternative": [],  # [{symbol, original_suffix, alternative_suffix, dividends_count}]
        "failed_both": [],  # [{symbol, tried_suffixes}]
        "timestamp": datetime.now().isoformat()
    }

    # noDividends 플래그가 있는 종목 제외
    original_count = len(active_tickers_info)
    active_tickers_info = [t for t in active_tickers_info if not t.get("noDividends", False)]
    excluded_count = original_count - len(active_tickers_info)
    
    if excluded_count > 0:
        print(f"⏭️  Excluded {excluded_count} symbols marked as noDividends")
    print(f"📊 Processing {len(active_tickers_info)} symbols for dividend updates\n")

    # [핵심 수정] 티커별로 개별 처리하여 증분 업데이트 로직 적용
    for ticker_info in tqdm(active_tickers_info, desc="Fetching and merging new dividends"):
        symbol = ticker_info["symbol"]
        yf_symbol = ticker_info.get("yfSymbol") or symbol
        market = ticker_info.get("market")
        try:
            # 기존 파일 찾기 (market 서브디렉토리와 루트 모두 확인)
            file_path_obj = find_existing_data_file(symbol, market)
            if not file_path_obj:
                # 파일이 없으면 market 정보로 새 경로 생성
                file_path_obj = get_data_file_path(symbol, market)
            file_path = str(file_path_obj)

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
                start_date_str = ticker_info.get("ipoDate", "1990-01-01")

            # 이미 최신이면 건너뛰기
            if (
                datetime.strptime(start_date_str, "%Y-%m-%d").date()
                > datetime.now().date()
            ):
                continue

            # 3. yfinance에서 해당 티커의 새로운 배당 데이터만 다운로드
            # 한국 시장의 경우 .KS/.KQ 접미사 문제로 fallback 시도
            ticker_obj = yf.Ticker(yf_symbol)
            dividends = ticker_obj.dividends

            original_suffix = None
            alternative_suffix = None
            used_alternative = False

            # 한국 시장 fallback: 빈 데이터면 다른 접미사 시도
            if market in ["KOSPI", "KOSDAQ"]:
                if yf_symbol.endswith(".KS"):
                    original_suffix = ".KS"
                    alternative_suffix = ".KQ"
                elif yf_symbol.endswith(".KQ"):
                    original_suffix = ".KQ"
                    alternative_suffix = ".KS"

                # 원래 접미사로 데이터를 못 찾으면 대체 접미사 시도
                if dividends.empty and alternative_suffix:
                    alternative_symbol = symbol + alternative_suffix

                    tqdm.write(f"  🔄 Trying alternative suffix for {symbol}: {alternative_symbol}")
                    ticker_obj = yf.Ticker(alternative_symbol)
                    dividends = ticker_obj.dividends

                    if not dividends.empty:
                        tqdm.write(f"  ✅ Found data with {alternative_symbol}")
                        used_alternative = True
                        yf_symbol = alternative_symbol  # 성공한 심볼로 업데이트

            if dividends.empty:
                # 한국 시장인 경우 실패 기록
                if market in ["KOSPI", "KOSDAQ"] and original_suffix:
                    tried_suffixes = [original_suffix]
                    if alternative_suffix:
                        tried_suffixes.append(alternative_suffix)
                    korean_suffix_report["failed_both"].append({
                        "symbol": symbol,
                        "tried_suffixes": tried_suffixes
                    })
                continue

            # 한국 시장 성공 기록
            if market in ["KOSPI", "KOSDAQ"]:
                if used_alternative:
                    korean_suffix_report["successful_with_alternative"].append({
                        "symbol": symbol,
                        "original_suffix": original_suffix,
                        "alternative_suffix": alternative_suffix,
                        "dividends_count": len(dividends)
                    })
                elif original_suffix:
                    korean_suffix_report["successful_with_original"].append({
                        "symbol": symbol,
                        "suffix": original_suffix,
                        "dividends_count": len(dividends)
                    })

            # Handle potential dtype mismatch for delisted stocks
            try:
                new_dividends_df = dividends[
                    dividends.index >= start_date_str
                ]
            except (TypeError, ValueError) as e:
                # Skip tickers with invalid index types (e.g., delisted stocks)
                tqdm.write(f"  ⚠️ Skipping {symbol}: invalid dividend data ({e})")
                continue

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
            currency = ticker_info.get("currency", "USD")

            for date, amount in new_dividends_df.items():
                date_str = date.strftime("%Y-%m-%d")

                # Handle string amounts (e.g. "10.0 KRW")
                if isinstance(amount, str):
                    # Remove currency suffix and whitespace
                    amount_clean = amount.replace("KRW", "").strip()
                    try:
                        amount = float(amount_clean)
                    except ValueError:
                        tqdm.write(f"  ⚠️ Warning: Could not parse dividend amount '{amount}' for {symbol}")
                        continue

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

    # 한국 시장 접미사 리포트 저장
    script_dir = os.path.dirname(os.path.abspath(__file__))
    report_file_path = os.path.join(script_dir, "korean_suffix_report.json")
    with open(report_file_path, "w", encoding="utf-8") as f:
        json.dump(korean_suffix_report, f, indent=4, ensure_ascii=False)

    # 리포트 요약 출력
    print(f"\n📊 Korean Market Suffix Report:")
    print(f"  ✅ Original suffix worked: {len(korean_suffix_report['successful_with_original'])} tickers")
    print(f"  🔄 Alternative suffix worked: {len(korean_suffix_report['successful_with_alternative'])} tickers")
    print(f"  ❌ Both suffixes failed: {len(korean_suffix_report['failed_both'])} tickers")
    print(f"  📄 Report saved to: {report_file_path}")


if __name__ == "__main__":
    main()
