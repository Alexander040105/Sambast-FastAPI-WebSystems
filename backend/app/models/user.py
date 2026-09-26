"""users — staff identity table (admin|dispatcher|ops_manager|driver).

Customer accounts live in `customers` (per instructor's schema) — the
OTP→PIN columns moved there. Staff authenticate with email + password.
"""

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, String, Text, func,
)

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    role = Column(
        String(20),
        nullable=False,
        comment="admin|dispatcher|ops_manager|driver",
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    name = Column(String(255), nullable=True)

    # Staff auth
    password_hash = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
