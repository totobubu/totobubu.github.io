#!/usr/bin/env python3
"""Remove noDividends only for the 13 independently verified symbols in issue #202.

This intentionally does not inspect dividend arrays or scan the full nav universe.
"""
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
NAV_DIR = ROOT_DIR / "public" / "nav"

VERIFIED_TARGETS = {
    "public/nav/NASDAQ/g.json": {"GFS", "GLDW"},
    "public/nav/NYSE/m.json": {"MSTU", "MULL"},
    "public/nav/NYSE/u.json": {"UBRL"},
    "public/nav/NYSE/g.json": {"GRNY"},
    "public/nav/NYSE/r.json": {"RSSY"},
    "public/nav/NYSE/p.json": {"PTIR"},
    "public/nav/NYSE/e.json": {"ETH", "ETHE"},
    "public/nav/NYSE/l.json": {"LLYX"},
    "public/nav/NYSE/c.json": {"CHAT"},
    "public/nav/NYSE/s.json": {"SMCX"},
}
VERIFIED_SYMBOLS = set().union(*VERIFIED_TARGETS.values())


def remove_verified_flags(records, verified_symbols):
    """Return a copied nav list with flags removed only for the supplied symbols."""
    if len({record.get("symbol") for record in records}) != len(records):
        raise ValueError("Duplicate symbol in nav file")
    present = {record.get("symbol") for record in records}
    missing = set(verified_symbols) - present
    if missing:
        raise ValueError(f"Verified symbols missing from nav file: {sorted(missing)}")

    updated = []
    changed = set()
    for record in records:
        copy = dict(record)
        if copy.get("symbol") in verified_symbols:
            if copy.get("noDividends") is True:
                del copy["noDividends"]
                changed.add(copy["symbol"])
        updated.append(copy)
    return updated, changed


def apply_verified_updates(root=ROOT_DIR):
    changed = set()
    for relative_path, symbols in VERIFIED_TARGETS.items():
        path = Path(root) / relative_path
        records = json.loads(path.read_text(encoding="utf-8"))
        updated, file_changed = remove_verified_flags(records, symbols)
        if file_changed:
            path.write_text(
                json.dumps(updated, ensure_ascii=False, indent=4) + "\n",
                encoding="utf-8",
            )
        changed.update(file_changed)

    if changed != VERIFIED_SYMBOLS:
        raise RuntimeError(
            "Expected to remove exactly the verified flags; "
            f"changed={sorted(changed)}, expected={sorted(VERIFIED_SYMBOLS)}"
        )
    return changed


if __name__ == "__main__":
    changed = apply_verified_updates()
    print(f"Removed noDividends from {len(changed)} verified symbols: {', '.join(sorted(changed))}")

