"""drivers — extends users with driving-specific fields."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, String, func,
)

from app.db.session import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    license_no = Column(String(50), nullable=True)
    status = Column(
        String(20), nullable=False, default="active",
        comment="active|off_duty|suspended",
    )
    home_location_id = Column(
        BigInteger, ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
