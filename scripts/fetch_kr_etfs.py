import os
import json
import FinanceDataReader as fdr
from tqdm import tqdm
from utils import load_json_file, save_json_file

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

# 브랜드-운용사 맵은 company 필드를 채우는 데 유용하므로 유지합니다.
BRAND_TO_ISSUER_MAP = {
    "KODEX": "삼성자산운용",
    "TIGER": "미래에셋자산운용",
    "KBSTAR": "KB자산운용",
    "HANARO": "NH-Amundi자산운용",
    "KOSEF": "키움투자자산운용",
    "ARIRANG": "한화자산운용",
    "SOL": "신한자산운용",
    "TIMEFOLIO": "타임폴리오자산운용",
    "WOORI": "우리자산운용",
    "ACE": "한국투자신탁운용",
    "FOCUS": "대신자산운용",
    "HK": "흥국자산운용",
    "BNK": "비엔케이자산운용",
    "VITA": "이베스트자산운용",
    "RISE": "KB자산운용",
    "KURE": "트러스톤자산운용",
    "HEROES": "브이아이자산운용",
    "MAESTRO": "마에스트로자산운용",
}


def get_kr_top_etfs(top_n=1000):
    """FinanceDataReader 목록과 브랜드 매핑을 사용하여 상위 KR ETF 목록을 생성합니다."""
    print(f"Fetching Top {top_n} KR ETFs by NAV from FDR...")
    try:
        etf_df = fdr.StockListing("ETF/KR")

        if "NAV" not in etf_df.columns:
            print("❌ Error: 'NAV' column not found in FDR ETF list.")
            return []

        top_df = etf_df.sort_values(by="NAV", ascending=False).head(top_n)
        etfs = []

        print("Assigning company names based on brand keywords...")
        for _, row in tqdm(top_df.iterrows(), total=len(top_df)):
            name = row["Name"]
            company_name = None  # 기본값은 None

            for brand, issuer in BRAND_TO_ISSUER_MAP.items():
                if name.startswith(brand):
                    company_name = issuer
                    break

            # [핵심 수정] Market 정보가 없으므로 KOSPI와 .KS로 통일
            symbol = f"{row['Symbol']}.KS"
            market_name = "KOSPI"

            etfs.append(
                {
                    "symbol": symbol,
                    "koName": name,
                    "company": company_name,
                    "market": market_name,
                }
            )

        print(f"  -> Found and processed {len(etfs)} KR ETFs.")
        return etfs
    except Exception as e:
        print(f"❌ Error fetching KR ETFs: {e}")
        return []


def save_new_etfs_to_nav(new_etf_list, currency):
    """가져온 ETF 목록을 올바른 market 폴더에 추가합니다."""
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


def main():
    print("\n--- Starting to Fetch Top KR ETFs ---")

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

    kr_etfs = get_kr_top_etfs(1000)
    if kr_etfs:
        new_kr_etfs = [etf for etf in kr_etfs if etf["symbol"] not in existing_symbols]
        print(f"  -> Found {len(new_kr_etfs)} new KR ETFs to add.")
        if new_kr_etfs:
            save_new_etfs_to_nav(
                [{**etf, "currency": "KRW"} for etf in new_kr_etfs], "KRW"
            )

    print("\n🎉 Finished fetching and updating top KR ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
