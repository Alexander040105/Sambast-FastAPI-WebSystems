"""
Comprehensive validation script for BE-B Tasks T1-T3.

T1: Contract session — verify server boots, health endpoint, CORS, and data contract shapes.
T2: Baseline Alembic migration — verify all 18 tables exist in Neon.
T3: Fleet CRUD + locations — full CRUD tests for drivers, vehicles, shifts, locations.

We first seed a dispatcher user directly in the DB, then obtain a JWT
to authenticate all API calls.
"""

import sys
import requests
import json
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api/v1"
PASS_EMOJI = "[OK]"
FAIL_EMOJI = "[FAIL]"
results = []


def log(test_name: str, passed: bool, detail: str = ""):
    emoji = PASS_EMOJI if passed else FAIL_EMOJI
    results.append((test_name, passed))
    line = f"  {emoji} {test_name}"
    if detail:
        line += f" — {detail}"
    print(line)


# ── SETUP: seed a dispatcher + driver user in the DB ───────────────────
print("\n" + "=" * 60)
print("SETUP: Seeding test users via direct DB access")
print("=" * 60)

# We'll use a helper endpoint approach — but since we don't have auth endpoints
# (that's BE-A's T3), we seed directly by importing DB models.
# Instead, let's POST directly to the DB via a quick script approach.
# Actually, let's just create the users programmatically using sqlalchemy:

sys.path.insert(0, ".")
from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.core.security import hash_password, create_access_token

db = SessionLocal()

# Clean up any existing test data
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.location import Location

# Clean up vehicle if it exists
existing_vehicle = db.query(Vehicle).filter(Vehicle.plate_no == "TEST-001").first()
if existing_vehicle:
    db.query(DriverShift).filter(DriverShift.vehicle_id == existing_vehicle.id).delete()
    db.delete(existing_vehicle)

for email in ["test_dispatcher@sambast.com", "test_driver@sambast.com"]:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.query(Driver).filter(Driver.user_id == existing.id).delete()
        db.delete(existing)
db.commit()

# Create dispatcher
dispatcher = User(
    role="dispatcher",
    email="test_dispatcher@sambast.com",
    name="Test Dispatcher",
    password_hash=hash_password("testpass123"),
    is_active=True,
)
db.add(dispatcher)
db.commit()
db.refresh(dispatcher)
DISPATCHER_TOKEN = create_access_token(dispatcher.id, dispatcher.role)
DISPATCHER_USER_ID = dispatcher.id
print(f"  Created dispatcher user (id={dispatcher.id})")

# Create driver user
driver_user = User(
    role="driver",
    email="test_driver@sambast.com",
    name="Test Driver",
    password_hash=hash_password("testpass123"),
    is_active=True,
)
db.add(driver_user)
db.commit()
db.refresh(driver_user)
DRIVER_USER_ID = driver_user.id
print(f"  Created driver user (id={driver_user.id})")

db.close()

HEADERS = {"Authorization": f"Bearer {DISPATCHER_TOKEN}"}


# ═══════════════════════════════════════════════════════════════════════
# T1 — Contract session validation
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("T1 — CONTRACT SESSION VALIDATION")
print("=" * 60)

# T1.1: Health endpoint
r = requests.get(f"{BASE}/health")
log("T1.1 Health endpoint", r.status_code == 200 and r.json()["status"] == "ok",
    f"status={r.status_code} body={r.json()}")

# T1.2: Swagger UI is accessible
r = requests.get(f"{BASE}/docs")
log("T1.2 Swagger UI /docs", r.status_code == 200, f"status={r.status_code}")

# T1.3: OpenAPI schema accessible
r = requests.get(f"{BASE}/openapi.json")
schema = r.json()
log("T1.3 OpenAPI schema", r.status_code == 200 and "paths" in schema,
    f"endpoint count = {len(schema.get('paths', {}))}")

# T1.4: CORS headers present
r = requests.options(f"{API}/drivers", headers={
    "Origin": "http://localhost:5173",
    "Access-Control-Request-Method": "GET",
})
cors_ok = "access-control-allow-origin" in r.headers
log("T1.4 CORS allows localhost:5173", cors_ok,
    f"ACAO={r.headers.get('access-control-allow-origin', 'MISSING')}")

# T1.5: Unauthenticated request is 403 (HTTPBearer returns 403 when missing)
r = requests.get(f"{API}/drivers")
log("T1.5 Unauthenticated -> 401/403", r.status_code in (401, 403),
    f"status={r.status_code}")

# T1.6: API prefix is /api/v1
r = requests.get(f"{API}/drivers", headers=HEADERS)
log("T1.6 /api/v1 prefix works", r.status_code == 200,
    f"status={r.status_code}")


# ═══════════════════════════════════════════════════════════════════════
# T2 — Baseline migration validation
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("T2 — BASELINE MIGRATION VALIDATION")
print("=" * 60)

# Check all 18 tables exist by querying pg_tables
from sqlalchemy import text
db = SessionLocal()

expected_tables = [
    "users", "drivers", "vehicles", "driver_shifts", "audit_logs",
    "categories", "products", "locations", "customer_addresses",
    "orders", "order_items", "payments", "routes", "deliveries",
    "delivery_stops", "delivery_status_events", "proof_of_delivery",
    "notifications",
]

result = db.execute(text(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
))
existing_tables = [row[0] for row in result.fetchall()]

for tbl in expected_tables:
    found = tbl in existing_tables
    log(f"T2 Table '{tbl}' exists", found,
        "FOUND" if found else f"MISSING — existing: {existing_tables}")

# Check alembic_version
result = db.execute(text("SELECT version_num FROM alembic_version"))
version = result.scalar()
log("T2 Alembic version recorded", version is not None, f"version={version}")

db.close()


# ═══════════════════════════════════════════════════════════════════════
# T3 — Fleet CRUD + Locations
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("T3 — FLEET CRUD + LOCATIONS VALIDATION")
print("=" * 60)

# ── T3.1: CREATE VEHICLE ──────────────────────────────────────────────
print("\n--- Vehicles ---")
vehicle_body = {
    "plate_no": "TEST-001",
    "type": "van",
    "max_weight_kg": 1500.0,
    "max_volume_m3": 12.5,
    "is_active": True,
}
r = requests.post(f"{API}/vehicles", json=vehicle_body, headers=HEADERS)
log("T3.1 POST /vehicles -> 201", r.status_code == 201, f"status={r.status_code}")
vehicle = r.json()
vehicle_id = vehicle.get("id")
log("T3.1a Vehicle has id", vehicle_id is not None, f"id={vehicle_id}")
log("T3.1b plate_no matches", vehicle.get("plate_no") == "TEST-001")
log("T3.1c max_weight_kg correct", vehicle.get("max_weight_kg") == 1500.0)

# T3.2: Duplicate plate_no -> 409
r = requests.post(f"{API}/vehicles", json=vehicle_body, headers=HEADERS)
log("T3.2 Duplicate plate -> 409", r.status_code == 409, f"status={r.status_code}")

# T3.3: GET /vehicles (list with pagination)
r = requests.get(f"{API}/vehicles", headers=HEADERS)
log("T3.3 GET /vehicles -> 200", r.status_code == 200)
body = r.json()
log("T3.3a Has 'data' key", "data" in body)
log("T3.3b Has 'pagination' key", "pagination" in body)
log("T3.3c Pagination has total_items", body.get("pagination", {}).get("total_items", 0) >= 1)

# T3.4: GET /vehicles/{id}
r = requests.get(f"{API}/vehicles/{vehicle_id}", headers=HEADERS)
log("T3.4 GET /vehicles/:id -> 200", r.status_code == 200)

# T3.5: PATCH /vehicles/{id}
r = requests.patch(f"{API}/vehicles/{vehicle_id}",
                   json={"max_weight_kg": 2000.0}, headers=HEADERS)
log("T3.5 PATCH /vehicles/:id -> 200", r.status_code == 200)
log("T3.5a Weight updated", r.json().get("max_weight_kg") == 2000.0)

# T3.6: GET /vehicles/999 -> 404
r = requests.get(f"{API}/vehicles/999999", headers=HEADERS)
log("T3.6 GET /vehicles/999999 -> 404", r.status_code == 404)


# ── T3.7: CREATE DRIVER ──────────────────────────────────────────────
print("\n--- Drivers ---")
driver_body = {
    "user_id": DRIVER_USER_ID,
    "license_no": "D12345678",
    "status": "active",
}
r = requests.post(f"{API}/drivers", json=driver_body, headers=HEADERS)
log("T3.7 POST /drivers -> 201", r.status_code == 201, f"status={r.status_code}")
driver = r.json()
driver_id = driver.get("id")
log("T3.7a Driver has id", driver_id is not None, f"id={driver_id}")
log("T3.7b license_no matches", driver.get("license_no") == "D12345678")

# T3.8: Duplicate driver for same user -> 409
r = requests.post(f"{API}/drivers", json=driver_body, headers=HEADERS)
log("T3.8 Duplicate driver -> 409", r.status_code == 409, f"status={r.status_code}")

# T3.9: GET /drivers (list)
r = requests.get(f"{API}/drivers", headers=HEADERS)
log("T3.9 GET /drivers -> 200 with pagination", r.status_code == 200 and "data" in r.json())

# T3.10: GET /drivers/{id}
r = requests.get(f"{API}/drivers/{driver_id}", headers=HEADERS)
log("T3.10 GET /drivers/:id -> 200", r.status_code == 200)

# T3.11: PATCH /drivers/{id}
r = requests.patch(f"{API}/drivers/{driver_id}",
                   json={"status": "off_duty"}, headers=HEADERS)
log("T3.11 PATCH /drivers/:id -> 200", r.status_code == 200)
log("T3.11a Status updated to off_duty", r.json().get("status") == "off_duty")

# T3.12: Non-driver role user -> 400
r = requests.post(f"{API}/drivers",
                   json={"user_id": DISPATCHER_USER_ID, "license_no": "X"},
                   headers=HEADERS)
log("T3.12 Non-driver role -> 400", r.status_code == 400, f"status={r.status_code}")


# ── T3.13: CREATE SHIFT ──────────────────────────────────────────────
print("\n--- Shifts ---")
now = datetime.utcnow()
shift_body = {
    "driver_id": driver_id,
    "vehicle_id": vehicle_id,
    "starts_at": (now + timedelta(hours=1)).isoformat() + "Z",
    "ends_at": (now + timedelta(hours=9)).isoformat() + "Z",
    "status": "scheduled",
}
r = requests.post(f"{API}/shifts", json=shift_body, headers=HEADERS)
log("T3.13 POST /shifts -> 201", r.status_code == 201, f"status={r.status_code}")
shift = r.json()
log("T3.13a Shift has driver_id", shift.get("driver_id") == driver_id)
log("T3.13b Shift has vehicle_id", shift.get("vehicle_id") == vehicle_id)

# T3.14: Invalid time window -> 400
bad_shift = {
    "driver_id": driver_id,
    "starts_at": (now + timedelta(hours=9)).isoformat() + "Z",
    "ends_at": (now + timedelta(hours=1)).isoformat() + "Z",
}
r = requests.post(f"{API}/shifts", json=bad_shift, headers=HEADERS)
log("T3.14 Bad time window -> 400", r.status_code == 400, f"status={r.status_code}")

# T3.15: Non-existent driver -> 404
r = requests.post(f"{API}/shifts",
                   json={"driver_id": 999999, "starts_at": shift_body["starts_at"],
                         "ends_at": shift_body["ends_at"]},
                   headers=HEADERS)
log("T3.15 Non-existent driver -> 404", r.status_code == 404, f"status={r.status_code}")


# ── T3.16: CREATE LOCATION (with geocoding) ─────────────────────────
print("\n--- Locations ---")
location_body = {
    "label": "Sambast HQ",
    "line1": "123 Main Street",
    "city": "Manila",
    "province": "Metro Manila",
    "postal_code": "1000",
    "lat": 14.5995,
    "lng": 120.9842,
}
r = requests.post(f"{API}/locations", json=location_body, headers=HEADERS)
log("T3.16 POST /locations -> 201", r.status_code == 201, f"status={r.status_code}")
loc = r.json()
loc_id = loc.get("id")
log("T3.16a Location has id", loc_id is not None)
log("T3.16b lat preserved", loc.get("lat") == 14.5995)
log("T3.16c lng preserved", loc.get("lng") == 120.9842)

# T3.17: GET /locations/{id}
r = requests.get(f"{API}/locations/{loc_id}", headers=HEADERS)
log("T3.17 GET /locations/:id -> 200", r.status_code == 200)

# T3.18: Location without lat/lng (triggers geocoding attempt)
geo_body = {
    "label": "Test Geo",
    "line1": "Rizal Park",
    "city": "Manila",
    "province": "Metro Manila",
}
r = requests.post(f"{API}/locations", json=geo_body, headers=HEADERS)
log("T3.18 POST /locations (geocode) -> 201", r.status_code == 201,
    f"lat={r.json().get('lat')} lng={r.json().get('lng')}")


# ═══════════════════════════════════════════════════════════════════════
# CLEANUP: Remove test data
# ═══════════════════════════════════════════════════════════════════════
print("\n--- Cleanup ---")
from app.models.driver_shift import DriverShift
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.location import Location

db = SessionLocal()
db.query(DriverShift).filter(DriverShift.driver_id == driver_id).delete()
db.query(Driver).filter(Driver.id == driver_id).delete()
db.query(Vehicle).filter(Vehicle.id == vehicle_id).delete()
db.query(Location).filter(Location.id.in_([loc_id])).delete()
for email in ["test_dispatcher@sambast.com", "test_driver@sambast.com"]:
    db.query(User).filter(User.email == email).delete()
db.commit()
db.close()
print("  Test data cleaned up.")


# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
total = len(results)
passed = sum(1 for _, p in results if p)
failed = total - passed
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
if failed > 0:
    print("\nFailed tests:")
    for name, p in results:
        if not p:
            print(f"  {FAIL_EMOJI} {name}")
print("=" * 60)

sys.exit(0 if failed == 0 else 1)
