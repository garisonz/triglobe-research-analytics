"""Authenticated company-catalog reads; provider requests belong in the import job."""
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.market.ingestion import normalize_symbol
from app.market.models import Candle, Company, Instrument

router = APIRouter(
    prefix="/market/catalog",
    tags=["Company Catalog"],
    dependencies=[Depends(get_current_user)],
)
DatabaseSession = Annotated[Session, Depends(get_db)]


class CatalogInstrument(BaseModel):
    id: UUID
    company_id: UUID
    cik: str
    symbol: str
    yahoo_symbol: str | None
    name: str
    exchange: str | None
    currency: str | None
    sector: str | None
    industry: str | None
    gics_sector: str | None
    gics_sub_industry: str | None
    is_sp500: bool
    catalog_synced_at: datetime | None
    profile_synced_at: datetime | None
    candle_count: int

    @field_validator("catalog_synced_at", "profile_synced_at")
    @classmethod
    def utc_timestamp(cls, value: datetime | None) -> datetime | None:
        # SQLite drops offsets in tests; PostgreSQL preserves timezone information.
        return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


class CatalogList(BaseModel):
    instruments: list[CatalogInstrument]
    total: int
    sectors: list[str]


class CatalogDetail(CatalogInstrument):
    description: str | None
    website: str | None
    country: str | None


def catalog_query():
    counts = (
        select(Candle.symbol, func.count().label("candle_count"))
        .where(Candle.interval == "1d")
        .group_by(Candle.symbol)
        .subquery()
    )
    return (
        select(Instrument, Company, func.coalesce(counts.c.candle_count, 0))
        .join(Company, Company.id == Instrument.company_id)
        .outerjoin(counts, counts.c.symbol == Instrument.symbol)
    )


def catalog_fields(instrument: Instrument, company: Company, count: int) -> dict:
    return {
        "id": instrument.id,
        "company_id": company.id,
        "cik": company.cik,
        "symbol": instrument.symbol,
        "yahoo_symbol": instrument.yahoo_symbol,
        "name": instrument.name,
        "exchange": instrument.exchange,
        "currency": instrument.currency,
        "sector": company.sector if company.sector is not None else company.gics_sector,
        "industry": company.industry if company.industry is not None else company.gics_sub_industry,
        "gics_sector": company.gics_sector,
        "gics_sub_industry": company.gics_sub_industry,
        "is_sp500": instrument.is_sp500,
        "catalog_synced_at": instrument.catalog_synced_at,
        "profile_synced_at": company.profile_synced_at,
        "candle_count": count,
    }


@router.get("", response_model=CatalogList)
def catalog(
    db: DatabaseSession,
    q: Annotated[str | None, Query(max_length=255)] = None,
    sector: Annotated[str | None, Query(max_length=255)] = None,
    sp500_only: bool = True,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CatalogList:
    effective_sector = func.coalesce(Company.sector, Company.gics_sector)
    filters = [Instrument.company_id.is_not(None)]
    if sp500_only:
        filters.append(Instrument.is_sp500.is_(True))
    # Sector choices describe the selected universe, independent of pagination/search.
    sectors = db.scalars(
        select(effective_sector)
        .select_from(Instrument)
        .join(Company, Company.id == Instrument.company_id)
        .where(*filters, effective_sector.is_not(None))
        .distinct()
        .order_by(effective_sector)
    ).all()
    if q and q.strip():
        # contains(autoescape=True) treats '%' and '_' as literal user text.
        needle = q.strip().lower()
        filters.append(or_(
            func.lower(Instrument.symbol).contains(needle, autoescape=True),
            func.lower(Instrument.yahoo_symbol).contains(needle, autoescape=True),
            func.lower(Instrument.name).contains(needle, autoescape=True),
            func.lower(Company.name).contains(needle, autoescape=True),
        ))
    if sector is not None:
        filters.append(effective_sector == sector)
    total = db.scalar(
        select(func.count())
        .select_from(Instrument)
        .join(Company, Company.id == Instrument.company_id)
        .where(*filters)
    )
    rows = db.execute(
        catalog_query().where(*filters).order_by(Instrument.symbol).limit(limit).offset(offset)
    ).all()
    return CatalogList(
        instruments=[CatalogInstrument(**catalog_fields(*row)) for row in rows],
        total=total or 0,
        sectors=list(sectors),
    )


@router.get("/{symbol}", response_model=CatalogDetail)
def catalog_detail(symbol: str, db: DatabaseSession) -> CatalogDetail:
    try:
        symbol = normalize_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    row = db.execute(
        catalog_query().where(or_(Instrument.symbol == symbol, Instrument.yahoo_symbol == symbol))
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="This symbol is not in the company catalog.")
    instrument, company, count = row
    return CatalogDetail(
        **catalog_fields(instrument, company, count),
        description=company.description,
        website=company.website,
        country=company.country,
    )
