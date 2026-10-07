"""Build a review-only U.S. dividend and income ETF inventory report.

Yahoo is used to enumerate U.S. ETFs and identify funds with a reported
distribution yield. ETF Shopping is a supplementary discovery source; a
blocked response is retained as a source failure rather than silently treated
as an empty catalogue.  This command never changes public data or nav.json.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yfinance as yf
from yfinance import ETFQuery

try:
    from .discover_official_dividend_etfs import discover
    from .fallback_sources import fetch_cboe_fallbacks
    from .provider_sources import PROVIDERS
except ImportError:  # Direct script invocation from repository root.
    from discover_official_dividend_etfs import discover
    from fallback_sources import fetch_cboe_fallbacks
    from provider_sources import PROVIDERS

ROOT = Path(__file__).resolve().parents[2]
NAV_PATH = ROOT / "public" / "nav.json"
DEFAULT_JSON_OUTPUT = ROOT / "tmp" / "us-dividend-etf-inventory.json"
INCOME_NAME = re.compile(
    r"(?:dividend|income|yield|covered.?call|option|distribution|premium|weeklypay|yieldboost|yieldmax)",
    re.IGNORECASE,
)
THEME_PATTERNS = (
    (re.compile(r"covered.?call|buy.?write", re.IGNORECASE), "커버드콜"),
    (re.compile(r"autocallable", re.IGNORECASE), "오토콜 인컴"),
    (re.compile(r"option income|option strategy|yieldboost|yieldmax", re.IGNORECASE), "옵션 인컴"),
    (re.compile(r"preferred", re.IGNORECASE), "우선주 인컴"),
    (re.compile(r"\b(?:reit|real estate)\b", re.IGNORECASE), "리츠·부동산 인컴"),
    (re.compile(r"\b(?:bond|treasury|muni(?:cipal)?|fixed income|corporate)\b", re.IGNORECASE), "채권 인컴"),
    (re.compile(r"dividend", re.IGNORECASE), "배당 주식"),
    (re.compile(r"income|yield|distribution|premium", re.IGNORECASE), "인컴·일드"),
)
ETF_SHOPPING_URL = "https://etfshopping.com/search/us-etf"
YAHOO_PAGE_SIZE = 250


def load_registered() -> dict[str, dict[str, Any]]:
    payload = json.loads(NAV_PATH.read_text(encoding="utf-8"))
    return {str(item.get("symbol", "")).upper(): item for item in payload.get("nav", [])}


def fetch_yahoo_us_etfs() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Page through Yahoo's U.S. ETF screener without treating it as official evidence."""
    query = ETFQuery("eq", ["region", "us"])
    quotes: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    offset = 0
    total: int | None = None
    while total is None or offset < total:
        try:
            page = yf.screen(query, offset=offset, size=YAHOO_PAGE_SIZE, sortField="ticker", sortAsc=True)
        except Exception as exc:  # Yahoo is a discovery source and may rate-limit.
            errors.append({"source": "yahoo", "url": "https://finance.yahoo.com/markets/etfs/", "error": str(exc)})
            break
        page_quotes = page.get("quotes", [])
        if not isinstance(page_quotes, list):
            errors.append({"source": "yahoo", "url": "https://finance.yahoo.com/markets/etfs/", "error": "invalid screener response"})
            break
        quotes.extend(item for item in page_quotes if isinstance(item, dict))
        total = int(page.get("total", len(quotes)))
        if not page_quotes:
            if offset < total:
                errors.append({"source": "yahoo", "url": "https://finance.yahoo.com/markets/etfs/", "error": "screener pagination ended early"})
            break
        offset += len(page_quotes)
        if offset < total:
            time.sleep(0.15)
    return quotes, errors


def fetch_etf_shopping() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Probe ETF Shopping and record anti-bot protection as an explicit failure."""
    try:
        response = requests.get(ETF_SHOPPING_URL, timeout=30, headers={"User-Agent": "DivGrow ticker review bot/1.0"})
        response.raise_for_status()
    except requests.RequestException as exc:
        return [], [{"source": "etfshopping", "url": ETF_SHOPPING_URL, "error": str(exc)}]
    if "Vercel Security Checkpoint" in response.text:
        return [], [{"source": "etfshopping", "url": ETF_SHOPPING_URL, "error": "Vercel Security Checkpoint blocked automated collection"}]
    # The source is a supplementary discovery catalogue. Its public page does
    # not expose a stable export contract, so only explicit ticker badges are
    # accepted; anything else is deliberately left for a future parser.
    symbols = sorted(set(re.findall(r"\b[A-Z]{1,5}\b", response.text)))
    return [{"symbol": symbol, "sources": ["etfshopping"]} for symbol in symbols], []


def is_dividend_or_income(quote: dict[str, Any]) -> bool:
    yield_value = quote.get("dividendYield")
    try:
        if float(yield_value or 0) > 0:
            return True
    except (TypeError, ValueError):
        pass
    title = " ".join(str(quote.get(key, "")) for key in ("longName", "shortName", "displayName"))
    return bool(INCOME_NAME.search(title))


def infer_theme(name: Any) -> str | None:
    """Return a strategy/theme label, never a guessed single underlying."""
    if not isinstance(name, str):
        return None
    for pattern, theme in THEME_PATTERNS:
        if pattern.search(name):
            return theme
    return None


def iso_date_from_millis(value: Any) -> str | None:
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc).date().isoformat()


def build_rows(
    yahoo_quotes: list[dict[str, Any]],
    official_candidates: list[dict[str, Any]],
    shopping_candidates: list[dict[str, Any]],
    cboe_candidates: list[dict[str, Any]],
    registered: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for quote in yahoo_quotes:
        symbol = str(quote.get("symbol", "")).upper()
        if not symbol or not is_dividend_or_income(quote):
            continue
        rows[symbol] = {
            "symbol": symbol,
            "name": quote.get("longName") or quote.get("shortName"),
            "provider": None,
            "underlying": None,
            "isin": None,
            "listingDate": iso_date_from_millis(quote.get("firstTradeDateMilliseconds")),
            "exchange": quote.get("fullExchangeName") or quote.get("exchange"),
            "theme": infer_theme(quote.get("longName") or quote.get("shortName") or quote.get("displayName")),
            "fieldEvidence": {
                "name": "yahoo_screener",
                "listingDate": "yahoo_screener",
                "exchange": "yahoo_screener",
            },
            "sources": ["yahoo"],
            "yahooDividendYield": quote.get("dividendYield"),
        }
    for candidate in official_candidates:
        symbol = candidate["symbol"].upper()
        row = rows.setdefault(symbol, {"symbol": symbol, "name": None, "provider": None, "underlying": None, "isin": None, "listingDate": None, "exchange": None, "fieldEvidence": {}, "sources": []})
        row["provider"] = candidate.get("company") or row["provider"]
        row["underlying"] = candidate.get("underlying") or row["underlying"]
        row["name"] = row["name"] or candidate.get("officialTitle")
        row["sources"] = sorted(set(row["sources"] + ["official_catalogue"]))
        row["fieldEvidence"].update({"provider": "official_catalogue", "underlying": "official_catalogue" if candidate.get("underlying") else None})
    for candidate in shopping_candidates:
        symbol = candidate["symbol"].upper()
        if symbol in rows:
            rows[symbol]["sources"] = sorted(set(rows[symbol]["sources"] + ["etfshopping"]))
    for candidate in cboe_candidates:
        symbol = candidate["symbol"].upper()
        row = rows.setdefault(symbol, {"symbol": symbol, "name": None, "provider": None, "underlying": None, "isin": None, "listingDate": None, "exchange": None, "fieldEvidence": {}, "sources": []})
        row["provider"] = candidate.get("company") or row["provider"]
        row["exchange"] = "Cboe US"
        row["sources"] = sorted(set(row["sources"] + ["cboe_new_listing_notice"]))
        row["fieldEvidence"].update({"provider": "cboe_new_listing_notice", "exchange": "cboe_new_listing_notice"})
        date_match = re.match(r"(\d{4}-\d{2}-\d{2})", str(candidate.get("officialTitle", "")))
        if date_match:
            row["listingDate"] = date_match.group(1)
            row["fieldEvidence"]["listingDate"] = "cboe_new_listing_notice"
    for symbol, row in rows.items():
        existing = registered.get(symbol)
        if existing:
            row["registeredData"] = {key: existing.get(key) for key in ("company", "underlying", "isin", "ipoDate", "market")}
            for source_key, target_key in (("company", "provider"), ("underlying", "underlying"), ("isin", "isin"), ("ipoDate", "listingDate"), ("market", "exchange")):
                if existing.get(source_key) not in (None, ""):
                    row[target_key] = existing[source_key]
                    row["fieldEvidence"][target_key] = "public_nav"
            row["registrationStatus"] = "registered"
        else:
            row["registrationStatus"] = "unregistered"
        row["theme"] = row.get("theme") or infer_theme(row.get("name"))
        if row["theme"]:
            row["fieldEvidence"]["theme"] = "name_keyword_inference"
        row["missingFields"] = [key for key in ("provider", "underlying", "isin", "listingDate", "exchange") if not row.get(key)]
        row["fieldEvidence"] = {key: value for key, value in row["fieldEvidence"].items() if value}
    return [rows[symbol] for symbol in sorted(rows)]


def render_markdown(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# 미국 배당·인컴 ETF 등록 현황",
        "",
        f"생성 시각: {payload['generatedAt']}",
        "",
        f"- 전체: {summary['total']}",
        f"- 기등록: {summary['registered']}",
        f"- 미등록: {summary['unregistered']}",
        f"- 데이터 부족: {summary['withMissingFields']}",
        f"- 수집 실패: {len(payload['sourceFailures'])}",
        f"- 이름 기반 테마 추정: {summary['withInferredTheme']}",
    ]
    for status, heading in (("registered", "기등록 ETF"), ("unregistered", "미등록 ETF")):
        lines.extend(["", f"## {heading}", "", "| 티커 | 테마(이름 추정) | 운용사 | 기초자산 | ISIN | 상장일 | 거래소 | 누락 필드 | 원천 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"])
        for row in (item for item in payload["rows"] if item["registrationStatus"] == status):
            lines.append("| {symbol} | {theme} | {provider} | {underlying} | {isin} | {listingDate} | {exchange} | {missing} | {sources} |".format(
                symbol=row["symbol"],
                theme=row.get("theme") or "미분류",
                provider=row["provider"] or "미확인",
                underlying=row["underlying"] or "미확인",
                isin=row["isin"] or "미확인",
                listingDate=row["listingDate"] or "미확인",
                exchange=row["exchange"] or "미확인",
                missing=", ".join(row["missingFields"]) or "없음",
                sources=", ".join(row["sources"]),
            ))
    lines.extend(["", "## 수집 실패", ""])
    for failure in payload["sourceFailures"]:
        lines.append(f"- `{failure['source']}`: {failure['error']} ({failure['url']})")
    return "\n".join(lines) + "\n"


def collect() -> dict[str, Any]:
    registered = load_registered()
    yahoo_quotes, yahoo_errors = fetch_yahoo_us_etfs()
    shopping_candidates, shopping_errors = fetch_etf_shopping()
    official = discover(sorted(PROVIDERS), yahoo_limit=0)
    cboe_candidates, cboe_errors = fetch_cboe_fallbacks(PROVIDERS)
    rows = build_rows(yahoo_quotes, official["candidates"], shopping_candidates, cboe_candidates, registered)
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "U.S.-listed dividend and income ETFs discovered from Yahoo and ETF Shopping, with official supplements",
        "sourceFailures": yahoo_errors + shopping_errors + [{"source": item.get("provider", "official_catalogue"), "url": item.get("url", ""), "error": item.get("error", "")} for item in official["sourceErrors"]] + cboe_errors,
        "summary": {
            "total": len(rows),
            "registered": sum(row["registrationStatus"] == "registered" for row in rows),
            "unregistered": sum(row["registrationStatus"] == "unregistered" for row in rows),
            "withMissingFields": sum(bool(row["missingFields"]) for row in rows),
            "withInferredTheme": sum(bool(row.get("theme")) for row in rows),
        },
        "rows": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a review-only U.S. dividend ETF inventory report.")
    parser.add_argument("--output", type=Path, default=DEFAULT_JSON_OUTPUT)
    parser.add_argument("--markdown-output", type=Path)
    args = parser.parse_args()
    payload = collect()
    markdown_output = args.markdown_output or args.output.with_suffix(".md")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_output.write_text(render_markdown(payload), encoding="utf-8")
    print(f"Wrote {payload['summary']['total']} ETF rows to {args.output} and {markdown_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
