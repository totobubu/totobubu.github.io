import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = (
    Path(__file__).parents[1]
    / "scripts"
    / "data_pipeline"
    / "remove_verified_no_dividends.py"
)
SPEC = importlib.util.spec_from_file_location("remove_verified_no_dividends", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class VerifiedNoDividendScopeTests(unittest.TestCase):
    EXPECTED_SYMBOLS = {
        "GFS", "GLDW", "MSTU", "MULL", "UBRL", "GRNY", "RSSY",
        "PTIR", "ETH", "ETHE", "LLYX", "CHAT", "SMCX",
    }

    def test_216_flagged_symbols_only_clear_the_13_verified_targets(self):
        targets = self.EXPECTED_SYMBOLS
        self.assertEqual(module.VERIFIED_SYMBOLS, targets)
        unrelated = {f"UNRELATED_{index:03d}" for index in range(203)}
        records = [
            {"symbol": symbol, "noDividends": True, "company": f"metadata:{symbol}"}
            for symbol in sorted(targets | unrelated)
        ]

        updated, changed = module.remove_verified_flags(records, targets)

        self.assertEqual(changed, targets)
        self.assertEqual(
            {record["symbol"] for record in updated if record.get("noDividends") is True},
            unrelated,
        )
        self.assertEqual(
            {record["symbol"] for record in updated if "noDividends" not in record},
            targets,
        )
        expected_records = [dict(record) for record in records]
        for record in expected_records:
            if record["symbol"] in targets:
                del record["noDividends"]
        self.assertEqual(updated, expected_records)
        self.assertTrue(all(record["noDividends"] for record in records))

    def test_missing_target_fails_closed(self):
        records = [{"symbol": "UNRELATED", "noDividends": True}]
        with self.assertRaises(ValueError):
            module.remove_verified_flags(records, {"GFS"})

    def test_duplicate_symbol_fails_closed(self):
        records = [
            {"symbol": "GFS", "noDividends": True},
            {"symbol": "GFS", "noDividends": True},
        ]
        with self.assertRaises(ValueError):
            module.remove_verified_flags(records, {"GFS"})


if __name__ == "__main__":
    unittest.main()

