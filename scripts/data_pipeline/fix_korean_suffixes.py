#!/usr/bin/env python3
"""
한국 시장 종목의 잘못된 yfSymbol 접미사를 수정하는 스크립트
korean_suffix_report.json의 successful_with_alternative 데이터를 기반으로
public/nav/KOSDAQ, public/nav/KOSPI 내의 JSON 파일들을 업데이트합니다.
"""

import os
import json
from pathlib import Path

# 경로 설정
ROOT_DIR = Path(__file__).parent.parent.parent
REPORT_FILE = Path(__file__).parent / "korean_suffix_report.json"
NAV_DIR = ROOT_DIR / "public" / "nav"

def load_report():
    """리포트 파일 로드"""
    with open(REPORT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def find_and_update_symbol(symbol, new_suffix, market_dirs):
    """
    심볼을 찾아서 yfSymbol 업데이트
    Returns: (found, updated, old_yf, new_yf, file_path)
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
        
        # 현재 yfSymbol 확인
        current_yf_symbol = data[found_index].get("yfSymbol", "")
        new_yf_symbol = symbol + new_suffix
        
        if current_yf_symbol == new_yf_symbol:
            return True, False, current_yf_symbol, new_yf_symbol, str(file_path)
        
        # 업데이트
        data[found_index]["yfSymbol"] = new_yf_symbol
        
        # 파일 저장
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        return True, True, current_yf_symbol, new_yf_symbol, str(file_path)
    
    return False, False, "", "", ""

def main():
    print("🔧 Korean Market Suffix Correction Script")
    print("=" * 60)
    
    # 리포트 로드
    report = load_report()
    successful_alternatives = report.get("successful_with_alternative", [])
    
    print(f"📊 Found {len(successful_alternatives)} symbols to update\n")
    
    updated_count = 0
    skipped_count = 0
    not_found_count = 0
    
    market_dirs = ["KOSDAQ", "KOSPI"]
    
    for item in successful_alternatives:
        symbol = item["symbol"]
        alternative_suffix = item["alternative_suffix"]
        original_suffix = item["original_suffix"]
        
        # 심볼 찾아서 업데이트
        found, updated, old_yf, new_yf, file_path = find_and_update_symbol(
            symbol, alternative_suffix, market_dirs
        )
        
        if not found:
            print(f"  ⚠️  {symbol}: File not found")
            not_found_count += 1
            continue
        
        if updated:
            print(f"  ✅ {symbol}: {old_yf} → {new_yf}")
            updated_count += 1
        else:
            print(f"  ⏭️  {symbol}: Already correct ({new_yf})")
            skipped_count += 1
    
    print("\n" + "=" * 60)
    print(f"📈 Summary:")
    print(f"  ✅ Updated: {updated_count} files")
    print(f"  ⏭️  Skipped (already correct): {skipped_count} files")
    print(f"  ⚠️  Not found: {not_found_count} files")
    print(f"  📝 Total processed: {len(successful_alternatives)} symbols")

if __name__ == "__main__":
    main()
