#!/usr/bin/env python3
"""
토스증권에서 한국어 종목명을 수집하는 스크립트
Playwright를 사용하여 동적 콘텐츠 로드
"""

import asyncio
import json
import sys
import argparse
from pathlib import Path
from typing import Optional, Dict
import aiohttp
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout

# 경로 설정
ROOT_DIR = Path(__file__).parent.parent.parent
NAV_DIR = ROOT_DIR / "public" / "nav"
OUTPUT_FILE = Path(__file__).parent / "korean_names_from_toss.json"

async def search_stock_via_api(symbol: str) -> Optional[Dict]:
    """
    토스증권 검색 API를 통해 종목 정보 찾기

    Args:
        symbol: 종목 심볼

    Returns:
        종목 정보 딕셔너리 또는 None
    """
    try:
        async with aiohttp.ClientSession() as session:
            # 토스증권 검색 API (추정)
            search_url = f"https://tossinvest.com/api/v2/search?keyword={symbol}"

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://tossinvest.com"
            }

            async with session.get(search_url, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    # 검색 결과에서 미국 주식 찾기
                    if isinstance(data, dict) and "stocks" in data:
                        for stock in data["stocks"]:
                            if stock.get("ticker") == symbol or stock.get("symbol") == symbol:
                                return stock
                    elif isinstance(data, list):
                        for stock in data:
                            if stock.get("ticker") == symbol or stock.get("symbol") == symbol:
                                return stock

        return None

    except Exception as e:
        return None

async def fetch_korean_name_from_page(page: Page, symbol: str) -> Optional[str]:
    """
    Playwright로 토스증권 페이지에서 한국어 이름 추출

    Args:
        page: Playwright page 객체
        symbol: 종목 심볼

    Returns:
        한국어 종목명 또는 None
    """
    try:
        # 토스증권 검색 페이지로 이동
        await page.goto("https://tossinvest.com", wait_until="domcontentloaded", timeout=10000)

        # 페이지 로딩 대기
        await page.wait_for_timeout(2000)

        # 검색 버튼 찾아서 클릭 (모달 열기)
        try:
            # 검색 버튼: button[data-section-name="검색"]
            search_button = await page.wait_for_selector('button[data-section-name="검색"]', timeout=5000)

            if not search_button:
                print(f"    Could not find search button for {symbol}")
                return None

            # 검색 버튼 클릭하여 모달 열기
            await search_button.click()
            await page.wait_for_timeout(1000)

            # 모달 내 검색 입력창 찾기
            search_input = await page.wait_for_selector('input[data-section-name="검색"][type="search"]', timeout=5000)

            if not search_input:
                print(f"    Could not find search input in modal for {symbol}")
                return None

            # 검색어 입력
            await search_input.fill(symbol)
            await page.keyboard.press("Enter")

            # 검색 결과 대기
            await page.wait_for_timeout(3000)

            # 검색 결과에서 첫 번째 주식 링크 클릭
            # 미국 주식 결과 우선 찾기
            result_link = await page.query_selector(f'a[href*="/stocks/US"]')

            if not result_link:
                # 아무 주식 결과나 클릭
                result_link = await page.query_selector('a[href*="/stocks/"]')

            if result_link:
                await result_link.click()
                await page.wait_for_load_state("networkidle", timeout=15000)

                # "회사정보" 섹션에서 한국어 종목명 찾기
                section = await page.query_selector('section[data-section-name="회사정보"]')

                if section:
                    # 첫 번째 bold span 태그
                    korean_name_element = await section.query_selector('span.tw3f-1r5dc8g0[style*="font-weight: bold"]')

                    if korean_name_element:
                        text = await korean_name_element.inner_text()
                        text = text.strip()

                        # 한글이 포함되어 있는지 확인
                        if text and any('\uac00' <= c <= '\ud7a3' for c in text):
                            return text

        except Exception as e:
            print(f"    Navigation error for {symbol}: {e}")

        return None

    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return None

async def fetch_korean_name_from_toss(page: Page, symbol: str, market: str) -> Optional[str]:
    """
    토스증권에서 심볼의 한국어 이름 가져오기
    먼저 API 시도, 실패하면 Playwright로 페이지 스크래핑

    Args:
        page: Playwright page 객체
        symbol: 종목 심볼
        market: 시장 (NASDAQ, NYSE 등)

    Returns:
        한국어 종목명 또는 None
    """
    # 방법 1: API 시도 (빠름)
    api_result = await search_stock_via_api(symbol)
    if api_result and api_result.get("koreanName"):
        return api_result["koreanName"]

    # 방법 2: Playwright로 페이지 스크래핑 (느림but확실)
    return await fetch_korean_name_from_page(page, symbol)

async def fetch_korean_names_batch(symbols_data: list, max_concurrent: int = 1):
    """
    여러 심볼의 한국어 이름을 배치로 가져오기
    한 페이지에서 순차적으로 검색 (모달 재사용)

    Args:
        symbols_data: [{"symbol": "AAPL", "market": "NASDAQ"}, ...] 형식의 리스트
        max_concurrent: 동시 실행 수 (기본 1 - 순차 실행 권장)
    """
    results = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)  # headless 모드
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )

        page = await context.new_page()

        try:
            # 토스증권 메인 페이지로 이동
            await page.goto("https://tossinvest.com", wait_until="domcontentloaded", timeout=10000)
            await page.wait_for_timeout(2000)

            # 각 심볼 순차 처리
            for symbol_data in symbols_data:
                symbol = symbol_data["symbol"]
                market = symbol_data["market"]

                try:
                    # 검색 버튼 클릭하여 모달 열기
                    search_button = await page.wait_for_selector('button[data-section-name="검색"]', timeout=5000)
                    await search_button.click()
                    await page.wait_for_timeout(1000)

                    # 검색 입력창 찾기
                    search_input = await page.wait_for_selector('input[data-section-name="검색"][type="search"]', timeout=5000)

                    # 검색어 입력
                    await search_input.fill(symbol)

                    # 검색 결과 대기 (실시간으로 나타남)
                    await page.wait_for_timeout(2000)

                    # "종목" 섹션에서 첫 번째 결과 찾기
                    stock_section = await page.query_selector('div[data-section-name="종목"]')

                    if stock_section:
                        # 첫 번째 종목 링크의 한국어 이름 찾기
                        # bold span 안의 한국어 텍스트
                        first_stock = await stock_section.query_selector('a[data-parent-name="ProductListRow"]')

                        if first_stock:
                            korean_name_element = await first_stock.query_selector('span.tw3f-1r5dc8g0[style*="font-weight: bold"]')

                            if korean_name_element:
                                text = await korean_name_element.inner_text()
                                text = text.strip()

                                # 한글이 포함되어 있는지 확인
                                if text and any('\uac00' <= c <= '\ud7a3' for c in text):
                                    print(f"  OK {symbol}: {text}")
                                    results[symbol] = {
                                        "koName": text,
                                        "market": market,
                                        "source": "toss"
                                    }
                                else:
                                    print(f"  X {symbol}: No Korean text found ({text})")
                            else:
                                print(f"  X {symbol}: Korean name element not found")
                        else:
                            print(f"  X {symbol}: No first stock found")
                    else:
                        print(f"  X {symbol}: Stock section not found")

                    # ESC 눌러서 모달 닫기
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(500)

                except Exception as e:
                    # 에러 메시지에서 "Call log" 부분 제거
                    error_msg = str(e)
                    if "Call log:" in error_msg:
                        error_msg = error_msg.split("Call log:")[0].strip()
                    print(f"  X {symbol}: {error_msg}")
                    # 에러 발생 시 모달 닫기
                    try:
                        await page.keyboard.press("Escape")
                        await page.wait_for_timeout(500)
                    except:
                        pass

                # 다음 심볼 처리 전 딜레이
                await asyncio.sleep(1)

        finally:
            await page.close()
            await browser.close()

    return results

def load_symbols_from_nav(markets=["NASDAQ", "NYSE"], limit=None):
    """
    NAV 파일에서 한국어 이름이 없는 심볼들 로드

    Args:
        markets: 확인할 시장 리스트
        limit: 테스트용 제한 (None이면 전체)

    Returns:
        [{"symbol": "AAPL", "market": "NASDAQ"}, ...] 형식의 리스트
    """
    symbols_to_fetch = []

    for market in markets:
        market_path = NAV_DIR / market

        if not market_path.exists():
            continue

        print(f"\nScanning {market}...")

        for nav_file in market_path.glob("*.json"):
            try:
                with open(nav_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                for item in data:
                    symbol = item.get("symbol")
                    ko_name = item.get("koName")

                    # 한국어 이름이 없는 경우만 추가
                    if symbol and not ko_name:
                        symbols_to_fetch.append({
                            "symbol": symbol,
                            "market": market
                        })

                        if limit and len(symbols_to_fetch) >= limit:
                            return symbols_to_fetch

            except Exception as e:
                print(f"  Error reading {nav_file}: {e}")

    return symbols_to_fetch

def update_nav_files(korean_names_data: dict) -> None:
    """
    수집한 한국어 이름을 NAV 파일에 업데이트

    Args:
        korean_names_data: {symbol: {"koName": "한국명", "market": "NASDAQ", ...}, ...} 형식
    """
    updated_count = 0
    nav_files_updated = set()

    for symbol, data in korean_names_data.items():
        market = data.get("market", "NASDAQ")
        ko_name = data.get("koName")

        if not ko_name:
            continue

        # NAV 파일 경로 찾기
        first_char = symbol[0].lower() if symbol else "unknown"
        nav_filename = f"{first_char}.json" if first_char.isalnum() else "unknown.json"

        # MARKET_TO_DIR 매핑 (NASDAQ -> nasdaq)
        market_dir_map = {
            "NASDAQ": "nasdaq",
            "NYSE": "nyse",
            "NYSEARCA": "nysearca",
            "BATS": "bats",
            "AMEX": "amex",
        }
        market_dir = market_dir_map.get(market.upper(), market.lower())
        nav_path = NAV_DIR / market_dir / nav_filename

        if not nav_path.exists():
            print(f"  X NAV file not found: {nav_path}")
            continue

        try:
            with open(nav_path, "r", encoding="utf-8") as f:
                nav_data = json.load(f)

            # 해당 심볼 찾아서 koName 업데이트
            symbol_found = False
            for item in nav_data:
                if item.get("symbol") == symbol:
                    if not item.get("koName"):
                        item["koName"] = ko_name
                        symbol_found = True
                        updated_count += 1
                        nav_files_updated.add(str(nav_path.relative_to(ROOT_DIR)))
                        print(f"  OK Updated {symbol}: {ko_name}")
                    break

            if symbol_found:
                # NAV 파일 저장
                with open(nav_path, "w", encoding="utf-8") as f:
                    json.dump(nav_data, f, indent=4, ensure_ascii=False)

        except Exception as e:
            print(f"  X Error updating {symbol} in {nav_path}: {e}")

    print(f"\nNAV Update Summary:")
    print(f"  Updated: {updated_count} symbols")
    print(f"  Files modified: {len(nav_files_updated)}")
    if nav_files_updated:
        for file_path in sorted(nav_files_updated):
            print(f"    - {file_path}")

def load_symbols_from_nav_file(nav_file_path: Path) -> list:
    """
    특정 NAV 파일에서 한국어 이름이 없는 심볼들 로드

    Args:
        nav_file_path: NAV 파일 경로 (예: public/nav/NASDAQ/a.json)

    Returns:
        [{"symbol": "AAPL", "market": "NASDAQ"}, ...] 형식의 리스트
    """
    symbols_to_fetch = []

    try:
        with open(nav_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 시장 정보 추출 (파일 경로에서)
        # public/nav/NASDAQ/a.json -> NASDAQ
        market = nav_file_path.parent.name.upper()

        for item in data:
            symbol = item.get("symbol")
            ko_name = item.get("koName")

            # 한국어 이름이 없는 경우만 추가
            if symbol and not ko_name:
                symbols_to_fetch.append({
                    "symbol": symbol,
                    "market": market
                })

        print(f"  Found {len(symbols_to_fetch)} symbols without koName in {nav_file_path.name}")

    except Exception as e:
        print(f"  Error reading {nav_file_path}: {e}")

    return symbols_to_fetch

async def main():
    # 커맨드라인 인자 파싱
    parser = argparse.ArgumentParser(description="토스증권에서 한국어 종목명 수집")
    parser.add_argument("--symbol", type=str, help="특정 심볼만 검색 (예: --symbol VOO)")
    parser.add_argument("--market", type=str, default="NASDAQ", help="심볼의 시장 (기본값: NASDAQ)")
    parser.add_argument("--nav-file", type=str, help="특정 NAV 파일만 처리 (예: public/nav/NASDAQ/a.json)")
    parser.add_argument("--all", action="store_true", help="전체 심볼 처리 (배치 제한 없음)")
    args = parser.parse_args()

    print("Fetching Korean Names from Toss Securities")
    print("=" * 60)

    # 모드 1: 특정 심볼 검색
    if args.symbol:
        symbol = args.symbol.upper()
        market = args.market.upper()
        print(f"\nSINGLE SYMBOL MODE: Fetching {symbol} ({market})")

        symbols_to_fetch = [{
            "symbol": symbol,
            "market": market
        }]

    # 모드 2: 특정 NAV 파일 처리
    elif args.nav_file:
        nav_file_path = Path(args.nav_file)
        if not nav_file_path.exists():
            print(f"\nERROR: NAV file not found: {nav_file_path}")
            return

        print(f"\nNAV FILE MODE: Processing {nav_file_path}")
        symbols_to_fetch = load_symbols_from_nav_file(nav_file_path)

        if not symbols_to_fetch:
            print("All symbols in this file already have Korean names!")
            return

    # 모드 3: 전체 또는 배치 처리
    else:
        if args.all:
            print(f"\nALL MODE: Fetching all symbols without Korean names")
            LIMIT = None
        else:
            BATCH_SIZE = 100
            LIMIT = BATCH_SIZE
            print(f"\nBATCH MODE: Fetching {BATCH_SIZE} symbols without Korean names")

        # NAV에서 한국어 이름이 없는 심볼 로드
        symbols_to_fetch = load_symbols_from_nav(
            markets=["NASDAQ", "NYSE"],
            limit=LIMIT
        )

        print(f"\nFound {len(symbols_to_fetch)} symbols without Korean names")

        if not symbols_to_fetch:
            print("All symbols already have Korean names!")
            return

    print(f"\nFetching Korean names from Toss...")

    # 한국어 이름 가져오기
    results = await fetch_korean_names_batch(symbols_to_fetch, max_concurrent=3)

    # 결과 저장
    if results:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=4, ensure_ascii=False)

        print("\n" + "=" * 60)
        print(f"Summary:")
        print(f"  Found: {len(results)} Korean names")
        print(f"  Not found: {len(symbols_to_fetch) - len(results)}")
        print(f"  Saved to: {OUTPUT_FILE}")

        # 샘플 결과 출력
        if results:
            print(f"\nSample results:")
            for i, (symbol, data) in enumerate(list(results.items())[:5]):
                print(f"    - {symbol}: {data['koName']}")
            if len(results) > 5:
                print(f"    ... and {len(results) - 5} more")

        # NAV 파일 자동 업데이트
        print("\n" + "=" * 60)
        print("Updating NAV files...")
        update_nav_files(results)
    else:
        print("\nNo Korean names found")

if __name__ == "__main__":
    asyncio.run(main())
