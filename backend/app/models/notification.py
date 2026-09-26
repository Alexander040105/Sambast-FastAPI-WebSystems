"""notifications — email/in-app notification log."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, String, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True, index=True, comment="staff recipient (nullable)",
    )
    customer_id = Column(
        BigInteger, ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True, index=True, comment="customer recipient",
    )
    channel = Column(
        String(20), nullable=False, default="email",
        comment="email|in_app",
    )
    template = Column(String(100), nullable=True)
    payload = Column(JSONB, nullable=True)
    status = Column(
        String(20), nullable=False, default="pending",
        comment="pending|sent|failed",
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
