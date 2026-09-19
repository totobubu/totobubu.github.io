"""Static admin-view exports. SQLite remains the source of truth for numbers."""
from __future__ import annotations

import json
import sqlite3
import shutil
from pathlib import Path


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def export_all(db: Path, bundles: Path, output: Path) -> None:
    connection = sqlite3.connect(db)
    connection.row_factory = sqlite3.Row
    try:
        events = [dict(row) for row in connection.execute("""
            SELECT e.*, LAG(distribution_per_share) OVER (PARTITION BY ticker ORDER BY ex_date) AS previous_amount,
            AVG(CAST(distribution_per_share AS REAL)) OVER (PARTITION BY ticker ORDER BY ex_date ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS average4,
            AVG(CAST(distribution_per_share AS REAL)) OVER (PARTITION BY ticker ORDER BY ex_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) AS average12
            FROM distribution_events e ORDER BY declared_date DESC, id DESC""")]
        providers = [dict(row) for row in connection.execute("""
            SELECT p.slug, p.display_name, p.parser_version, MAX(s.fetched_at) last_success,
            (SELECT prs.status FROM pipeline_run_steps prs WHERE prs.provider_slug=p.slug ORDER BY prs.id DESC LIMIT 1) last_status,
            (SELECT prs.message FROM pipeline_run_steps prs WHERE prs.provider_slug=p.slug ORDER BY prs.id DESC LIMIT 1) last_message
            FROM providers p LEFT JOIN source_documents s ON s.provider_slug=p.slug GROUP BY p.slug ORDER BY p.display_name""")]
        performance = [dict(row) for row in connection.execute("SELECT * FROM content_performance ORDER BY published_at DESC")]
    finally:
        connection.close()
    render_rows = []
    content_rows = []
    for manifest_path in sorted(bundles.glob("*/manifest.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = manifest.get("files", {})
        content_rows.append({"manifest": manifest, "path": str(manifest_path.parent), "files": files})
        for name in files.values():
            source = manifest_path.parent / name
            if source.exists():
                destination = output / "renders" / str(manifest["eventId"]) / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
                render_rows.append({"eventId": manifest["eventId"], "ticker": manifest["ticker"], "exDate": manifest.get("exDate"), "name": name, "url": "/content-studio/renders/" + str(manifest["eventId"]) + "/" + name})
    _write(output / "distributions.json", {"events": events, "marketData": "not_configured: NAV/price adapter required"})
    _write(output / "content.json", {"bundles": content_rows, "notionEditScope": ["title", "body", "channels", "approval status"]})
    _write(output / "sources.json", {"providers": providers})
    _write(output / "renders.json", {"renders": render_rows})
    _write(output / "archive.json", {"performance": performance, "reuseCandidates": sorted(performance, key=lambda row: row["views"], reverse=True)[:10]})
