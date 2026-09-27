from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cik: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    gics_sector: Mapped[str | None] = mapped_column(String(120))
    gics_sub_industry: Mapped[str | None] = mapped_column(String(160))
    sector: Mapped[str | None] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(500))
    country: Mapped[str | None] = mapped_column(String(120))
    reference_source: Mapped[str] = mapped_column(String(500), default="Unknown", server_default="Unknown")
    profile_source: Mapped[str | None] = mapped_column(String(80))
    profile_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Instrument(Base):
    __tablename__ = "instruments"

    # Retain symbol as the legacy key for chart compatibility. New portfolio
    # references should use the permanent, unique id instead.
    symbol: Mapped[str] = mapped_column(String(15), primary_key=True)
    id: Mapped[UUID] = mapped_column(default=uuid4, unique=True)
    company_id: Mapped[UUID | None] = mapped_column(ForeignKey("companies.id"), index=True)
    yahoo_symbol: Mapped[str | None] = mapped_column(String(15), unique=True)
    currency: Mapped[str | None] = mapped_column(String(10))
    is_sp500: Mapped[bool] = mapped_column(default=False, server_default=false())
    catalog_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    name: Mapped[str] = mapped_column(String(255))
    asset_type: Mapped[str] = mapped_column(String(20))
    exchange: Mapped[str | None] = mapped_column(String(80))
    # These two fields describe PRICE imports, not profile/catalog imports.
    data_source: Mapped[str] = mapped_column(String(80), default="Unknown", server_default="Unknown")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Candle(Base):
    __tablename__ = "candles"
    __table_args__ = (
        CheckConstraint("interval = '1d'", name="ck_candles_daily_interval"),
        CheckConstraint("volume >= 0", name="ck_candles_nonnegative_volume"),
        CheckConstraint(
            "low >= 0 AND high >= low AND open >= low AND open <= high "
            "AND close >= low AND close <= high",
            name="ck_candles_valid_ohlc",
        ),
    )

    symbol: Mapped[str] = mapped_column(
        ForeignKey("instruments.symbol", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    interval: Mapped[str] = mapped_column(String(8), primary_key=True, default="1d")
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    open: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    high: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    low: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    close: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    volume: Mapped[int] = mapped_column(BigInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
