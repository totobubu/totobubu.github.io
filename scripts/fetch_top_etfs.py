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

# --- 경로 설정 및 상수 ---
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


def get_us_top_etfs(top_n=3000):  # [수정] 기본값을 3000으로 변경
    us_etf_symbols = get_us_etf_universe_from_stockanalysis()
    if not us_etf_symbols:
        return []
    # [수정] 분석 대상을 top_n보다 넉넉하게 설정 (yf 조회 실패율 고려)
    analysis_target_count = min(len(us_etf_symbols), top_n + 200)
    print(f"Analyzing {analysis_target_count} US ETFs to find top {top_n} by AUM...")
    etf_details = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {
            executor.submit(fetch_single_etf_details, symbol): symbol
            for symbol in us_etf_symbols[:analysis_target_count]
        }

        for future in tqdm(
            as_completed(future_to_symbol),
            total=len(future_to_symbol),
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


def get_kr_top_300_etfs():
    """FinanceDataReader에서 NAV 기준 상위 300개 한국 ETF를 가져옵니다."""
    try:
        print("Fetching Top 300 KR ETFs by NAV from FDR...")
        etf_df = fdr.StockListing("ETF/KR")

        if "NAV" not in etf_df.columns:
            print(f"❌ Error: 'NAV' column not found in FDR ETF list.")
            return []

        top_300 = etf_df.sort_values(by="NAV", ascending=False).head(300)

        etfs = []
        for _, row in top_300.iterrows():
            # [핵심 수정] 모든 한국 ETF를 .KS로 가정하고 market을 'KOSPI'로 고정합니다.
            symbol = f"{row['Symbol']}.KS"
            market_name = "KOSPI"

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


def save_etfs_to_nav_files(etf_list, currency):
    """가져온 ETF 목록을 올바른 market 폴더에 추가합니다."""
    print(f"Updating nav source files for {currency} ETFs...")
    files_to_update = {}
    total_added_count = 0

    for etf in tqdm(etf_list, desc=f"Processing {currency} ETFs"):
        symbol = etf.get("symbol")
        market = etf.get("market")

        if not symbol or not market:
            continue

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
                    files_to_update[file_path] = {
                        ticker["symbol"]: ticker for ticker in json.load(f)
                    }
            except (FileNotFoundError, json.JSONDecodeError):
                files_to_update[file_path] = {}

        if symbol not in files_to_update[file_path]:
            # [핵심 수정] new_ticker_info를 생성할 때 'company' 필드를 명시적으로 추가
            new_ticker_info = {"symbol": symbol, "market": market, "currency": currency}
            if etf.get("company"):
                new_ticker_info["company"] = etf["company"]
            if etf.get("koName"):
                new_ticker_info["koName"] = etf["koName"]
                new_ticker_info["longName"] = etf["koName"]

            files_to_update[file_path][symbol] = new_ticker_info
            total_added_count += 1

    if total_added_count == 0:
        print("  -> No new ETFs to add.")
        return

    print(f"  -> Found {total_added_count} new ETFs. Saving files...")
    for file_path, tickers_dict in files_to_update.items():
        # 파일에 변경 사항이 있을 때만 저장
        if any(
            ticker["symbol"] not in load_json_file(file_path)
            for ticker in tickers_dict.values()
            if os.path.exists(file_path)
        ):
            sorted_tickers = sorted(tickers_dict.values(), key=lambda x: x["symbol"])
            save_json_file(file_path, sorted_tickers)
            print(f"  -> Updated file: {os.path.relpath(file_path, ROOT_DIR)}")


def main():
    print("\n--- Starting to Fetch Top ETFs ---")

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

    # 미국 Top ETF 처리 (3000개로 확대)
    us_etfs = get_us_top_etfs(3000)
    if us_etfs:
        new_us_etfs = []
        for etf in us_etfs:
            if etf["symbol"] not in existing_symbols:
                exchange = etf.get("exchange")
                etf["market"] = EXCHANGE_MAP.get(exchange, DEFAULT_US_MARKET)
                new_us_etfs.append(etf)
        print(f"  -> Found {len(new_us_etfs)} new US ETFs to add.")
        if new_us_etfs:
            save_etfs_to_nav_files(new_us_etfs, "USD")

    # 한국 Top ETF 처리
    kr_etfs = get_kr_top_300_etfs()
    if kr_etfs:
        new_kr_etfs = [etf for etf in kr_etfs if etf["symbol"] not in existing_symbols]
        print(f"  -> Found {len(new_kr_etfs)} new KR ETFs to add.")
        if new_kr_etfs:
            save_etfs_to_nav_files(new_kr_etfs, "KRW")

    print("\n🎉 Finished fetching and updating top ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
