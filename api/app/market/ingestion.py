"""Validate normalized daily bars and persist one instrument atomically."""
import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.market.models import Candle, Instrument

NEW_YORK = ZoneInfo("America/New_York")
SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9.-]{0,14}$")


class MarketDataError(Exception):
    """A safe, non-secret provider or data validation message."""


def normalize_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if not SYMBOL_PATTERN.fullmatch(value):
        raise ValueError("Use a stock or ETF ticker such as AAPL, SPY, or BRK.B.")
    return value


def validate_candles(symbol: str, payload: dict, *, now: datetime) -> list[dict]:
    if payload.get("symbol") != symbol or not isinstance(payload.get("candles"), list):
        raise MarketDataError(f"Unexpected price-history response for {symbol}.")
    if payload.get("empty") is True:
        raise MarketDataError(f"No price history was returned for {symbol}.")

    today = now.astimezone(NEW_YORK).date()
    rows: dict[datetime, dict] = {}
    for raw in payload["candles"]:
        try:
            if not isinstance(raw, dict):
                raise ValueError()
            timestamp = raw["datetime"]
            if isinstance(timestamp, bool) or not isinstance(timestamp, int):
                raise ValueError()
            instant = datetime.fromtimestamp(timestamp / 1000, UTC)
            if instant.year < 1970 or instant > now:
                raise ValueError()
            # Current-session daily bars can still change. Only store prior sessions.
            if instant.astimezone(NEW_YORK).date() >= today:
                continue
            prices = {}
            for field in ("open", "high", "low", "close"):
                value = raw[field]
                if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
                    raise ValueError()
                price = Decimal(str(value))
                if not price.is_finite() or price < 0 or price >= Decimal("1000000000000"):
                    raise ValueError()
                prices[field] = price
            if not (
                prices["low"] <= prices["open"] <= prices["high"]
                and prices["low"] <= prices["close"] <= prices["high"]
            ):
                raise ValueError()
            volume = raw["volume"]
            if isinstance(volume, bool) or not isinstance(volume, int) or not 0 <= volume < 2**63:
                raise ValueError()
        except (ValueError, KeyError, TypeError, OverflowError, OSError, InvalidOperation):
            raise MarketDataError(f"Invalid daily candle returned for {symbol}.") from None
        rows[instant] = {
            "symbol": symbol, "interval": "1d", "time": instant,
            **prices, "volume": volume, "updated_at": now,
        }
    if not rows:
        raise MarketDataError(f"No completed daily candles were returned for {symbol}.")
    return [rows[key] for key in sorted(rows)]


def save_history(db: Session, instrument: dict, candles: list[dict], *, synced_at: datetime) -> int:
    """Caller owns the transaction. Conflict updates also pick up corrected bars."""
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        insert = postgres_insert
    elif dialect == "sqlite":
        insert = sqlite_insert
    else:
        raise ValueError("Historical ingestion supports PostgreSQL and SQLite test databases.")

    details = {**instrument, "last_synced_at": synced_at}
    statement = insert(Instrument).values(**details)
    db.execute(statement.on_conflict_do_update(
        index_elements=["symbol"],
        set_={key: getattr(statement.excluded, key) for key in details if key != "symbol"},
    ))
    # Bound SQL parameter counts and memory for multi-year histories.
    for offset in range(0, len(candles), 200):
        statement = insert(Candle).values(candles[offset:offset + 200])
        db.execute(statement.on_conflict_do_update(
            index_elements=["symbol", "interval", "time"],
            set_={
                field: getattr(statement.excluded, field)
                for field in ("open", "high", "low", "close", "volume", "updated_at")
            },
        ))
    return len(candles)

