"""Historical-data tests use an isolated SQLite database and fake provider replies."""
import unittest
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Install safe test settings before importing the application configuration.
from tests import auth_server  # noqa: F401
from app.auth.dependencies import get_current_user
from app.database import Base, get_db
from app.market.ingestion import (
    MarketDataError, normalize_symbol, save_history, validate_candles,
)
from app.market.models import Candle, Instrument
from app.routers.market import range_start, router

NOW = datetime(2026, 9, 26, 12, tzinfo=UTC)
DETAILS = {"symbol": "AAPL", "name": "Apple Inc.", "asset_type": "EQUITY", "exchange": "NASDAQ", "data_source": "Example Market Data"}


def raw_bar(instant=None, **changes):
    instant = instant or datetime(2026, 9, 25, 4, tzinfo=UTC)
    return {
        "datetime": int(instant.timestamp() * 1000),
        "open": 220.0, "high": 223.0, "low": 219.0,
        "close": 222.0, "volume": 12000, **changes,
    }


def payload(*bars):
    return {"symbol": "AAPL", "empty": False, "candles": list(bars)}


class ProviderValidationTests(unittest.TestCase):
    def test_partial_day_is_excluded_and_duplicate_corrections_replace_prior_value(self):
        first = raw_bar()
        correction = raw_bar(close=222.5)
        today = raw_bar(datetime(2026, 9, 26, 4, tzinfo=UTC))
        older = raw_bar(datetime(2026, 9, 24, 4, tzinfo=UTC))
        rows = validate_candles("AAPL", payload(first, today, older, correction), now=NOW)
        self.assertEqual(len(rows), 2)
        self.assertLess(rows[0]["time"], rows[1]["time"])
        self.assertEqual(rows[1]["close"], Decimal("222.5"))

    def test_bad_or_empty_provider_data_is_rejected(self):
        invalid = [
            {"symbol": "MSFT", "candles": [raw_bar()]},
            {"symbol": "AAPL", "empty": True, "candles": []},
            payload(),
            payload(raw_bar(close=float("nan"))),
            payload(raw_bar(high=200)),
            payload(raw_bar(volume=-1)),
            payload(raw_bar(volume=3.5)),
            payload(raw_bar(volume=True)),
            payload(raw_bar(datetime=True)),
            payload(raw_bar(NOW + timedelta(days=2))),
        ]
        for data in invalid:
            with self.subTest(data=data):
                with self.assertRaises(MarketDataError):
                    validate_candles("AAPL", data, now=NOW)

    def test_symbols_are_normalized_and_validated(self):
        self.assertEqual(normalize_symbol(" brk.b "), "BRK.B")
        with self.assertRaises(ValueError):
            normalize_symbol("../etc")


class HistoricalStorageTests(unittest.TestCase):
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

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def save(self, bars, now=NOW):
        rows = validate_candles("AAPL", payload(*bars), now=now)
        with Session(self.engine) as db, db.begin():
            return save_history(db, DETAILS, rows, synced_at=now)

    def test_repeated_backfill_upserts_corrections_without_duplicates(self):
        self.save([raw_bar()])
        self.save([raw_bar(close=221.75)], NOW + timedelta(hours=1))
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Candle)), 1)
            self.assertEqual(db.scalar(select(Candle.close)), Decimal("221.75000000"))
            self.assertEqual(db.get(Instrument, "AAPL").last_synced_at.hour, 13)

    def test_failed_symbol_transaction_leaves_no_instrument_or_partial_bars(self):
        rows = validate_candles("AAPL", payload(raw_bar()), now=NOW)
        rows[0]["volume"] = -1
        with self.assertRaises(IntegrityError):
            with Session(self.engine) as db, db.begin():
                save_history(db, DETAILS, rows, synced_at=NOW)
        with Session(self.engine) as db:
            self.assertIsNone(db.get(Instrument, "AAPL"))
            self.assertEqual(db.scalar(select(func.count()).select_from(Candle)), 0)

    def test_history_reads_storage_and_returns_chronological_numeric_candles(self):
        self.save([
            raw_bar(datetime(2026, 9, 25, 4, tzinfo=UTC)),
            raw_bar(datetime(2026, 1, 5, 5, tzinfo=UTC)),
        ])
        with patch("app.routers.market.datetime") as clock:
            clock.now.return_value = NOW
            clock.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)
            response = self.client.get("/market/history/aapl?range=1y")
            recent = self.client.get("/market/history/AAPL?range=1m")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["candles"]), 2)
        self.assertEqual(len(recent.json()["candles"]), 1)
        self.assertLess(body["candles"][0]["time"], body["candles"][1]["time"])
        self.assertIsInstance(body["candles"][0]["close"], float)
        self.assertTrue(body["candles"][0]["time"].endswith("Z"))
        self.assertEqual(body["source"], "Example Market Data")
        summary = self.client.get("/market/instruments").json()["instruments"][0]
        self.assertEqual(summary["candle_count"], 2)
        self.assertEqual(summary["symbol"], "AAPL")

    def test_missing_empty_and_invalid_ranges(self):
        self.assertEqual(self.client.get("/market/history/AAPL").status_code, 404)
        with Session(self.engine) as db, db.begin():
            db.add(Instrument(**DETAILS))
        self.assertEqual(self.client.get("/market/history/AAPL?range=all").json()["candles"], [])
        self.assertEqual(self.client.get("/market/history/AAPL?range=bad").status_code, 422)
        self.assertEqual(self.client.get("/market/history/INVALID!").status_code, 422)

    def test_all_market_routes_require_app_login(self):
        del self.app.dependency_overrides[get_current_user]
        for path in ("/market/instruments", "/market/history/AAPL"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

    def test_calendar_ranges_clamp_month_end_and_respect_new_york(self):
        cutoff = range_start("1m", datetime(2026, 3, 31, 16, tzinfo=UTC))
        self.assertEqual(cutoff, datetime(2026, 2, 28, 5, tzinfo=UTC))
        self.assertIsNone(range_start("all", NOW))


if __name__ == "__main__":
    unittest.main()
