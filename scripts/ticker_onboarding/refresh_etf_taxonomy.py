"""Classify registered income ETFs without altering single-underlying evidence."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yfinance as yf

ROOT = Path(__file__).resolve().parents[2]
NAV_PATH = ROOT / "public" / "nav.json"
DEFAULT_INVENTORY = ROOT / "tmp" / "us-dividend-etf-inventory.json"
DEFAULT_CACHE = ROOT / "tmp" / "yahoo-etf-taxonomy-cache.json"
RULES_PATH = Path(__file__).with_name("etf_taxonomy_rules.json")


def load_json(path: Path, fallback: Any) -> Any:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def yahoo_overview(symbol: str) -> dict[str, Any] | None:
    try:
        overview = yf.Ticker(symbol).funds_data.fund_overview
        return overview if isinstance(overview, dict) else None
    except Exception:
        return None


def classify(name: str | None, yahoo: dict[str, Any] | None, rules: list[dict[str, Any]]) -> dict[str, Any]:
    text = " ".join(value for value in (name, (yahoo or {}).get("categoryName"), (yahoo or {}).get("description")) if isinstance(value, str))
    matches = [rule for rule in rules if re.search(rule["pattern"], text, re.IGNORECASE)]
    buckets = {bucket: [] for bucket in ("strategyTags", "assetClassTags", "themeTags")}
    for rule in sorted(matches, key=lambda rule: -rule["priority"]):
        if rule["code"] not in buckets[rule["bucket"]]:
            buckets[rule["bucket"]].append(rule["code"])
    candidates = buckets["strategyTags"] + buckets["assetClassTags"]
    primary = candidates[0] if candidates else "unclassified"
    labels = {rule["code"]: rule.get("label", rule["code"]) for rule in rules}
    source = "yahoo_category" if yahoo and yahoo.get("categoryName") else "name_keyword_inference"
    confidence = "medium" if source == "yahoo_category" else "low"
    evidence = []
    if yahoo:
        evidence.append({"source": "yahoo_fund_overview", "categoryName": yahoo.get("categoryName"), "family": yahoo.get("family"), "collectedAt": datetime.now(timezone.utc).isoformat()})
    if matches:
        evidence.append({"source": "name_keyword_inference", "rules": [rule["code"] for rule in matches], "confidence": "low"})
    return {"primary": primary, "primaryLabel": labels.get(primary, "미분류"), **buckets, "keywords": sorted({rule["code"] for rule in matches}), "evidence": evidence, "reviewStatus": "auto_classified" if primary != "unclassified" else "needs_review", "source": source, "confidence": confidence}


def refresh(inventory: dict[str, Any], nav: dict[str, Any], cache: dict[str, Any], detail_limit: int) -> tuple[int, dict[str, Any]]:
    rules = load_json(RULES_PATH, {"rules": []})["rules"]
    rows = {row["symbol"]: row for row in inventory.get("rows", []) if row.get("registrationStatus") == "registered"}
    fetched = 0
    changed = 0
    for item in nav.get("nav", []):
        symbol = item.get("symbol")
        row = rows.get(symbol)
        if not row:
            continue
        existing = item.get("classification")
        if isinstance(existing, dict) and existing.get("reviewStatus") == "verified":
            continue
        if symbol not in cache and fetched < detail_limit:
            cache[symbol] = yahoo_overview(symbol)
            fetched += 1
        taxonomy = classify(row.get("name") or item.get("koName"), cache.get(symbol), rules)
        if item.get("classification") != taxonomy:
            item["classification"] = taxonomy
            changed += 1
    return changed, cache


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply source-qualified ETF taxonomy to registered nav entries.")
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--yahoo-detail-limit", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    inventory = load_json(args.inventory, {})
    nav = load_json(NAV_PATH, {})
    cache = load_json(args.cache, {})
    changed, cache = refresh(inventory, nav, cache, max(args.yahoo_detail_limit, 0))
    if not args.dry_run:
        args.cache.parent.mkdir(parents=True, exist_ok=True)
        args.cache.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        NAV_PATH.write_text(json.dumps(nav, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    print(json.dumps({"changed": changed, "cachedYahooDetails": len(cache), "dryRun": args.dry_run}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
