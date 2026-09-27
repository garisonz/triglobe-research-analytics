"""Catalog persistence. All functions leave transaction ownership to the caller."""
from datetime import datetime

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.market.catalog_sources import CatalogSourceError, Constituent, yahoo_symbol
from app.market.ingestion import normalize_symbol
from app.market.models import Company, Instrument

PROFILE_SOURCE = "Yahoo Finance via yfinance"


def sync_members(
    db: Session, members: list[Constituent], *, source: str,
    synced_at: datetime, full_snapshot: bool = False,
) -> list[str]:
    """Upsert issuer/security identity atomically, retaining former members.

    A small CSV can add/update members but cannot remove membership. Only a
    validated complete snapshot can mark absent securities as former members.
    Never guess ticker changes from CIK: multiple share classes share a CIK.
    """
    if not members:
        raise CatalogSourceError("The constituent list is empty.")
    symbols = [normalize_symbol(member.symbol) for member in members]
    aliases = [yahoo_symbol(symbol) for symbol in symbols]
    if len(set(symbols)) != len(symbols) or len(set(aliases)) != len(aliases):
        raise CatalogSourceError("Duplicate or ambiguous symbols in constituent list.")
    for member in members:
        if (len(member.cik) != 10 or not member.cik.isascii()
                or not member.cik.isdigit() or int(member.cik) == 0):
            raise CatalogSourceError("Every constituent needs a valid ten-digit CIK.")
        if not member.name.strip() or len(member.name) > 255:
            raise CatalogSourceError("Every constituent needs a valid company name.")
    if full_snapshot and not (450 <= len(symbols) <= 550 and len({m.cik for m in members}) >= 450):
        raise CatalogSourceError("Refusing to replace membership with an incomplete S&P 500 snapshot.")

    for member, symbol, alias in zip(members, symbols, aliases):
        company = db.scalar(select(Company).where(Company.cik == member.cik))
        if company is None:
            company = Company(cik=member.cik, name=member.name, reference_source=source)
            db.add(company)
            db.flush()
        company.reference_source = source
        company.gics_sector = member.gics_sector or company.gics_sector
        company.gics_sub_industry = member.gics_sub_industry or company.gics_sub_industry
        if company.profile_synced_at is None:
            company.name = member.name
        candidates = db.scalars(select(Instrument).where(or_(
            Instrument.symbol == symbol,
            Instrument.symbol == alias,
            Instrument.yahoo_symbol == alias,
        ))).all()
        if len(candidates) > 1:
            raise CatalogSourceError(f"Conflicting stock identities for {symbol}; reconcile them before importing.")
        instrument = candidates[0] if candidates else None
        if instrument is None:
            instrument = Instrument(
                symbol=symbol, name=member.name, asset_type="EQUITY",
                company_id=company.id,
            )
            db.add(instrument)
        elif instrument.asset_type != "EQUITY":
            raise CatalogSourceError(f"{symbol} already exists as a non-equity instrument.")
        elif instrument.company_id is not None and instrument.company_id != company.id:
            raise CatalogSourceError(f"CIK changed for {symbol}; review issuer identity before importing.")
        # Known provider punctuation correction, not a guessed ticker rename.
        # The database FK cascades this change to existing price rows.
        instrument.symbol = symbol
        instrument.company_id = company.id
        instrument.yahoo_symbol = alias
        instrument.is_sp500 = True
        instrument.catalog_synced_at = synced_at
        if instrument.currency is None:
            instrument.name = member.name
        db.flush()

    if full_snapshot:
        db.execute(update(Instrument).where(
            Instrument.is_sp500.is_(True), Instrument.symbol.not_in(symbols),
        ).values(is_sp500=False, catalog_synced_at=synced_at))
    return symbols


def apply_profile(db: Session, symbol: str, profile: dict, *, synced_at: datetime) -> None:
    """Store validated yfinance profile data, preserving absent optional fields."""
    instrument = db.get(Instrument, symbol)
    if instrument is None or instrument.company_id is None:
        raise CatalogSourceError(f"{symbol} has no catalog identity.")
    company = db.get(Company, instrument.company_id)
    limits = {
        "name": 255, "exchange": 80, "currency": 10, "sector": 120,
        "industry": 160, "website": 500, "country": 120,
    }
    for key, limit in limits.items():
        value = profile.get(key)
        if value is not None and (not isinstance(value, str) or len(value) > limit):
            raise CatalogSourceError(f"Invalid {key} in profile for {symbol}.")
    if not profile.get("name") or not profile.get("currency"):
        raise CatalogSourceError(f"Incomplete profile for {symbol}.")
    if profile.get("description") is not None and not isinstance(profile["description"], str):
        raise CatalogSourceError(f"Invalid description in profile for {symbol}.")
    instrument.name = profile["name"]
    instrument.currency = profile["currency"]
    if profile.get("exchange"):
        instrument.exchange = profile["exchange"]
    for key in ("name", "sector", "industry", "description", "website", "country"):
        if profile.get(key):
            setattr(company, key, profile[key])
    company.profile_source = PROFILE_SOURCE
    company.profile_synced_at = synced_at
    # Catalog/profile work must never claim that prices were refreshed.


def needs_profile(db: Session, symbol: str) -> bool:
    instrument = db.get(Instrument, symbol)
    if instrument is None or instrument.company_id is None:
        return False
    company = db.get(Company, instrument.company_id)
    return instrument.currency is None or company.profile_synced_at is None
