"""
Idempotent staff seed — creates one user per role for T3 auth testing.

Run from backend/:  .venv/Scripts/python scripts/seed_staff.py

Staff (password login):  password = testpass123
  - admin@sambast.com      (admin)
  - dispatcher@sambast.com (dispatcher — exists from BE-B; password updated only)
  - ops@sambast.com        (ops_manager)
  - driver1@sambast.com    (driver)

Customer (PIN login):    contact_no = 09123456789, pin = 1234
  - customer@sambast.com   (customer)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402

STAFF_PASSWORD = "testpass123"
CUSTOMER_PIN = "1234"
CUSTOMER_PHONE = "09123456789"

STAFF = [
    ("admin@sambast.com", "admin", "Admin User"),
    ("dispatcher@sambast.com", "dispatcher", "Dispatcher User"),
    ("ops@sambast.com", "ops_manager", "Ops Manager"),
    ("driver1@sambast.com", "driver", "Driver One"),
]


def upsert_staff(db, email: str, role: str, name: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Exists (e.g. dispatcher from BE-B seed) — update password only.
        user.password_hash = hash_password(STAFF_PASSWORD)
        print(f"  updated  {email} (role={user.role})")
        return user
    user = User(
        role=role,
        email=email,
        name=name,
        password_hash=hash_password(STAFF_PASSWORD),
        is_active=True,
    )
    db.add(user)
    print(f"  created  {email} (role={role})")
    return user


def upsert_customer(db) -> User:
    email = "customer@sambast.com"
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.pin_hash = hash_password(CUSTOMER_PIN)
        user.phone = CUSTOMER_PHONE
        print(f"  updated  {email} (customer PIN reset)")
        return user
    user = User(
        role="customer",
        email=email,
        name="Test Customer",
        phone=CUSTOMER_PHONE,
        pin_hash=hash_password(CUSTOMER_PIN),
        otp_verified=True,
        is_active=True,
    )
    db.add(user)
    print(f"  created  {email} (customer, pin={CUSTOMER_PIN})")
    return user


def main() -> None:
    db = SessionLocal()
    try:
        for email, role, name in STAFF:
            upsert_staff(db, email, role, name)
        upsert_customer(db)
        db.commit()
    finally:
        db.close()

    print("\nSeeded credentials:")
    print(f"  staff    password={STAFF_PASSWORD}")
    for email, role, _ in STAFF:
        print(f"           {email} ({role})")
    print(f"  customer phone={CUSTOMER_PHONE} pin={CUSTOMER_PIN} (customer@sambast.com)")


if __name__ == "__main__":
    main()
