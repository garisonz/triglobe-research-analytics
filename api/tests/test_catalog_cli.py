"""Offline CLI integration tests for roster scope and recoverable profile failures."""
import io
import unittest
from contextlib import nullcontext, redirect_stderr, redirect_stdout
from datetime import UTC, datetime
from unittest.mock import call, patch

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from tests import auth_server  # noqa: F401
from app.database import Base
from app.market import sync_catalog
from app.market.catalog import apply_profile, sync_members
from app.market.catalog_sources import CatalogSourceError, Constituent
from app.market.models import Company, Instrument

OLD_SYNC = datetime(2026, 9, 20, 12, tzinfo=UTC)


def roster():
    identities = [
        ("AAPL", "0000320193", "Apple"),
        ("BRK.B", "0001067983", "Berkshire Hathaway"),
        ("GOOG", "0001652044", "Alphabet"),
    ]
    identities.extend((f"Z{index:04}", str(index + 1000).zfill(10), f"Company {index}") for index in range(447))
    return [
        Constituent(symbol=symbol, name=name, cik=cik, gics_sector="Financials", gics_sub_industry="Insurance")
        for symbol, cik, name in identities
    ]


def profile(symbol):
    return {"name": f"{symbol} Yahoo name", "currency": "USD", "exchange": "NASDAQ", "sector": "Technology"}


class CatalogCliTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.members = roster()

    def tearDown(self):
        self.engine.dispose()

    def run_cli(self, args, fetch=profile):
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            patch.object(sync_catalog, "engine", self.engine),
            patch.object(sync_catalog, "import_lock", nullcontext),
            patch.object(sync_catalog, "fetch_sp500_constituents", return_value=self.members),
            patch.object(sync_catalog, "fetch_profile", side_effect=fetch) as fetcher,
            patch.object(sync_catalog.time, "sleep"),
            redirect_stdout(stdout), redirect_stderr(stderr),
        ):
            result = sync_catalog.main(["--delay", "0", *args])
        return result, stdout.getvalue(), stderr.getvalue(), fetcher.call_args_list

    def assert_full_membership(self):
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Instrument).where(Instrument.is_sp500)), 450)
            self.assertEqual(db.scalar(select(func.count()).select_from(Company)), 450)

    def test_limit_only_restricts_profile_work_and_retains_full_membership(self):
        result, stdout, stderr, calls = self.run_cli(["--limit", "1"])
        self.assertEqual(result, 0)
        self.assertEqual(calls, [call("AAPL")])
        self.assertIn("Catalog saved: 450 securities / 450 companies", stdout)
        self.assertEqual(stderr, "")
        self.assert_full_membership()
        with Session(self.engine) as db:
            self.assertIsNotNone(db.get(Instrument, "AAPL").currency)
            self.assertIsNone(db.get(Instrument, "BRK.B").currency)

    def test_symbol_selection_resolves_yahoo_alias_without_truncating_membership(self):
        result, _, stderr, calls = self.run_cli(["--symbols", "brk-b"])
        self.assertEqual(result, 0)
        self.assertEqual(calls, [call("BRK.B")])
        self.assertEqual(stderr, "")
        self.assert_full_membership()
        with Session(self.engine) as db:
            self.assertIsNone(db.get(Instrument, "AAPL").currency)
            self.assertEqual(db.get(Instrument, "BRK.B").currency, "USD")

    def test_five_failures_stop_requests_and_explain_unattempted_resume(self):
        result, stdout, stderr, calls = self.run_cli([], fetch=CatalogSourceError("Provider unavailable"))
        self.assertEqual(result, 1)
        self.assertEqual(calls, [call(member.symbol) for member in self.members[:5]])
        self.assertIn("Profiles saved: 0; failed: 5; not attempted: 445", stdout)
        self.assertIn("Stopping after five consecutive profile failures", stderr)
        self.assertIn("unattempted profiles", stderr)
        self.assertIn("original command", stderr)
        self.assertIn("--only-missing", stderr)
        self.assert_full_membership()
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Company).where(Company.profile_synced_at.is_not(None))), 0)

    def test_mixed_profile_results_preserve_prior_data_and_commit_roster(self):
        previous = {"name": "Apple prior name", "currency": "USD", "sector": "Technology", "website": "https://www.apple.com"}
        with Session(self.engine) as db, db.begin():
            sync_members(db, [self.members[0]], source="prior roster", synced_at=OLD_SYNC)
            apply_profile(db, "AAPL", previous, synced_at=OLD_SYNC)
            old_instrument = db.get(Instrument, "AAPL")
            previous_id = old_instrument.id
            previous_company_id = old_instrument.company_id
            db.add(Instrument(symbol="FORMER", name="Former member", asset_type="EQUITY", is_sp500=True))

        def fetch(symbol):
            if symbol == "AAPL":
                raise CatalogSourceError("Apple temporarily unavailable")
            return profile(symbol)

        result, stdout, stderr, calls = self.run_cli(["--symbols", "AAPL,BRK-B,GOOG"], fetch=fetch)
        self.assertEqual(result, 1)
        self.assertEqual(calls, [call("AAPL"), call("BRK.B"), call("GOOG")])
        self.assertIn("Profiles saved: 2; failed: 1; not attempted: 0", stdout)
        self.assertIn("Retry with --symbols AAPL", stderr)
        self.assert_full_membership()
        with Session(self.engine) as db:
            apple = db.get(Instrument, "AAPL")
            company = db.get(Company, apple.company_id)
            self.assertEqual(apple.id, previous_id)
            self.assertEqual(apple.company_id, previous_company_id)
            self.assertEqual(apple.name, previous["name"])
            self.assertEqual(company.website, previous["website"])
            self.assertEqual(company.profile_synced_at.replace(tzinfo=UTC), OLD_SYNC)
            self.assertGreater(apple.catalog_synced_at.replace(tzinfo=UTC), OLD_SYNC)
            self.assertEqual(db.get(Instrument, "BRK.B").name, "BRK.B Yahoo name")
            self.assertEqual(db.get(Instrument, "GOOG").currency, "USD")
            self.assertFalse(db.get(Instrument, "FORMER").is_sp500)


if __name__ == "__main__":
    unittest.main()
