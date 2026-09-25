"""driver_shifts — driver availability windows."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, String, func,
)

from app.db.session import Base


class DriverShift(Base):
    __tablename__ = "driver_shifts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    driver_id = Column(
        BigInteger, ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vehicle_id = Column(
        BigInteger, ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        String(20), nullable=False, default="scheduled",
        comment="scheduled|active|completed|cancelled",
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
