"""Apply reviewer-selected official candidates without publishing them directly.

The command rediscovers candidates before any write.  Yahoo-only underlying
candidates are intentionally excluded: a reviewer must add an official mapping
before such an ETF can be onboarded with an ``underlying`` field.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.ticker_onboarding.discover_official_dividend_etfs import discover, load_registered_symbols
from scripts.ticker_onboarding.provider_sources import PROVIDERS

PYTHON = sys.executable


def command_for(items: list[dict]) -> list[str]:
    command = [PYTHON, "scripts/utils/add_new_symbols.py", "--skip-workflow"]
    for item in items:
        symbol = item["symbol"]
        command.extend([
            "--symbol", symbol, "--etf", symbol, "--company", f"{symbol}:{item['company']}",
            "--auto-registered", "--allow-missing-isin", "--registration-source", f"{symbol}:{item['officialUrl']}",
        ])
        if item.get("underlying"):
            command.extend(["--underlying", f"{symbol}:{item['underlying']}"])
    return command


def run(command: list[str]) -> None:
    print("$", subprocess.list2cmdline(command))
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Onboard approved official income ETF candidates.")
    parser.add_argument("--symbols", required=True, help="Comma-separated approved ETF tickers.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--register-only",
        action="store_true",
        help="Register nav/data metadata but defer the slower historical-data collection.",
    )
    args = parser.parse_args()
    requested = {value.strip().upper() for value in args.symbols.split(",") if value.strip()}
    if not requested:
        raise SystemExit("At least one approved symbol is required.")

    # Approval accepts only official evidence, so it does not spend time on
    # optional Yahoo lookups while revalidating the selected symbols.
    payload = discover(list(PROVIDERS), yahoo_limit=0)
    found = {item["symbol"]: item for item in payload["candidates"]}
    missing = sorted(requested - set(found))
    if missing:
        raise SystemExit(f"Approved symbols are absent from current official discovery: {', '.join(missing)}")
    selected = [found[symbol] for symbol in sorted(requested)]
    unsafe = [item["symbol"] for item in selected if item["status"] != "new_etf"]
    if unsafe:
        raise SystemExit("Official single-underlying evidence is required for approval: " + ", ".join(unsafe))

    registered = load_registered_symbols()
    missing_underlyings = sorted({item["underlying"] for item in selected if item.get("underlying") and item["underlying"] not in registered})
    commands: list[list[str]] = []
    if missing_underlyings:
        commands.append([PYTHON, "scripts/utils/add_new_symbols.py", "--skip-workflow", *sum((["--symbol", symbol] for symbol in missing_underlyings), [])])
    commands.append(command_for(selected))
    if not args.register_only:
        all_symbols = [*missing_underlyings, *sorted(requested)]
        commands.append([PYTHON, "scripts/workflows/run_new_ticker_workflow.py", "--skip-ipo-sync", *all_symbols])

    print(json.dumps({"approved": sorted(requested), "missingUnderlyings": missing_underlyings, "dryRun": args.dry_run, "registerOnly": args.register_only}, indent=2))
    for command in commands:
        if args.dry_run:
            print("[DRY-RUN]", subprocess.list2cmdline(command))
        else:
            run(command)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
