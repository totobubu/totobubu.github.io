import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "data_pipeline" / "update_distributions.py"
SPEC = importlib.util.spec_from_file_location("update_distributions", MODULE_PATH)
update_distributions = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = update_distributions
SPEC.loader.exec_module(update_distributions)


class YieldMaxOcrTests(unittest.TestCase):
    def test_workflow_boundary_normalizes_yqqq_alias(self):
        self.assertEqual(
            update_distributions.normalize_provider_ticker(
                update_distributions.YieldMaxParser, "YEQQ"
            ),
            "YQQQ",
        )
        self.assertEqual(
            update_distributions.normalize_provider_ticker(
                update_distributions.YieldMaxParser, "YEOQ"
            ),
            "YQQQ",
        )

    def test_provider_scoped_aliases_are_normalized(self):
        text = "\n".join(
            [
                "HOOYY Weekly $0.4302",
                "NEFLY Weekly $0.1750",
                "YEQQ Weekly $0.0373",
                "YEOQ Weekly $0.0373",
                "SDTV Weekly $0.1640",
                "VM Weekly $0.0857",
                "YOQQQ Weekly $0.0373",
            ]
        )
        parser = update_distributions.YieldMaxParser(text, "YieldMax_2026-10-07.txt")
        self.assertEqual(
            parser.extract_data(),
            {
                "HOOY": 0.4302,
                "NFLY": 0.175,
                "YQQQ": 0.0373,
                "SDTY": 0.164,
                "YMAG": 0.0857,
            },
        )

    def test_target_12_fixture_recovers_bigy_rnty_and_soxy_by_table_order(self):
        fixture = Path(__file__).parent / "fixtures" / "yieldmax_2026-10-07-target12-ocr.txt"
        parser = update_distributions.YieldMaxParser(
            fixture.read_text(encoding="utf-8"), fixture.name
        )
        self.assertEqual(
            parser.extract_data(),
            {"BIGY": 0.5323, "RNTY": 0.4614, "SOXY": 0.9992},
        )
        self.assertEqual(parser.issues, [])

    def test_gouge_without_complete_target_12_context_is_ambiguous(self):
        parser = update_distributions.YieldMaxParser(
            "Target 12\nGOUGE Monthly $0.4614", "YieldMax_2026-10-07.txt"
        )
        self.assertEqual(parser.extract_data(), {})
        self.assertEqual(parser.issues[0]["status"], "ambiguous_mapping")


class UpdateOutcomeTests(unittest.TestCase):
    def write_data(self, directory, rows):
        path = Path(directory) / "soxy.json"
        path.write_text(json.dumps({"backtestData": rows}), encoding="utf-8")
        return path

    def test_expected_row_is_confirmed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_data(directory, [{"date": "2026-10-07", "expected": True}])
            outcome = update_distributions.update_json(path, "2026-10-07", 0.9992)
            self.assertEqual(outcome.status, "updated")
            row = json.loads(path.read_text(encoding="utf-8"))["backtestData"][0]
            self.assertNotIn("expected", row)
            self.assertEqual(row["amountFixed"], 0.9992)

    def test_missing_row_requires_review(self):
        with tempfile.TemporaryDirectory() as directory:
            outcome = update_distributions.update_json(
                self.write_data(directory, []), "2026-10-07", 0.9992
            )
            self.assertEqual(outcome.status, "missing_distribution_row")

    def test_known_ticker_row_without_expected_is_confirmed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_data(
                directory, [{"date": "2026-10-08", "forecasted": True}]
            )
            outcome = update_distributions.update_json(path, "2026-10-08", 0.7667)
            self.assertEqual(outcome.status, "updated")
            row = json.loads(path.read_text(encoding="utf-8"))["backtestData"][0]
            self.assertTrue(row["forecasted"])
            self.assertEqual(row["amountFixed"], 0.7667)

    def test_confirmed_amount_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            outcome = update_distributions.update_json(
                self.write_data(directory, [{"date": "2026-10-07", "amountFixed": 0.5}]),
                "2026-10-07",
                0.9992,
            )
            self.assertEqual(outcome.status, "conflicting_confirmed_amount")

    def test_review_summary_marks_blocking_outcomes(self):
        original = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                review = update_distributions.write_review_summary(
                    [
                        update_distributions.UpdateOutcome("SOXY", "updated", "date=2026-10-07", 0.9992),
                        update_distributions.UpdateOutcome("INYY", "missing_registration", "no data", 0.7667),
                    ]
                )
                self.assertTrue(review["blocking"])
                self.assertIn(
                    "missing_registration",
                    Path("distribution-update-review.md").read_text(encoding="utf-8"),
                )
            finally:
                os.chdir(original)


class RegisteredTickerDataTests(unittest.TestCase):
    def test_new_yieldmax_tickers_have_nav_and_official_distribution_records(self):
        root = Path(__file__).parents[1]
        nav = json.loads((root / "public" / "nav.json").read_text(encoding="utf-8"))
        nav_by_symbol = {entry["symbol"]: entry for entry in nav["nav"]}

        expected = {
            "INYY": ("data/nyse/inyy.json", "2026-10-01", 0.7667),
            "YSPC": ("data/nyse/yspc.json", "2026-10-01", 0.4923),
            "YRAM": ("data/nyse/yram.json", "2026-10-07", 0.4214),
        }
        for symbol, (relative_path, date, amount) in expected.items():
            self.assertEqual(nav_by_symbol[symbol]["dataPaths"], [relative_path])
            data = json.loads((root / "public" / relative_path).read_text(encoding="utf-8"))
            event = next(row for row in data["backtestData"] if row["date"] == date)
            self.assertEqual(event["amountFixed"], amount)
            self.assertTrue(event["officiallyAnnounced"])


if __name__ == "__main__":
    unittest.main()
