from __future__ import annotations

import argparse
import json
from pathlib import Path

if __package__ in {None, ""}:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.content_pipeline.database import ContentDatabase, DEFAULT_DB_PATH


def main() -> int:
    parser = argparse.ArgumentParser(description="Export the content studio dashboard snapshot")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/content-studio/dashboard.json"),
    )
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    database = ContentDatabase(args.db)
    database.initialize()
    snapshot = database.dashboard_snapshot(limit=args.limit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Exported dashboard snapshot: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
