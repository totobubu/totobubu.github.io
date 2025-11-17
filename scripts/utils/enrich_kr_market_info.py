#!/usr/bin/env python3
"""
한국 티커의 market 정보를 보강/정규화하는 스크립트.

기능
------
1. ``public/nav.json`` 에서 한국 상장 티커를 필터링
2. ``stockevents.app`` 페이지를 요청해 시장(Market) / ISIN 등을 파싱
3. market 값이 누락됐거나 잘못된 항목만 업데이트
4. 필요 시 dry-run 모드로 변경 내역만 확인

Usage
------
    python scripts/enrich_kr_market_info.py
    python scripts/enrich_kr_market_info.py --symbol 000080.KQ --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

import requests
from bs4 import BeautifulSoup


ROOT_DIR = Path(__file__).resolve().parents[2]  # scripts/utils/ -> scripts/ -> 프로젝트 루트
NAV_PATH = ROOT_DIR / "public" / "nav.json"
NAV_DIR = ROOT_DIR / "public" / "nav"
BASE_URL = "http://stockevents.app/kr/stock/{symbol}"
REQUEST_TIMEOUT = 10

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/119.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.4",
    "Connection": "keep-alive",
}

REQUEST_SESSION = requests.Session()
REQUEST_SESSION.headers.update(HEADERS)

LABEL_MAP = {
    "ISIN": "isin",
    "isin": "isin",
    "Market": "market",
    "시장": "market",
    "거래소": "market",
    "Exchange": "market",
    "통화": "currency",
    "Currency": "currency",
}

MARKET_ALIASES = {
    "KOSPI": "KOSPI",
    "KOSDAQ": "KOSDAQ",
    "KRX (KOSPI)": "KOSPI",
    "KRX (KOSDAQ)": "KOSDAQ",
    "KRX-KOSPI": "KOSPI",
    "KRX-KOSDAQ": "KOSDAQ",
    "코스피": "KOSPI",
    "코스닥": "KOSDAQ",
    "KONEX": "KONEX",
    "KRX (KONEX)": "KONEX",
}

SUFFIX_TO_MARKET = {
    ".KS": "KOSPI",
    ".KQ": "KOSDAQ",
    ".KN": "KONEX",
}


@dataclass
class MarketMetadata:
    symbol: str
    resolved_symbol: str
    market: Optional[str] = None
    isin: Optional[str] = None
    currency: Optional[str] = None


def load_nav_entries() -> list[dict]:
    if not NAV_PATH.exists():
        raise FileNotFoundError(f"nav.json not found at {NAV_PATH}")
    with NAV_PATH.open(encoding="utf-8") as fp:
        payload = json.load(fp)
    nav_entries = payload.get("nav")
    if not isinstance(nav_entries, list):
        raise ValueError("nav.json 파일 형식이 잘못되었습니다.")
    return nav_entries


def dump_nav(entries: list[dict]) -> None:
    payload = {"nav": entries}
    with NAV_PATH.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)
        fp.write("\n")


def is_korean_ticker(entry: dict) -> bool:
    symbol = (entry or {}).get("symbol")
    if not isinstance(symbol, str):
        return False
    upper_symbol = symbol.upper()
    if upper_symbol.endswith(tuple(SUFFIX_TO_MARKET.keys())):
        return True
    market = (entry or {}).get("market")
    if isinstance(market, str) and market.upper() in {"KOSPI", "KOSDAQ", "KONEX"}:
        return True
    currency = (entry or {}).get("currency")
    if isinstance(currency, str) and currency.upper() == "KRW":
        return True
    return False


def build_symbol_candidates(symbol: str) -> Iterator[str]:
    if not symbol:
        return
    symbol = symbol.upper()
    yield symbol
    if "." in symbol:
        base, suffix = symbol.rsplit(".", 1)
        suffix = f".{suffix}"
    else:
        base, suffix = symbol, ""
    preferred = [s for s in SUFFIX_TO_MARKET if s != suffix]
    for candidate_suffix in preferred:
        candidate = f"{base}{candidate_suffix}"
        if candidate != symbol:
            yield candidate


def normalize_market(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    upper = cleaned.upper()
    if upper in MARKET_ALIASES:
        return MARKET_ALIASES[upper]
    if cleaned in MARKET_ALIASES:
        return MARKET_ALIASES[cleaned]
    if cleaned.upper().startswith("KOSPI"):
        return "KOSPI"
    if cleaned.upper().startswith("KOSDAQ"):
        return "KOSDAQ"
    if cleaned.upper().startswith("KONEX"):
        return "KONEX"
    return cleaned


def parse_stockevents_metadata(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    metadata: dict[str, str] = {}
    for div in soup.find_all("div", class_="font-semibold"):
        label = div.get_text(strip=True)
        mapped = LABEL_MAP.get(label)
        if not mapped:
            continue
        value_div = div.find_next_sibling("div")
        if not value_div:
            continue
        value = value_div.get_text(strip=True)
        if value:
            metadata[mapped] = value
    return metadata


def fetch_stockevents(symbol: str) -> MarketMetadata:
    errors: list[str] = []
    max_retries = 2
    retry_delay = 1.0

    for candidate in build_symbol_candidates(symbol):
        url = BASE_URL.format(symbol=candidate)

        # 재시도 로직
        for attempt in range(max_retries + 1):
            try:
                response = REQUEST_SESSION.get(url, timeout=REQUEST_TIMEOUT)
            except requests.RequestException as exc:
                if attempt < max_retries:
                    time.sleep(retry_delay * (attempt + 1))
                    continue
                errors.append(f"{candidate}: request failed ({exc})")
                break

            # 403 에러는 rate limiting일 수 있으므로 재시도
            if response.status_code == 403:
                if attempt < max_retries:
                    time.sleep(retry_delay * (attempt + 1))
                    continue
                errors.append(f"{candidate}: HTTP {response.status_code}")
                break

            if response.status_code != 200:
                errors.append(f"{candidate}: HTTP {response.status_code}")
                break

            metadata = parse_stockevents_metadata(response.text)
            if not metadata:
                errors.append(f"{candidate}: metadata block not found")
                break

            market = normalize_market(metadata.get("market"))
            if not market:
                market = normalize_market(metadata.get("currency"))
            return MarketMetadata(
                symbol=symbol,
                resolved_symbol=candidate,
                market=market or normalize_market_from_suffix(candidate),
                isin=metadata.get("isin"),
                currency=metadata.get("currency"),
            )

    raise RuntimeError(
        "; ".join(errors) if errors else f"{symbol}: unable to fetch metadata"
    )


def normalize_market_from_suffix(symbol: str) -> Optional[str]:
    upper = symbol.upper()
    for suffix, market in SUFFIX_TO_MARKET.items():
        if upper.endswith(suffix):
            return market
    return None


def ensure_market(entry: dict, metadata: MarketMetadata) -> bool:
    current = entry.get("market")
    target_market = metadata.market or normalize_market_from_suffix(
        metadata.resolved_symbol
    )
    changed = False

    if target_market and current != target_market:
        entry["market"] = target_market
        changed = True

    if metadata.isin and not entry.get("isin"):
        entry["isin"] = metadata.isin
        changed = True

    if metadata.resolved_symbol != entry.get("symbol"):
        entry["symbol"] = metadata.resolved_symbol
        changed = True

    return changed


def filter_entries(entries: list[dict], symbols: list[str] | None = None) -> list[dict]:
    if not symbols:
        return [entry for entry in entries if is_korean_ticker(entry)]
    upper_targets = {sym.upper() for sym in symbols}
    return [
        entry for entry in entries if entry.get("symbol", "").upper() in upper_targets
    ]


def build_cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="한국 티커의 market 정보를 보강합니다."
    )
    parser.add_argument(
        "--symbol",
        action="append",
        dest="symbols",
        help="특정 심볼만 업데이트 (여러 번 지정 가능)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="처리할 최대 티커 수 (테스트용)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="파일을 수정하지 않고 변경 예정인 내역만 출력",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="market 값이 없거나 알 수 없는 티커만 처리",
    )
    parser.add_argument(
        "--sync-nav-files",
        action="store_true",
        help="업데이트 후 public/nav/<MARKET>/<symbol>.json 구조를 최신화합니다.",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_cli()
    args = parser.parse_args(argv)

    try:
        entries = load_nav_entries()
    except Exception as exc:  # pragma: no cover - CLI utility
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    targets = filter_entries(entries, args.symbols)
    if args.only_missing:
        targets = [
            entry for entry in targets if not normalize_market(entry.get("market"))
        ]
    if args.limit is not None:
        targets = targets[: args.limit]

    if not targets:
        print("처리할 한국 티커가 없습니다.")
        return 0

    updated_symbols: list[str] = []
    failures: list[str] = []

    for entry in targets:
        symbol = entry.get("symbol")
        if not symbol:
            continue
        try:
            metadata = fetch_stockevents(symbol)
        except Exception as exc:
            failures.append(f"{symbol}: {exc}")
            # 요청 간 딜레이 (rate limiting 방지)
            time.sleep(0.5)
            continue

        if ensure_market(entry, metadata):
            updated_symbols.append(symbol)

        # 요청 간 딜레이 (rate limiting 방지)
        time.sleep(0.3)

    if updated_symbols:
        print(f"[INFO] market 갱신: {len(updated_symbols)}건")
        for sym in updated_symbols:
            print(f"  • {sym}")
        if not args.dry_run:
            dump_nav(entries)
            print(f"[DONE] nav.json 업데이트 완료 ({NAV_PATH})")
            if args.sync_nav_files:
                try:
                    from scripts.migrate_nav_to_symbol_files import (  # type: ignore
                        migrate_nav_structure,
                    )
                except Exception as sync_error:  # pragma: no cover - import failure
                    print(
                        f"[WARN] nav 디렉토리 동기화 모듈을 불러오지 못했습니다: {sync_error}"
                    )
                else:
                    print("[INFO] public/nav 디렉토리를 심볼 기준으로 갱신합니다...")
                    migrate_nav_structure(dry_run=False)
        else:
            print("[DRY-RUN] 파일은 수정하지 않았습니다.")
    else:
        print("변경된 항목이 없습니다.")

    if failures:
        print(f"[WARN] {len(failures)}건 실패:")
        # 너무 많은 실패 메시지는 출력하지 않음 (로그가 너무 길어지는 것 방지)
        if len(failures) <= 50:
            for fail in failures:
                print(f"  - {fail}")
        else:
            for fail in failures[:20]:
                print(f"  - {fail}")
            print(f"  ... 외 {len(failures) - 20}건")

        # 실패율이 너무 높으면 (50% 이상) 에러 반환, 그 외에는 경고만
        failure_rate = len(failures) / len(targets) if targets else 0
        if failure_rate > 0.5:
            print(f"[ERROR] 실패율이 {failure_rate:.1%}로 너무 높습니다.")
            return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
