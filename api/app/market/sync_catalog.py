"""Run with: uv run python -m app.market.sync_catalog --help"""
import argparse
import math
import sys
import time
from contextlib import contextmanager
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import engine
from app.market.catalog import apply_profile, needs_profile, sync_members
from app.market.catalog_sources import (
    CatalogSourceError, SP500_SOURCE_URL, fetch_profile,
    fetch_sp500_constituents, load_constituents_csv,
)
from app.market.ingestion import normalize_symbol


@contextmanager
def import_lock():
    # Protect stable identity creation and snapshot reconciliation from two CLIs.
    with engine.connect() as connection:
        if connection.dialect.name == "postgresql":
            acquired = connection.scalar(text("SELECT pg_try_advisory_lock(726491305)"))
            connection.commit()
            if not acquired:
                raise CatalogSourceError("Another catalog import is already running.")
        try:
            yield
        finally:
            if connection.dialect.name == "postgresql":
                connection.execute(text("SELECT pg_advisory_unlock(726491305)"))
                connection.commit()


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Import S&P 500 identities and yfinance company profiles.")
    result.add_argument("--constituents-csv", help="CSV with symbol,name,cik,gics_sector,gics_sub_industry; partial by default.")
    result.add_argument("--full-snapshot", action="store_true", help="Treat CSV as full membership (450–550 securities required).")
    result.add_argument("--catalog-only", action="store_true", help="Import reference identities without requesting Yahoo profiles.")
    result.add_argument("--only-missing", action="store_true", help="Retry only securities without a successful profile import.")
    result.add_argument("--symbols", help="Enrich only these comma-separated catalog tickers; still import the full reference list.")
    result.add_argument("--limit", type=int, help="Maximum number of profiles to enrich; does not truncate membership.")
    result.add_argument("--delay", type=float, default=1.0, help="Seconds between Yahoo profile requests (default 1).")
    return result


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    if not math.isfinite(args.delay) or args.delay < 0 or args.delay > 60 or (args.limit is not None and args.limit < 1):
        parser().error("--delay must be 0–60 and --limit must be positive.")
    try:
        requested = {normalize_symbol(x) for x in args.symbols.split(",")} if args.symbols else None
        with import_lock():
            if args.constituents_csv:
                members = load_constituents_csv(args.constituents_csv)
                source = "Local constituent CSV"
                full_snapshot = args.full_snapshot
            else:
                members = fetch_sp500_constituents()
                source = SP500_SOURCE_URL
                full_snapshot = True
            # Resolve provider aliases explicitly; do not guess arbitrary ticker changes.
            available = {member.symbol for member in members}
            from app.market.catalog_sources import yahoo_symbol
            aliases = {yahoo_symbol(member.symbol): member.symbol for member in members}
            if requested is not None:
                requested = {aliases.get(symbol, symbol) for symbol in requested}
                if requested - available:
                    raise CatalogSourceError("Requested symbol is not present in the supplied S&P 500 roster.")
            with Session(engine) as db, db.begin():
                symbols = sync_members(db, members, source=source, synced_at=datetime.now(UTC), full_snapshot=full_snapshot)
            print(f"Catalog saved: {len(members)} securities / {len({m.cik for m in members})} companies.", flush=True)
            if args.catalog_only:
                print("Profile enrichment skipped; no prices were imported.", flush=True)
                return 0
            selected = [s for s in symbols if requested is None or s in requested]
            if args.only_missing:
                with Session(engine) as db:
                    selected = [s for s in selected if needs_profile(db, s)]
            if args.limit is not None:
                selected = selected[:args.limit]
            success = 0
            consecutive_failures = 0
            failed = []
            for index, symbol in enumerate(selected):
                if index:
                    time.sleep(args.delay)
                try:
                    profile = fetch_profile(symbol)
                    with Session(engine) as db, db.begin():
                        apply_profile(db, symbol, profile, synced_at=datetime.now(UTC))
                    success += 1
                    consecutive_failures = 0
                    print(f"[{index + 1}/{len(selected)}] {symbol}: profile saved", flush=True)
                except CatalogSourceError as exc:
                    failed.append(symbol)
                    consecutive_failures += 1
                    print(f"[{index + 1}/{len(selected)}] {symbol}: {exc}", file=sys.stderr, flush=True)
                except SQLAlchemyError:
                    failed.append(symbol)
                    consecutive_failures += 1
                    print(f"[{index + 1}/{len(selected)}] {symbol}: profile could not be saved; prior data retained.", file=sys.stderr, flush=True)
                if consecutive_failures >= 5:
                    print("Stopping after five consecutive profile failures; rerun when the provider is available.", file=sys.stderr, flush=True)
                    break
            remaining = len(selected) - success - len(failed)
            print(f"Profiles saved: {success}; failed: {len(failed)}; not attempted: {remaining}. No prices were imported.", flush=True)
            if failed:
                print("Retry with --symbols " + ",".join(failed), file=sys.stderr, flush=True)
            if remaining:
                print("Rerun the original command to refresh unattempted profiles; use --only-missing only to resume initial enrichment.", file=sys.stderr, flush=True)
            return 1 if failed or remaining else 0
    except (CatalogSourceError, ValueError, OSError) as exc:
        print(f"Catalog import stopped: {exc}", file=sys.stderr)
        return 1
    except SQLAlchemyError:
        print("Catalog import stopped: database unavailable or schema out of date. Run alembic upgrade head.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Import interrupted. Completed records are retained; rerun with --only-missing to resume.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
