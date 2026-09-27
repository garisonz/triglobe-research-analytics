from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


HistoryRange = Literal["1m", "3m", "6m", "1y", "5y", "all"]


class InstrumentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    symbol: str
    name: str
    asset_type: str
    exchange: str | None
    last_synced_at: datetime | None

    @field_validator("last_synced_at")
    @classmethod
    def utc_timestamp(cls, value: datetime | None) -> datetime | None:
        # SQLite test storage drops offsets; PostgreSQL preserves them.
        return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


class InstrumentSummary(InstrumentPublic):
    candle_count: int


class InstrumentList(BaseModel):
    instruments: list[InstrumentSummary]


class CandlePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    @field_validator("time")
    @classmethod
    def utc_timestamp(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class HistoryResponse(BaseModel):
    instrument: InstrumentPublic
    interval: Literal["1d"] = "1d"
    range: HistoryRange
    candles: list[CandlePublic]
    source: str
    last_synced_at: datetime | None
