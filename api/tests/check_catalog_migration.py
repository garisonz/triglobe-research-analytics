"""Opt-in PostgreSQL migration verification in an isolated temporary schema.

Run from api/: uv run python -m tests.check_catalog_migration
The configured database's application tables are never modified.
"""
import os
import subprocess
import sys
from uuid import UUID, uuid4

from sqlalchemy import text

from app.database import engine

schema = "catalog_verify_" + uuid4().hex
environment = {**os.environ, "PGOPTIONS": f"-c search_path={schema}"}


def alembic(*args):
    result = subprocess.run([sys.executable, "-m", "alembic", *args], env=environment, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    print(result.stdout.strip() or f"alembic {' '.join(args)}: OK", flush=True)


def main():
    if engine.dialect.name != "postgresql":
        raise RuntimeError("This check requires PostgreSQL.")
    with engine.begin() as db:
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        alembic("upgrade", "c91f4b63a8e2")
        with engine.begin() as db:
            db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            db.execute(text("INSERT INTO instruments (symbol,name,asset_type,data_source) VALUES ('BRK-B','Berkshire','EQUITY','Migration fixture')"))
            db.execute(text("INSERT INTO candles (symbol,interval,time,open,high,low,close,volume) VALUES ('BRK-B','1d','2026-09-25T04:00:00Z',100,103,99,101,1000)"))
        alembic("upgrade", "head")
        with engine.begin() as db:
            db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            instrument_id = db.scalar(text("SELECT id FROM instruments WHERE symbol='BRK-B'"))
            assert isinstance(instrument_id, UUID)
            assert db.scalar(text("SELECT data_source FROM instruments")) == "Migration fixture"
            assert db.scalar(text("SELECT count(*) FROM candles")) == 1
            db.execute(text("UPDATE instruments SET symbol='BRK.B' WHERE symbol='BRK-B'"))
            assert db.scalar(text("SELECT symbol FROM candles")) == "BRK.B"
            assert db.scalar(text("SELECT id FROM instruments")) == instrument_id
        alembic("check")
        alembic("downgrade", "c91f4b63a8e2")
        with engine.begin() as db:
            db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            assert db.scalar(text("SELECT count(*) FROM candles")) == 1
            assert db.scalar(text("SELECT symbol FROM instruments")) == "BRK.B"
        print("Existing prices, stable IDs, ticker cascade, schema alignment and downgrade verified.", flush=True)
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


if __name__ == "__main__":
    main()
