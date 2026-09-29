"""products — catalog items with weight_kg_per_unit for capacity checks."""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, Numeric,
    String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    category_id = Column(
        BigInteger, ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(50), nullable=True, comment="default selling unit")
    unit_options = Column(JSONB, nullable=True)
    discounts = Column(JSONB, nullable=True)
    weight_kg_per_unit = Column(
        Numeric(10, 3), nullable=True,
        comment="kg per 1 base unit — used by assignment capacity check",
    )
    stock_quantity = Column(BigInteger, default=0)
    image_url = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    purpose = Column(String(100), nullable=True)
    target_species = Column(String(100), nullable=True)
    tags = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
