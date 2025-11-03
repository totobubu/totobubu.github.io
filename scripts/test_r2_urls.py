# scripts/test_r2_urls.py
"""
R2 URL 테스트 스크립트
"""
import requests
import json
from r2_config import load_r2_config

def test_r2_urls():
    print("=" * 60)
    print("  R2 URL 테스트")
    print("=" * 60)
    
    try:
        config = load_r2_config()
        base_url = config['public_url']
        print(f"[OK] Base URL: {base_url}\n")
    except Exception as e:
        print(f"[ERROR] R2 설정 로드 실패: {e}")
        return
    
    # 테스트할 URL 목록
    test_urls = [
        ("nav.json", "nav"),
        ("data/005930-ks.json", "005930-ks (삼성전자)"),
        ("data/qqq-us.json", "QQQ ETF"),
        ("sidebar/sidebar-tickers-kr-stocks.json", "한국 주식 사이드바"),
        ("calendar-events.json", "캘린더 이벤트"),
    ]
    
    success_count = 0
    fail_count = 0
    
    for path, desc in test_urls:
        url = f"{base_url}/{path}"
        try:
            print(f"[테스트] {desc}")
            print(f"  URL: {url}")
            
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                size_kb = len(response.content) / 1024
                
                print(f"  [OK] 상태: 200")
                print(f"  [OK] 크기: {size_kb:.2f} KB")
                
                # 내용 검증
                if "nav.json" in path:
                    nav_count = len(data.get("nav", []))
                    print(f"  [OK] 티커 수: {nav_count}개")
                elif "data/" in path:
                    ticker_info = data.get("tickerInfo", {})
                    ko_name = ticker_info.get("koName", "")
                    backtest_len = len(data.get("backtestData", []))
                    print(f"  [OK] 종목명: {ko_name}")
                    print(f"  [OK] backtestData: {backtest_len}개")
                elif "sidebar" in path:
                    ticker_count = len(data)
                    print(f"  [OK] 사이드바 티커 수: {ticker_count}개")
                elif "calendar" in path:
                    event_count = len(data)
                    print(f"  [OK] 이벤트 수: {event_count}개")
                
                success_count += 1
                print()
            else:
                print(f"  [FAIL] 상태: {response.status_code}")
                fail_count += 1
                print()
                
        except requests.exceptions.RequestException as e:
            print(f"  [ERROR] 요청 실패: {e}")
            fail_count += 1
            print()
        except json.JSONDecodeError as e:
            print(f"  [ERROR] JSON 파싱 실패: {e}")
            fail_count += 1
            print()
    
    # 결과 요약
    print("=" * 60)
    print(f"  테스트 결과: 성공 {success_count}/{len(test_urls)}")
    print("=" * 60)
    
    if success_count == len(test_urls):
        print("\n[OK] 모든 테스트 통과! R2가 정상 작동합니다.")
        return True
    else:
        print(f"\n[WARNING] {fail_count}개 테스트 실패")
        return False


if __name__ == "__main__":
    test_r2_urls()

