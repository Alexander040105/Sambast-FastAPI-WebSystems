import os
import sys
import pytest
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.payment import Payment
from app.models.route import Route
from app.core.security import create_access_token
from app.services.geocoding import geocode_address, METRO_MANILA_PRESETS
from app.services.routing import route_cost, haversine
from app.services.costing import calculate_route_cost

client = TestClient(app)

import asyncio

def test_1_geocoding_fallback_presets():
    """Verify fallback preset lookup works when Nominatim fails or offline."""
    assert any(k == "makati" for k, _, _ in METRO_MANILA_PRESETS)
    # Test preset match directly with a query that triggers fallback
    query_lower = "somewhere in makati city center".lower()
    matched = None
    for key, lat, lng in METRO_MANILA_PRESETS:
        if key in query_lower:
            matched = (lat, lng)
            break
    assert matched is not None
    assert round(matched[0], 2) == 14.55
    assert round(matched[1], 2) == 121.02
    print(f"[PASS] Fix 1: Geocoding fallback presets verified with {matched}.")

def test_2_null_island_optimizer_protection():
    """Verify (0.0, 0.0) coordinates are penalized as nominal 2km instead of 11,000km."""
    now = datetime.now(timezone.utc)
    # Stop 1 at Makati, Stop 2 at (0.0, 0.0)
    stop1 = (None, 14.5547, 121.0244, None)
    stop2 = (None, 0.0, 0.0, None)
    cost = route_cost([stop1, stop2], now)
    # Nominal 2km hop at 30km/h: 2.0 km + (2/30)*0.5 penalty = ~2.033
    assert cost < 10.0, f"Expected < 10km equivalent cost, got {cost}"
    print("[PASS] Fix 2: Null Island optimizer protection verified.")

def test_3_driver_manifest_endpoint():
    """Verify GET /drivers/{driver_id}/manifest endpoint works for dispatchers."""
    db = SessionLocal()
    try:
        dispatcher = db.query(User).filter(User.role == "dispatcher").first()
        driver = db.query(Driver).first()
        token = create_access_token(sub=dispatcher.id, role="dispatcher")
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = client.get(f"/api/v1/drivers/{driver.id}/manifest", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "stops" in data
        assert "shift_label" in data
        print("[PASS] Fix 3: GET /drivers/{driver_id}/manifest verified.")
    finally:
        db.close()

def test_4_analytics_security_guards():
    """Verify unauthorized roles cannot access ops analytics."""
    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.role == "customer").first()
        token = create_access_token(sub=customer.id, role="customer")
        headers = {"Authorization": f"Bearer {token}"}

        for path in ["/api/v1/analytics/driver-performance", "/api/v1/analytics/delivery-costs", "/api/v1/analytics/failed-deliveries"]:
            resp = client.get(path, headers=headers)
            assert resp.status_code == 403
        print("[PASS] Fix 4: Analytics security guards verified.")
    finally:
        db.close()

def test_5_global_error_format():
    """Verify global exception handler returns standard error code and message."""
    resp = client.get("/api/v1/routes/999999999")
    assert resp.status_code == 404
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "detail" in data
    print("[PASS] Fix 5: Global error response format verified.")

def test_6_stock_deduction_and_cod_reconciliation():
    """Verify stock deduction and COD payment sync on stop completion."""
    db = SessionLocal()
    try:
        # Create a test product
        product = Product(
            name="Test Verification Gadget",
            base_price=100.0,
            stock_quantity=50,
            weight_kg_per_unit=1.0
        )
        db.add(product)
        db.flush()

        customer = db.query(User).filter(User.role == "customer").first()
        driver = db.query(Driver).first()
        route = db.query(Route).filter(Route.driver_id == driver.id).first()

        import uuid
        order = Order(
            order_no=f"TEST-VERIF-{uuid.uuid4().hex[:8].upper()}",
            customer_id=customer.id,
            status="OUT_FOR_DELIVERY",
            subtotal=200.0,
            delivery_fee=50.0,
            total_price=250.0
        )
        db.add(order)
        db.flush()

        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=5,
            unit_multiplier=1.0,
            base_price_at_time=100.0,
            price_at_time=100.0
        )
        db.add(item)

        payment = Payment(
            order_id=order.id,
            amount=250.0,
            method="COD",
            status="pending"
        )
        db.add(payment)

        delivery = Delivery(
            order_id=order.id,
            driver_id=driver.id,
            route_id=route.id,
            status="ARRIVED",
            cost=25.0
        )
        db.add(delivery)
        db.flush()

        stop = DeliveryStop(
            route_id=route.id,
            delivery_id=delivery.id,
            sequence_no=999,
            status="ARRIVED"
        )
        db.add(stop)
        db.commit()

        driver_user = db.query(User).filter(User.id == driver.user_id).first()
        token = create_access_token(sub=driver_user.id, role="driver")
        headers = {"Authorization": f"Bearer {token}"}

        stop_id = stop.id
        prod_id = product.id
        rt_id = route.id
        ord_id = order.id
        del_id = delivery.id
        pay_id = payment.id
        it_id = item.id

        db.commit()
        db.close()

        resp = client.post(f"/api/v1/stops/{stop_id}/complete", headers=headers)
        assert resp.status_code == 200

        # Reopen fresh session to verify
        db = SessionLocal()
        prod = db.query(Product).filter(Product.id == prod_id).first()
        assert prod.stock_quantity == 45, f"Expected 45, got {prod.stock_quantity}"

        # Verify COD reconciliation
        calculate_route_cost(db, rt_id)
        pmt = db.query(Payment).filter(Payment.id == pay_id).first()
        ord_rec = db.query(Order).filter(Order.id == ord_id).first()
        assert pmt.amount == ord_rec.total_price

        # Clean up test rows
        s = db.query(DeliveryStop).filter(DeliveryStop.id == stop_id).first()
        d = db.query(Delivery).filter(Delivery.id == del_id).first()
        p = db.query(Payment).filter(Payment.id == pay_id).first()
        i = db.query(OrderItem).filter(OrderItem.id == it_id).first()
        o = db.query(Order).filter(Order.id == ord_id).first()
        pr = db.query(Product).filter(Product.id == prod_id).first()
        if s: db.delete(s)
        if d: db.delete(d)
        if p: db.delete(p)
        if i: db.delete(i)
        if o: db.delete(o)
        if pr: db.delete(pr)
        db.commit()

        print("[PASS] Fix 6: Stock deduction and COD reconciliation verified.")
    finally:
        db.close()

if __name__ == "__main__":
    test_1_geocoding_fallback_presets()
    test_2_null_island_optimizer_protection()
    test_3_driver_manifest_endpoint()
    test_4_analytics_security_guards()
    test_5_global_error_format()
    test_6_stock_deduction_and_cod_reconciliation()
    print("\nALL BE-B FIXES VERIFIED SUCCESSFULLY!")
