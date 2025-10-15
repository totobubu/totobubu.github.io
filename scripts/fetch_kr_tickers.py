# scripts / fetch_kr_tickers.py

import os
import json
import FinanceDataReader as fdr
import pandas as pd

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")


def get_yfinance_ticker(row):
    market = row["Market"]
    symbol = row["Code"]
    if market == "KOSPI":
        return f"{symbol}.KS"
    elif market == "KOSDAQ":
        return f"{symbol}.KQ"
    return None


def main():
    print("--- Starting to fetch KRX ticker list from FinanceDataReader ---")
    try:
        df_krx = fdr.StockListing("KRX")
        df_krx = df_krx[df_krx["Market"].isin(["KOSPI", "KOSDAQ"])]
        print(f"Successfully fetched {len(df_krx)} KOSPI/KOSDAQ tickers.")
    except Exception as e:
        print(f"❌ Error fetching stock listing from FDR: {e}")
        return

    df_krx["yfinance_symbol"] = df_krx.apply(get_yfinance_ticker, axis=1)
    df_krx = df_krx.dropna(subset=["yfinance_symbol"])

    tickers_by_market_and_char = {"KOSPI": {}, "KOSDAQ": {}}

    for index, row in df_krx.iterrows():
        market = row["Market"]
        symbol = row["yfinance_symbol"]
        first_char = row["Code"][0].lower()
        if not first_char.isalnum():
            first_char = "etc"
        if "0" <= first_char <= "9":
            pass
        elif not "a" <= first_char <= "z":
            first_char = "etc"

        if first_char not in tickers_by_market_and_char[market]:
            tickers_by_market_and_char[market][first_char] = []

        tickers_by_market_and_char[market][first_char].append(
            {
                "symbol": symbol,
                "koName": row["Name"],
                # "longName" 제거
                "market": market,
            }
        )

    for market, chars in tickers_by_market_and_char.items():
        market_path = os.path.join(NAV_DIR, market)
        os.makedirs(market_path, exist_ok=True)
        for char, tickers in chars.items():
            tickers.sort(key=lambda x: x["symbol"])
            file_path = os.path.join(market_path, f"{char}.json")
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(tickers, f, indent=4, ensure_ascii=False)
            except IOError as e:
                print(f"❌ Error writing file {file_path}: {e}")

    print("\n🎉 Successfully generated Korean ticker source files.")


if __name__ == "__main__":
    main()
