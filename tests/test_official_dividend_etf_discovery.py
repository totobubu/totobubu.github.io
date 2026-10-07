import unittest
from unittest.mock import patch

from scripts.ticker_onboarding import discover_official_dividend_etfs as discovery
from scripts.ticker_onboarding import fallback_sources
from scripts.workflows.run_new_ticker_workflow import prepare_steps


class OfficialDividendEtfDiscoveryTests(unittest.TestCase):
    def test_parses_only_income_products_from_official_catalogue(self):
        html = """
        <table>
          <tr><td>ABCD</td><td>ABCD XYZ Option Income Strategy ETF</td></tr>
          <tr><td>SPY</td><td>S&P 500 Index ETF</td></tr>
          <tr><td>TSLX</td><td>Daily Target 2X Long TSLA ETF Income</td></tr>
        </table>
        """
        products = discovery.parse_catalogue(html, "example", "Example", "https://issuer.example/etfs")
        self.assertEqual([item["symbol"] for item in products], ["ABCD", "TSLX"])
        self.assertEqual(products[0]["underlying"], "XYZ")
        self.assertEqual(products[1]["underlying"], "TSLA")

    @patch.object(discovery, "fetch_provider")
    @patch.object(discovery, "load_registered_symbols", return_value={"KNOWN"})
    @patch.object(discovery, "yahoo_single_holding", return_value="NVDA")
    def test_registered_symbols_are_excluded_and_yahoo_is_review_only(self, yahoo, registered, fetch):
        fetch.return_value = ([
            {"symbol": "KNOWN", "underlying": "AAPL"},
            {"symbol": "NEW", "underlying": None},
        ], [])
        payload = discovery.discover(["yieldmax"])
        self.assertEqual([item["symbol"] for item in payload["candidates"]], ["NEW"])
        candidate = payload["candidates"][0]
        self.assertEqual(candidate["status"], "needs_review")
        self.assertEqual(candidate["yahooCandidateUnderlying"], "NVDA")
        self.assertNotIn("underlying", {key: value for key, value in candidate.items() if value})

    def test_targeted_workflow_can_skip_repository_wide_ipo_sync(self):
        steps = prepare_steps(["TEST"], skip_format=True, skip_ipo_sync=True)
        commands = [command for _, command in steps]
        self.assertNotIn(["npm", "run", "add-ipo-dates"], commands)

    def test_cboe_fallback_is_review_only(self):
        rows = [["2026-07-29", "BNAV", "Cboe New Issue Notification for 1 Amplify ETF"]]
        with patch.object(fallback_sources, "fetch_cboe_rows", return_value=rows):
            candidates, errors = fallback_sources.fetch_cboe_fallbacks({"amplify": {"company": "Amplify"}}, year=2026)
        self.assertEqual(errors, [])
        self.assertEqual(candidates[0]["symbol"], "BNAV")
        self.assertEqual(candidates[0]["status"], "exchange_confirmed_needs_review")
        self.assertFalse(candidates[0]["autoRegisterEligible"])


if __name__ == "__main__":
    unittest.main()
