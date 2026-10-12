#!/usr/bin/env python3
"""Publish a small, versioned public-data contract for downstream readers.

The large ticker histories remain at their stable ``data/`` R2 keys.  A release
only publishes an immutable catalog plus a pointer, so consumers can pin a
validated inventory without duplicating market-history objects.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path


RELEASE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_catalog(public_root: Path) -> list[dict]:
    nav_payload = read_json(public_root / "nav.json")
    entries = nav_payload.get("nav", [])
    instruments: list[dict] = []
    for entry in entries:
        symbol = str(entry.get("symbol", "")).strip().upper()
        data_paths = entry.get("dataPaths") or []
        data_path = next((path for path in data_paths if isinstance(path, str) and path.startswith("data/")), None)
        if not symbol or not data_path:
            continue
        instruments.append(
            {
                "symbol": symbol,
                "market": entry.get("market"),
                "currency": entry.get("currency"),
                "koName": entry.get("koName"),
                "company": entry.get("company"),
                "securityType": entry.get("securityType"),
                "dataPath": data_path,
            }
        )
    return instruments


def build_release(public_root: Path, release_id: str, generated_at: str | None = None) -> dict:
    if not RELEASE_ID.fullmatch(release_id):
        raise ValueError("release id must contain only letters, numbers, '.', '_' or '-'")
    nav_path = public_root / "nav.json"
    if not nav_path.is_file():
        raise FileNotFoundError(f"missing catalog source: {nav_path}")

    instruments = build_catalog(public_root)
    release_root = public_root / "releases" / "v1" / "releases" / release_id
    catalog_path = release_root / "catalog.json"
    generated_at = generated_at or datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    catalog = {"schemaVersion": 1, "instruments": instruments}
    write_json(catalog_path, catalog)
    manifest = {
        "schemaVersion": 1,
        "releaseId": release_id,
        "generatedAt": generated_at,
        "catalogPath": "catalog.json",
        "dataRoot": "data/",
        "instrumentCount": len(instruments),
        "files": [{"path": "nav.json", "sha256": sha256(nav_path)}, {"path": "catalog.json", "sha256": sha256(catalog_path)}],
    }
    manifest_path = release_root / "manifest.json"
    write_json(manifest_path, manifest)
    pointer = {
        "schemaVersion": 1,
        "releaseId": release_id,
        "manifestKey": f"releases/v1/releases/{release_id}/manifest.json",
        "generatedAt": generated_at,
    }
    write_json(public_root / "releases" / "v1" / "current.json", pointer)
    return {"pointer": pointer, "manifest": manifest, "catalog": catalog}


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the DivGrow public release manifest.")
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--public-root", type=Path, default=Path("public"))
    args = parser.parse_args()
    result = build_release(args.public_root, args.release_id)
    print(f"Published release {result['pointer']['releaseId']} with {result['manifest']['instrumentCount']} instruments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
