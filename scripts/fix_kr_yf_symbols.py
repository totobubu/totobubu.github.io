#!/usr/bin/env python3
"""
한국 주식 티커의 yfSymbol을 yfSuffixFallbacks를 기반으로 올바르게 수정하는 스크립트

사용법:
    python scripts/fix_kr_yf_symbols.py --dry-run  # 미리보기
    python scripts/fix_kr_yf_symbols.py            # 실제 수정
"""

import os
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any

ROOT_DIR = Path(__file__).parent.parent
NAV_DIR = ROOT_DIR / "public" / "nav"
KR_MARKETS = ["KOSPI", "KOSDAQ"]


def load_json_file(file_path: Path) -> List[Dict[str, Any]]:
    """JSON 파일을 읽어서 반환"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"⚠️ 파일 읽기 실패: {file_path} - {e}")
        return []


def save_json_file(file_path: Path, data: List[Dict[str, Any]]) -> bool:
    """JSON 파일을 저장"""
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"❌ 파일 저장 실패: {file_path} - {e}")
        return False


def fix_yf_symbol(ticker: Dict[str, Any]) -> tuple[bool, str]:
    """
    티커의 yfSymbol을 yfSuffixFallbacks를 기반으로 수정
    
    Returns:
        (수정 여부, 메시지)
    """
    symbol = ticker.get("symbol")
    yf_suffix_fallbacks = ticker.get("yfSuffixFallbacks", [])
    current_yf_symbol = ticker.get("yfSymbol")
    
    # yfSuffixFallbacks가 없으면 수정할 필요 없음
    if not yf_suffix_fallbacks or not isinstance(yf_suffix_fallbacks, list):
        return False, ""
    
    # 첫 번째 fallback을 사용
    first_fallback = yf_suffix_fallbacks[0]
    if not first_fallback or not isinstance(first_fallback, str):
        return False, ""
    
    # fallback이 .로 시작하는지 확인
    if not first_fallback.startswith("."):
        first_fallback = f".{first_fallback}"
    
    # 올바른 yfSymbol 생성
    correct_yf_symbol = f"{symbol}{first_fallback}"
    
    # 이미 올바르게 설정되어 있으면 수정 불필요
    if current_yf_symbol == correct_yf_symbol:
        return False, ""
    
    # yfSymbol이 없거나 잘못된 경우 수정
    ticker["yfSymbol"] = correct_yf_symbol
    
    if current_yf_symbol:
        return True, f"{symbol}: {current_yf_symbol} → {correct_yf_symbol}"
    else:
        return True, f"{symbol}: (없음) → {correct_yf_symbol}"


def process_market_files(market: str, dry_run: bool = False) -> Dict[str, int]:
    """특정 시장의 모든 파일을 처리"""
    market_dir = NAV_DIR / market
    if not market_dir.exists():
        print(f"⚠️ 시장 디렉토리가 없습니다: {market_dir}")
        return {"processed": 0, "updated": 0, "files_modified": 0}
    
    stats = {"processed": 0, "updated": 0, "files_modified": 0}
    json_files = list(market_dir.glob("*.json"))
    
    print(f"\n📁 {market} 시장 처리 중... ({len(json_files)}개 파일)")
    
    for file_path in sorted(json_files):
        tickers = load_json_file(file_path)
        if not tickers:
            continue
        
        file_updated = False
        file_changes = []
        
        for ticker in tickers:
            stats["processed"] += 1
            updated, message = fix_yf_symbol(ticker)
            
            if updated:
                stats["updated"] += 1
                file_updated = True
                file_changes.append(message)
        
        if file_updated:
            stats["files_modified"] += 1
            if not dry_run:
                if save_json_file(file_path, tickers):
                    print(f"  ✅ {file_path.name}: {len(file_changes)}개 티커 수정")
                    for change in file_changes[:5]:  # 처음 5개만 출력
                        print(f"     - {change}")
                    if len(file_changes) > 5:
                        print(f"     ... 외 {len(file_changes) - 5}개")
                else:
                    print(f"  ❌ {file_path.name}: 저장 실패")
            else:
                print(f"  🔍 {file_path.name}: {len(file_changes)}개 티커 수정 예정")
                for change in file_changes[:5]:
                    print(f"     - {change}")
                if len(file_changes) > 5:
                    print(f"     ... 외 {len(file_changes) - 5}개")
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="한국 주식 티커의 yfSymbol을 yfSuffixFallbacks 기반으로 수정"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제로 수정하지 않고 미리보기만 수행",
    )
    parser.add_argument(
        "--market",
        choices=KR_MARKETS,
        help="특정 시장만 처리 (기본값: 모든 한국 시장)",
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("한국 주식 티커 yfSymbol 수정 스크립트")
    print("=" * 60)
    
    if args.dry_run:
        print("🔍 DRY-RUN 모드: 실제로 수정하지 않습니다.\n")
    
    markets_to_process = [args.market] if args.market else KR_MARKETS
    
    total_stats = {"processed": 0, "updated": 0, "files_modified": 0}
    
    for market in markets_to_process:
        stats = process_market_files(market, dry_run=args.dry_run)
        total_stats["processed"] += stats["processed"]
        total_stats["updated"] += stats["updated"]
        total_stats["files_modified"] += stats["files_modified"]
    
    print("\n" + "=" * 60)
    print("📊 처리 결과 요약")
    print("=" * 60)
    print(f"  처리된 티커: {total_stats['processed']}개")
    print(f"  수정된 티커: {total_stats['updated']}개")
    print(f"  수정된 파일: {total_stats['files_modified']}개")
    
    if args.dry_run and total_stats["updated"] > 0:
        print("\n💡 실제로 수정하려면 --dry-run 옵션을 제거하고 다시 실행하세요.")
    elif not args.dry_run and total_stats["updated"] > 0:
        print("\n✅ 수정 완료! 이제 'npm run generate-nav'를 실행하여 nav.json을 업데이트하세요.")


if __name__ == "__main__":
    main()

