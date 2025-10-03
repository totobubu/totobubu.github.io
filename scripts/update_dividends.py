# REFACTORED: scripts/update_dividends.py

import yfinance as yf
import time

# utils.py에서 필요한 함수들을 모두 import 합니다.
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
    get_yfinance_ticker,
)


def update_dividend_data_for_ticker(ticker_info, retries=3, delay=5):
    # ticker_info 객체에서 symbol과 market 정보를 가져옵니다.
    symbol = ticker_info.get("symbol")
    market = ticker_info.get("market")

    if not symbol:
        return False

    file_path = f"public/data/{sanitize_ticker_for_filename(symbol)}.json"

    # API 호출을 위한 야후 파이낸스용 티커를 생성합니다.
    yfinance_ticker = get_yfinance_ticker(symbol, market)

    for attempt in range(retries):
        try:
            data = load_json_file(file_path)
            if data is None:
                # upcoming 종목 등 아직 데이터 파일이 없는 경우 건너뜁니다.
                print(f"- Skipping {symbol}: Data file not found.")
                return False

            # yfinance.Ticker 호출 시 변환된 티커를 사용합니다.
            ticker_obj = yf.Ticker(yfinance_ticker)
            dividends_df = ticker_obj.dividends

            new_dividends = []
            if not dividends_df.empty:
                for date, amount in dividends_df.items():
                    new_dividends.append(
                        {"date": date.strftime("%Y-%m-%d"), "amount": float(amount)}
                    )

            if "backtestData" not in data:
                data["backtestData"] = {}
            data["backtestData"]["dividends"] = new_dividends

            if save_json_file(file_path, data, indent=2):
                print(
                    f"✅ [{symbol}] Dividend data updated. Found {len(new_dividends)} records."
                )
            return True

        except Exception as e:
            # 에러 메시지에 어떤 티커로 조회했는지 명시하여 디버깅을 쉽게 합니다.
            print(
                f"❌ [{symbol} as {yfinance_ticker}] Attempt {attempt + 1}/{retries} failed: {e}"
            )
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                print(f"❌ [{symbol}] All retries failed. Skipping.")
                return False
    return False


def main():
    nav_data = load_json_file("public/nav.json")
    if not nav_data or "nav" not in nav_data:
        print(
            "Error: public/nav.json not found. Please run 'npm run generate-nav' first."
        )
        return

    # upcoming이 아닌 종목 정보 전체(symbol, market 등)를 가져옵니다.
    active_tickers_info = [item for item in nav_data["nav"] if not item.get("upcoming")]
    # SPY 정보도 market을 포함하여 추가합니다.
    tickers_to_update = active_tickers_info + [{"symbol": "SPY", "market": "ARCA"}]

    print(
        f"--- Starting Dividend Data Update (Python/yfinance) for {len(tickers_to_update)} symbols ---"
    )

    success_count = sum(
        1
        for ticker_info in tickers_to_update
        if update_dividend_data_for_ticker(ticker_info)
    )

    print(
        f"\nUpdate complete. Success: {success_count}, Failure: {len(tickers_to_update) - success_count}"
    )


if __name__ == "__main__":
    main()
