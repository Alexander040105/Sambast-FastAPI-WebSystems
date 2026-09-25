"""delivery_stops — individual stops on a route."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, String, func,
)

from app.db.session import Base


class DeliveryStop(Base):
    __tablename__ = "delivery_stops"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    route_id = Column(
        BigInteger, ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    delivery_id = Column(
        BigInteger, ForeignKey("deliveries.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id = Column(
        BigInteger, ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    sequence_no = Column(BigInteger, nullable=False)
    planned_eta = Column(DateTime(timezone=True), nullable=True)
    arrived_at = Column(DateTime(timezone=True), nullable=True)
    departed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(20), nullable=False, default="PENDING",
        comment="PENDING|EN_ROUTE|ARRIVED|DELIVERED|FAILED",
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
