"""Identity/membership tests run offline against isolated SQLite."""
import unittest
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

from tests import auth_server  # noqa: F401
from app.market.catalog import apply_profile, needs_profile, sync_members
from app.market.catalog_sources import CatalogSourceError, Constituent
from app.market.ingestion import save_history, validate_candles
from app.market.models import Candle, Company, Instrument
from app.database import Base
from tests.test_market import DETAILS, NOW, payload, raw_bar


def member(symbol="AAPL", cik="0000320193", name="Apple Inc."):
    return Constituent(symbol=symbol, name=name, cik=cik,
                       gics_sector="Information Technology", gics_sub_industry="Technology Hardware")


class CatalogStorageTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        @event.listens_for(self.engine, "connect")
        def foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def sync(self, members, full=False, now=NOW):
        with Session(self.engine) as db, db.begin():
            return sync_members(db, members, source="test roster", synced_at=now, full_snapshot=full)

    def test_rerun_preserves_ids_prices_and_groups_share_classes(self):
        with Session(self.engine) as db, db.begin():
            save_history(db, DETAILS, validate_candles("AAPL", payload(raw_bar()), now=NOW), synced_at=NOW)
            original_id = db.get(Instrument, "AAPL").id
        members = [member(), member("GOOG", "0001652044", "Alphabet"), member("GOOGL", "0001652044", "Alphabet")]
        self.sync(members)
        with Session(self.engine) as db:
            company_id = db.get(Instrument, "AAPL").company_id
            self.assertEqual(db.get(Instrument, "AAPL").id, original_id)
            self.assertEqual(db.get(Instrument, "GOOG").company_id, db.get(Instrument, "GOOGL").company_id)
            self.assertNotEqual(db.get(Instrument, "GOOG").id, db.get(Instrument, "GOOGL").id)
        self.sync(members, now=NOW + timedelta(days=1))
        with Session(self.engine) as db:
            apple = db.get(Instrument, "AAPL")
            self.assertEqual(apple.id, original_id)
            self.assertEqual(apple.company_id, company_id)
            self.assertEqual(apple.data_source, DETAILS["data_source"])
            self.assertEqual(apple.last_synced_at.date(), NOW.date())
            self.assertEqual(db.scalar(select(func.count()).select_from(Company)), 2)
            self.assertEqual(db.scalar(select(func.count()).select_from(Candle)), 1)

    def test_canonical_punctuation_correction_keeps_id_and_candles(self):
        details = {**DETAILS, "symbol": "BRK-B"}
        bars = [{**row, "symbol": "BRK-B"} for row in validate_candles("AAPL", payload(raw_bar()), now=NOW)]
        with Session(self.engine) as db, db.begin():
            save_history(db, details, bars, synced_at=NOW)
            original = db.get(Instrument, "BRK-B").id
        self.sync([member("BRK.B", "0001067983", "Berkshire Hathaway")])
        with Session(self.engine) as db:
            self.assertIsNone(db.get(Instrument, "BRK-B"))
            instrument = db.get(Instrument, "BRK.B")
            self.assertEqual(instrument.id, original)
            self.assertEqual(instrument.yahoo_symbol, "BRK-B")
            self.assertEqual(db.scalar(select(Candle.symbol)), "BRK.B")

    def test_cik_conflict_rolls_back_entire_snapshot(self):
        self.sync([member()])
        with self.assertRaises(CatalogSourceError):
            self.sync([member("MSFT", "0000789019", "Microsoft"), member(cik="0000000001")])
        with Session(self.engine) as db:
            self.assertIsNone(db.get(Instrument, "MSFT"))
            self.assertEqual(db.scalar(select(func.count()).select_from(Company)), 1)
            self.assertEqual(db.get(Instrument, "AAPL").company_id, db.scalar(select(Company.id)))

    def test_only_complete_snapshot_marks_departures_without_deleting(self):
        self.sync([member()])
        self.sync([member("MSFT", "0000789019", "Microsoft")])
        with Session(self.engine) as db:
            self.assertTrue(db.get(Instrument, "AAPL").is_sp500)
        with self.assertRaises(CatalogSourceError):
            self.sync([member("MSFT", "0000789019", "Microsoft")], full=True)
        large = [member(f"X{index:04}", str(index + 1).zfill(10), f"Company {index}") for index in range(450)]
        self.sync(large, full=True)
        with Session(self.engine) as db:
            self.assertFalse(db.get(Instrument, "AAPL").is_sp500)
            self.assertIsNotNone(db.get(Instrument, "AAPL").company_id)
            self.assertEqual(db.scalar(select(func.count()).select_from(Instrument).where(Instrument.is_sp500)), 450)
            self.assertEqual(db.scalar(select(func.count()).select_from(Instrument)), 452)

    def test_profile_does_not_erase_missing_fields_or_touch_price_sync(self):
        self.sync([member()])
        with Session(self.engine) as db, db.begin():
            self.assertTrue(needs_profile(db, "AAPL"))
            apply_profile(db, "AAPL", {"name": "Apple Inc.", "currency": "USD", "sector": "Technology",
                                      "exchange": "NasdaqGS", "website": "https://www.apple.com"}, synced_at=NOW)
        with Session(self.engine) as db, db.begin():
            self.assertFalse(needs_profile(db, "AAPL"))
            apply_profile(db, "AAPL", {"name": "Apple Inc.", "currency": "USD", "sector": None,
                                      "website": None}, synced_at=NOW + timedelta(hours=1))
        with Session(self.engine) as db:
            instrument = db.get(Instrument, "AAPL")
            company = db.get(Company, instrument.company_id)
            self.assertEqual(company.sector, "Technology")
            self.assertEqual(company.website, "https://www.apple.com")
            self.assertEqual(company.profile_source, "Yahoo Finance via yfinance")
            self.assertIsNone(instrument.last_synced_at)
            self.assertEqual(instrument.data_source, "Unknown")
            self.assertEqual(company.cik, "0000320193")

    def test_duplicate_alias_and_invalid_cik_rejected(self):
        for members in ([member(), member()], [member("BRK.B"), member("BRK-B")],
                        [member(cik="0000000000")], [member(cik="wrong")]):
            with self.subTest(members=members), self.assertRaises(CatalogSourceError):
                self.sync(members)
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Company)), 0)


if __name__ == "__main__":
    unittest.main()
