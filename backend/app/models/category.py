"""categories — product groupings ported from legacy."""

from sqlalchemy import BigInteger, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    unit_options = Column(JSONB, nullable=True, comment="e.g. [{label, multiplier}]")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
