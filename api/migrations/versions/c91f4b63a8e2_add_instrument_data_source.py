"""Record the source of historical market data.

Revision ID: c91f4b63a8e2
Revises: a74c1d9e8302
"""
from alembic import op
import sqlalchemy as sa

revision = "c91f4b63a8e2"
down_revision = "a74c1d9e8302"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "instruments",
        sa.Column("data_source", sa.String(80), nullable=False, server_default="Unknown"),
    )


def downgrade() -> None:
    op.drop_column("instruments", "data_source")
