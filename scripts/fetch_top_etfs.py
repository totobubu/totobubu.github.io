import os
import sys
import json
import yfinance as yf
import pandas as pd
import FinanceDataReader as fdr
from tqdm import tqdm
import time
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils import load_json_file, save_json_file

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

EXCHANGE_MAP = {
    "NYSE Arca": "NYSE",
    "NASDAQ": "NASDAQ",
    "NYSE": "NYSE",
    "BATS": "NASDAQ",
    "KOE": "KOSDAQ",
    "KSC": "KOSPI",
    "ASX": "Other",
    "LSE": "Other",
}
DEFAULT_US_MARKET = "NASDAQ"


def get_us_etf_universe_from_stockanalysis():
    """stockanalysis.com에서 미국 ETF의 전체 목록을 스크래핑하여 가져옵니다."""
    print("Fetching US ETF universe from stockanalysis.com...")
    try:
        url = "https://stockanalysis.com/etf/"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")
        # id가 'main-table'인 테이블을 찾습니다.
        table = soup.find("table", {"id": "main-table"})
        if not table:
            print("❌ Could not find ETF table on stockanalysis.com.")
            return []

        tickers = []
        for row in table.find("tbody").find_all("tr"):
            cell = row.find("td")  # 첫 번째 셀에 티커가 있음
            if cell:
                tickers.append(cell.get_text(strip=True))

        print(f"  -> Found {len(tickers)} unique ETF symbols from universe.")
        return tickers
    except Exception as e:
        print(f"❌ Error fetching US ETF universe: {e}")
        return []


def fetch_single_etf_details(symbol):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        assets = info.get("totalAssets")
        if assets:
            return {
                "symbol": symbol,
                "company": info.get("fundFamily"),
                "assets": assets,
                "exchange": info.get("exchange"),
            }
        return None
    except Exception:
        return None


def get_us_top_etfs(top_n=200):
    us_etf_symbols = get_us_etf_universe_from_stockanalysis()
    if not us_etf_symbols:
        return []

    print(f"Analyzing {len(us_etf_symbols)} US ETFs to find top {top_n} by AUM...")
    etf_details = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {
            executor.submit(fetch_single_etf_details, symbol): symbol
            for symbol in us_etf_symbols
        }
        for future in tqdm(
            as_completed(future_to_symbol),
            total=len(us_etf_symbols),
            desc="Fetching US ETF details",
        ):
            result = future.result()
            if result:
                etf_details.append(result)

    if not etf_details:
        print("  -> Could not fetch asset data for any US ETFs.")
        return []
    top_etfs = sorted(etf_details, key=lambda x: x.get("assets", 0), reverse=True)[
        :top_n
    ]
    print(f"  -> Found and sorted Top {len(top_etfs)} US ETFs by AUM.")
    return top_etfs


def get_kr_top_100_etfs():
    """FinanceDataReader에서 NAV 기준 상위 100개 한국 ETF를 가져옵니다."""
    try:
        print("Fetching Top 100 KR ETFs by NAV from FDR...")
        etf_df = fdr.StockListing("ETF/KR")

        # [핵심 수정] 정렬 기준을 'NAV'로 확실하게 수정합니다.
        if "NAV" not in etf_df.columns:
            print(
                f"❌ Error: 'NAV' column not found in FDR ETF list. Available columns: {etf_df.columns}"
            )
            return []

        top_100 = etf_df.sort_values(by="NAV", ascending=False).head(100)
        etfs = []
        for _, row in top_100.iterrows():
            market = row.get("Market")
            if market == "ETF(KOSPI)":
                symbol, market_name = f"{row['Symbol']}.KS", "KOSPI"
            elif market == "ETF(KOSDAQ)":
                symbol, market_name = f"{row['Symbol']}.KQ", "KOSDAQ"
            else:
                continue

            etfs.append(
                {
                    "symbol": symbol,
                    "koName": row["Name"],
                    "company": row.get("Issuer"),
                    "market": market_name,
                }
            )

        print(f"  -> Found {len(etfs)} KR ETFs.")
        return etfs
    except Exception as e:
        print(f"❌ Error fetching KR ETFs: {e}")
        return []


def main():
    print("\n--- Starting to Fetch Top ETFs ---")

    # [핵심 수정] 저장을 시작하기 전에, nav 폴더에 이미 존재하는 모든 티커를 읽어 Set으로 만듭니다.
    existing_symbols = set()
    for market in os.listdir(NAV_DIR):
        market_path = os.path.join(NAV_DIR, market)
        if os.path.isdir(market_path):
            for filename in os.listdir(market_path):
                if filename.endswith(".json"):
                    file_path = os.path.join(market_path, filename)
                    data = load_json_file(file_path)
                    if data:
                        for ticker in data:
                            existing_symbols.add(ticker["symbol"])
    print(f"Found {len(existing_symbols)} existing symbols in nav directories.")

    # 미국 Top ETF 처리
    us_etfs = get_us_top_etfs(300)
    if us_etfs:
        # 중복되지 않은 새로운 ETF만 필터링
        new_us_etfs = [etf for etf in us_etfs if etf["symbol"] not in existing_symbols]
        print(f"  -> Found {len(new_us_etfs)} new US ETFs to add.")
        save_etfs_to_nav_files(new_us_etfs, "USD")

    # 한국 Top ETF 처리
    kr_etfs = get_kr_top_100_etfs()
    if kr_etfs:
        new_kr_etfs = [etf for etf in kr_etfs if etf["symbol"] not in existing_symbols]
        print(f"  -> Found {len(new_kr_etfs)} new KR ETFs to add.")
        save_etfs_to_nav_files(new_kr_etfs, "KRW")

    print("\n🎉 Finished fetching and updating top ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


def save_etfs_to_nav_files(etf_list, currency, default_market=None):
    print(f"Updating nav source files for {currency} ETFs...")
    added_count = 0
    files_to_update = {}

    for etf in tqdm(etf_list, desc=f"Processing ETFs"):
        symbol = etf["symbol"]

        # [핵심 수정] etf 객체에 market 정보가 있으면 그것을 최우선으로 사용
        market = etf.get("market")
        if not market and "exchange" in etf and etf["exchange"] in EXCHANGE_MAP:
            market = EXCHANGE_MAP[etf["exchange"]]
        elif not market:
            market = DEFAULT_US_MARKET

        first_char_base = symbol.split(".")[0]
        first_char = first_char_base[0].lower()
        if not ("a" <= first_char <= "z" or "0" <= first_char <= "9"):
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

        # if any(t["symbol"] == symbol for t in files_to_update[file_path]):
        #     continue

        new_ticker_info = {"symbol": symbol, "market": market, "currency": currency}
        if etf.get("company"):
            new_ticker_info["company"] = etf["company"]
        if etf.get("koName"):
            new_ticker_info["koName"] = etf["koName"]
            new_ticker_info["longName"] = etf["koName"]

        files_to_update[file_path].append(new_ticker_info)
        added_count += 1

    for file_path, tickers in files_to_update.items():
        tickers.sort(key=lambda x: x["symbol"])
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(tickers, f, indent=4, ensure_ascii=False)

    print(f"  -> Added {added_count} new ETFs.")


if __name__ == "__main__":
    main()
