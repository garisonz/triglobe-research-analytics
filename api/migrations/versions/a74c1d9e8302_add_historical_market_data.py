"""Add instruments and daily candles.

Revision ID: a74c1d9e8302
Revises: 810a771de154
"""
from alembic import op
import sqlalchemy as sa

revision = "a74c1d9e8302"
down_revision = "810a771de154"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "instruments",
        sa.Column("symbol", sa.String(15), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("exchange", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "candles",
        sa.Column("symbol", sa.String(15), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("interval", sa.String(8), primary_key=True),
        sa.Column("time", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("open", sa.Numeric(20, 8), nullable=False),
        sa.Column("high", sa.Numeric(20, 8), nullable=False),
        sa.Column("low", sa.Numeric(20, 8), nullable=False),
        sa.Column("close", sa.Numeric(20, 8), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("interval = '1d'", name="ck_candles_daily_interval"),
        sa.CheckConstraint("volume >= 0", name="ck_candles_nonnegative_volume"),
        sa.CheckConstraint(
            "low >= 0 AND high >= low AND open >= low AND open <= high "
            "AND close >= low AND close <= high",
            name="ck_candles_valid_ohlc",
        ),
    )


def downgrade() -> None:
    op.drop_table("candles")
    op.drop_table("instruments")
