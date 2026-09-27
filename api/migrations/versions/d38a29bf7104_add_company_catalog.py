"""Add company identities and catalog metadata without replacing price history.

Revision ID: d38a29bf7104
Revises: c91f4b63a8e2
"""
from alembic import op
import sqlalchemy as sa

revision = "d38a29bf7104"
down_revision = "c91f4b63a8e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("cik", sa.String(10), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("gics_sector", sa.String(120)),
        sa.Column("gics_sub_industry", sa.String(160)),
        sa.Column("sector", sa.String(120)),
        sa.Column("industry", sa.String(160)),
        sa.Column("description", sa.Text()),
        sa.Column("website", sa.String(500)),
        sa.Column("country", sa.String(120)),
        sa.Column("reference_source", sa.String(500), nullable=False, server_default="Unknown"),
        sa.Column("profile_source", sa.String(80)),
        sa.Column("profile_synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("cik", name="uq_companies_cik"),
    )
    op.add_column("instruments", sa.Column("id", sa.Uuid(), nullable=True))
    op.execute("UPDATE instruments SET id = gen_random_uuid() WHERE id IS NULL")
    op.alter_column("instruments", "id", nullable=False)
    op.create_unique_constraint("uq_instruments_id", "instruments", ["id"])
    op.add_column("instruments", sa.Column("company_id", sa.Uuid()))
    op.create_foreign_key("fk_instruments_company_id", "instruments", "companies", ["company_id"], ["id"])
    op.create_index("ix_instruments_company_id", "instruments", ["company_id"])
    op.add_column("instruments", sa.Column("yahoo_symbol", sa.String(15)))
    op.create_unique_constraint("uq_instruments_yahoo_symbol", "instruments", ["yahoo_symbol"])
    op.add_column("instruments", sa.Column("currency", sa.String(10)))
    op.add_column("instruments", sa.Column("is_sp500", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("instruments", sa.Column("catalog_synced_at", sa.DateTime(timezone=True)))
    # Preserve candle rows when an explicit, verified ticker correction is made.
    op.drop_constraint("candles_symbol_fkey", "candles", type_="foreignkey")
    op.create_foreign_key("candles_symbol_fkey", "candles", "instruments", ["symbol"], ["symbol"], ondelete="CASCADE", onupdate="CASCADE")


def downgrade() -> None:
    op.drop_constraint("candles_symbol_fkey", "candles", type_="foreignkey")
    op.create_foreign_key("candles_symbol_fkey", "candles", "instruments", ["symbol"], ["symbol"], ondelete="CASCADE")
    op.drop_column("instruments", "catalog_synced_at")
    op.drop_column("instruments", "is_sp500")
    op.drop_column("instruments", "currency")
    op.drop_constraint("uq_instruments_yahoo_symbol", "instruments", type_="unique")
    op.drop_column("instruments", "yahoo_symbol")
    op.drop_index("ix_instruments_company_id", table_name="instruments")
    op.drop_constraint("fk_instruments_company_id", "instruments", type_="foreignkey")
    op.drop_column("instruments", "company_id")
    op.drop_constraint("uq_instruments_id", "instruments", type_="unique")
    op.drop_column("instruments", "id")
    op.drop_table("companies")
