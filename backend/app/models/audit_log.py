"""audit_logs — immutable staff action history."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    action = Column(Text, nullable=False)
    category = Column(
        String(50), nullable=True,
        comment="Order Process|Product Management|User Activity|System Actions",
    )
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
