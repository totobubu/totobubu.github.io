import os
import json
import yfinance as yf
from tqdm import tqdm
import time
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
    "AMEX": "NYSE",
}
DEFAULT_US_MARKET = "NYSE"  # 대부분의 ETF는 NYSE Arca에 상장

# 제공해주신 데이터를 파싱하여 Python 리스트로 변환
PREDEFINED_ETF_TEXT = """

"""


def parse_predefined_list():
    etfs = []
    lines = PREDEFINED_ETF_TEXT.strip().split("\n")
    for line in lines:
        parts = line.split("\t")
        if len(parts) >= 2:
            symbol = parts[0].strip()
            # 운용사 이름 추출 (Vanguard, iShares, SPDR, Schwab 등)
            name = parts[1].strip()
            company = name.split(" ")[0]
            if company in [
                "SPDR",
                "Invesco",
                "Schwab",
                "Global",
                "VanEck",
                "Direxion",
                "ProShares",
                "WisdomTree",
                "iShares",
                "Vanguard",
                "State Street",
                "First Trust",
                "Global X",
                "PIMCO",
                "Roundhill",
                "YieldMax",
                "JPMorgan",
                "Fidelity",
                "REX",
            ]:
                pass  # 그대로 사용
            elif "iShares" in name:
                company = "iShares"
            else:
                company = name.split(" ")[0]  # 기본적으로 첫 단어를 운용사로 가정

            etfs.append({"symbol": symbol, "company": company, "longName": name})
    return etfs


def enrich_with_yfinance(etf_list):
    """yfinance를 사용하여 ETF 목록에 거래소 정보를 추가합니다."""
    print("Enriching ETF data with yfinance for exchange info...")

    enriched_etfs = []
    symbols = [etf["symbol"] for etf in etf_list]

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_symbol = {
            executor.submit(lambda s: yf.Ticker(s).info, symbol): symbol
            for symbol in symbols
        }

        for future in tqdm(
            as_completed(future_to_symbol),
            total=len(symbols),
            desc="Fetching yfinance details",
        ):
            symbol = future_to_symbol[future]
            original_etf = next(
                (etf for etf in etf_list if etf["symbol"] == symbol), None
            )
            if not original_etf:
                continue

            try:
                info = future.result()
                exchange = info.get("exchange")
                original_etf["market"] = EXCHANGE_MAP.get(exchange, DEFAULT_US_MARKET)
                # yfinance의 longName이 더 정확할 수 있으므로 업데이트
                if info.get("longName"):
                    original_etf["longName"] = info.get("longName")
                enriched_etfs.append(original_etf)
            except Exception:
                original_etf["market"] = DEFAULT_US_MARKET
                enriched_etfs.append(original_etf)

    return enriched_etfs


def save_new_etfs_to_nav(new_etf_list):
    if not new_etf_list:
        print("  -> No new ETFs to add.")
        return

    print(f"Updating nav source files with {len(new_etf_list)} new ETFs...")
    files_to_update = {}
    total_added_count = 0

    for etf in tqdm(new_etf_list, desc="Processing ETFs"):
        symbol, market = etf.get("symbol"), etf.get("market")
        if not symbol or not market:
            continue

        first_char = symbol.split(".")[0][0].lower()
        if not ("a" <= first_char <= "z" or "0" <= first_char <= "9"):
            first_char = "etc"

        file_path = os.path.join(NAV_DIR, market, f"{first_char}.json")
        if file_path not in files_to_update:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    files_to_update[file_path] = {
                        ticker["symbol"]: ticker for ticker in json.load(f)
                    }
            except (FileNotFoundError, json.JSONDecodeError):
                files_to_update[file_path] = {}

        if symbol not in files_to_update[file_path]:
            new_ticker_info = {"symbol": symbol, "market": market, "currency": "USD"}
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

    for file_path, tickers_dict in files_to_update.items():
        sorted_tickers = sorted(tickers_dict.values(), key=lambda x: x["symbol"])
        save_json_file(file_path, sorted_tickers)
        print(f"  -> Updated file: {os.path.relpath(file_path, ROOT_DIR)}")


def main():
    print("\n--- Starting to Fetch Top US ETFs from Predefined List ---")

    existing_symbols = {
        t["symbol"]
        for m in os.listdir(NAV_DIR)
        if os.path.isdir(os.path.join(NAV_DIR, m))
        for f in os.listdir(os.path.join(NAV_DIR, m))
        if f.endswith(".json")
        if (d := load_json_file(os.path.join(NAV_DIR, m, f)))
        for t in d
    }
    print(f"Found {len(existing_symbols)} existing symbols in nav directories.")

    # 1. 내장된 리스트 파싱
    us_etfs_base = parse_predefined_list()
    print(f"  -> Parsed {len(us_etfs_base)} ETFs from the predefined list.")

    if us_etfs_base:
        # 2. yfinance로 정보 보강
        us_etfs_enriched = enrich_with_yfinance(us_etfs_base)

        # 3. 새로운 ETF만 필터링
        new_us_etfs = [
            etf for etf in us_etfs_enriched if etf["symbol"] not in existing_symbols
        ]
        print(f"  -> Found {len(new_us_etfs)} new US ETFs to add.")

        if new_us_etfs:
            save_new_etfs_to_nav([{**etf, "currency": "USD"} for etf in new_us_etfs])

    print("\n🎉 Finished fetching and updating top US ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
