import tempfile
import unittest
from pathlib import Path

from scripts.content_pipeline.database import ContentDatabase
from scripts.content_pipeline.record_collection_report import record_collection_report


class CollectionHealthTest(unittest.TestCase):
    def test_dashboard_exposes_latest_browser_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "ledger.sqlite"
            database = ContentDatabase(db_path)
            database.initialize()
            database.upsert_provider(
                "schwab", "Schwab", "https://www.schwabassetmanagement.com"
            )
            record_collection_report(db_path, "schwab", {
                "errors": [{
                    "url": "https://www.schwabassetmanagement.com/products/schd",
                    "fetchMode": "browser",
                    "code": "challenge_detected",
                    "retryable": False,
                    "error": "anti-automation challenge detected; collection stopped",
                }],
            })
            provider = database.dashboard_snapshot()["providers"][0]
            self.assertEqual(provider["last_fetch_mode"], "browser")
            self.assertEqual(provider["last_attempt_status"], "challenge_detected")
            self.assertIn("challenge", provider["last_attempt_message"])


if __name__ == "__main__":
    unittest.main()
