"""deliveries — links an order to a route + driver."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, Text, func,
)

from app.db.session import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(
        BigInteger, ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    route_id = Column(
        BigInteger, ForeignKey("routes.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    driver_id = Column(
        BigInteger, ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    status = Column(
        String(20), nullable=False, default="PENDING",
        comment="PENDING|EN_ROUTE|ARRIVED|DELIVERED|FAILED|REATTEMPT|RETURNED",
    )
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    attempt_no = Column(BigInteger, nullable=False, default=1)
    failure_reason = Column(Text, nullable=True)
    cost = Column(Numeric(12, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
