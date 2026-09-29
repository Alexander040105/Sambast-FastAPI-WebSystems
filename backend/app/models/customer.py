"""customers — self-registered customer accounts (OTP → PIN auth).

Split out of `users` per the instructor's schema: Customer is its own
entity. `users` is now staff-only (admin|dispatcher|ops_manager|driver).
"""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, String, Text, func,
)

from app.db.session import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(30), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=True)

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

    @property
    def role(self) -> str:
        """Customer accounts always carry the 'customer' role — lets
        require_role()/UserOut treat principals uniformly."""
        return "customer"
