# scripts/update_market_cap.py
"""
매일 실행되어 현재 시가총액(marketCap)을 각 티커의 backtestData에 추가하는 스크립트
Yahoo Finance를 사용하여 현재 시가총액을 가져옵니다 (무료, 제한 없음).
"""

import json
import yfinance as yf
from datetime import datetime
from pathlib import Path
from tqdm import tqdm
import time

# --- 경로 설정 ---
ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
NAV_FILE = PUBLIC_DIR / "nav.json"


def get_current_market_cap_batch(symbols):
    """Yahoo Finance에서 여러 티커의 현재 시가총액을 배치로 가져오기"""
    try:
        tickers = yf.Tickers(" ".join(symbols))
        market_caps = {}
        
        for symbol in symbols:
            try:
                ticker_obj = tickers.tickers.get(symbol)
                if ticker_obj and ticker_obj.info:
                    market_cap = ticker_obj.info.get("marketCap")
                    market_caps[symbol] = market_cap if market_cap else None
                else:
                    market_caps[symbol] = None
            except Exception:
                market_caps[symbol] = None
        
        return market_caps
    
    except Exception as e:
        print(f"❌ Batch fetch error: {e}")
        return {symbol: None for symbol in symbols}


def update_ticker_market_cap(symbol, today_str, market_cap):
    """특정 티커의 오늘 날짜 backtestData에 marketCap 추가"""
    sanitized_symbol = symbol.replace(".", "-").lower()
    file_path = DATA_DIR / f"{sanitized_symbol}.json"

    if not file_path.exists():
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        backtest_data = data.get("backtestData", [])
        if not backtest_data:
            return False

        # 오늘 날짜의 데이터 찾기
        today_entry = None
        for entry in backtest_data:
            if entry.get("date") == today_str:
                today_entry = entry
                break

        if not today_entry:
            return False

        # 이미 marketCap이 있으면 스킵
        if "marketCap" in today_entry and today_entry["marketCap"] is not None:
            return False

        # marketCap이 None이면 스킵
        if market_cap is None:
            return False

        # marketCap 추가
        today_entry["marketCap"] = market_cap

        # 파일 저장
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return True

    except Exception as e:
        print(f"❌ Error updating {symbol}: {e}")
        return False


def main():
    print("=" * 70)
    print("📈 Daily Market Cap Update (Yahoo Finance)")
    print("=" * 70)

    # nav.json에서 활성 티커 목록 가져오기
    try:
        with open(NAV_FILE, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: nav.json not found at {NAV_FILE}")
        return

    active_tickers = [
        t["symbol"]
        for t in nav_data.get("nav", [])
        if t.get("symbol") and not t.get("upcoming", False)
    ]

    if not active_tickers:
        print("⚠️  No active tickers found in nav.json")
        return

    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"📊 Total active tickers: {len(active_tickers)}")
    print(f"📅 Today's date: {today_str}")
    print(f"💡 Using Yahoo Finance (free, no limits)\n")

    # 배치 크기 (Yahoo Finance는 제한 없지만 안정성을 위해 100개씩)
    BATCH_SIZE = 100
    updated_count = 0
    skipped_count = 0

    # 배치로 처리
    for i in tqdm(
        range(0, len(active_tickers), BATCH_SIZE),
        desc="Fetching market caps in batches"
    ):
        batch = active_tickers[i:i + BATCH_SIZE]
        
        # 배치로 시가총액 가져오기
        market_caps = get_current_market_cap_batch(batch)
        
        # 각 티커 업데이트
        for symbol in batch:
            market_cap = market_caps.get(symbol)
            result = update_ticker_market_cap(symbol, today_str, market_cap)
            if result:
                updated_count += 1
            else:
                skipped_count += 1
        
        # 다음 배치 전 잠시 대기 (API 안정성)
        if i + BATCH_SIZE < len(active_tickers):
            time.sleep(1)

    print("\n" + "=" * 70)
    print(f"✅ Successfully updated: {updated_count} tickers")
    print(f"⏭️  Skipped: {skipped_count} tickers")
    print("=" * 70)


if __name__ == "__main__":
    main()

