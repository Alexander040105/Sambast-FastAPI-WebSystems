"""orders — the central order entity."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, Text, func,
)

from app.db.session import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_no = Column(String(30), unique=True, nullable=False, index=True)
    customer_id = Column(
        BigInteger, ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    delivery_location_id = Column(
        BigInteger, ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    delivery_window_start = Column(DateTime(timezone=True), nullable=True)
    delivery_window_end = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(30), nullable=False, default="PENDING",
        index=True,
        comment=(
            "PENDING|CONFIRMED|READY_FOR_DISPATCH|ASSIGNED"
            "|OUT_FOR_DELIVERY|COMPLETED|CANCELLED"
        ),
    )
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount_total = Column(Numeric(12, 2), nullable=False, default=0)
    delivery_fee = Column(Numeric(12, 2), nullable=False, default=0)
    total_price = Column(Numeric(12, 2), nullable=False, default=0)
    payment_id = Column(
        BigInteger,
        ForeignKey("payments.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )
    cancellation_reason = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
