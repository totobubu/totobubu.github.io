"""
Fetch ISIN codes for symbols listed in ``public/missing_isin.json`` and update the
corresponding files under ``public/data``.

Usage:
    python scripts/fetch_missing_isin.py

    # optionally pass specific symbols
    python scripts/fetch_missing_isin.py --symbol 000080.KS --symbol YMAX
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

import requests
from bs4 import BeautifulSoup

try:  # pragma: no cover - optional dependency
    from playwright.sync_api import (
        TimeoutError as PlaywrightTimeoutError,
        sync_playwright,
    )
except ImportError:  # pragma: no cover - playwright is optional
    sync_playwright = None
    PlaywrightTimeoutError = Exception

try:  # pragma: no cover - optional dependency
    import cloudscraper
except ImportError:
    cloudscraper = None


ROOT_DIR = Path(__file__).resolve().parents[1]
MISSING_PATH = ROOT_DIR / "public" / "missing_isin.json"
DATA_DIR = ROOT_DIR / "public" / "data"
BASE_URL = "http://stockevents.app/kr/stock/{symbol}"
# BASE_URL = "https://kr.investing.com/etfs/{symbol}"
REQUEST_TIMEOUT = 10
REQUEST_SLEEP_SECONDS = 0.5
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/119.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    "sec-ch-ua": '"Chromium";v="119", "Not?A_Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}

REQUEST_SESSION = (
    cloudscraper.create_scraper(browser={"custom": "Firefox"}, delay=10)
    if cloudscraper
    else requests.Session()
)
REQUEST_SESSION.headers.update(HEADERS)

INVESTING_SUFFIXES = (
    ".KS",
    ".KQ",
    ".KOSPI",
    ".KOSDAQ",
    ".KR",
)

KOREAN_SUFFIXES = (".KS", ".KQ")


class FetchError(Exception):
    """Raised when ISIN cannot be fetched for a symbol."""


def load_missing_symbols() -> list[str]:
    with MISSING_PATH.open(encoding="utf-8") as fp:
        payload = json.load(fp)

    missing = payload.get("missing", [])
    return [entry["symbol"] for entry in missing if entry.get("symbol")]


def symbol_to_slug(symbol: str) -> str:
    slug = symbol.lower()
    for ch in (".", "/", "\\"):
        slug = slug.replace(ch, "-")
    return slug


def normalize_symbol_for_investing(symbol: str) -> str:
    upper_symbol = symbol.upper()
    for suffix in INVESTING_SUFFIXES:
        if upper_symbol.endswith(suffix):
            return symbol[: -len(suffix)]
    return symbol


def generate_symbol_variants(symbol: str) -> list[str]:
    variants: list[str] = [symbol]
    upper_symbol = symbol.upper()
    for suffix in KOREAN_SUFFIXES:
        if upper_symbol.endswith(suffix):
            base = symbol[: -len(suffix)]
            for alt_suffix in KOREAN_SUFFIXES:
                candidate = f"{base}{alt_suffix}"
                if candidate not in variants:
                    variants.append(candidate)
            break
    return variants


def format_symbol_for_fetch(symbol: str) -> str:
    if "investing.com" in BASE_URL:
        return normalize_symbol_for_investing(symbol)
    return symbol


def fetch_isin_via_requests(symbol: str) -> str:
    errors: list[str] = []
    for candidate in generate_symbol_variants(symbol):
        formatted_symbol = format_symbol_for_fetch(candidate)
        url = BASE_URL.format(symbol=formatted_symbol)
        try:
            response = REQUEST_SESSION.get(url, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            errors.append(f"{candidate}: request failed ({exc})")
            continue

        if response.status_code != 200:
            errors.append(f"{candidate}: unexpected status code {response.status_code}")
            continue

        soup = BeautifulSoup(response.text, "lxml")
        target_div = None
        for div in soup.find_all("div", class_="font-semibold"):
            if div.get_text(strip=True) == "ISIN":
                target_div = div.find_next_sibling("div")
                break

        if target_div is None:
            errors.append(f"{candidate}: failed to locate ISIN element")
            continue

        isin = target_div.get_text(strip=True)
        if not isin:
            errors.append(f"{candidate}: ISIN element is empty")
            continue

        if candidate != symbol:
            print(f"[INFO] {symbol}: fetched using alternate suffix {candidate}")
        return isin

    raise FetchError("; ".join(errors) if errors else f"{symbol}: failed to fetch ISIN")


def fetch_isin_via_playwright(symbol: str) -> str:
    if not sync_playwright:
        raise FetchError("Playwright is not available.")

    last_error: FetchError | None = None
    for candidate in generate_symbol_variants(symbol):
        formatted_symbol = format_symbol_for_fetch(candidate)
        url = BASE_URL.format(symbol=formatted_symbol)

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = None
                try:
                    context = browser.new_context(
                        user_agent=HEADERS["User-Agent"],
                        locale="ko-KR",
                    )
                    page = context.new_page()
                    page.goto(url, wait_until="networkidle", timeout=REQUEST_TIMEOUT * 1000)
                    locator = page.locator("div.font-semibold", has_text="ISIN")
                    if locator.count() == 0:
                        raise FetchError(f"{candidate}: failed to locate ISIN label via Playwright")

                    isin_value = locator.first.evaluate(
                        "el => (el.nextElementSibling && el.nextElementSibling.textContent) || ''"
                    )
                finally:
                    if context is not None:
                        context.close()
                    browser.close()
        except PlaywrightTimeoutError as exc:  # pragma: no cover - runtime error handling
            last_error = FetchError(f"{candidate}: Playwright navigation timeout")
            continue
        except FetchError as exc:
            last_error = exc
            continue
        except Exception as exc:  # pragma: no cover - unexpected Playwright failure
            last_error = FetchError(f"{candidate}: Playwright error {exc}")
            continue

        isin = (isin_value or "").strip()
        if not isin:
            last_error = FetchError(f"{candidate}: Playwright did not yield an ISIN value")
            continue

        if candidate != symbol:
            print(f"[INFO] {symbol}: fetched via Playwright using alternate suffix {candidate}")
        return isin

    if last_error:
        raise last_error
    raise FetchError(f"{symbol}: Playwright did not fetch ISIN")


def fetch_isin(symbol: str) -> str:
    errors: list[str] = []

    if sync_playwright:
        try:
            return fetch_isin_via_playwright(symbol)
        except FetchError as exc:
            errors.append(str(exc))
        except Exception as exc:  # pragma: no cover - unexpected Playwright failure
            errors.append(f"{symbol}: Playwright error {exc}")

    try:
        return fetch_isin_via_requests(symbol)
    except FetchError as exc:
        errors.append(str(exc))
    except requests.RequestException as exc:
        errors.append(f"{symbol}: request failed ({exc})")

    raise FetchError("; ".join(errors))


def update_data_file(symbol: str, isin: str) -> bool:
    slug = symbol_to_slug(symbol)
    json_path = DATA_DIR / f"{slug}.json"

    if not json_path.exists():
        print(f"[WARN] {symbol}: data file not found at {json_path}", file=sys.stderr)
        return False

    with json_path.open(encoding="utf-8") as fp:
        data = json.load(fp)

    ticker_info = data.get("tickerInfo")
    if not isinstance(ticker_info, dict):
        print(f"[WARN] {symbol}: tickerInfo missing or not a dict in {json_path}", file=sys.stderr)
        return False

    previous = ticker_info.get("isin")
    if previous == isin:
        print(f"[SKIP] {symbol}: ISIN already set to {isin}")
        return True

    ticker_info["isin"] = isin

    with json_path.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=4, ensure_ascii=False)
        fp.write("\n")

    if previous:
        print(f"[UPDATE] {symbol}: {previous} -> {isin}")
    else:
        print(f"[UPDATE] {symbol}: set ISIN to {isin}")

    return True


def process_symbols(symbols: Iterable[str]) -> None:
    for idx, symbol in enumerate(symbols, start=1):
        try:
            isin = fetch_isin(symbol)
        except FetchError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            continue
        except requests.RequestException as exc:
            print(f"[ERROR] {symbol}: request failed ({exc})", file=sys.stderr)
            continue

        update_data_file(symbol, isin)

        if REQUEST_SLEEP_SECONDS:
            time.sleep(REQUEST_SLEEP_SECONDS)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch ISIN codes and update local data files.")
    parser.add_argument(
        "--symbol",
        dest="symbols",
        action="append",
        help="Limit the operation to specific symbol(s). Can be passed multiple times.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most this many symbols (useful when testing).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip symbols whose data file already contains a non-null ISIN.",
    )
    return parser


def filter_symbols(symbols: Iterable[str], skip_existing: bool) -> list[str]:
    filtered: list[str] = []
    for symbol in symbols:
        if not skip_existing:
            filtered.append(symbol)
            continue

        slug = symbol_to_slug(symbol)
        json_path = DATA_DIR / f"{slug}.json"
        if not json_path.exists():
            filtered.append(symbol)
            continue

        with json_path.open(encoding="utf-8") as fp:
            data = json.load(fp)
        ticker_info = data.get("tickerInfo") or {}
        isin = ticker_info.get("isin")
        if isin:
            print(f"[SKIP] {symbol}: data file already has ISIN {isin}")
            continue

        filtered.append(symbol)
    return filtered


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.symbols:
        symbols = args.symbols
    else:
        symbols = load_missing_symbols()

    symbols = filter_symbols(symbols, skip_existing=args.skip_existing)

    if args.limit is not None:
        symbols = symbols[: args.limit]

    if not symbols:
        print("No symbols to process.")
        return 0

    print(f"Processing {len(symbols)} symbol(s)...")
    process_symbols(symbols)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

