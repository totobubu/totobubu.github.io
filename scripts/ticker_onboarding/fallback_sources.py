"""Official fallback evidence for issuer catalogues that cannot be parsed.

Exchange notices prove a ticker was listed, but do not establish income
strategy or a single underlying asset.  They therefore only create review
candidates and can never be passed to the automatic onboarding command.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import requests

CBOE_NOTICE_URL = "https://www.cboe.com/us/equities/notices/new_listings/{year}/"
CBOE_NOTICE_API_URL = "https://www-api.cboe.com/us/equities/notices/data/new_listings/{year}/"
SYMBOL_RE = re.compile(r"\b[A-Z]{1,5}(?:[.-][A-Z])?\b")
IGNORED_SYMBOLS = {"CBOE", "ETF", "ETFS", "US", "NEW", "ISSUE", "NOTICE"}

# Names used in Cboe notices are not always the retail brand names.
CBOE_ISSUER_ALIASES = {
    "amplify": ("amplify",),
    "defiance": ("defiance",),
    "first-trust": ("first trust", "ft vest"),
    "global-x": ("global x",),
    "graniteshares": ("graniteshares",),
    "ishares": ("ishares", "blackrock"),
    "invesco": ("invesco",),
    "jpmorgan": ("j.p. morgan", "jpmorgan", "jp morgan"),
    "kurv": ("kurv",),
    "neos": ("neos",),
    "proshares": ("proshares",),
    "rex": ("rexshares",),
    "roundhill": ("roundhill",),
    "schwab": ("schwab",),
    "spdr": ("state street", "spdr"),
    "vanguard": ("vanguard",),
    "wisdomtree": ("wisdomtree",),
    "yieldmax": ("yieldmax",),
}


def sec_search_url(symbol: str) -> str:
    """Link reviewers to the SEC's official filing search for the symbol."""
    return f"https://www.sec.gov/edgar/search/#/q={symbol}&category=custom&forms=N-1A%252C485BPOS"


def fetch_cboe_rows(year: int, url: str) -> list[Any]:
    """Read Cboe's public notices data endpoint used by its listings page."""
    response = requests.get(
        CBOE_NOTICE_API_URL.format(year=year),
        timeout=30,
        headers={"User-Agent": "DivGrow ticker review bot/1.0"},
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise requests.RequestException("Cboe listing notices API returned an unsuccessful response")
    return [
        [
            str(alert.get("first_trade_dt", "")),
            str(alert.get("symbols", "")),
            str(alert.get("firm_name", "")),
            str(alert.get("notification", "")),
        ]
        for alert in payload.get("alerts", [])
        if alert.get("etf")
    ]


def fetch_cboe_fallbacks(providers: dict[str, dict[str, Any]], year: int | None = None) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    year = year or datetime.now().year
    url = CBOE_NOTICE_URL.format(year=year)
    try:
        rows = fetch_cboe_rows(year, url)
    except (requests.RequestException, ValueError) as exc:
        return [], [{"provider": "cboe", "url": url, "error": str(exc)}]
    if not rows:
        return [], [{"provider": "cboe", "url": url, "error": "no Cboe listing notice rows found"}]
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        cells = row if isinstance(row, list) else []
        text = " ".join((cells or [str(row)]))
        lower = text.lower()
        provider = next(
            (slug for slug in providers if any(alias in lower for alias in CBOE_ISSUER_ALIASES.get(slug, ()))),
            None,
        )
        if not provider:
            continue
        symbol_field = cells[1] if len(cells) >= 2 else text
        symbols = [
            symbol.upper()
            for symbol in re.split(r"[\s,]+", symbol_field)
            if SYMBOL_RE.fullmatch(symbol.upper()) and symbol.upper() not in IGNORED_SYMBOLS
        ]
        for symbol in symbols:
            if symbol.isdigit() or symbol in {"CBOE", "ETF"}:
                continue
            key = (provider, symbol)
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "symbol": symbol,
                "provider": provider,
                "company": providers[provider]["company"],
                "status": "exchange_confirmed_needs_review",
                "autoRegisterEligible": False,
                "exchangeEvidence": "cboe_new_listing_notice",
                "officialUrl": url,
                "officialTitle": text[:500],
                "secSearchUrl": sec_search_url(symbol),
            })
    return candidates, []
