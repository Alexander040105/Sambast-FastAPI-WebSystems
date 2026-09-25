"""
Alembic env.py — configured to load models from app.models and use
DATABASE_URL_DIRECT (unpooled) for migrations per MEGAPLAN §9 Day-0.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Make sure 'backend/' is on sys.path so `import app` works.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load .env so DATABASE_URL_DIRECT is available
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Import ALL models so Base.metadata sees every table
import app.models  # noqa: F401
from app.db.session import Base

config = context.config

# Override sqlalchemy.url from env var (unpooled URL for migrations)
db_url = os.getenv("DATABASE_URL_DIRECT") or os.getenv("DATABASE_URL", "")
if db_url:
    # Use psycopg3 dialect
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
