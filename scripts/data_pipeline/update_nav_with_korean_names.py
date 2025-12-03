#!/usr/bin/env python3
"""
토스증권에서 수집한 한국어 종목명을 NAV 파일에 병합하는 스크립트
"""

import json
from pathlib import Path

# 경로 설정
ROOT_DIR = Path(__file__).parent.parent.parent
NAV_DIR = ROOT_DIR / "public" / "nav"
KOREAN_NAMES_FILE = Path(__file__).parent / "korean_names_from_toss.json"

def load_korean_names():
    """토스증권에서 수집한 한국어 이름 로드"""
    if not KOREAN_NAMES_FILE.exists():
        print(f"Error: {KOREAN_NAMES_FILE} not found")
        print("Run fetch_korean_names_from_toss.py first!")
        return {}

    with open(KOREAN_NAMES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def update_nav_files(korean_names_dict):
    """
    NAV 파일에 한국어 이름 업데이트

    Args:
        korean_names_dict: {symbol: {koName, market, source}} 형식의 딕셔너리
    """
    updated_count = 0
    not_found_count = 0
    markets_to_check = set(data["market"] for data in korean_names_dict.values())

    for market in markets_to_check:
        market_path = NAV_DIR / market

        if not market_path.exists():
            print(f"Warning: Market directory not found: {market_path}")
            continue

        print(f"\nUpdating {market}...")

        for nav_file in market_path.glob("*.json"):
            try:
                with open(nav_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                modified = False

                for item in data:
                    symbol = item.get("symbol")

                    # 이 심볼에 대한 한국어 이름이 있는지 확인
                    if symbol in korean_names_dict:
                        korean_data = korean_names_dict[symbol]

                        # koName 필드가 없거나 비어있으면 업데이트
                        if not item.get("koName"):
                            item["koName"] = korean_data["koName"]
                            print(f"  OK {symbol}: {korean_data['koName']}")
                            updated_count += 1
                            modified = True

                # 변경사항이 있으면 파일 저장
                if modified:
                    with open(nav_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)

            except Exception as e:
                print(f"  Error processing {nav_file}: {e}")

    # 업데이트되지 않은 심볼 찾기
    for symbol in korean_names_dict.keys():
        found = False
        market = korean_names_dict[symbol]["market"]
        market_path = NAV_DIR / market

        if market_path.exists():
            for nav_file in market_path.glob("*.json"):
                try:
                    with open(nav_file, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    if any(item.get("symbol") == symbol for item in data):
                        found = True
                        break
                except:
                    continue

        if not found:
            print(f"  WARNING {symbol}: Not found in NAV files")
            not_found_count += 1

    return updated_count, not_found_count

def main():
    print("Updating NAV Files with Korean Names")
    print("=" * 60)

    # 한국어 이름 로드
    korean_names_dict = load_korean_names()

    if not korean_names_dict:
        return

    print(f"\nLoaded {len(korean_names_dict)} Korean names from Toss")

    # NAV 파일 업데이트
    updated_count, not_found_count = update_nav_files(korean_names_dict)

    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Updated: {updated_count} symbols")
    print(f"  Not found in NAV: {not_found_count} symbols")
    print(f"  Total processed: {len(korean_names_dict)} symbols")

if __name__ == "__main__":
    main()
