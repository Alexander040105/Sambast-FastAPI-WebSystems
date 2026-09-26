"""
Dev-only bootstrap for local manual testing.

Creates all tables in a local SQLite DB (dev.db), seeds a dispatcher
account plus sample fleet/dispatch data, writes a one-click dev login
page into frontend/public, and prints a JWT.

Run from backend/:  .venv/Scripts/python dev_seed.py
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import BigInteger, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


# ── SQLite compatibility shims (dev only) ────────────────────────────
@compiles(JSONB, "sqlite")
def _jsonb_as_json(element, compiler, **kw):
    return "JSON"


@compiles(BigInteger, "sqlite")
def _bigint_as_int(element, compiler, **kw):
    # SQLite only auto-increments columns typed exactly INTEGER
    return "INTEGER"


import bcrypt  # noqa: E402 — passlib 1.7.4 crashes on bcrypt>=5; hash directly

import app.models  # noqa: E402,F401 — register all tables on metadata
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.models import (  # noqa: E402
    Category,
    Customer,
    Driver,
    DriverShift,
    Location,
    Order,
    OrderItem,
    Product,
    User,
    Vehicle,
)

# Create every table individually: emits FKs inline and skips the
# ALTER TABLE ... ADD CONSTRAINT that use_alter would produce
# (SQLite cannot add constraints post-create).
for table in Base.metadata.tables.values():
    table.create(engine, checkfirst=True)

db = SessionLocal()


def get_or_create(model, defaults=None, **lookup):
    obj = db.query(model).filter_by(**lookup).first()
    if obj:
        return obj
    obj = model(**{**lookup, **(defaults or {})})
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ── Staff + drivers ──────────────────────────────────────────────────
dispatcher = get_or_create(
    User,
    email="dispatcher@sambast.com",
    defaults=dict(
        role="dispatcher",
        name="Dev Dispatcher",
        password_hash=bcrypt.hashpw(b"testpass123", bcrypt.gensalt()).decode(),
        is_active=True,
    ),
)
customer = get_or_create(
    Customer, email="customer@sambast.com", defaults=dict(name="Dev Customer", is_active=True)
)

driver_users = []
for i, name in enumerate(["Juan Cruz", "Maria Santos"], start=1):
    u = get_or_create(
        User,
        email=f"driver{i}@sambast.com",
        defaults=dict(role="driver", name=name, is_active=True),
    )
    driver_users.append(u)

drivers = [
    get_or_create(Driver, user_id=u.id, defaults=dict(license_no=f"LIC-{i:04d}", status="active"))
    for i, u in enumerate(driver_users, start=1)
]

# ── Fleet ─────────────────────────────────────────────────────────────
vehicles = [
    get_or_create(Vehicle, plate_no="ABC-1234", defaults=dict(type="truck", max_weight_kg=1000, max_volume_m3=8)),
    get_or_create(Vehicle, plate_no="XYZ-5678", defaults=dict(type="van", max_weight_kg=500, max_volume_m3=3)),
]

now = datetime.now(timezone.utc)
for driver, vehicle in zip(drivers, vehicles):
    if not db.query(DriverShift).filter_by(driver_id=driver.id).first():
        db.add(
            DriverShift(
                driver_id=driver.id,
                vehicle_id=vehicle.id,
                starts_at=now.replace(hour=8, minute=0),
                ends_at=now.replace(hour=17, minute=0),
                status="scheduled",
            )
        )
db.commit()

# ── Locations ─────────────────────────────────────────────────────────
locations = [
    get_or_create(Location, line1="123 Rizal Ave", city="Quezon City", defaults=dict(label="Warehouse", lat=14.6760, lng=121.0437)),
    get_or_create(Location, line1="45 España Blvd", city="Manila", defaults=dict(lat=14.6091, lng=120.9897)),
    get_or_create(Location, line1="78 Ortigas Ave", city="Pasig", defaults=dict(lat=14.5864, lng=121.0612)),
]

# ── Catalog + orders in the dispatch queue ────────────────────────────
category = get_or_create(Category, name="Pet Food")
product = get_or_create(
    Product,
    name="Dog Food 25kg",
    defaults=dict(category_id=category.id, base_price=1450, unit="sack", weight_kg_per_unit=25, stock_quantity=50),
)

if not db.query(Order).filter(Order.status == "READY_FOR_DISPATCH").first():
    for i, loc in enumerate(locations[1:], start=1):
        order = Order(
            order_no=f"ORD-SEED-{i:04d}",
            customer_id=customer.id,
            delivery_location_id=loc.id,
            delivery_window_start=now + timedelta(hours=2),
            delivery_window_end=now + timedelta(hours=6),
            status="READY_FOR_DISPATCH",
            subtotal=2900,
            total_price=2900,
        )
        db.add(order)
        db.flush()
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=2,
                selected_unit="sack",
                unit_multiplier=1,
                base_price_at_time=1450,
                price_at_time=2900,
            )
        )
    db.commit()

# ── Token + one-click dev login page ──────────────────────────────────
token = create_access_token(dispatcher.id, dispatcher.role)

login_page = Path(__file__).parent.parent / "frontend" / "public" / "dev-login.html"
login_page.write_text(
    "<!doctype html><meta charset=utf-8><title>Dev login</title><script>"
    f"localStorage.setItem('access_token',{json.dumps(token)});"
    "location.href='/dispatcher/fleet/drivers';</script>"
    "<body>Signing in...</body>",
    encoding="utf-8",
)

print(f"\nDispatcher: dispatcher@sambast.com (id={dispatcher.id})")
print(f"Token (24h):\n{token}\n")
print("One-click login: http://localhost:5173/dev-login.html")
