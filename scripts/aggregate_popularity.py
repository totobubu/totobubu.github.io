# NEW FILE: scripts/aggregate_popularity.py

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

def main():
    print("--- Starting Popularity Aggregation ---")

    # GitHub Actions에서 시크릿을 환경 변수로 주입받아 사용
    service_account_info = os.environ.get("FIRESTORE_SA_KEY")
    if not service_account_info:
        print("Error: FIRESTORE_SA_KEY environment variable not set.")
        return

    try:
        cred = credentials.Certificate(json.loads(service_account_info))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase connection successful.")
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return

    popularity_counts = {}
    users_ref = db.collection('userBookmarks')
    docs = users_ref.stream()

    total_bookmarks = 0
    for doc in docs:
        user_data = doc.to_dict()
        bookmarks = user_data.get('bookmarks', {})
        for symbol in bookmarks.keys():
            popularity_counts[symbol] = popularity_counts.get(symbol, 0) + 1
            total_bookmarks += 1

    print(f"Aggregation complete. Total bookmarks found: {total_bookmarks}")

    # 인기도 순으로 정렬
    sorted_popularity = sorted(popularity_counts.items(), key=lambda item: item[1], reverse=True)

    output_path = "public/popularity.json"
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted_popularity), f, ensure_ascii=False, indent=2)
        print(f"Successfully saved popularity data to {output_path}")
    except Exception as e:
        print(f"Error saving file: {e}")


if __name__ == "__main__":
    main()