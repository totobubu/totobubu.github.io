#!/usr/bin/env python3
"""
no_dividends로 분류된 종목들을 nav 파일에 표시하는 스크립트
"""

import os
import json
from pathlib import Path

# 경로 설정
ROOT_DIR = Path(__file__).parent.parent.parent
CLASSIFIED_FILE = Path(__file__).parent / "failed_symbols_classified.json"
NAV_DIR = ROOT_DIR / "public" / "nav"

def load_classified_report():
    """분류 리포트 로드"""
    with open(CLASSIFIED_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def find_and_update_symbol(symbol, market_dirs):
    """
    심볼을 찾아서 noDividends 필드 추가
    Returns: (found, updated, file_path)
    """
    first_digit = symbol[0]
    filename = f"{first_digit}.json"
    
    for market_dir in market_dirs:
        file_path = NAV_DIR / market_dir / filename
        
        if not file_path.exists():
            continue
        
        # JSON 파일 로드
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 심볼 찾기
        found_index = None
        for i, item in enumerate(data):
            if item.get("symbol") == symbol:
                found_index = i
                break
        
        if found_index is None:
            continue
        
        # 이미 noDividends 필드가 있는지 확인
        if data[found_index].get("noDividends") == True:
            return True, False, str(file_path)
        
        # noDividends 필드 추가
        data[found_index]["noDividends"] = True
        
        # 파일 저장
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        return True, True, str(file_path)
    
    return False, False, ""

def main():
    print("🏷️  Marking No-Dividend Symbols")
    print("=" * 60)
    
    # 분류 리포트 로드
    classified = load_classified_report()
    no_dividends = classified.get("no_dividends", [])
    
    print(f"📊 Found {len(no_dividends)} no-dividend symbols to mark\n")
    
    updated_count = 0
    skipped_count = 0
    not_found_count = 0
    
    market_dirs = ["KOSDAQ", "KOSPI"]
    
    for item in no_dividends:
        symbol = item["symbol"]
        
        # 심볼 찾아서 업데이트
        found, updated, file_path = find_and_update_symbol(symbol, market_dirs)
        
        if not found:
            print(f"  ⚠️  {symbol}: File not found")
            not_found_count += 1
            continue
        
        if updated:
            print(f"  ✅ {symbol}: Marked as noDividends")
            updated_count += 1
        else:
            skipped_count += 1
    
    print("\n" + "=" * 60)
    print(f"📈 Summary:")
    print(f"  ✅ Updated: {updated_count} symbols")
    print(f"  ⏭️  Skipped (already marked): {skipped_count} symbols")
    print(f"  ⚠️  Not found: {not_found_count} symbols")
    print(f"  📝 Total processed: {len(no_dividends)} symbols")

if __name__ == "__main__":
    main()
