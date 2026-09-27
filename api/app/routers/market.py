import calendar
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.market.ingestion import NEW_YORK, normalize_symbol
from app.market.models import Candle, Instrument
from app.market.schemas import (
    CandlePublic, HistoryRange, HistoryResponse, InstrumentList,
    InstrumentPublic, InstrumentSummary,
)

router = APIRouter(
    prefix="/market",
    tags=["Market Data"],
    dependencies=[Depends(get_current_user)],
)
DatabaseSession = Annotated[Session, Depends(get_db)]


def checked_symbol(symbol: str) -> str:
    try:
        return normalize_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


def range_start(value: HistoryRange, now: datetime) -> datetime | None:
    months = {"1m": 1, "3m": 3, "6m": 6, "1y": 12, "5y": 60}.get(value)
    if months is None:
        return None
    local = now.astimezone(NEW_YORK)
    year, month_index = divmod(local.year * 12 + local.month - 1 - months, 12)
    month = month_index + 1
    day = min(local.day, calendar.monthrange(year, month)[1])
    return datetime(year, month, day, tzinfo=NEW_YORK).astimezone(UTC)


@router.get("/instruments", response_model=InstrumentList)
def instruments(db: DatabaseSession) -> InstrumentList:
    counts = (
        select(Candle.symbol, func.count().label("candle_count"))
        .where(Candle.interval == "1d")
        .group_by(Candle.symbol)
        .subquery()
    )
    rows = db.execute(
        select(Instrument, func.coalesce(counts.c.candle_count, 0))
        .outerjoin(counts, counts.c.symbol == Instrument.symbol)
        .order_by(Instrument.symbol)
    ).all()
    return InstrumentList(instruments=[
        InstrumentSummary(
            **InstrumentPublic.model_validate(instrument).model_dump(),
            candle_count=count,
        )
        for instrument, count in rows
    ])


@router.get("/history/{symbol}", response_model=HistoryResponse)
def history(
    symbol: str, db: DatabaseSession,
    range: Annotated[HistoryRange, Query()] = "1y",
) -> HistoryResponse:
    symbol = checked_symbol(symbol)
    instrument = db.scalar(select(Instrument).where(or_(Instrument.symbol == symbol, Instrument.yahoo_symbol == symbol)))
    if instrument is None:
        raise HTTPException(status_code=404, detail="This symbol has not been added to the research watchlist.")
    symbol = instrument.symbol
    now = datetime.now(UTC)
    today = now.astimezone(NEW_YORK).replace(hour=0, minute=0, second=0, microsecond=0)
    query = select(Candle).where(
        Candle.symbol == symbol, Candle.interval == "1d", Candle.time < today,
    )
    start = range_start(range, now)
    if start is not None:
        query = query.where(Candle.time >= start)
    candles = db.scalars(query.order_by(Candle.time)).all()
    public = InstrumentPublic.model_validate(instrument)
    return HistoryResponse(
        instrument=public, range=range,
        candles=[CandlePublic.model_validate(candle) for candle in candles],
        last_synced_at=public.last_synced_at, source=instrument.data_source,
    )
