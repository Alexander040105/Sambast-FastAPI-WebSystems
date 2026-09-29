"""
scripts/seed_demo.py — demo data for the presentation (BE-A T11).

Loads the real product catalog from legacy_code/sambast_inventory_list_v2.csv,
creates a handful of customers + geocoded locations, and generates ~100
orders spread across the status pipeline so analytics, dispatch queue and
order history all have something to show.

Run from backend/:  .venv/Scripts/python scripts/seed_demo.py
"""

import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import bcrypt  # hash directly — passlib 1.7.4 warns on bcrypt>=5

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.location import Location  # noqa: E402
from app.models.order import Order  # noqa: E402
from app.models.order_item import OrderItem  # noqa: E402
from app.models.payment import Payment  # noqa: E402
from app.models.products import Product  # noqa: E402

CSV_PATH = ROOT.parent / "legacy_code" / "sambast_inventory_list_v2.csv"

ORDER_COUNT = 100
STATUSES = [
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",  # ~40% done
    "READY_FOR_DISPATCH", "READY_FOR_DISPATCH",          # queue for dispatch
    "ASSIGNED", "OUT_FOR_DELIVERY",
    "PENDING", "CONFIRMED", "CANCELLED",
]

# Metro Manila pins used by the demo frontend
DEMO_LOCATIONS = [
    ("123 Rizal Ave", "Quezon City", 14.6760, 121.0437),
    ("45 España Blvd", "Manila", 14.6091, 120.9897),
    ("78 Ortigas Ave", "Pasig", 14.5864, 121.0612),
    ("12 Shaw Blvd", "Mandaluyong", 14.5794, 121.0359),
    ("301 Ayala Ave", "Makati", 14.5547, 121.0244),
    ("67 Commonwealth Ave", "Quezon City", 14.6995, 121.0850),
    ("88 Sucat Rd", "Paranaque", 14.4793, 121.0198),
    ("15 Marcos Hwy", "Marikina", 14.6507, 121.1029),
    ("220 EDSA", "Makati", 14.5378, 121.0014),
    ("9 Del Monte Ave", "Quezon City", 14.6426, 121.0001),
]

DEMO_CUSTOMERS = [
    ("maria.santos.demo@gmail.com", "Maria Santos", "09170000001"),
    ("jose.rizal.demo@gmail.com", "Jose Rizal", "09170000002"),
    ("ana.reyes.demo@gmail.com", "Ana Reyes", "09170000003"),
    ("adobofree@gmail.com", "Adobo Free", "09170000004"),
]

DEMO_PIN = "1234"  # demo PIN for every seeded customer


def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def _category_for(target_pet: str) -> str:
    text = (target_pet or "").lower()
    if "chick" in text or "poultry" in text or "duck" in text or "gamefowl" in text:
        return "Poultry Feed"
    if "pig" in text or "swine" in text or "hog" in text:
        return "Swine Feed"
    if "fish" in text or "tilapia" in text or "aquaculture" in text:
        return "Aquaculture Feed"
    if "dog" in text or "cat" in text or "pet" in text:
        return "Pet Food"
    if "rabbit" in text:
        return "Rabbit Feed"
    if "bird" in text:
        return "Bird Feed"
    return "Livestock Feed"


def seed_categories_products(db):
    """CSV → categories + products. Category drives unit options per kg."""
    if not CSV_PATH.exists():
        print(f"CSV not found at {CSV_PATH} — skipping catalog seed")
        return []

    created_products = []
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = (row.get("Product") or "").strip()
            if not name:
                continue

            category_name = _category_for(row.get("Target Pet Type"))
            category = db.query(Category).filter(
                Category.name == category_name
            ).first()
            if not category:
                category = Category(
                    name=category_name,
                    unit_options=[
                        {"label": "1kg", "value": "1kg", "multiplier": 1},
                        {"label": "5kg", "value": "5kg", "multiplier": 5},
                        {"label": "10kg sack", "value": "10kg sack", "multiplier": 10},
                        {"label": "25kg sack", "value": "25kg sack", "multiplier": 25},
                        {"label": "50kg sack", "value": "50kg sack", "multiplier": 50},
                    ],
                )
                db.add(category)
                db.flush()

            if db.query(Product).filter(Product.name == name).first():
                continue

            price = Decimal(str(row.get("Price per kg (PHP)") or "0"))
            product = Product(
                category_id=category.id,
                name=name,
                description=(row.get("Description") or "").strip(),
                base_price=price,
                unit="kg",
                weight_kg_per_unit=Decimal("1"),
                stock_quantity=random.randint(0, 80),
                purpose=(row.get("Target Pet Type") or "").strip() or None,
                is_archived=False,
            )
            db.add(product)
            created_products.append(product)

    db.commit()
    return created_products


def seed_customers(db):
    customers = []
    for email, name, phone in DEMO_CUSTOMERS:
        customer = db.query(Customer).filter(Customer.email == email).first()
        if not customer:
            customer = Customer(
                email=email,
                phone=phone,
                name=name,
                pin_hash=_hash_pin(DEMO_PIN),
                otp_verified=True,
                is_active=True,
            )
            db.add(customer)
            db.flush()
        customers.append(customer)
    db.commit()
    return customers


def seed_locations(db):
    locations = []
    for line1, city, lat, lng in DEMO_LOCATIONS:
        location = db.query(Location).filter(
            Location.line1 == line1, Location.city == city
        ).first()
        if not location:
            location = Location(line1=line1, city=city, lat=lat, lng=lng)
            db.add(location)
            db.flush()
        locations.append(location)
    db.commit()
    return locations


def seed_orders(db, customers, locations):
    products = db.query(Product).filter(Product.is_archived.is_(False)).all()
    if not products or not customers:
        print("Nothing to seed orders against — skipped")
        return

    already = db.query(Order).filter(
        Order.order_no.like("ORD-DEMO-%")
    ).count()
    if already:
        print(f"{already} demo orders already exist — skipping")
        return

    now = datetime.now(timezone.utc)
    for i in range(ORDER_COUNT):
        order_status = random.choice(STATUSES)
        customer = random.choice(customers)
        location = random.choice(locations)

        # 1-3 line items per order, priced off the real product rows
        picks = random.sample(products, k=min(len(products), random.randint(1, 3)))
        items = []
        subtotal = Decimal("0")
        for product in picks:
            qty = random.randint(1, 5)
            line_total = Decimal(str(product.base_price)) * qty
            subtotal += line_total
            items.append((product, qty, line_total))

        delivery_fee = Decimal("50")
        total = subtotal + delivery_fee

        order = Order(
            order_no=f"ORD-DEMO-{i + 1:05d}",
            customer_id=customer.id,
            delivery_location_id=location.id,
            delivery_window_start=now + timedelta(hours=random.randint(-48, 48)),
            delivery_window_end=now + timedelta(hours=random.randint(49, 72)),
            status=order_status,
            subtotal=subtotal,
            discount_total=Decimal("0"),
            delivery_fee=delivery_fee,
            total_price=total,
            created_at=now - timedelta(days=random.randint(0, 30)),
        )
        db.add(order)
        db.flush()

        for product, qty, line_total in items:
            db.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=qty,
                selected_unit="1kg",
                unit_multiplier=Decimal("1"),
                base_price_at_time=product.base_price,
                discount_amount_at_time=Decimal("0"),
                price_at_time=line_total,
            ))

        payment = Payment(
            order_id=order.id,
            method="cash",
            amount=total,
            status="paid" if order_status == "COMPLETED" else "pending",
            paid_at=order.created_at if order_status == "COMPLETED" else None,
        )
        db.add(payment)
        db.flush()
        order.payment_id = payment.id

    db.commit()


def main():
    db = SessionLocal()
    try:
        products = seed_categories_products(db)
        customers = seed_customers(db)
        locations = seed_locations(db)
        seed_orders(db, customers, locations)

        print("\n=== Demo seed complete ===")
        print(f"Products loaded: {db.query(Product).count()} "
              f"({len(products)} new)")
        print(f"Orders: {db.query(Order).count()} total "
              f"(ORD-DEMO-* are the seeded ones)")
        print("\nCustomer logins (contact_no / PIN):")
        for email, name, phone in DEMO_CUSTOMERS:
            print(f"  {name:<14} {phone} / {DEMO_PIN}")
        print("\nStaff logins stay the same: admin@sambast.com etc. / testpass123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
