"""
Idempotent staff seed — one account per role for auth testing.

Run from backend/:  .venv/Scripts/python scripts/seed_staff.py

Override emails with your team's real Gmail via env vars:
    SEED_ADMIN_EMAIL, SEED_DISPATCHER_EMAIL, SEED_OPS_EMAIL,
    SEED_DRIVER_EMAIL, SEED_CUSTOMER_EMAIL

Staff (users table — password login):  password = testpass123
  - admin@sambast.com      (admin)
  - dispatcher@sambast.com (dispatcher)
  - ops@sambast.com        (ops_manager)
  - driver1@sambast.com    (driver — users row + drivers profile)

Customer (customers table — PIN login):  contact_no = 09123456789, pin = 1234
  - customer@sambast.com
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.driver import Driver  # noqa: E402
from app.models.user import User  # noqa: E402

STAFF_PASSWORD = "testpass123"
CUSTOMER_PIN = "1234"
CUSTOMER_PHONE = "09123456789"

STAFF = [
    (os.environ.get("SEED_ADMIN_EMAIL", "admin@sambast.com"), "admin", "Admin User"),
    ("alexanderjonsolis0401@gmail.com", "admin", "Alexander Jon Solis"),
    (os.environ.get("SEED_DISPATCHER_EMAIL", "dispatcher@sambast.com"), "dispatcher", "Dispatcher User"),
    (os.environ.get("SEED_OPS_EMAIL", "ops@sambast.com"), "ops_manager", "Ops Manager"),
    (os.environ.get("SEED_DRIVER_EMAIL", "driver1@sambast.com"), "driver", "Driver One"),
]


def upsert_staff(db, email: str, role: str, name: str) -> User:
    user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    if user:
        # Exists — update password only.
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
    db.flush()
    print(f"  created  {email} (role={role})")
    return user


def ensure_driver_profile(db, user: User) -> None:
    """Seeded driver needs a drivers row so the account is usable."""
    if db.query(Driver).filter(Driver.user_id == user.id).first():
        return
    db.add(Driver(user_id=user.id, license_no="LIC-SEED-001", status="active"))
    print(f"  + driver profile for {user.email}")


def upsert_customer(db) -> Customer:
    email = os.environ.get("SEED_CUSTOMER_EMAIL", "customer@sambast.com")
    customer = db.query(Customer).filter(Customer.email == email).first()
    if customer:
        customer.pin_hash = hash_password(CUSTOMER_PIN)
        customer.phone = CUSTOMER_PHONE
        print(f"  updated  {email} (customer PIN reset)")
        return customer
    customer = Customer(
        email=email,
        name="Test Customer",
        phone=CUSTOMER_PHONE,
        pin_hash=hash_password(CUSTOMER_PIN),
        otp_verified=True,
        is_active=True,
    )
    db.add(customer)
    print(f"  created  {email} (customer, pin={CUSTOMER_PIN})")
    return customer


def main() -> None:
    db = SessionLocal()
    try:
        for email, role, name in STAFF:
            user = upsert_staff(db, email, role, name)
            if role == "driver":
                ensure_driver_profile(db, user)
        upsert_customer(db)
        db.commit()
    finally:
        db.close()

    print("\nSeeded credentials:")
    print(f"  staff    password={STAFF_PASSWORD}")
    for email, role, _ in STAFF:
        print(f"           {email} ({role})")
    print(f"  customer phone={CUSTOMER_PHONE} pin={CUSTOMER_PIN}")


if __name__ == "__main__":
    main()
