| Package           | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| FastAPI           | Defines API endpoints and validates requests                      |
| SQLAlchemy        | Handles database connections, queries, and Python database models |
| Psycopg           | Provides the PostgreSQL driver SQLAlchemy uses                    |
| Pydantic Settings | Loads and validates configuration                                 |

| URL                                                | Purpose                        |
| -------------------------------------------------- | ------------------------------ |
| [Interactive API docs](http://127.0.0.1:8000/docs) | Explore and test endpoints     |
| [API health](http://127.0.0.1:8000/health)         | Verify FastAPI is running      |
| [Database health](http://127.0.0.1:8000/health/db) | Verify the database connection |

For Database management, run these commands from your project’s root:
| Command                                           | Purpose                                |
| ------------------------------------------------- | -------------------------------------- |
| `docker compose up -d --wait db`                  | Start PostgreSQL                       |
| `docker compose logs db`                          | Inspect database logs                  |
| `docker compose stop db`                          | Stop PostgreSQL while keeping its data |
| `docker compose exec db psql -U appuser -d appdb` | Open the database’s SQL terminal       |

pyproject.toml to see dependencies