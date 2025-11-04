#!/usr/bin/env python3
# scripts/market_data_pipeline.py
"""
시장 데이터 통합 파이프라인
- 한 번의 실행으로 yfinance를 활용한 모든 시장 데이터 업데이트
- 개별 스크립트를 순차 실행하는 것보다 효율적
"""

import os
import json
import time
import sys
from datetime import datetime
from pathlib import Path
from tqdm import tqdm

# Firebase 관련 (선택적)
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("⚠️  Firebase 라이브러리가 없습니다. popularity 업데이트를 건너뜁니다.")

# 공통 유틸리티
from utils import (
    load_json_file,
    save_json_file,
    sanitize_ticker_for_filename,
)

# 경로 설정
ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
SIDEBAR_DIR = PUBLIC_DIR / "sidebar"
NAV_FILE = PUBLIC_DIR / "nav.json"
POPULARITY_FILE = PUBLIC_DIR / "popularity.json"

# 글로벌 상태
nav_data = None
active_symbols = []
popularity_dict = {}

# 사이드바 카테고리 설정
CATEGORIES = {
    "us-etfs": {
        "file": "sidebar-tickers-us-etfs.json",
        "filter": lambda t: t.get("currency") == "USD" and t.get("isEtf") == True,
    },
    "us-stocks": {
        "file": "sidebar-tickers-us-stocks.json",
        "filter": lambda t: t.get("currency") == "USD" and not t.get("isEtf"),
    },
    "kr-etfs": {
        "file": "sidebar-tickers-kr-etfs.json",
        "filter": lambda t: t.get("currency") == "KRW" and t.get("isEtf") == True,
    },
    "kr-stocks": {
        "file": "sidebar-tickers-kr-stocks.json",
        "filter": lambda t: t.get("currency") == "KRW" and not t.get("isEtf"),
    },
}

MAX_TICKERS = 50
POPULARITY_LIMIT = 20


# ============================================================================
# 초기화
# ============================================================================
def initialize():
    """공통 데이터 로드"""
    global nav_data, active_symbols
    
    print("=" * 80)
    print("📈 시장 데이터 통합 파이프라인 시작")
    print("=" * 80)
    
    # nav.json 로드
    print("\n[1/2] nav.json 로드 중...")
    try:
        with open(NAV_FILE, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ nav.json을 찾을 수 없습니다: {NAV_FILE}")
        return False
    
    active_symbols = [
        t["symbol"]
        for t in nav_data.get("nav", [])
        if t.get("symbol") and not t.get("upcoming", False)
    ]
    
    print(f"   ✓ 활성 티커 {len(active_symbols)}개 로드 완료")
    
    # 디렉토리 확인
    print("\n[2/2] 디렉토리 확인 중...")
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SIDEBAR_DIR, exist_ok=True)
    print(f"   ✓ 데이터 디렉토리: {DATA_DIR}")
    print(f"   ✓ 사이드바 디렉토리: {SIDEBAR_DIR}")
    
    print("\n✅ 초기화 완료\n")
    return True


# ============================================================================
# Step 1: 인기도 집계 (aggregate_popularity)
# ============================================================================
def aggregate_popularity():
    """Firestore에서 북마크 데이터를 집계하여 인기도 생성"""
    global popularity_dict
    
    print("\n" + "=" * 80)
    print("⭐ STEP 1: 인기도 집계")
    print("=" * 80)
    
    if not FIREBASE_AVAILABLE:
        print("⚠️  Firebase 라이브러리 없음. 인기도 업데이트 건너뜀\n")
        # 기존 파일 로드
        popularity_dict = load_json_file(str(POPULARITY_FILE)) or {}
        return 0
    
    # Firebase 인증
    service_account_info = os.environ.get("FIRESTORE_SA_KEY")
    if service_account_info:
        try:
            cred = credentials.Certificate(json.loads(service_account_info))
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"❌ Firebase 환경변수 인증 실패: {e}")
            popularity_dict = load_json_file(str(POPULARITY_FILE)) or {}
            return 0
    else:
        local_key_path = "service-account-key.json"
        if not os.path.exists(local_key_path):
            print("⚠️  Firebase 인증 정보 없음. 인기도 업데이트 건너뜀\n")
            popularity_dict = load_json_file(str(POPULARITY_FILE)) or {}
            return 0
        try:
            cred = credentials.Certificate(local_key_path)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"❌ Firebase 로컬 파일 인증 실패: {e}")
            popularity_dict = load_json_file(str(POPULARITY_FILE)) or {}
            return 0
    
    db = firestore.client()
    print("✓ Firebase 연결 성공")
    
    # 인기도 집계
    popularity_counts = {}
    users_ref = db.collection("userBookmarks")
    docs = users_ref.stream()
    
    total_bookmarks = 0
    for doc in docs:
        user_data = doc.to_dict()
        bookmarks = user_data.get("bookmarks", {})
        for symbol in bookmarks.keys():
            popularity_counts[symbol] = popularity_counts.get(symbol, 0) + 1
            total_bookmarks += 1
    
    print(f"✓ 총 북마크: {total_bookmarks}개")
    
    # 인기도 순 정렬
    sorted_popularity = sorted(
        popularity_counts.items(), key=lambda item: item[1], reverse=True
    )
    
    # 파일 저장
    popularity_dict = dict(sorted_popularity)
    try:
        with open(POPULARITY_FILE, "w", encoding="utf-8") as f:
            json.dump(popularity_dict, f, ensure_ascii=False, indent=2)
        print(f"✓ 인기도 파일 저장: {POPULARITY_FILE}")
    except Exception as e:
        print(f"❌ 파일 저장 실패: {e}")
    
    print(f"\n✅ 인기도 집계 완료: {len(popularity_dict)}개 티커\n")
    return len(popularity_dict)


# ============================================================================
# Step 3: 사이드바 티커 생성 (generate_sidebar_tickers)
# ============================================================================
def enrich_ticker_data(ticker_info):
    """티커 정보에 data 파일의 정보 추가"""
    symbol = ticker_info.get("symbol")
    day_order = {"월": 1, "화": 2, "수": 3, "목": 4, "금": 5}
    
    file_path = DATA_DIR / f"{sanitize_ticker_for_filename(symbol)}.json"
    data_file_content = load_json_file(str(file_path))
    
    market_cap_raw = None
    yield_val = None
    price = None
    
    if data_file_content and "tickerInfo" in data_file_content:
        info = data_file_content["tickerInfo"]
        market_cap_raw = info.get("marketCap")
        yield_val = info.get("Yield")
        price = info.get("regularMarketPrice")
    
    return {
        "symbol": symbol,
        "koName": ticker_info.get("koName"),
        "longName": ticker_info.get("longName"),
        "company": ticker_info.get("company"),
        "logo": ticker_info.get("logo"),
        "frequency": ticker_info.get("frequency"),
        "group": ticker_info.get("group"),
        "yield": yield_val,
        "price": price,
        "groupOrder": day_order.get(ticker_info.get("group"), 999),
        "currency": ticker_info.get("currency"),
        "underlying": ticker_info.get("underlying"),
        "market": ticker_info.get("market"),
        "marketCap": market_cap_raw,
        "isEtf": ticker_info.get("isEtf"),
        "popularity": 0,
    }


def select_top_tickers(all_tickers, popularity_dict):
    """popularity 상위 20개 + marketCap 상위 30개 선택"""
    # popularity 값 업데이트
    for ticker in all_tickers:
        symbol = ticker["symbol"]
        ticker["popularity"] = popularity_dict.get(symbol, 0)
    
    # popularity가 있는 티커들 정렬
    popular_tickers = [t for t in all_tickers if t["popularity"] > 0]
    popular_tickers.sort(key=lambda x: x["popularity"], reverse=True)
    
    # 상위 20개 선택
    top_popular = popular_tickers[:POPULARITY_LIMIT]
    selected_symbols = {t["symbol"] for t in top_popular}
    
    # 나머지 티커들
    remaining_tickers = [t for t in all_tickers if t["symbol"] not in selected_symbols]
    
    # marketCap 순 정렬
    remaining_tickers.sort(key=lambda x: (x.get("marketCap") or 0), reverse=True)
    
    # 50개까지 채우기
    needed = MAX_TICKERS - len(top_popular)
    top_by_marketcap = remaining_tickers[:needed]
    
    result = top_popular + top_by_marketcap
    return result


def generate_sidebar_tickers():
    """사이드바 티커 파일 생성"""
    print("\n" + "=" * 80)
    print("📂 STEP 2: 사이드바 티커 생성")
    print("=" * 80)
    
    all_tickers_from_nav = nav_data.get("nav", [])
    
    # 모든 티커 enrichment
    print("\n📊 티커 데이터 enrichment 중...")
    all_enriched_tickers = []
    for ticker_info in tqdm(all_tickers_from_nav, desc="티커 처리"):
        symbol = ticker_info.get("symbol")
        if not symbol or ticker_info.get("upcoming"):
            continue
        
        enriched = enrich_ticker_data(ticker_info)
        all_enriched_tickers.append(enriched)
    
    # 카테고리별 처리
    print("\n📂 카테고리별 파일 생성 중...")
    for category_name, config in CATEGORIES.items():
        print(f"\n  {category_name} 처리 중...")
        
        # 카테고리 필터링
        category_tickers = [t for t in all_enriched_tickers if config["filter"](t)]
        print(f"    - 카테고리 내 총 티커: {len(category_tickers)}개")
        
        # 상위 50개 선택
        top_tickers = select_top_tickers(category_tickers, popularity_dict)
        print(f"    - 선택된 티커: {len(top_tickers)}개")
        
        # 인기 티커 수
        popular_count = sum(1 for t in top_tickers if t["popularity"] > 0)
        print(f"    - 인기 티커: {popular_count}개")
        print(f"    - 시가총액 기준 티커: {len(top_tickers) - popular_count}개")
        
        # 파일 저장
        output_path = SIDEBAR_DIR / config["file"]
        save_json_file(str(output_path), top_tickers)
        print(f"    ✓ 저장 완료: {config['file']}")
    
    print(f"\n✅ 사이드바 티커 생성 완료\n")
    return len(CATEGORIES)


# ============================================================================
# 메인 실행
# ============================================================================
def main():
    """통합 파이프라인 실행"""
    start_time = time.time()
    
    # 초기화
    if not initialize():
        return
    
    # Step 1: 인기도 집계
    popularity_count = aggregate_popularity()
    
    # Step 2: 사이드바 티커 생성
    sidebar_count = generate_sidebar_tickers()
    
    # 완료
    elapsed_time = time.time() - start_time
    print("\n" + "=" * 80)
    print("🎉 시장 데이터 통합 파이프라인 완료")
    print("=" * 80)
    print(f"⭐ 인기도: {popularity_count}개 티커")
    print(f"📂 사이드바: {sidebar_count}개 카테고리")
    print(f"⏱️  총 소요 시간: {elapsed_time:.2f}초")
    print("=" * 80)


if __name__ == "__main__":
    main()

