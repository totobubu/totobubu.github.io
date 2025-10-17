import os
import sys
import json
import yfinance as yf
import pandas as pd
import FinanceDataReader as fdr
from tqdm import tqdm
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- 경로 설정 및 상수 ---
ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")
NAV_FILE_PATH = os.path.join(PUBLIC_DIR, "nav.json")

EXCHANGE_MAP = {
    "NYQ": "NYSE",
    "NMS": "NASDAQ",
    "PCX": "NYSE",
    "ASE": "NYSE",
    "BATS": "NASDAQ",
    "KOE": "KOSDAQ",
    "KSC": "KOSPI",
}
DEFAULT_US_MARKET = "NASDAQ"


def fetch_single_etf_details(symbol):
    """단일 ETF 티커의 자산, 운용사, 거래소 정보를 가져옵니다."""
    retries = 2
    for _ in range(retries):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info  # .info를 한번만 호출하여 모든 정보 가져오기

            assets = info.get("totalAssets")
            if assets:
                return {
                    "symbol": symbol,
                    "company": info.get("fundFamily"),
                    "assets": assets,
                    "exchange": info.get("exchange"),
                }
            return None  # 자산 정보가 없으면 유효한 ETF로 보지 않음
        except Exception:
            time.sleep(1)
    return None


def get_us_top_etfs(top_n=100):
    """nav.json의 모든 미국 티커를 분석하여 AUM 기준 상위 ETF 목록을 반환합니다."""
    print(f"Fetching Top {top_n} US ETFs by AUM using yfinance...")
    try:
        nav_data = load_json_file(NAV_FILE_PATH)
        us_symbols = [
            t["symbol"] for t in nav_data.get("nav", []) if t.get("currency") == "USD"
        ]
        if not us_symbols:
            print("  -> No US tickers found in nav.json to analyze.")
            return []
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"❌ Error: nav.json not found or is invalid.")
        return []

    print(f"Analyzing {len(us_symbols)} existing US tickers in parallel...")
    etf_details = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {
            executor.submit(fetch_single_etf_details, symbol): symbol
            for symbol in us_symbols
        }

        for future in tqdm(
            as_completed(future_to_symbol),
            total=len(us_symbols),
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
    """FinanceDataReader에서 시가총액 기준 상위 100개 한국 ETF를 가져옵니다."""
    try:
        print("Fetching Top 100 KR ETFs by Market Cap from FDR...")
        etf_df = fdr.StockListing("ETF/KR")

        # [핵심 수정] 'Assets' 대신 'Marcap' 컬럼을 사용합니다.
        if "Marcap" not in etf_df.columns:
            print(
                f"❌ Error: 'Marcap' column not found in FDR ETF list. Available columns: {etf_df.columns}"
            )
            return []

        top_100 = etf_df.sort_values(by="Marcap", ascending=False).head(100)

        etfs = []
        for _, row in top_100.iterrows():
            etfs.append(
                {
                    "symbol": f"{row['Symbol']}.KS",
                    "koName": row["Name"],
                    "company": row.get("Issuer"),
                }
            )

        print(f"  -> Found {len(etfs)} KR ETFs.")
        return etfs
    except Exception as e:
        print(f"❌ Error fetching KR ETFs: {e}")
        return []


def save_etfs_to_nav_files(etf_list, default_market, currency):
    """가져온 ETF 목록을 올바른 market 폴더에 추가합니다."""
    print(f"Updating nav source files...")
    added_count = 0
    files_to_update = {}

    for etf in tqdm(etf_list, desc=f"Processing ETFs"):
        symbol = etf["symbol"]

        # [핵심 수정] yfinance에서 가져온 exchange 정보로 market 결정
        market = default_market
        if "exchange" in etf and etf["exchange"] in EXCHANGE_MAP:
            market = EXCHANGE_MAP[etf["exchange"]]

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

        if any(t["symbol"] == symbol for t in files_to_update[file_path]):
            continue

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


def main():
    print("\n--- Starting to Fetch Top ETFs ---")

    # 미국 Top ETF 처리
    us_etfs = get_us_top_etfs(100)
    if us_etfs:
        # [핵심 수정] market을 고정하지 않고, 각 ETF의 exchange 정보에 따라 동적으로 저장
        save_etfs_to_nav_files(us_etfs, DEFAULT_US_MARKET, "USD")

    # 한국 Top ETF 처리
    kr_etfs = get_kr_top_100_etfs()
    if kr_etfs:
        # 한국 ETF는 market이 KOSPI로 고정되어 있으므로 기존 방식 유지
        kr_etf_list_with_market = [{"market": "KOSPI", **etf} for etf in kr_etfs]
        save_etfs_to_nav_files(kr_etf_list_with_market, "KOSPI", "KRW")

    print("\n🎉 Finished fetching and updating top ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
