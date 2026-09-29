import os
import sys
import pytest
from fastapi.testclient import TestClient

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", ".env")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.main import app

client = TestClient(app)

def test_analytics_driver_performance():
    response = client.get("/api/v1/analytics/driver-performance?period_key=this_week")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "on_time_percent" in data["summary"]
    assert "series" in data
    assert len(data["series"]) > 0
    assert "on_time_percent" in data["series"][0]
    assert "updated_at" in data

def test_analytics_delivery_costs():
    response = client.get("/api/v1/analytics/delivery-costs?period_key=previous_week")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "average_cost_per_stop" in data["summary"]
    assert "series" in data
    assert len(data["series"]) > 0
    assert "cost_per_stop" in data["series"][0]
    assert "updated_at" in data

def test_analytics_failed_deliveries():
    response = client.get("/api/v1/analytics/failed-deliveries")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "failed_count" in data["summary"]
    assert "change_from_previous_week" in data["summary"]
    assert "reasons" in data
    assert "daily" in data
    assert "updated_at" in data

def test_costing_logic_imports_and_structure():
    # Verify the costing module doesn't crash on import
    from app.services.costing import calculate_order_delivery_fee, calculate_route_cost
    assert calculate_order_delivery_fee is not None
    assert calculate_route_cost is not None
    
    # We can test calculate_order_delivery_fee since it doesn't need DB for simple cost
    fee = calculate_order_delivery_fee(None, 1, distance_km=20.0)
    assert fee == 15.0  # 5.0 base + 20 * 0.50

