"""
Utility script to run the local onboarding workflow for new tickers.

Example:
    python scripts/run_new_ticker_workflow.py WEED MAGS

Features:
    1. Executes npm/node and Python steps in order.
    2. Stops on the first failure with clear logs.
    3. Uses the Windows formatting script automatically when needed.
    4. Offers a --dry-run option to preview the plan.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable


def resolve_executable(executable: str) -> str:
    """Return a platform-appropriate executable path."""
    system = platform.system().lower()
    if system.startswith("win"):
        if executable.lower() in {"npm", "npx"}:
            return f"{executable}.cmd"
        if not os.path.splitext(executable)[1]:
            # PATHEXT를 이용해 직접 찾는다.
            path = shutil.which(executable)
            if path:
                return path
    return executable


def run_command(label: str, command: List[str], dry_run: bool = False) -> None:
    """Run a command and raise if it fails."""
    if not command:
        raise ValueError("Command is empty.")

    normalized = [resolve_executable(command[0]), *command[1:]]
    printable = shlex.join(normalized)
    print(f"\n-> {label}\n   $ {printable}")

    if dry_run:
        return

    result = subprocess.run(normalized, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        raise RuntimeError(
            f"Step failed ({label}) - exit code {result.returncode}\n"
            f"Command: {printable}"
        )


def prepare_steps(
    tickers: Iterable[str], skip_format: bool, skip_fetch: bool
):
    """Return the ordered list of workflow steps."""
    ticker_args = [t.upper() for t in tickers]
    if not ticker_args:
        raise ValueError("Specify at least one ticker.")

    format_script = (
        ["npm", "run", "format:changed:win"]
        if platform.system().lower().startswith("win")
        else ["npm", "run", "format:changed"]
    )

    steps = [
        ("Update IPO dates (nav)", ["npm", "run", "add-ipo-dates"]),
        (
            "Analyze dividend frequency",
            [PYTHON, "scripts/analyze_dividend_frequency.py", *ticker_args],
        ),
        (
            "Auto-detect holdings",
            [
                PYTHON,
                "scripts/auto_detect_holdings.py",
                "--api",
                "--exclude-kr",
                "--yes",
                *ticker_args,
            ],
        ),
        ("Regenerate nav", ["npm", "run", "generate-nav"]),
        (
            "Scrape info data",
            [PYTHON, "scripts/scraper_info.py", *ticker_args],
        ),
    ]

    if not skip_fetch:
        for ticker in ticker_args:
            steps.append(
                (
                    f"Fetch holdings ({ticker})",
                    [PYTHON, "scripts/fetch_holdings.py", ticker],
                )
            )

    steps.extend(
        [
            (
                "Update historical prices",
                ["npm", "run", "update-data", "--", *ticker_args],
            ),
            (
                "Update market cap",
                [PYTHON, "scripts/update_market_cap.py", *ticker_args],
            ),
            (
                "Update dividend history",
                [PYTHON, "scripts/update_dividends.py", *ticker_args],
            ),
            (
                "Scrape dividends",
                [PYTHON, "scripts/scraper_dividend.py", *ticker_args],
            ),
            (
                "Project future dividends",
                [PYTHON, "scripts/project_future_dividends.py", *ticker_args],
            ),
            (
                "Regenerate calendar events",
                ["npm", "run", "generate-calendar-events"],
            ),
            (
                "Regenerate sidebar tickers",
                [PYTHON, "scripts/generate_sidebar_tickers.py"],
            ),
        ]
    )

    if not skip_format:
        steps.append(("Format changed files", format_script))

    return steps


def main():
    parser = argparse.ArgumentParser(
        description="Run the local onboarding workflow for new tickers."
    )
    parser.add_argument(
        "tickers",
        nargs="+",
        help="Ticker symbols to process.",
    )
    parser.add_argument(
        "--skip-format",
        action="store_true",
        help="Skip the final formatting step.",
    )
    parser.add_argument(
        "--skip-fetch-holdings",
        action="store_true",
        help="Skip holdings collection.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan without executing commands.",
    )

    args = parser.parse_args()

    os.chdir(PROJECT_ROOT)

    steps = prepare_steps(
        args.tickers,
        skip_format=args.skip_format,
        skip_fetch=args.skip_fetch_holdings,
    )

    print("=" * 80)
    print("Local new-ticker workflow")
    print(f"Tickers: {', '.join(t.upper() for t in args.tickers)}")
    print(f"Total steps: {len(steps)}")
    print(f"Project root: {PROJECT_ROOT}")
    print("=" * 80)

    for index, (label, command) in enumerate(steps, start=1):
        print(f"\n=== Step {index}/{len(steps)} ===")
        run_command(label, command, dry_run=args.dry_run)

    if args.dry_run:
        print("\n[DRY-RUN] No commands were executed.")
    else:
        print("\n[OK] All steps completed successfully.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted by user (Ctrl+C).")
        sys.exit(1)
    except Exception as exc:  # pylint: disable=broad-except
        print(f"\n[ERROR] Workflow aborted due to error: {exc}")
        sys.exit(1)

