"""delivery_status_events — immutable audit trail, powers SSE + tracking."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, Text, func,
)

from app.db.session import Base


class DeliveryStatusEvent(Base):
    __tablename__ = "delivery_status_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    delivery_id = Column(
        BigInteger, ForeignKey("deliveries.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status = Column(String(20), nullable=False)
    note = Column(Text, nullable=True)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)
    actor_user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
