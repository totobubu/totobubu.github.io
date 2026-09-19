"""Static admin-view exports. SQLite remains the source of truth for numbers."""
from __future__ import annotations

import json
import sqlite3
import shutil
from pathlib import Path


DISTRIBUTION_PAGE_SIZE = 200


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
    # Keep the legacy complete export for integrations, but do not make the UI
    # download thousands of rows before it can render a tab.
    provider_events: dict[str, list[dict]] = {}
    for event in events:
        provider_events.setdefault(event["provider_slug"], []).append(event)
    provider_names = {provider["slug"]: provider["display_name"] for provider in providers}
    distribution_providers = []
    for slug, rows in sorted(provider_events.items(), key=lambda item: provider_names.get(item[0], item[0])):
        page_count = max(1, (len(rows) + DISTRIBUTION_PAGE_SIZE - 1) // DISTRIBUTION_PAGE_SIZE)
        distribution_providers.append({
            "slug": slug,
            "displayName": provider_names.get(slug, slug),
            "eventCount": len(rows),
            "pageCount": page_count,
            "latestExDate": rows[0].get("ex_date"),
        })
        for page in range(page_count):
            start = page * DISTRIBUTION_PAGE_SIZE
            _write(output / f"distribution-{slug}-{page + 1}.json", {
                "provider": distribution_providers[-1],
                "page": page + 1,
                "pageSize": DISTRIBUTION_PAGE_SIZE,
                "events": rows[start : start + DISTRIBUTION_PAGE_SIZE],
            })
    _write(output / "distribution-index.json", {
        "providers": distribution_providers,
        "recentEvents": events[:100],
        "marketData": "not_configured: NAV/price adapter required",
    })
    _write(output / "distributions.json", {"events": events, "marketData": "not_configured: NAV/price adapter required"})
    _write(output / "content.json", {"bundles": content_rows, "notionEditScope": ["title", "body", "channels", "approval status"]})
    _write(output / "sources.json", {"providers": providers})
    _write(output / "renders.json", {"renders": render_rows})
    _write(output / "archive.json", {"performance": performance, "reuseCandidates": sorted(performance, key=lambda row: row["views"], reverse=True)[:10]})
