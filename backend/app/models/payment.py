"""payments — COD-only for now."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, func,
)

from app.db.session import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(
        BigInteger, ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    method = Column(String(20), nullable=False, default="cash")
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(
        String(20), nullable=False, default="pending",
        comment="pending|paid|refunded",
    )
    reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
