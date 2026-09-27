"""Catalog endpoints read stored profiles without fetching external data."""
import unittest
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Load isolated configuration before importing application settings.
from tests import auth_server  # noqa: F401
from app.auth.dependencies import get_current_user
from app.database import Base, get_db
from app.market.catalog_api import router
from app.market.models import Candle, Company, Instrument

NOW = datetime(2026, 9, 26, 12, tzinfo=UTC)


class CatalogApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.app = FastAPI()
        self.app.include_router(router)

        def database():
            with Session(self.engine) as db:
                yield db

        self.app.dependency_overrides[get_db] = database
        self.app.dependency_overrides[get_current_user] = lambda: object()
        self.client = TestClient(self.app)
        with Session(self.engine) as db, db.begin():
            apple = Company(
                cik="0000320193", name="Apple Inc.", gics_sector="Information Technology",
                gics_sub_industry="Technology Hardware", sector="Technology",
                industry="Consumer Electronics", description="Makes phones and computers.",
                website="https://www.apple.com", country="United States", profile_synced_at=NOW,
            )
            alphabet = Company(
                cik="0001652044", name="Alphabet Inc.", gics_sector="Communication Services",
                gics_sub_industry="Interactive Media & Services",
            )
            berkshire = Company(cik="0001067983", name="Berkshire Hathaway", sector="Financial Services")
            former = Company(cik="0000000001", name="Former Company", gics_sector="Industrials")
            literal = Company(cik="0000000002", name="100% Example_Company", sector="Consumer Defensive")
            db.add_all([apple, alphabet, berkshire, former, literal])
            db.flush()
            entries = [
                ("AAPL", "AAPL", "Apple Inc.", apple, True),
                ("GOOG", "GOOG", "Alphabet Class C", alphabet, True),
                ("GOOGL", "GOOGL", "Alphabet Class A", alphabet, True),
                ("BRK.B", "BRK-B", "Berkshire Class B", berkshire, True),
                ("FORM", "FORM", "Former Company", former, False),
                ("TEST", "TEST", "Literal Holdings", literal, False),
            ]
            for symbol, yahoo_symbol, name, company, member in entries:
                db.add(Instrument(
                    symbol=symbol, yahoo_symbol=yahoo_symbol, name=name, company_id=company.id,
                    asset_type="EQUITY", exchange="NASDAQ", currency="USD", is_sp500=member,
                    catalog_synced_at=NOW,
                ))
            # Existing price-only instruments are outside the company catalog.
            db.add(Instrument(symbol="SPY", name="S&P 500 ETF", asset_type="ETF"))
            db.flush()
            db.add(Candle(
                symbol="AAPL", interval="1d", time=datetime(2026, 9, 25, 4, tzinfo=UTC),
                open=Decimal("200"), high=Decimal("202"), low=Decimal("199"),
                close=Decimal("201"), volume=100,
            ))

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_catalog_lists_members_without_requiring_history(self):
        response = self.client.get("/market/catalog")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 4)
        self.assertEqual([entry["symbol"] for entry in body["instruments"]], ["AAPL", "BRK.B", "GOOG", "GOOGL"])
        apple, _, goog, googl = body["instruments"]
        self.assertEqual(apple["candle_count"], 1)
        self.assertEqual(goog["candle_count"], 0)
        self.assertEqual(goog["company_id"], googl["company_id"])
        self.assertNotEqual(goog["id"], googl["id"])
        self.assertEqual(apple["cik"], "0000320193")
        self.assertTrue(apple["catalog_synced_at"].endswith("Z"))
        self.assertTrue(apple["profile_synced_at"].endswith("Z"))
        self.assertEqual(apple["sector"], "Technology")
        self.assertEqual(apple["industry"], "Consumer Electronics")
        self.assertEqual(goog["sector"], "Communication Services")
        self.assertEqual(goog["industry"], "Interactive Media & Services")
        self.assertIsNone(goog["profile_synced_at"])
        self.assertEqual(body["sectors"], ["Communication Services", "Financial Services", "Technology"])
        self.assertNotIn("description", apple)

    def test_pagination_retains_total_and_validates_bounds(self):
        body = self.client.get("/market/catalog?limit=2&offset=1").json()
        self.assertEqual(body["total"], 4)
        self.assertEqual([entry["symbol"] for entry in body["instruments"]], ["BRK.B", "GOOG"])
        self.assertEqual(self.client.get("/market/catalog?offset=20").json()["instruments"], [])
        for query in ("limit=0", "limit=101", "offset=-1"):
            with self.subTest(query=query):
                self.assertEqual(self.client.get(f"/market/catalog?{query}").status_code, 422)

    def test_search_matches_case_insensitive_symbol_alias_and_company_name(self):
        cases = [(" aapl ", ["AAPL"]), ("brk-b", ["BRK.B"]), ("alphabet inc.", ["GOOG", "GOOGL"]), ("class b", ["BRK.B"])]
        for query, expected in cases:
            with self.subTest(query=query):
                body = self.client.get("/market/catalog", params={"q": query}).json()
                self.assertEqual([entry["symbol"] for entry in body["instruments"]], expected)
                self.assertEqual(body["total"], len(expected))

    def test_search_wildcards_are_literal_and_query_can_be_combined_with_sector(self):
        for query in ("%", "_"):
            body = self.client.get("/market/catalog", params={"q": query, "sp500_only": "false"}).json()
            self.assertEqual(body["total"], 1)
            self.assertEqual(body["instruments"][0]["symbol"], "TEST")
        body = self.client.get("/market/catalog", params={"q": "apple", "sector": "Financial Services"}).json()
        self.assertEqual(body["total"], 0)
        self.assertEqual(body["instruments"], [])
        self.assertIn("Technology", body["sectors"])

    def test_sector_filter_uses_effective_sector_and_nonmembers_are_available(self):
        technology = self.client.get("/market/catalog", params={"sector": "Technology"}).json()
        self.assertEqual([entry["symbol"] for entry in technology["instruments"]], ["AAPL"])
        self.assertEqual(self.client.get("/market/catalog", params={"sector": "Information Technology"}).json()["total"], 0)
        all_catalog = self.client.get("/market/catalog?sp500_only=false").json()
        self.assertEqual(all_catalog["total"], 6)
        self.assertNotIn("SPY", [entry["symbol"] for entry in all_catalog["instruments"]])
        self.assertIn("Industrials", all_catalog["sectors"])
        self.assertFalse(self.client.get("/market/catalog/FORM").json()["is_sp500"])

    def test_detail_normalizes_alias_and_includes_profile(self):
        canonical = self.client.get("/market/catalog/BRK.B")
        alias = self.client.get("/market/catalog/brk-b")
        self.assertEqual(canonical.status_code, 200)
        self.assertEqual(canonical.json(), alias.json())
        apple = self.client.get("/market/catalog/aapl").json()
        self.assertEqual(apple["description"], "Makes phones and computers.")
        self.assertEqual(apple["website"], "https://www.apple.com")
        self.assertEqual(apple["country"], "United States")
        self.assertEqual(self.client.get("/market/catalog/UNKNOWN").status_code, 404)
        self.assertEqual(self.client.get("/market/catalog/SPY").status_code, 404)
        self.assertEqual(self.client.get("/market/catalog/INVALID!").status_code, 422)

    def test_catalog_routes_require_login(self):
        del self.app.dependency_overrides[get_current_user]
        for path in ("/market/catalog", "/market/catalog/AAPL"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)


if __name__ == "__main__":
    unittest.main()
