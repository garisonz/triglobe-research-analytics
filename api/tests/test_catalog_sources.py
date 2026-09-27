"""Catalog provider tests use generated HTML and mocked Yahoo replies only."""

import csv
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError

from app.market.catalog_sources import (
    CatalogSourceError, _parse_constituents_html,
    fetch_profile, fetch_sp500_constituents, load_constituents_csv, yahoo_symbol,
)

CSV_HEADER = ["symbol", "name", "cik", "gics_sector", "gics_sub_industry"]


def roster_html(count=500, *, repeated_cik=False):
    header = ["Symbol", "Security", "GICS Sector", "GICS Sub-Industry", "CIK"]
    rows = ["<tr>" + "".join(f"<th>{value}</th>" for value in header) + "</tr>"]
    for i in range(count):
        cells = [f"S{i}", f"Company {i}", "Technology", "Software", str(1 if repeated_cik else i + 1)]
        rows.append("<tr>" + "".join(f"<td>{value}</td>" for value in cells) + "</tr>")
    return '<table id="constituents">' + "".join(rows) + "</table>"


def company_info(**changes):
    return {
        "symbol": "AAPL", "quoteType": "EQUITY", "longName": "Apple Inc.",
        "currency": "USD", "exchange": "NMS", "fullExchangeName": "NasdaqGS",
        "sector": "Technology", "industry": "Consumer Electronics",
        "longBusinessSummary": "Company description.", "website": "https://example.com",
        "country": "United States", "currentPrice": 123.45, **changes,
    }


class ConstituentTests(unittest.TestCase):
    def load_csv(self, rows, header=CSV_HEADER):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "roster.csv"
            with path.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(header)
                writer.writerows(rows)
            return load_constituents_csv(path)

    def test_html_uses_only_target_table_and_normalizes_cik(self):
        source = '<table><tr><td>ignore me</td></tr></table>' + roster_html()
        source = source.replace("Company 0", '<a href="/example">Company &amp; Co.</a><sup>[1]</sup>')
        rows = _parse_constituents_html(source)
        self.assertEqual(len(rows), 500)
        self.assertEqual(rows[0].cik, "0000000001")
        self.assertEqual(rows[0].name, "Company & Co.")
        self.assertEqual(rows[0].gics_sector, "Technology")
        self.assertEqual(rows[0].gics_sub_industry, "Software")

    def test_full_roster_shape_and_issuer_count_are_guarded(self):
        for source in [
            "", roster_html().replace('id="constituents"', 'id="other"'),
            roster_html(449), roster_html(551), roster_html(repeated_cik=True),
            roster_html().replace("<th>CIK</th>", "<th>Wrong</th>"),
            roster_html().replace("<td>S0</td>", ""),
            roster_html().replace("</table>", ""),
            roster_html() + roster_html(),
        ]:
            with self.subTest(source=source[:100]):
                with self.assertRaises(CatalogSourceError):
                    _parse_constituents_html(source)

    def test_html_invalid_cik_and_duplicate_symbols_are_rejected(self):
        for source in [
            roster_html().replace("<td>1</td>", "<td>0</td>", 1),
            roster_html().replace("<td>S1</td>", "<td>S0</td>", 1),
            roster_html().replace("<td>S0</td>", "<td>BRK.B</td>", 1).replace("<td>S1</td>", "<td>BRK-B</td>", 1),
        ]:
            with self.assertRaises(CatalogSourceError):
                _parse_constituents_html(source)

    def test_csv_subsets_share_classes_and_duplicate_ciks_are_supported(self):
        rows = self.load_csv([
            [" brk.b ", "Berkshire", "1067983", "Financials", "Insurance"],
            ["BRK.A", "Berkshire", "0001067983", "Financials", "Insurance"],
        ])
        self.assertEqual([row.symbol for row in rows], ["BRK.B", "BRK.A"])
        self.assertEqual([row.cik for row in rows], ["0001067983", "0001067983"])
        self.assertEqual(yahoo_symbol("BRK.B"), "BRK-B")
        self.assertEqual(yahoo_symbol("BRK-B"), "BRK-B")

    def test_bad_ciks_missing_fields_and_duplicates_are_rejected(self):
        base = ["AAPL", "Apple", "320193", "Technology", "Hardware"]
        for cik in ["", "0", "0000000000", "-1", "12.5", "12345678901", "abc", "１２３"]:
            with self.subTest(cik=cik):
                with self.assertRaises(CatalogSourceError):
                    self.load_csv([[*base[:2], cik, *base[3:]]])
        for rows in [
            [], [base, base], [["AAPL", "", *base[2:]]],
            [base + ["extra"]], [base[:-1]],
            [["BRK.B", *base[1:]], ["BRK-B", *base[1:]]],
        ]:
            with self.subTest(rows=rows):
                with self.assertRaises(CatalogSourceError):
                    self.load_csv(rows)
        with self.assertRaises(CatalogSourceError):
            self.load_csv([base], header=["symbol", "name", "wrong", "gics_sector", "gics_sub_industry"])
        with self.assertRaises(CatalogSourceError):
            self.load_csv([base], header=["symbol", "name", "cik", "gics_sector", "gics_sub_industry", "cik"])

    @patch("app.market.catalog_sources.time.sleep")
    @patch("app.market.catalog_sources.urlopen")
    def test_download_retries_transient_errors_and_uses_timeout(self, open_url, sleep):
        open_url.side_effect = [URLError("secret upstream detail"), io.BytesIO(roster_html().encode())]
        self.assertEqual(len(fetch_sp500_constituents()), 500)
        self.assertEqual(open_url.call_count, 2)
        self.assertEqual(open_url.call_args.kwargs["timeout"], 20)
        sleep.assert_called_once_with(1)
        self.assertTrue(open_url.call_args.args[0].get_header("User-agent"))

    @patch("app.market.catalog_sources.time.sleep")
    @patch("app.market.catalog_sources.urlopen")
    def test_download_failure_retries_are_bounded_and_safe(self, open_url, sleep):
        open_url.side_effect = HTTPError("https://secret.example/token", 429, "secret", {}, None)
        with self.assertRaisesRegex(CatalogSourceError, "after 3 attempts") as error:
            fetch_sp500_constituents()
        self.assertNotIn("secret", str(error.exception))
        self.assertEqual(open_url.call_count, 3)
        self.assertEqual(sleep.call_args_list, [call(1), call(2)])

    @patch("app.market.catalog_sources.time.sleep")
    @patch("app.market.catalog_sources.urlopen")
    def test_invalid_downloads_are_not_retried(self, open_url, sleep):
        for content in [b"invalid document", b"\xff", b"x" * 5_000_001]:
            open_url.return_value = io.BytesIO(content)
            with self.assertRaises(CatalogSourceError):
                fetch_sp500_constituents()
        sleep.assert_not_called()


class YahooProfileTests(unittest.TestCase):
    @patch("app.market.catalog_sources.time.sleep")
    @patch("yfinance.Ticker")
    def test_company_metadata_is_normalized_without_prices(self, ticker, sleep):
        ticker.return_value.get_info.return_value = company_info(symbol="BRK-B")
        details = fetch_profile("brk.b")
        ticker.assert_called_once_with("BRK-B")
        self.assertEqual(details["name"], "Apple Inc.")
        self.assertEqual(details["exchange"], "NasdaqGS")
        self.assertEqual(details["description"], "Company description.")
        self.assertEqual(set(details), {
            "name", "exchange", "currency", "sector", "industry",
            "description", "website", "country",
        })
        sleep.assert_not_called()

    @patch("app.market.catalog_sources.time.sleep")
    @patch("yfinance.Ticker")
    def test_optional_fields_may_be_missing(self, ticker, sleep):
        ticker.return_value.get_info.return_value = {
            "symbol": "AAPL", "quoteType": "EQUITY", "shortName": "Apple", "currency": "USD",
        }
        details = fetch_profile("AAPL")
        self.assertEqual(details["name"], "Apple")
        self.assertIsNone(details["sector"])
        self.assertIsNone(details["description"])

    @patch("app.market.catalog_sources.time.sleep")
    @patch("yfinance.Ticker")
    def test_error_mismatch_and_incomplete_replies_are_rejected(self, ticker, sleep):
        for info in [
            None, [], {}, {"error": "secret"}, {"finance": {"error": "secret"}},
            company_info(symbol="MSFT"), company_info(quoteType="ETF"),
            company_info(currency=None), company_info(longName=" "),
            {"symbol": "AAPL", "quoteType": "EQUITY", "trailingPegRatio": None},
        ]:
            with self.subTest(info=info):
                ticker.reset_mock()
                ticker.return_value.get_info.return_value = info
                with self.assertRaises(CatalogSourceError) as error:
                    fetch_profile("AAPL")
                self.assertEqual(ticker.call_count, 3)
                self.assertNotIn("secret", str(error.exception))

    @patch("app.market.catalog_sources.time.sleep")
    @patch("yfinance.Ticker")
    def test_provider_exception_is_sanitized_and_transient_failure_retried(self, ticker, sleep):
        ticker.return_value.get_info.side_effect = [RuntimeError("secret token"), company_info()]
        self.assertEqual(fetch_profile("AAPL")["currency"], "USD")
        self.assertEqual(ticker.call_count, 2)
        sleep.assert_called_once_with(1)
        ticker.return_value.get_info.side_effect = RuntimeError("secret token")
        with self.assertRaises(CatalogSourceError) as error:
            fetch_profile("AAPL")
        self.assertNotIn("secret", str(error.exception))


if __name__ == "__main__":
    unittest.main()
