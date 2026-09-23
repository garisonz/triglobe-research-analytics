"""
database.py creates the database connection and session dependency
using sqlalchemy.

- Engine manages reusable database connections.
- Session handles a request's database work and is closed afterward.
- URL.create() handles special characters in credentials without 
  manually constructing a connection string.
"""

from collections.abc import Iterator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import settings

class Base(DeclarativeBase):
    pass

database_url = URL.create(
    drivername="postgresql+psycopg",
    username=settings.postgres_user,
    password=settings.postgres_password.get_secret_value(),
    host=settings.postgres_host,
    port=settings.postgres_port,
    database=settings.postgres_db,
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)


def get_db() -> Iterator[Session]:
    with Session(engine) as session:
        yield session