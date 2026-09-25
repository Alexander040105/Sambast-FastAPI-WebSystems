"""customer_addresses — saved delivery addresses per customer."""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, String, func,
)

from app.db.session import Base


class CustomerAddress(Base):
    __tablename__ = "customer_addresses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id = Column(
        BigInteger, ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
    )
    label = Column(String(100), nullable=True, comment="e.g. Home, Office")
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
