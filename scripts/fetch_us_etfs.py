import os
import sys
import json
import yfinance as yf
from tqdm import tqdm
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils import load_json_file, save_json_file

# Windows 콘솔 한글 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python 3.7 이전 버전
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

EXCHANGE_MAP = {
    "NYSE Arca": "NYSE",
    "NYSEArca": "NYSE",
    "NYSE": "NYSE",
    "New York Stock Exchange": "NYSE",
    "NASDAQ": "NASDAQ",
    "NasdaqGS": "NASDAQ",
    "NasdaqGM": "NASDAQ",
    "NasdaqCM": "NASDAQ",
    "Nasdaq": "NASDAQ",
    "NASDAQ Global Select": "NASDAQ",
    "BATS": "NASDAQ",
    "BZX": "NASDAQ",  # Cboe BZX (BATS)
    "AMEX": "NYSE",
    "PCX": "NYSE",  # NYSE Pacific
}
DEFAULT_US_MARKET = "NYSE"  # 대부분의 ETF는 NYSE Arca에 상장

# 제공해주신 데이터를 파싱하여 Python 리스트로 변환
PREDEFINED_ETF_TEXT = """
"""


def parse_predefined_list():
    """
    PREDEFINED_ETF_TEXT에서 티커 심볼 파싱

    지원 형식:
    1. 심볼만: "AAPL"
    2. 심볼\t이름: "AAPL\tApple Inc."
    """
    etfs = []
    lines = PREDEFINED_ETF_TEXT.strip().split("\n")

    for line in lines:
        line = line.strip()
        if not line:  # 빈 줄 건너뛰기
            continue

        parts = line.split("\t")
        symbol = parts[0].strip()

        if not symbol:  # 심볼이 비어있으면 건너뛰기
            continue

        # 기본 ETF 정보
        etf_info = {"symbol": symbol}

        # 탭으로 구분된 이름이 있는 경우
        if len(parts) >= 2:
            name = parts[1].strip()
            company = name.split(" ")[0]

            # 알려진 운용사인지 확인
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
                company = name.split(" ")[0]

            etf_info["company"] = company
            etf_info["longName"] = name

        etfs.append(etf_info)

    return etfs


def enrich_with_yfinance(etf_list):
    """yfinance를 사용하여 ETF 목록에 거래소 정보를 추가합니다."""
    print("Enriching ETF data with yfinance for exchange info...")

    enriched_etfs = []
    symbols = [etf["symbol"] for etf in etf_list]
    exchange_stats = {"NYSE": 0, "NASDAQ": 0, "Unknown": 0, "Failed": 0}

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
                exchange = info.get("exchange", "")

                # 거래소 매핑
                if exchange in EXCHANGE_MAP:
                    market = EXCHANGE_MAP[exchange]
                    exchange_stats[market] += 1
                else:
                    # 거래소 정보가 없거나 매핑되지 않은 경우
                    market = DEFAULT_US_MARKET
                    exchange_stats["Unknown"] += 1
                    print(
                        f"\n  ⚠️ {symbol}: Unknown exchange '{exchange}' -> defaulting to {DEFAULT_US_MARKET}"
                    )

                original_etf["market"] = market

                # yfinance의 longName이 더 정확할 수 있으므로 업데이트
                if info.get("longName"):
                    original_etf["longName"] = info.get("longName")
                enriched_etfs.append(original_etf)
            except Exception as e:
                original_etf["market"] = DEFAULT_US_MARKET
                exchange_stats["Failed"] += 1
                print(
                    f"\n  ❌ {symbol}: Failed to fetch data ({str(e)[:50]}) -> defaulting to {DEFAULT_US_MARKET}"
                )
                enriched_etfs.append(original_etf)

    # 통계 출력
    print(f"\n📊 Exchange Distribution:")
    print(f"  - NYSE: {exchange_stats['NYSE']}")
    print(f"  - NASDAQ: {exchange_stats['NASDAQ']}")
    print(f"  - Unknown exchange: {exchange_stats['Unknown']}")
    print(f"  - Failed to fetch: {exchange_stats['Failed']}")

    return enriched_etfs


def save_new_etfs_to_nav(new_etf_list):
    if not new_etf_list:
        print("  -> No new ETFs to add.")
        return

    print(f"Updating nav source files with {len(new_etf_list)} new ETFs...")
    files_to_update = {}
    total_added_count = 0
    market_counts = {"NYSE": 0, "NASDAQ": 0}

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
            if market in market_counts:
                market_counts[market] += 1

    if total_added_count == 0:
        print("  -> No new ETFs to add.")
        return

    print(f"\n📁 Files to update by market:")
    for file_path, tickers_dict in files_to_update.items():
        sorted_tickers = sorted(tickers_dict.values(), key=lambda x: x["symbol"])
        save_json_file(file_path, sorted_tickers)
        rel_path = os.path.relpath(file_path, ROOT_DIR)
        added_count = sum(
            1
            for t in sorted_tickers
            if t["symbol"] in [e["symbol"] for e in new_etf_list]
        )
        print(f"  ✓ {rel_path} (+{added_count} tickers)")

    print(f"\n📊 Market Distribution:")
    print(f"  - NYSE: {market_counts['NYSE']} ETFs")
    print(f"  - NASDAQ: {market_counts['NASDAQ']} ETFs")


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
