"""routes — a driver's delivery run."""

from sqlalchemy import (
    BigInteger, Column, DateTime, Date, ForeignKey, Numeric, String, func,
)

from app.db.session import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    driver_id = Column(
        BigInteger, ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    vehicle_id = Column(
        BigInteger, ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
    )
    shift_id = Column(
        BigInteger, ForeignKey("driver_shifts.id", ondelete="SET NULL"),
        nullable=True,
    )
    date = Column(Date, nullable=False)
    status = Column(
        String(20), nullable=False, default="planned",
        comment="planned|active|completed",
    )
    total_distance_km = Column(Numeric(10, 2), nullable=True)
    est_duration_min = Column(Numeric(10, 2), nullable=True)
    cost = Column(Numeric(12, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
