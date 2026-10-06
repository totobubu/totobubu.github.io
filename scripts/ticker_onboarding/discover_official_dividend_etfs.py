"""Discover unregistered income ETFs from official issuer product catalogues.

This command is deliberately review-only: its default output is under ``tmp``
and it never changes ``public`` data.  Approval must happen through the
separate onboarding workflow, which rediscovers selected symbols first.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yfinance as yf
from bs4 import BeautifulSoup

try:
    from .provider_sources import PROVIDERS
except ImportError:  # Direct script invocation from repository root.
    from provider_sources import PROVIDERS

ROOT = Path(__file__).resolve().parents[2]
NAV_PATH = ROOT / "public" / "nav.json"
DEFAULT_OUTPUT = ROOT / "tmp" / "official-dividend-etf-candidates.json"
INCOME_TERMS = re.compile(
    r"(?:income|distribution|covered.?call|option income|option strategy|weeklypay|yieldboost|yieldmax)",
    re.IGNORECASE,
)
PROVIDER_ELIGIBILITY_TERMS = {
    "graniteshares": re.compile(r"autocallable", re.IGNORECASE),
}
SYMBOL_RE = re.compile(r"\b[A-Z]{1,5}(?:[.-][A-Z])?\b")
UNDERLYING_PATTERNS = (
    re.compile(r"(?:daily target \d+x (?:long|short)|leveraged (?:long|short))\s+([A-Z]{2,5}(?:[.-][A-Z])?)\s+ETF", re.I),
    re.compile(r"\b([A-Z]{2,5}(?:[.-][A-Z])?)\s+(?:option income|covered call|weeklypay)", re.I),
    re.compile(r"\bAutocallable\s+([A-Z]{2,5}(?:[.-][A-Z])?)\s+ETF", re.I),
    re.compile(r"\b([A-Z]{2,5}(?:[.-][A-Z])?)\s+Defined Income Boost ETF", re.I),
)


def load_registered_symbols() -> set[str]:
    payload = json.loads(NAV_PATH.read_text(encoding="utf-8"))
    return {str(item.get("symbol", "")).upper() for item in payload.get("nav", [])}


def normalize_text(value: str) -> str:
    return " ".join(value.split())


def extract_underlying(title: str, etf_symbol: str) -> str | None:
    """Return only an explicit single-symbol official-title candidate."""
    for pattern in UNDERLYING_PATTERNS:
        match = pattern.search(title)
        if match:
            candidate = match.group(1).upper()
            if candidate != etf_symbol:
                return candidate
    return None


def parse_catalogue(html: str, provider: str, company: str, source_url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    products: list[dict[str, Any]] = []
    # Prefer table rows.  Issuer product catalogues frequently contain large
    # wrapper divs whose text includes every ticker and navigation link.
    nodes = soup.find_all("tr")
    # Defiance renders income products as cards rather than table rows.
    if provider == "defiance":
        nodes.extend(soup.select(".etfs-income-card"))
    if not nodes:
        nodes = soup.find_all(["article", "li", "h2", "h3", "h4"])
    for node in nodes:
        text = normalize_text(node.get_text(" ", strip=True))
        eligibility = PROVIDER_ELIGIBILITY_TERMS.get(provider)
        if not text or not (INCOME_TERMS.search(text) or (eligibility and eligibility.search(text))):
            continue
        # A real catalogue row starts with its ticker.  This excludes page
        # navigation and wrapper text that can otherwise look like a fund.
        if not re.match(r"^[A-Z]{1,5}(?:[.-][A-Z])?\b", text):
            continue
        symbols = [symbol.upper() for symbol in SYMBOL_RE.findall(text)]
        if not symbols:
            continue
        # Product catalogues commonly expose a lone upper-case ticker first.
        symbol = next((item for item in symbols if item not in {"ETF", "SEC", "ROC", "USD"}), None)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        underlying = extract_underlying(text, symbol)
        products.append({
            "symbol": symbol,
            "provider": provider,
            "company": company,
            "officialUrl": source_url,
            "officialTitle": text[:500],
            "incomeEvidence": "official_catalogue_title",
            "underlying": underlying,
            "underlyingEvidence": "official_catalogue_title" if underlying else None,
        })
    return products


def fetch_provider(provider: str) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    config = PROVIDERS[provider]
    products: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for url in config["urls"]:
        try:
            response = requests.get(url, timeout=30, headers={"User-Agent": "DivGrow ticker review bot/1.0"})
            response.raise_for_status()
            parsed = parse_catalogue(response.text, provider, config["company"], url)
            if not parsed:
                errors.append({"provider": provider, "url": url, "error": "no income ETF rows parsed"})
            products.extend(parsed)
        except requests.RequestException as exc:
            errors.append({"provider": provider, "url": url, "error": str(exc)})
    return products, errors


def yahoo_single_holding(symbol: str) -> str | None:
    """Return a review-only candidate; never use it as an automatic mapping."""
    try:
        holdings = yf.Ticker(symbol).funds_data.top_holdings
        if holdings is None or holdings.empty or "holdingPercent" not in holdings:
            return None
        weights = holdings["holdingPercent"].dropna().sort_values(ascending=False)
        if len(weights) == 1 and float(weights.iloc[0]) >= 0.9:
            return str(weights.index[0]).upper()
    except Exception:  # Yahoo is optional evidence, not a discovery dependency.
        return None
    return None


def discover(providers: list[str], yahoo_limit: int = 25) -> dict[str, Any]:
    registered = load_registered_symbols()
    candidates: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    seen: set[str] = set()
    yahoo_checked = 0
    for provider in providers:
        products, provider_errors = fetch_provider(provider)
        errors.extend(provider_errors)
        for item in products:
            symbol = item["symbol"]
            if symbol in seen or symbol in registered:
                continue
            seen.add(symbol)
            underlying = item.get("underlying")
            item["status"] = "new_etf" if underlying else "needs_review"
            item["missingUnderlying"] = bool(underlying and underlying not in registered)
            if not underlying and yahoo_checked < yahoo_limit:
                yahoo_checked += 1
                yahoo_underlying = yahoo_single_holding(symbol)
                if yahoo_underlying:
                    item["yahooCandidateUnderlying"] = yahoo_underlying
                    item["yahooEvidence"] = "single_holding_at_least_90_percent"
            candidates.append(item)
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reviewRequired": True,
        "candidates": sorted(candidates, key=lambda item: item["symbol"]),
        "sourceErrors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a review-only official income ETF candidate report.")
    parser.add_argument("--provider", action="append", choices=sorted(PROVIDERS), help="Limit to a provider; repeatable.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--yahoo-limit", type=int, default=25, help="Maximum Yahoo supplemental checks (default: 25).")
    args = parser.parse_args()
    payload = discover(args.provider or sorted(PROVIDERS), yahoo_limit=max(args.yahoo_limit, 0))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['candidates'])} review candidate(s) to {args.output}")
    if payload["sourceErrors"]:
        print(f"[WARN] {len(payload['sourceErrors'])} source parsing/fetch issue(s); review the report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
