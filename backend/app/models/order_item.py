"""order_items — line items inside an order."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, func,
)

from app.db.session import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(
        BigInteger, ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id = Column(
        BigInteger, ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    quantity = Column(BigInteger, nullable=False)
    selected_unit = Column(String(50), nullable=True)
    unit_multiplier = Column(Numeric(10, 4), nullable=False, default=1)
    base_price_at_time = Column(Numeric(12, 2), nullable=False)
    discount_amount_at_time = Column(Numeric(12, 2), nullable=False, default=0)
    price_at_time = Column(Numeric(12, 2), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
