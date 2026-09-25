"""users — Identity table for all 5 roles."""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, String, Text,
    func,
)

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    role = Column(
        String(20),
        nullable=False,
        comment="customer|driver|dispatcher|admin|ops_manager",
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    name = Column(String(255), nullable=True)

    # Staff auth
    password_hash = Column(Text, nullable=True)

    # Customer auth — OTP → PIN flow
    pin_hash = Column(Text, nullable=True)
    otp_code_hash = Column(Text, nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    otp_attempts = Column(BigInteger, default=0)
    otp_last_sent_at = Column(DateTime(timezone=True), nullable=True)
    otp_resend_count = Column(BigInteger, default=0)
    otp_verified = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
