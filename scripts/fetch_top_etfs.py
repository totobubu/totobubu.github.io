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
    "KOSPI": "KOSPI",
    "KOSDAQ": "KOSDAQ",
}
DEFAULT_US_MARKET = "NASDAQ"


def get_us_etf_universe_from_stockanalysis():
    print("Fetching US ETF universe from stockanalysis.com...")
    try:
        url = "https://stockanalysis.com/etf/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")
        table = soup.find("table", {"id": "main-table"})
        if not table:
            return []
        tickers = [
            cell.get_text(strip=True)
            for row in table.find("tbody").find_all("tr")
            if (cell := row.find("td"))
        ]
        print(f"  -> Found {len(tickers)} unique ETF symbols from universe.")
        return tickers
    except Exception as e:
        print(f"❌ Error fetching US ETF universe: {e}")
        return []


def fetch_single_etf_details(symbol, session):
    """단일 ETF 티커의 정보를 재시도 로직과 함께 가져옵니다."""
    retries = 3
    for attempt in range(retries):
        try:
            # [핵심 수정] 세션 객체를 사용하여 Ticker 생성
            ticker = yf.Ticker(symbol, session=session)
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
        except Exception as e:
            # 401 오류는 재시도해도 소용없을 수 있으므로 즉시 중단
            if "401" in str(e):
                # tqdm.write(f"  - 401 Unauthorized for {symbol}. Skipping.")
                return None
            if attempt < retries - 1:
                time.sleep(attempt + 2)  # 재시도 간격을 2초, 3초로 늘림
            else:
                # tqdm.write(f"  - Failed to fetch {symbol} after {retries} attempts.")
                return None


def get_us_top_etfs(top_n=1000):
    us_etf_symbols = get_us_etf_universe_from_stockanalysis()
    if not us_etf_symbols:
        return []

    # yfinance 조회 실패율을 고려하여 분석 대상을 넉넉하게 설정
    analysis_target_count = min(len(us_etf_symbols), top_n + 500)
    print(f"Analyzing {analysis_target_count} US ETFs to find top {top_n} by AUM...")
    etf_details = []

    # [핵심 수정] requests.Session() 생성
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
    )

    # [핵심 수정] ThreadPoolExecutor의 max_workers를 줄여 동시 요청 수 제어
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(fetch_single_etf_details, symbol, session): symbol
            for symbol in us_etf_symbols[:analysis_target_count]
        }

        for future in tqdm(
            as_completed(futures), total=len(futures), desc="Fetching US ETF details"
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


def get_kr_top_etfs(top_n=300):
    print(f"Fetching Top {top_n} KR ETFs by NAV from FDR...")
    try:
        etf_df = fdr.StockListing("ETF/KR")
        if "NAV" not in etf_df.columns:
            print(f"❌ Error: 'NAV' column not found in FDR ETF list.")
            return []
        top_df = etf_df.sort_values(by="NAV", ascending=False).head(top_n)
        etfs = []
        for _, row in top_df.iterrows():
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


def save_new_etfs_to_nav(new_etf_list):
    if not new_etf_list:
        print("  -> No new ETFs to add.")
        return

    print(f"Updating nav source files with {len(new_etf_list)} new ETFs...")

    files_to_update = {}
    for etf in new_etf_list:
        symbol, market = etf.get("symbol"), etf.get("market")
        if not symbol or not market:
            continue

        first_char = symbol.split(".")[0][0].lower()
        if not ("a" <= first_char <= "z" or "0" <= first_char <= "9"):
            first_char = "etc"

        file_path = os.path.join(NAV_DIR, market, f"{first_char}.json")
        if file_path not in files_to_update:
            files_to_update[file_path] = []
        files_to_update[file_path].append(etf)

    for file_path, tickers_to_add in tqdm(files_to_update.items(), desc="Saving files"):
        market_dir = os.path.dirname(file_path)
        os.makedirs(market_dir, exist_ok=True)

        existing_tickers = load_json_file(file_path) or []
        combined_tickers = existing_tickers + tickers_to_add
        combined_tickers.sort(key=lambda x: x["symbol"])

        save_json_file(file_path, combined_tickers)
        print(
            f"  -> Added {len(tickers_to_add)} new ETF(s) to {os.path.relpath(file_path, ROOT_DIR)}"
        )


def main():
    print("\n--- Starting to Fetch Top ETFs ---")

    existing_symbols = {
        ticker["symbol"]
        for market in os.listdir(NAV_DIR)
        if os.path.isdir(os.path.join(NAV_DIR, market))
        for filename in os.listdir(os.path.join(NAV_DIR, market))
        if filename.endswith(".json")
        if (data := load_json_file(os.path.join(NAV_DIR, market, filename)))
        for ticker in data
    }
    print(f"Found {len(existing_symbols)} existing symbols in nav directories.")

    all_new_etfs = []

    us_etfs = get_us_top_etfs(1000)
    if us_etfs:
        for etf in us_etfs:
            if etf["symbol"] not in existing_symbols:
                exchange = etf.get("exchange")
                etf["market"] = EXCHANGE_MAP.get(exchange, DEFAULT_US_MARKET)
                all_new_etfs.append(
                    {
                        "symbol": etf["symbol"],
                        "market": etf["market"],
                        "currency": "USD",
                        "company": etf.get("company"),
                    }
                )

    kr_etfs = get_kr_top_etfs(300)
    if kr_etfs:
        for etf in kr_etfs:
            if etf["symbol"] not in existing_symbols:
                all_new_etfs.append({**etf, "currency": "KRW"})

    if all_new_etfs:
        print(f"  -> Found {len(all_new_etfs)} total new ETFs to add.")
        save_new_etfs_to_nav(all_new_etfs)
    else:
        print("  -> No new ETFs to add.")

    print("\n🎉 Finished fetching and updating top ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
