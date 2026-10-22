import importlib.util
import json
import os
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "data_pipeline" / "update_distributions.py"
SPEC = importlib.util.spec_from_file_location("update_distributions", MODULE_PATH)
update_distributions = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = update_distributions
SPEC.loader.exec_module(update_distributions)


class YieldMaxOcrTests(unittest.TestCase):
    def test_actual_october_15_ocr_matches_every_official_row(self):
        fixtures = Path(__file__).parent / "fixtures"
        official = json.loads(
            (fixtures / "yieldmax_2026-10-15-official.json").read_text(encoding="utf-8")
        )
        parser = update_distributions.YieldMaxParser(
            (fixtures / "yieldmax_2026-10-15-ocr.txt").read_text(encoding="utf-8"),
            "YieldMax_2026-10-15.png",
        )
        self.assertEqual(parser.extract_data(), official["amounts"])
        self.assertEqual(parser.issues, [])
        self.assertNotIn("YRAM", parser.raw_rows)

    def test_added_removed_or_reordered_rows_never_shift_amounts(self):
        for text, expected in [
            ("MSTY Weekly $0.2474\n*MUY Weekly $0.1583\nNFLY Weekly $0.0328",
             {"MSTY": 0.2474, "MUY": 0.1583, "NFLY": 0.0328}),
            ("NFLY Weekly $0.0328\nMSTY Weekly $0.2474",
             {"NFLY": 0.0328, "MSTY": 0.2474}),
        ]:
            with self.subTest(text=text):
                parser = update_distributions.YieldMaxParser(text, "YieldMax_2026-10-15.txt")
                self.assertEqual(parser.extract_data(), expected)
                self.assertEqual(parser.issues, [])

    def test_lost_ticker_or_amount_is_blocking_not_zipped(self):
        for text in ["NFLY\n$0.0328", "$0.0328\nNVDY Weekly $0.0797",
                     "NFLY Weekly - 25.0000%", "NFLY Weekly - 25.0000 %", "ZZZZ Weekly -"]:
            with self.subTest(text=text):
                parser = update_distributions.YieldMaxParser(text, "YieldMax_2026-10-15.txt")
                parser.extract_data()
                self.assertTrue(parser.issues)
                self.assertEqual(parser.issues[0]["status"], "ambiguous_mapping")

    def test_conflicting_duplicate_ticker_is_blocking(self):
        parser = update_distributions.YieldMaxParser(
            "NFLY Weekly $0.0328\nNFLY Weekly $0.1583", "YieldMax_2026-10-15.txt"
        )
        parser.extract_data()
        self.assertEqual(parser.issues[0]["status"], "ambiguous_mapping")

    def test_digit_alias_is_issuer_scoped(self):
        self.assertEqual(update_distributions.normalize_provider_ticker(
            update_distributions.YieldMaxParser, "YQ0Q"), "YQQQ")
        self.assertEqual(update_distributions.normalize_provider_ticker(
            update_distributions.RoundHillParser, "YQ0Q"), "YQ0Q")

    def test_october_22_gdxy_duplicate_x_is_issuer_scoped(self):
        parser = update_distributions.YieldMaxParser(
            "FIAT Weekly $0.2203\nGDXxY Income Strategy ETF hate Weekly $0.0766 40.74% 2.97%\nGMEY Weekly $0.3418",
            "YieldMax_2026-10-22.png",
        )
        self.assertEqual(parser.extract_data(), {"FIAT": 0.2203, "GDXY": 0.0766, "GMEY": 0.3418})
        self.assertEqual(parser.issues, [])
        self.assertEqual(update_distributions.normalize_provider_ticker(
            update_distributions.YieldMaxParser, "GDXXY"), "GDXY")
        self.assertEqual(update_distributions.normalize_provider_ticker(
            update_distributions.RoundHillParser, "GDXXY"), "GDXXY")

    def test_visual_recovery_uses_coordinates_not_token_order(self):
        data = {
            "text": ["$0.2451", "MSST", "NVIT", "$0.1501"],
            "left": [696, 49, 53, 696],
            "top": [268, 162, 271, 160],
            "width": [68, 54, 46, 69],
            "height": [17, 16, 15, 17],
        }
        with mock.patch.object(update_distributions.pytesseract, "image_to_data",
                               return_value=data):
            text = update_distributions.recover_yieldmax_visual_rows(mock.Mock(width=1120))
        self.assertEqual(text, "MSST Weekly $0.1501\nNVIT Weekly $0.2451")
        data["top"][0] = 400  # Unmatched amount must reject the entire fallback.
        with mock.patch.object(update_distributions.pytesseract, "image_to_data",
                               return_value=data):
            self.assertIsNone(update_distributions.recover_yieldmax_visual_rows(
                mock.Mock(width=1120)))

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

    def test_expected_flag_does_not_bypass_confirmed_amount(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_data(directory, [
                {"date": "2026-10-07", "expected": True, "amountFixed": 0.5}
            ])
            before = path.read_bytes()
            for amount in [0.9992, 0.5001]:
                outcome = update_distributions.update_json(path, "2026-10-07", amount)
                self.assertEqual(outcome.status, "conflicting_confirmed_amount")
                self.assertEqual(path.read_bytes(), before)

    def test_duplicate_date_rows_require_review(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_data(directory, [
                {"date": "2026-10-07", "expected": True},
                {"date": "2026-10-07", "amountFixed": 0.5},
            ])
            before = path.read_bytes()
            outcome = update_distributions.update_json(path, "2026-10-07", 0.9992)
            self.assertEqual(outcome.status, "ambiguous_mapping")
            self.assertEqual(path.read_bytes(), before)

    def test_preflight_leaves_file_bytes_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_data(directory, [{"date": "2026-10-07", "expected": True}])
            before = path.read_bytes()
            outcome = update_distributions.update_json(path, "2026-10-07", 0.9992, dry_run=True)
            self.assertEqual(outcome.status, "updated")
            self.assertEqual(path.read_bytes(), before)

    def test_review_summary_marks_blocking_outcomes(self):
        original = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                review, _ = update_distributions.write_review_summary(
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


class BatchPreflightTests(unittest.TestCase):
    def run_batch(self, text, rows, second_text=None):
        root = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            screenshots = temp / "screenshots"
            screenshots.mkdir()
            (screenshots / "YieldMax_2026-10-15.txt").write_text(text, encoding="utf-8")
            if second_text:
                (screenshots / "YieldMax_2026-10-15-2.txt").write_text(second_text, encoding="utf-8")
            data = temp / "data"
            data.mkdir()
            for symbol, entries in rows.items():
                (data / f"{symbol.lower()}.json").write_text(
                    json.dumps({"backtestData": entries}), encoding="utf-8")
            before = {p.name: p.read_bytes() for p in data.glob("*.json")}
            code = 0
            try:
                os.chdir(temp)
                with mock.patch.object(update_distributions, "SCREENSHOT_DIR", screenshots), \
                     mock.patch.object(update_distributions, "DATA_DIR", data), \
                     mock.patch.object(update_distributions, "OCR_DEBUG_PATH", temp / "ocr.txt"), \
                     mock.patch.object(sys, "argv", ["update_distributions.py",
                                                   "--skip-missing-distribution-row"]):
                    try:
                        update_distributions.main()
                    except SystemExit as exc:
                        code = exc.code
                after = {p.name: p.read_bytes() for p in data.glob("*.json")}
                review = json.loads((temp / "distribution-update-review.json").read_text(encoding="utf-8"))
            finally:
                os.chdir(root)
            return code, before, after, review

    def test_parser_issue_blocks_whole_batch_before_writes(self):
        code, before, after, review = self.run_batch(
            "NFLY Weekly $0.0328\n$0.1583",
            {"NFLY": [{"date": "2026-10-15", "expected": True}]},
        )
        self.assertEqual(code, 2)
        self.assertEqual(before, after)
        self.assertTrue(review["blocking"])
        self.assertNotIn("updated", [r["status"] for r in review["outcomes"]])
        issue = next(r for r in review["outcomes"] if r["status"] == "ambiguous_mapping")
        self.assertEqual(issue["source"], "YieldMax_2026-10-15.txt")
        self.assertEqual(issue["date"], "2026-10-15")
        self.assertEqual(issue["raw_text"], "$0.1583")

    def test_skip_missing_rows_cannot_bypass_confirmed_conflict(self):
        code, before, after, _ = self.run_batch(
            "NFLY Weekly $0.0328\nNVDY Weekly $0.0797",
            {"NFLY": [{"date": "2026-10-15", "expected": True}],
             "NVDY": [{"date": "2026-10-15", "amountFixed": 0.1583, "expected": True}]},
        )
        self.assertEqual(code, 2)
        self.assertEqual(before, after)

    def test_skip_missing_rows_still_allows_only_missing_dates(self):
        code, before, after, review = self.run_batch(
            "NFLY Weekly $0.0328",
            {"NFLY": []},
        )
        self.assertEqual(code, 0)
        self.assertEqual(before, after)
        self.assertFalse(review["blocking"])
        self.assertEqual(review["outcomes"][0]["status"], "missing_distribution_row")

    def test_disagreeing_screenshots_block_whole_batch(self):
        code, before, after, _ = self.run_batch(
            "NFLY Weekly $0.0328",
            {"NFLY": [{"date": "2026-10-15", "expected": True}]},
            second_text="NFLY Weekly $0.1583",
        )
        self.assertEqual(code, 2)
        self.assertEqual(before, after)

    def test_missing_registration_is_blocking(self):
        code, before, after, review = self.run_batch(
            "NFLY Weekly $0.0328\nMUY Weekly $0.1583",
            {"NFLY": [{"date": "2026-10-15", "expected": True}]},
        )
        self.assertEqual(code, 2)
        self.assertEqual(before, after)
        self.assertIn("missing_registration", [r["status"] for r in review["outcomes"]])

    def test_valid_batch_is_idempotent(self):
        code, _, after, review = self.run_batch(
            "NFLY Weekly $0.0328\nMUY Weekly $0.1583",
            {"NFLY": [{"date": "2026-10-15", "amountFixed": 0.0328}],
             "MUY": [{"date": "2026-10-15", "amountFixed": 0.1583}]},
        )
        self.assertEqual(code, 0)
        self.assertFalse(review["blocking"])
        self.assertEqual({r["status"] for r in review["outcomes"]}, {"already_applied"})

    def test_valid_unconfirmed_batch_writes_after_preflight(self):
        code, before, after, review = self.run_batch(
            "NFLY Weekly $0.0328",
            {"NFLY": [{"date": "2026-10-15", "expected": True}]},
        )
        self.assertEqual(code, 0)
        self.assertNotEqual(before, after)
        self.assertEqual(review["outcomes"][0]["status"], "updated")


class RegisteredTickerDataTests(unittest.TestCase):
    def test_muy_navigation_source_and_sidebar_keep_registration_metadata(self):
        root = Path(__file__).parents[1]
        for relative in ["public/nav/NASDAQ/m.json", "public/sidebar-tickers.json"]:
            entries = json.loads((root / relative).read_text(encoding="utf-8"))
            entry = next(r for r in entries if r["symbol"] == "MUY")
            self.assertTrue(entry["autoRegistered"])
            self.assertTrue(entry["isinPending"])
            self.assertEqual(entry["underlying"], "MU")
            self.assertEqual(entry["market"], "NASDAQ")
            self.assertEqual(entry["frequency"], "매주")
            self.assertEqual(entry["group"], "목")
            self.assertEqual(entry["registrationSource"], "https://yieldmaxetfs.com/our-etfs/muy/")

    def test_muy_is_registered_with_official_event_and_existing_underlying(self):
        root = Path(__file__).parents[1]
        nav = json.loads((root / "public/nav.json").read_text(encoding="utf-8"))["nav"]
        entry = next(r for r in nav if r["symbol"] == "MUY")
        self.assertTrue(entry["autoRegistered"])
        self.assertEqual(entry["market"], "NASDAQ")
        self.assertEqual(entry["ipoDate"], "2026-09-29")
        self.assertEqual(entry["underlying"], "MU")
        self.assertTrue(any(r["symbol"] == "MU" for r in nav))
        data = json.loads((root / "public/data/nasdaq/muy.json").read_text(encoding="utf-8"))
        event = next(r for r in data["backtestData"] if r["date"] == "2026-10-15")
        self.assertEqual(event["amountFixed"], 0.1583)
        self.assertTrue(event["officiallyAnnounced"])
        self.assertGreater(event["close"], 0)

    def test_october_15_data_and_calendar_match_official_table(self):
        root = Path(__file__).parents[1]
        official = json.loads(
            (root / "tests/fixtures/yieldmax_2026-10-15-official.json").read_text(encoding="utf-8"))
        calendar = json.loads((root / "public/calendar/monthly/2026/10.json").read_text(encoding="utf-8"))
        events = {r["ticker"]: r for r in calendar["UsEtf"]["2026-10-15"]}
        for ticker, amount in official["amounts"].items():
            matches = list((root / "public/data").glob(f"**/{ticker.lower()}.json"))
            self.assertEqual(len(matches), 1)
            data = json.loads(matches[0].read_text(encoding="utf-8"))
            row = next(r for r in data["backtestData"] if r["date"] == "2026-10-15")
            self.assertEqual(row["amountFixed"], amount, ticker)
            self.assertEqual(events[ticker]["amount"], amount, ticker)
        self.assertNotIn("YRAM", events)
        yram = json.loads((root / "public/data/nyse/yram.json").read_text(encoding="utf-8"))
        self.assertFalse(any(r.get("amountFixed") is not None
                             for r in yram["backtestData"] if r["date"] == "2026-10-15"))
        self.assertEqual(next(r["amountFixed"] for r in yram["backtestData"]
                              if r["date"] == "2026-10-14"), 0.3877)

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
