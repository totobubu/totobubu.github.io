# scripts/aggregate_popularity.py

import os
import json
import sys
from contextlib import suppress
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from scripts.popularity_utils import (  # noqa: E402
    load_nav_metadata,
    is_etf,
    normalize_symbol,
)


def main():
    # Windows 콘솔에서 한글 출력을 위한 UTF-8 인코딩 설정
    if sys.stdout.encoding != "utf-8":
        with suppress(AttributeError, ValueError):
            sys.stdout.reconfigure(encoding="utf-8")
    print("--- Starting Popularity Aggregation ---")

    # Firebase 인증: 환경 변수(GitHub Actions) 또는 로컬 파일
    if service_account_info := os.environ.get("FIRESTORE_SA_KEY"):
        # GitHub Actions: 환경 변수에서 JSON 문자열 로드
        try:
            cred = credentials.Certificate(json.loads(service_account_info))
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Error initializing Firebase from environment: {e}")
            return
    else:
        # 로컬 개발: 파일에서 로드
        local_key_path = "service-account-key.json"
        if not os.path.exists(local_key_path):
            print("Error: No authentication method found.")
            print("  - Environment variable FIRESTORE_SA_KEY not set")
            print(f"  - Local file {local_key_path} not found")
            return
        try:
            cred = credentials.Certificate(local_key_path)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Error initializing Firebase from file: {e}")
            return

    db = firestore.client()
    print("Firebase connection successful.")

    nav_metadata = load_nav_metadata()
    if not nav_metadata:
        print("Warning: nav metadata is empty. Results may be incomplete.")

    popularity_counts = {}
    users_ref = db.collection("userBookmarks")
    docs = users_ref.stream()

    total_bookmarks = 0
    normalization_changes = {}
    for doc in docs:
        user_data = doc.to_dict()
        bookmarks = user_data.get("bookmarks", {})
        for symbol in bookmarks.keys():
            canonical_symbol = normalize_symbol(symbol, nav_metadata)
            if canonical_symbol != symbol:
                normalization_changes[symbol] = canonical_symbol
            popularity_counts[canonical_symbol] = (
                popularity_counts.get(canonical_symbol, 0) + 1
            )
            total_bookmarks += 1

    print(f"Aggregation complete. Total bookmarks found: {total_bookmarks}")
    if normalization_changes:
        print(
            "Normalized symbols detected: "
            + ", ".join(
                f"{old}→{new}" for old, new in normalization_changes.items()
            )
        )

    # 인기도 순으로 정렬
    sorted_popularity = sorted(
        popularity_counts.items(), key=lambda item: item[1], reverse=True
    )

    output_path = "public/popularity.json"
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(dict(sorted_popularity), f, ensure_ascii=False, indent=2)
        print(f"Successfully saved popularity data to {output_path}")
    except Exception as e:
        print(f"Error saving file: {e}")

    # 추가 시장별 인기도 파일 저장
    nav_metadata = load_nav_metadata()
    breakdown = {
        "us-etfs": {},
        "us-stocks": {},
        "kr-etfs": {},
        "kr-stocks": {},
    }
    skipped_symbols = []

    for symbol, count in sorted_popularity:
        nav_item = nav_metadata.get(symbol)
        if not nav_item:
            skipped_symbols.append(symbol)
            continue

        currency = (nav_item.get("currency") or "").upper()
        etf_flag = is_etf(nav_item)

        if currency == "USD":
            bucket = "us-etfs" if etf_flag else "us-stocks"
        elif currency == "KRW":
            bucket = "kr-etfs" if etf_flag else "kr-stocks"
        else:
            skipped_symbols.append(symbol)
            continue

        breakdown[bucket][symbol] = count

    popularity_dir = os.path.join("public", "popularity")
    os.makedirs(popularity_dir, exist_ok=True)

    for bucket, data in breakdown.items():
        bucket_path = os.path.join(popularity_dir, f"popularity-{bucket}.json")
        try:
            with open(bucket_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"Saved {bucket} popularity data to {bucket_path}")
        except Exception as e:
            print(f"Error saving {bucket_path}: {e}")

    if skipped_symbols:
        print(
            "Warning: Skipped symbols for market breakdown (missing metadata or currency): "
            + ", ".join(skipped_symbols)
        )


if __name__ == "__main__":
    main()
