"""vehicles — fleet inventory."""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Numeric, String, func,
)

from app.db.session import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    plate_no = Column(String(20), unique=True, nullable=False)
    type = Column(String(50), nullable=False)
    max_weight_kg = Column(Numeric(10, 2), nullable=False)
    max_volume_m3 = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
