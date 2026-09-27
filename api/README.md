# Triglobe API

FastAPI, SQLAlchemy, and PostgreSQL backend for account sessions and stored
historical stock/ETF charts. Market storage and chart endpoints are independent
of a particular data provider.

The company catalog can import S&P 500 identities and company profiles using
yfinance. **Historical prices still require a separate import adapter.**
Migrations create tables but do not fetch data. There is no scheduled ingestion
job or live quote endpoint. See the company catalog commands below.

## Local setup

Use Python 3.14 or later, uv, and Docker with Compose. Run these commands in
Linux or WSL.

For a new environment, copy `.env.example` to `.env` inside `api/` and choose a
local database password. Preserve an existing `.env`. Both PostgreSQL in Compose
and the API read this configuration.

From the repository root:

```sh
docker compose up -d db
cd api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`; interactive API documentation is at
`/docs`. Check `GET /health` for the process and `GET /health/db` for database
connectivity.

The React development server proxies `/api` to this backend. Paths below omit
that browser proxy prefix: `/api/market/instruments` in the browser reaches the
backend's `/market/instruments` route.

## Configuration

`app/config.py` loads `api/.env`; environment variables override file values.

- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are required.
- `POSTGRES_HOST` defaults to `127.0.0.1`; `POSTGRES_PORT` defaults to `5432`.
- `AUTH_COOKIE_SECURE=false` is for local HTTP development. Use `true` with
  production HTTPS.
- `AUTH_SESSION_HOURS` defaults to eight hours.
- `AUTH_ALLOWED_ORIGINS` is a JSON list of trusted browser origins.

Keep local environment files out of source control. The application needs no
market-data credentials to serve previously stored history.


## S&P 500 company catalog

The catalog separates an issuer (`companies`) from its traded share classes
(`instruments`). A company has a permanent UUID and a unique, zero-padded SEC CIK.
Each instrument has its own permanent UUID, canonical ticker, explicit Yahoo ticker
(e.g. `BRK.B` / `BRK-B`), company reference, exchange, currency, and current
S&P 500 membership flag. New portfolio references should use `instruments.id`.

yfinance supplies company names, exchange/currency, sector, industry, business
description, website, and country. Membership, CIK, and GICS classifications come
from the [Wikipedia constituent table](https://en.wikipedia.org/wiki/List_of_S%26P_500_companies),
not from yfinance. This is a community-maintained reference, not an official
S&P constituent feed or an SEC-verified identity service. The importer records
its source and observation time; it does not claim historical index membership
or effective dates. Yahoo sector/industry and GICS classifications are retained
separately.

From `api/`, with the Docker database running:

```sh
uv sync
uv run alembic upgrade head
uv run python -m app.market.sync_catalog
```

This command imports the complete reference catalog atomically, then enriches
profiles one security at a time. It uses bounded retries, a one-second pause
between profiles, and a database advisory lock to prevent simultaneous CLI
imports. Five consecutive profile failures stop enrichment. Successful records
remain saved; a nonzero exit status reports incomplete work. Profile requests
can take time because yfinance performs several HTTP requests internally.

Useful variations:

```sh
# Import membership/identifiers without contacting Yahoo:
uv run python -m app.market.sync_catalog --catalog-only

# Resume initial enrichment, skipping successful profiles:
uv run python -m app.market.sync_catalog --only-missing

# Refresh selected profiles (both BRK.B and BRK-B are accepted):
uv run python -m app.market.sync_catalog --symbols AAPL,MSFT,BRK.B

# Import the full reference list but enrich only five profiles:
uv run python -m app.market.sync_catalog --limit 5
```

For offline reference input, supply a UTF-8 CSV with this header:

```csv
symbol,name,cik,gics_sector,gics_sub_industry
AAPL,Apple Inc.,0000320193,Information Technology,Technology Hardware Storage & Peripherals
```

Run `uv run python -m app.market.sync_catalog --constituents-csv /path/to/constituents.csv`.
A partial CSV adds/updates listed members but never marks absent members as removed.
Use `--full-snapshot` only with a complete roster: replacement requires 450–550
distinct securities and at least 450 distinct CIKs. The default downloaded roster
has the same guard. `--limit` and `--symbols` restrict Yahoo enrichment only,
never the membership snapshot.

Reruns retain UUIDs. Multiple share classes sharing a CIK map to the same company.
Departing members are marked `is_sp500=false`; company, instrument and price
records remain. The importer corrects known Yahoo punctuation while preserving
instrument IDs and cascading ticker corrections to candles. It does not guess
ticker renames or mergers from a shared CIK. Conflicting issuer mappings stop
the reference transaction for manual reconciliation.

`catalog_synced_at` describes the reference refresh; company
`profile_synced_at` describes successful Yahoo profile enrichment. These do not
change the historical-price `last_synced_at` or `data_source`. Missing optional
profile fields preserve previously stored values. No prices, quotes, filings,
portfolio records, or scheduled jobs are created by this command.

### Catalog API and app

All catalog endpoints require the existing application session:

| Method and path | Result |
| --- | --- |
| `GET /market/catalog?q=apple&sector=Technology&limit=24&offset=0` | Search by company name/canonical ticker/Yahoo alias, sector filter, pagination, total, and sector choices |
| `GET /market/catalog?sp500_only=false` | Include retained former constituents |
| `GET /market/catalog/BRK.B` | Company profile, identifiers, membership, and history count; `BRK-B` is also accepted |

The default universe is current S&P 500 members. The limit defaults to 50 and
is bounded to 1–100. These endpoints read PostgreSQL only; they never contact
Yahoo or Wikipedia during a page request.

Research home provides company search, sector filtering, and pagination.
Stock pages display the company overview even when no prices have been imported.
In pgAdmin, refresh `appdb → Schemas → public → Tables` to inspect
`companies` and the expanded `instruments` table.

[yfinance](https://github.com/ranaroussi/yfinance) is an unofficial Yahoo client,
and its documentation describes Yahoo data access as intended for personal use.
This integration is suitable for development/research; confirm suitable data
rights before a public or commercial launch.

### Catalog verification

Offline regression coverage is included in the normal backend test command.
To additionally verify migration upgrade/downgrade and price preservation on
PostgreSQL, run:

```sh
uv run python -m tests.check_catalog_migration
```

This creates and removes an isolated temporary schema in the configured database.
It requires schema creation permissions and does not modify application tables.

## Historical storage

The `instruments` table records a symbol, name, asset type, optional exchange,
data source, creation time, and last synchronization time. The `candles` table
stores daily open, high, low, close, and volume (OHLCV) with timestamps.

Candles are unique by `(symbol, interval, time)`, with `1d` currently the only
supported interval. Decimal price columns retain precision. Database constraints
reject negative volume, invalid price ranges, and unsupported intervals.

`app/market/ingestion.py` contains reusable validation and persistence functions:

- `normalize_symbol` normalizes stock/ETF tickers.
- `validate_candles` validates normalized daily bars, rejects future timestamps, excludes
  today's unfinished New York session, orders bars, and resolves duplicate
  timestamps using the last supplied correction.
- `save_history` upserts instrument metadata and candles, updating corrected
  values without adding duplicates. The caller owns the database transaction, so
  it can roll back the whole instrument update on failure.

A future provider adapter must supply instrument metadata with its
`data_source`, plus normalized OHLCV data. The validator currently expects a
payload with `symbol` and a `candles` list; each input candle contains
`datetime` as Unix milliseconds and `open`, `high`, `low`, `close`, and
integer `volume`. It returns database-ready rows with UTC timestamps.

The adapter must handle provider access, pagination, request limits, and daily
timestamp conventions before passing data to these helpers. Select a source
whose terms permit the intended public display and retained research data.
A hosted chart widget does not, by itself, populate these database tables.

## Historical data API

Both market endpoints require an active Triglobe session cookie. The existing
account routes are `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
and `POST /auth/logout`.

| Method and path | Result |
| --- | --- |
| `GET /market/instruments` | Stored instruments with names, asset types, exchanges, last sync times, and candle counts |
| `GET /market/history/{symbol}?range=1y` | Chronological completed daily candles from PostgreSQL |

History ranges are `1m`, `3m`, `6m`, `1y` (default), `5y`, and `all`.
Calendar ranges are relative to today's date in America/New_York and clamp to
the destination month's last day when needed.

The history response contains `instrument`, `interval`, `range`, `candles`,
`source`, and `last_synced_at`. The source comes from the stored instrument.
Each candle has `time`, `open`, `high`, `low`, `close`, and `volume`.
Timestamps include a UTC offset; daily chart dates use America/New_York.

An unknown symbol returns 404. Invalid symbols or unsupported ranges return
422. A stored instrument without candles returns an empty candle array.
Without an active application session, requests return 401.

These endpoints read the database; loading a chart never fetches prices from an
external provider. With no imported data, the instruments list is empty.

## Checks

From `api/`:

```sh
uv run python -m unittest discover -s tests -p 'test_*.py'
uv run alembic check
```

Unit tests use isolated SQLite storage and synthetic market fixtures. They
exercise application sessions, candle validation, persistence, and historical
API behavior without contacting a market-data provider or modifying the
development database. `alembic check` separately checks the configured database
for model/migration drift; apply migrations before running it.

Frontend browser tests run with `npm test` from `client/` after installing its
dependencies and Playwright browser. They start the isolated
`tests.auth_server` backend and a separate Vite server.
