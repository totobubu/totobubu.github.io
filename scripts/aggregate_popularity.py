# scripts/aggregate_popularity.py

import os
import json
import sys
import firebase_admin
from firebase_admin import credentials, firestore


def main():
    # Windows 콘솔에서 한글 출력을 위한 UTF-8 인코딩 설정
    if sys.stdout.encoding != "utf-8":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            # Python < 3.7 또는 이미 reconfigure된 경우 무시
            pass
    print("--- Starting Popularity Aggregation ---")

    # Firebase 인증: 환경 변수(GitHub Actions) 또는 로컬 파일
    service_account_info = os.environ.get("FIRESTORE_SA_KEY")
    if service_account_info:
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

    print(f"Aggregation complete. Total bookmarks found: {total_bookmarks}")

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


if __name__ == "__main__":
    main()
