import os
import sys
import pytest
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", ".env")))

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.location import Location
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.driver_shift import DriverShift
from app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def db():
    db_session = SessionLocal()
    yield db_session
    db_session.close()

@pytest.fixture(scope="module")
def admin_token(db):
    user = db.query(User).filter(User.email == "admin@example.com").first()
    if not user:
        user = User(email="admin@example.com", password_hash="pw", role="admin", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token(user.id, user.role)
    return {"Authorization": f"Bearer {token}"}

def test_t4_dispatch_queue(admin_token):
    # GET /api/v1/dispatch/queue
    response = client.get("/api/v1/dispatch/queue", headers=admin_token)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data

def test_t6_auto_assign(admin_token, db):
    # Setup test data
    user = User(email="driver_t6@test.com", password_hash="pw", role="driver", is_active=True)
    db.add(user)
    db.commit()
    
    loc = Location(line1="123 test", city="test", lat=14.5, lng=121.0)
    db.add(loc)
    db.commit()
    
    driver = Driver(user_id=user.id, home_location_id=loc.id, status="active")
    db.add(driver)
    db.commit()
    
    vehicle = Vehicle(plate_no="TEST-123", type="van", max_weight_kg=500.0, is_active=True)
    db.add(vehicle)
    db.commit()
    
    now = datetime.now(timezone.utc)
    shift = DriverShift(driver_id=driver.id, vehicle_id=vehicle.id, starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=8), status="active")
    db.add(shift)
    db.commit()
    
    order = Order(
        order_no="ORD-T6", 
        customer_id=user.id, 
        status="READY_FOR_DISPATCH",
        delivery_location_id=loc.id,
        delivery_window_start=now + timedelta(hours=1),
        delivery_window_end=now + timedelta(hours=3)
    )
    db.add(order)
    db.commit()
    
    prod = Product(name="Test Prod", base_price=10.0, weight_kg_per_unit=5.0)
    db.add(prod)
    db.commit()
    
    item = OrderItem(order_id=order.id, product_id=prod.id, quantity=2, unit_multiplier=1.0, base_price_at_time=10, price_at_time=10)
    db.add(item)
    db.commit()

    # POST /dispatch/auto-assign
    response = client.post("/api/v1/dispatch/auto-assign", json={"order_id": order.id}, headers=admin_token)
    assert response.status_code == 200
    data = response.json()
    assert data["driver_id"] == driver.id
    assert data["vehicle_id"] == vehicle.id
    assert "reason" in data["reason"] or "Assigned" in data["reason"]
    
    return order.id, driver.id

def test_t5_manual_assign(admin_token, db):
    order_id, driver_id = test_t6_auto_assign.__wrapped__(admin_token, db) if hasattr(test_t6_auto_assign, '__wrapped__') else None
    
    if not order_id:
        # Just create an order to assign
        user = db.query(User).filter(User.role=="customer").first()
        if not user:
            user = User(email="cust@test.com", password_hash="pw", role="customer")
            db.add(user)
            db.commit()
        order = Order(order_no="ORD-T5", customer_id=user.id, status="READY_FOR_DISPATCH")
        db.add(order)
        db.commit()
        order_id = order.id
        driver = db.query(Driver).first()
        driver_id = driver.id

    response = client.post(f"/api/v1/dispatch/orders/{order_id}/assign", json={"driver_id": driver_id}, headers=admin_token)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    # Verify DB
    db.refresh(db.query(Order).get(order_id))
    order = db.query(Order).get(order_id)
    assert order.status == "ASSIGNED"
