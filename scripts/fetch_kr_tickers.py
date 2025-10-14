# scripts / fetch_kr_tickers.py

import os
import json
import FinanceDataReader as fdr
import pandas as pd

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")


def get_yfinance_ticker(row):
    """FDR 데이터를 기반으로 yfinance 티커 형식을 생성합니다."""
    market = row["Market"]
    symbol = row["Symbol"]
    if market == "KOSPI":
        return f"{symbol}.KS"
    elif market == "KOSDAQ":
        return f"{symbol}.KQ"
    return None


def main():
    print("--- Starting to fetch KRX ticker list from FinanceDataReader ---")

    # KRX (코스피, 코스닥, 코넥스) 전체 종목 리스트 가져오기
    try:
        df_krx = fdr.StockListing("KRX")
        # 코스피와 코스닥 종목만 필터링
        df_krx = df_krx[df_krx["Market"].isin(["KOSPI", "KOSDAQ"])]
        print(f"Successfully fetched {len(df_krx)} KOSPI/KOSDAQ tickers.")
    except Exception as e:
        print(f"❌ Error fetching stock listing from FDR: {e}")
        return

    # yfinance 티커 형식 추가 및 불필요한 열 제거
    df_krx["yfinance_symbol"] = df_krx.apply(get_yfinance_ticker, axis=1)
    df_krx = df_krx.dropna(subset=["yfinance_symbol"])

    # 최종 JSON 객체 생성을 위한 데이터 구조화
    tickers_by_market_and_char = {"KOSPI": {}, "KOSDAQ": {}}

    for index, row in df_krx.iterrows():
        market = row["Market"]
        symbol = row["yfinance_symbol"]
        first_char = row["Symbol"][0].lower()  # 그룹핑 기준은 .KS/.KQ 제외한 원본 심볼

        if not first_char.isalnum():  # 숫자로 시작하지 않으면 'etc'로
            first_char = "etc"

        if first_char not in tickers_by_market_and_char[market]:
            tickers_by_market_and_char[market][first_char] = []

        tickers_by_market_and_char[market][first_char].append(
            {
                "symbol": symbol,
                "koName": row["Name"],
                "longName": row["Name"],  # 우선 한글 이름으로 통일
                "market": market,
            }
        )

    # market/char.json 파일로 저장
    for market, chars in tickers_by_market_and_char.items():
        market_path = os.path.join(NAV_DIR, market)
        os.makedirs(market_path, exist_ok=True)

        for char, tickers in chars.items():
            # 심볼 순으로 정렬
            tickers.sort(key=lambda x: x["symbol"])
            file_path = os.path.join(market_path, f"{char}.json")
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(tickers, f, indent=4, ensure_ascii=False)
                print(f"  -> Saved {len(tickers)} tickers to {market}/{char}.json")
            except IOError as e:
                print(f"❌ Error writing file {file_path}: {e}")

    print("\n🎉 Successfully generated Korean ticker source files.")


if __name__ == "__main__":
    # 이 스크립트를 실행하기 전에 FinanceDataReader를 설치해야 합니다.
    # pip install finance-datareader
    main()
