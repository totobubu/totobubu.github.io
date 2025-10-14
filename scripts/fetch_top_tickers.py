import os
import json
import pandas as pd
import FinanceDataReader as fdr
import requests
import yfinance as yf
from tqdm import tqdm
import time

# --- 경로 설정 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

# 거래소 코드 매핑 (migrate 스크립트와 동일하게 유지)
EXCHANGE_MAP = {
    "NYQ": "NYSE",
    "NMS": "NASDAQ",
    "PCX": "NYSE",
    "BATS": "NASDAQ",
    "KOE": "KOSDAQ",
    "KSC": "KOSPI",
}
DEFAULT_MARKET = "NASDAQ"


def get_exchange_for_tickers_batch(tickers):
    """여러 티커의 거래소 정보를 일괄 조회하여 딕셔너리로 반환합니다."""
    exchanges = {}
    # yfinance는 티커 목록을 공백으로 구분하여 전달할 수 있습니다.
    ticker_str = " ".join(tickers)
    yf_tickers = yf.Tickers(ticker_str)

    for symbol, ticker_obj in tqdm(
        yf_tickers.tickers.items(), desc="Verifying exchanges"
    ):
        try:
            # .info는 비용이 큰 작업이므로 최소한의 정보인 .exchange를 사용 시도
            # (버전에 따라 .info를 써야 할 수도 있음)
            exchange_code = ticker_obj.info.get("exchange")
            market = EXCHANGE_MAP.get(exchange_code, DEFAULT_MARKET)
            exchanges[symbol] = market
        except Exception:
            exchanges[symbol] = DEFAULT_MARKET  # 실패 시 기본값 할당
    return exchanges


def get_sp500_tickers():
    """Wikipedia에서 S&P 500 티커 목록을 스크래핑합니다."""
    try:
        print("Fetching S&P 500 tickers from Wikipedia...")
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        tables = pd.read_html(response.text)
        sp500_df = tables[0]
        tickers = sp500_df["Symbol"].tolist()
        tickers = [t.replace(".", "-") for t in tickers]
        print(f"  -> Found {len(tickers)} S&P 500 tickers.")
        return tickers
    except Exception as e:
        print(f"❌ Error fetching S&P 500: {e}")
        return []


def get_krx_top_tickers(market, top_n):
    """FinanceDataReader를 사용해 KRX 시가총액 상위 N개 티커를 가져옵니다."""
    try:
        print(f"Fetching {market} top {top_n} tickers from FinanceDataReader...")
        df = fdr.StockListing(market)
        top_df = df.sort_values(by="Marcap", ascending=False).head(top_n)

        suffix = ".KS" if market == "KOSPI" else ".KQ"
        tickers = [f"{code}{suffix}" for code in top_df["Code"]]

        print(f"  -> Found top {len(tickers)} {market} tickers.")
        return tickers, top_df
    except Exception as e:
        print(f"❌ Error fetching {market} top {top_n}: {e}")
        return [], None


def get_nasdaq_100_tickers():
    """Wikipedia에서 NASDAQ 100 티커 목록을 스크래핑합니다."""
    try:
        print("Fetching NASDAQ 100 tickers from Wikipedia...")
        url = "https://en.wikipedia.org/wiki/NASDAQ-100"

        # [핵심 수정] User-Agent 헤더를 추가하여 403 Forbidden 오류 우회
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        # requests로 HTML 콘텐츠를 먼저 가져옴
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # 오류 발생 시 예외 발생

        # 가져온 HTML 콘텐츠를 pandas로 파싱
        tables = pd.read_html(response.text)

        ndx_df = tables[4]
        tickers = ndx_df["Ticker"].tolist()
        tickers = [t.replace(".", "-") for t in tickers]
        print(f"  -> Found {len(tickers)} NASDAQ 100 tickers.")
        return tickers
    except Exception as e:
        print(f"❌ Error fetching NASDAQ 100: {e}")
        return []


def save_tickers_to_nav_files(tickers_to_add, market_map, currency, name_map=None):
    print(f"Updating nav source files...")

    added_count = 0
    files_to_update = {}

    for symbol in tqdm(tickers_to_add, desc="Processing tickers"):
        market = market_map.get(symbol, DEFAULT_MARKET)  # 조회된 market 정보 사용

        base_symbol = symbol.split(".")[0]
        first_char = base_symbol[0].lower()
        if not "a" <= first_char <= "z":
            if "0" <= first_char <= "9":
                pass
            else:
                first_char = "etc"

        market_dir = os.path.join(NAV_DIR, market)
        os.makedirs(market_dir, exist_ok=True)
        file_path = os.path.join(market_dir, f"{first_char}.json")

        if file_path not in files_to_update:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    files_to_update[file_path] = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                files_to_update[file_path] = []

        if any(t["symbol"] == symbol for t in files_to_update[file_path]):
            continue

        new_ticker_info = {"symbol": symbol, "market": market, "currency": currency}

        if name_map and base_symbol in name_map:
            name = name_map[base_symbol]
            new_ticker_info.update({"koName": name, "longName": name})

        files_to_update[file_path].append(new_ticker_info)
        added_count += 1

    for file_path, tickers in files_to_update.items():
        tickers.sort(key=lambda x: x["symbol"])
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(tickers, f, indent=4, ensure_ascii=False)

    print(f"  -> Added {added_count} new tickers.")


def main():
    print("--- Starting to Fetch Top Market Tickers ---")

    # [핵심 수정] 미국 주식들을 먼저 모아서 한 번에 거래소 정보를 조회
    sp500_tickers = get_sp500_tickers()
    nasdaq_tickers = get_nasdaq_100_tickers()
    us_tickers = sorted(list(set(sp500_tickers + nasdaq_tickers)))

    if us_tickers:
        print("\nVerifying exchanges for US tickers...")
        us_market_map = get_exchange_for_tickers_batch(us_tickers)
        save_tickers_to_nav_files(us_tickers, us_market_map, "USD")

    # 한국 주식 처리
    kospi_tickers, kospi_df = get_krx_top_tickers("KOSPI", 200)
    if kospi_tickers:
        kospi_market_map = {ticker: "KOSPI" for ticker in kospi_tickers}
        kospi_name_map = pd.Series(kospi_df.Name.values, index=kospi_df.Code).to_dict()
        save_tickers_to_nav_files(
            kospi_tickers, kospi_market_map, "KRW", name_map=kospi_name_map
        )

    kosdaq_tickers, kosdaq_df = get_krx_top_tickers("KOSDAQ", 150)
    if kosdaq_tickers:
        kosdaq_market_map = {ticker: "KOSDAQ" for ticker in kosdaq_tickers}
        kosdaq_name_map = pd.Series(
            kosdaq_df.Name.values, index=kosdaq_df.Code
        ).to_dict()
        save_tickers_to_nav_files(
            kosdaq_tickers, kosdaq_market_map, "KRW", name_map=kosdaq_name_map
        )

    print("\n🎉 Finished fetching and updating top tickers.")


if __name__ == "__main__":
    main()
