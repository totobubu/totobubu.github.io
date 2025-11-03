# scripts/test_logos.py
"""로고 파일 R2 테스트"""
import requests

logos_to_test = [
    "aapl.svg",
    "korea-tiger.ico", 
    "roundhill.svg",
    "yieldmax.png"
]

base_url = "https://pub-cdda6824954243b49965012b33c29bd6.r2.dev/logos"

print("=" * 60)
print("  R2 로고 파일 테스트")
print("=" * 60)

for logo in logos_to_test:
    url = f"{base_url}/{logo}"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            print(f"\n[OK] {logo}")
            print(f"  Status: {r.status_code}")
            print(f"  Content-Type: {r.headers.get('Content-Type')}")
            print(f"  Size: {len(r.content):,} bytes")
            print(f"  Cache-Control: {r.headers.get('Cache-Control')}")
        else:
            print(f"\n[FAIL] {logo}")
            print(f"  Status: {r.status_code}")
    except Exception as e:
        print(f"\n[ERROR] {logo}")
        print(f"  {e}")

print("\n" + "=" * 60)
print("  테스트 완료!")
print("=" * 60)

