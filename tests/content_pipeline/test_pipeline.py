import json
import tempfile
import unittest
from pathlib import Path

from scripts.content_pipeline.content_calendar import export_calendar
from scripts.content_pipeline.database import ContentDatabase
from scripts.content_pipeline.export_admin_data import export_all
from scripts.content_pipeline.generate_content import generate_all_bundles
from scripts.content_pipeline.models import DistributionEvent, SourceDocument
from scripts.content_pipeline.weekly_digest import build_shorts_script


class PipelineTest(unittest.TestCase):
    def test_verified_event_generates_once_and_exports_admin_views(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); db = ContentDatabase(root / "ledger.sqlite"); db.initialize()
            db.upsert_provider("yieldmax", "YieldMax", "https://yieldmaxetfs.com")
            source = db.add_source_document(SourceDocument(provider_slug="yieldmax", source_url="https://yieldmaxetfs.com/a", source_type="official", content=b"official"))
            event = DistributionEvent(provider_slug="yieldmax", ticker="TSLY", distribution_per_share="0.20", declared_date="2026-09-16", ex_date="2026-09-17", official_url="https://yieldmaxetfs.com/a")
            db.upsert_distribution_event(event, source)
            bundles = generate_all_bundles(root / "ledger.sqlite", root / "bundles")
            self.assertEqual(len(bundles), 1)
            self.assertEqual(generate_all_bundles(root / "ledger.sqlite", root / "bundles"), bundles)
            export_calendar(root / "bundles", root / "calendar.json", root / "calendar.csv")
            export_all(root / "ledger.sqlite", root / "bundles", root / "public")
            self.assertEqual(json.loads((root / "public/distributions.json").read_text())["events"][0]["ticker"], "TSLY")

    def test_shorts_keeps_facts_and_commentary_separate(self):
        result = build_shorts_script([], __import__('datetime').date(2026, 9, 1), __import__('datetime').date(2026, 9, 7))
        self.assertIn("사실 데이터", result)
        self.assertIn("내레이션", result)


if __name__ == "__main__":
    unittest.main()
