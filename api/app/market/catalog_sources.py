"""Reference-data providers for the company catalog; never imports price history."""

import csv
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SP500_SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
SOURCE_NAME = "Wikipedia S&P 500 constituents"
_ATTEMPTS = 3
_MAX_DOWNLOAD_BYTES = 5_000_000
_SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9.-]{0,14}$")
_CSV_FIELDS = ("symbol", "name", "cik", "gics_sector", "gics_sub_industry")
_HTML_FIELDS = ("Symbol", "Security", "CIK", "GICS Sector", "GICS Sub-Industry")


class CatalogSourceError(Exception):
    """A provider or input error safe to include in command output."""


@dataclass(frozen=True)
class Constituent:
    symbol: str
    name: str
    cik: str
    gics_sector: str
    gics_sub_industry: str


def yahoo_symbol(symbol: str) -> str:
    """Map known canonical class separators without rewriting genuine hyphens."""
    return symbol.strip().upper().replace(".", "-")


def _constituent(raw: dict, row_number: int) -> Constituent:
    values = {}
    for field in _CSV_FIELDS:
        value = raw.get(field)
        if not isinstance(value, str) or not value.strip():
            raise CatalogSourceError(f"Missing {field} in constituent row {row_number}.")
        values[field] = " ".join(value.split())
    values["symbol"] = values["symbol"].upper()
    if not _SYMBOL_PATTERN.fullmatch(values["symbol"]):
        raise CatalogSourceError(f"Invalid symbol in constituent row {row_number}.")
    cik = values["cik"]
    if not re.fullmatch(r"[0-9]{1,10}", cik) or int(cik) == 0:
        raise CatalogSourceError(f"Invalid CIK in constituent row {row_number}.")
    values["cik"] = cik.zfill(10)
    return Constituent(**values)


def _validate_roster(rows: list[Constituent], *, full_roster: bool) -> list[Constituent]:
    if not rows:
        raise CatalogSourceError("The constituent source contains no securities.")
    canonical_seen = set()
    yahoo_seen = set()
    for row in rows:
        mapped = yahoo_symbol(row.symbol)
        if row.symbol in canonical_seen or mapped in yahoo_seen:
            raise CatalogSourceError(f"Duplicate constituent or Yahoo symbol: {row.symbol}.")
        canonical_seen.add(row.symbol)
        yahoo_seen.add(mapped)
    if full_roster and not (
        450 <= len(rows) <= 550 and len({row.cik for row in rows}) >= 450
    ):
        raise CatalogSourceError("Downloaded S&P 500 roster is incomplete or unexpectedly sized.")
    return rows


class _ConstituentsParser(HTMLParser):
    """Read only the constituents table, ignoring unrelated tables and footnotes."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.tables_found = 0
        self._table_depth = 0
        self._row = None
        self._cell = None
        self._sup_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            if self._table_depth:
                self._table_depth += 1
            elif dict(attrs).get("id") == "constituents":
                self.tables_found += 1
                self._table_depth = 1
            return
        if self._table_depth != 1:
            return
        if tag == "tr":
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell = []
        elif tag == "sup" and self._cell is not None:
            self._sup_depth += 1
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")

    def handle_endtag(self, tag):
        if tag == "table" and self._table_depth:
            self._table_depth -= 1
            return
        if self._table_depth != 1:
            return
        if tag == "sup" and self._sup_depth:
            self._sup_depth -= 1
        elif tag in {"th", "td"} and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
            self._sup_depth = 0
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._table_depth == 1 and self._cell is not None and not self._sup_depth:
            self._cell.append(data)


def _parse_constituents_html(html: str) -> list[Constituent]:
    parser = _ConstituentsParser()
    parser.feed(html)
    parser.close()
    if parser.tables_found != 1 or not parser.rows or parser._table_depth or parser._row is not None:
        raise CatalogSourceError("Expected one complete S&P 500 constituents table.")
    header, *body = parser.rows
    if any(header.count(field) != 1 for field in _HTML_FIELDS):
        raise CatalogSourceError("S&P 500 constituents table has unexpected columns.")
    positions = {target: header.index(source) for target, source in zip(_CSV_FIELDS, _HTML_FIELDS)}
    rows = []
    for number, cells in enumerate(body, start=2):
        if len(cells) != len(header):
            raise CatalogSourceError(f"Malformed S&P 500 constituent row {number}.")
        rows.append(_constituent({key: cells[pos] for key, pos in positions.items()}, number))
    return _validate_roster(rows, full_roster=True)


def fetch_sp500_constituents() -> list[Constituent]:
    """Download and validate a complete roster with finite retries and response size."""
    request = Request(SP500_SOURCE_URL, headers={
        "User-Agent": "TriglobeResearchAnalytics/1.0 (company catalog sync)",
        "Accept": "text/html",
    })
    for attempt in range(_ATTEMPTS):
        try:
            with urlopen(request, timeout=20) as response:
                content = response.read(_MAX_DOWNLOAD_BYTES + 1)
            if len(content) > _MAX_DOWNLOAD_BYTES:
                raise CatalogSourceError("S&P 500 roster response exceeded the size limit.")
            return _parse_constituents_html(content.decode("utf-8"))
        except CatalogSourceError:
            raise
        except UnicodeDecodeError:
            raise CatalogSourceError("S&P 500 roster response was not valid UTF-8.") from None
        except HTTPError as error:
            error.close()
            if error.code != 429 and error.code < 500:
                raise CatalogSourceError(f"S&P 500 roster request failed (HTTP {error.code}).") from None
        except (URLError, TimeoutError, OSError):
            pass
        if attempt < _ATTEMPTS - 1:
            time.sleep(2 ** attempt)
    raise CatalogSourceError("Could not download the S&P 500 roster after 3 attempts.")


def load_constituents_csv(path: str | Path) -> list[Constituent]:
    """Load an explicit local roster or subset; the command decides membership scope."""
    try:
        with Path(path).open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, strict=True)
            if not reader.fieldnames or any(reader.fieldnames.count(field) != 1 for field in _CSV_FIELDS):
                raise CatalogSourceError("Constituent CSV must include symbol,name,cik,gics_sector,gics_sub_industry.")
            rows = []
            for number, raw in enumerate(reader, start=2):
                if None in raw:
                    raise CatalogSourceError(f"Unexpected extra CSV values in constituent row {number}.")
                rows.append(_constituent(raw, number))
    except (OSError, UnicodeError, csv.Error):
        raise CatalogSourceError("Could not read a valid UTF-8 constituent CSV.") from None
    return _validate_roster(rows, full_roster=False)


def _text(info: dict, *keys: str) -> str | None:
    for key in keys:
        value = info.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _normalize_profile(symbol: str, info: dict) -> dict:
    if not isinstance(info, dict) or not info or info.get("error") or info.get("finance"):
        raise CatalogSourceError(f"Yahoo returned an error or empty profile for {symbol}.")
    if info.get("symbol") != yahoo_symbol(symbol) or info.get("quoteType") != "EQUITY":
        raise CatalogSourceError(f"Yahoo returned an unexpected security for {symbol}.")
    name = _text(info, "longName", "shortName")
    currency = _text(info, "currency")
    if not name or not currency:
        raise CatalogSourceError(f"Yahoo returned an incomplete company profile for {symbol}.")
    return {
        "name": name,
        "exchange": _text(info, "fullExchangeName", "exchange"),
        "currency": currency,
        "sector": _text(info, "sector"),
        "industry": _text(info, "industry"),
        "description": _text(info, "longBusinessSummary"),
        "website": _text(info, "website"),
        "country": _text(info, "country"),
    }


def fetch_profile(symbol: str) -> dict:
    """Fetch company metadata with bounded retries; no prices enter the catalog.

    yfinance's public get_info API has no timeout argument. Version 1.7 uses
    30-second HTTP request timeouts internally; a profile can use several requests.
    """
    canonical = symbol.strip().upper()
    if not _SYMBOL_PATTERN.fullmatch(canonical):
        raise CatalogSourceError("Invalid symbol for Yahoo company profile.")
    try:
        import yfinance as yf
    except ImportError:
        raise CatalogSourceError("Install the API dependencies to use Yahoo company profiles.") from None
    last_error = None
    for attempt in range(_ATTEMPTS):
        try:
            info = yf.Ticker(yahoo_symbol(canonical)).get_info()
            return _normalize_profile(canonical, info)
        except CatalogSourceError as error:
            last_error = error
        except Exception:
            # Upstream exception messages can include URLs, tokens or session data.
            last_error = CatalogSourceError(f"Could not retrieve Yahoo company profile for {canonical}.")
        if attempt < _ATTEMPTS - 1:
            time.sleep(2 ** attempt)
    raise last_error from None
