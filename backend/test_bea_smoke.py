"""BE-A smoke test — exercises the new catalog/orders/addresses/payments/
tracking/notifications/analytics endpoints against a live server.

Prereqs: seed_demo.py run (for products + demo customer),
seed_staff.py run (admin). Run: BASE_URL=http://127.0.0.1:8001 python test_bea_smoke.py
"""

import os
import time
import requests

RUN_ID = str(int(time.time()))[-8:]  # unique suffix so reruns don't collide

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
API = f"{BASE}/api/v1"

passed = 0
failed = 0


def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  [OK] {name} — {detail}")
    else:
        failed += 1
        print(f"  [FAIL] {name} — {detail}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


def pin_login(contact_no, pin):
    r = requests.post(f"{API}/auth/login", json={"contact_no": contact_no, "pin": pin})
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


print("=" * 60)
print("BE-A SMOKE TEST")
print("=" * 60)

admin = login("admin@sambast.com", "testpass123")
customer = pin_login("09170000001", "1234")

# ── Categories CRUD ─────────────────────────────────────────────
cat_name = f"Smoke Test Cat {RUN_ID}"
r = requests.post(f"{API}/categories", json={"name": cat_name}, headers=H(admin))
check("POST /categories -> 201", r.status_code == 201, f"{r.status_code}")
cat_id = r.json().get("id") if r.status_code == 201 else None

r = requests.get(f"{API}/categories", headers=H(customer))
check("GET /categories -> 200", r.status_code == 200, f"count={len(r.json().get('data', []))}")

if cat_id:
    r = requests.patch(f"{API}/categories/{cat_id}", json={"name": f"{cat_name} v2"}, headers=H(admin))
    check("PATCH /categories/{id} -> 200", r.status_code == 200 and r.json()["name"] == f"{cat_name} v2", f"{r.status_code}")
    r = requests.post(f"{API}/categories", json={"name": f"{cat_name} v2"}, headers=H(admin))
    check("POST dup category -> 409", r.status_code == 409, f"{r.status_code}")

r = requests.post(f"{API}/categories", json={"name": "Nope"}, headers=H(customer))
check("customer POST /categories -> 403", r.status_code == 403, f"{r.status_code}")

# ── Products: search/filter/sort ────────────────────────────────
r = requests.get(f"{API}/products", headers=H(customer))
check("GET /products -> 200", r.status_code == 200, f"{r.status_code}")
first_product = r.json()["data"][0]
prod_id = first_product["id"]

r = requests.get(f"{API}/products?search=feed", headers=H(customer))
check("GET /products?search=feed", r.status_code == 200, f"hits={r.json()['pagination']['total_items']}")

r = requests.get(f"{API}/products?sort_by=price&sort_order=asc", headers=H(customer))
prices = [float(p["base_price"]) for p in r.json()["data"]]
check("GET /products sort price asc", r.status_code == 200 and prices == sorted(prices), f"{r.status_code}")

r = requests.get(f"{API}/products?category_id={first_product['category_id']}", headers=H(customer))
check("GET /products?category_id", r.status_code == 200, f"hits={r.json()['pagination']['total_items']}")

r = requests.get(f"{API}/products/{prod_id}", headers=H(customer))
check("GET /products/{id} -> 200", r.status_code == 200 and r.json()["id"] == prod_id, f"{r.status_code}")

# ── Customer addresses ──────────────────────────────────────────
addr_payload = {"label": "Home", "line1": "45 España Blvd", "city": "Manila", "lat": 14.6091, "lng": 120.9897, "is_default": True}
r = requests.post(f"{API}/customer_addresses", json=addr_payload, headers=H(customer))
check("POST /customer_addresses -> 201", r.status_code == 201, f"{r.status_code} {r.text[:120]}")
addr_id = r.json().get("id") if r.status_code == 201 else None

r = requests.get(f"{API}/customer_addresses", headers=H(customer))
check("GET /customer_addresses -> 200", r.status_code == 200 and r.json()["data"], f"{r.status_code}")

# ── Quote ───────────────────────────────────────────────────────
quote_body = {
    "items": [{"product_id": prod_id, "quantity": 2}],
    "address": {"line1": "45 España Blvd", "city": "Manila", "lat": 14.6091, "lng": 120.9897},
}
r = requests.post(f"{API}/orders/quote", json=quote_body, headers=H(customer))
check("POST /orders/quote -> 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
if r.status_code == 200:
    s = r.json()["summary"]
    expected_total = float(s["subtotal"]) - float(s["discount_total"]) + float(s["delivery_fee"])
    check("quote has fee+total", "delivery_fee" in s and abs(float(s["total"]) - expected_total) < 0.01, f"{s}")

r = requests.post(f"{API}/orders/quote", json={"items": [{"product_id": 999999, "quantity": 1}]}, headers=H(customer))
check("quote bad product -> 400", r.status_code == 400, f"{r.status_code}")

# ── Create order + idempotency ──────────────────────────────────
order_body = {
    "items": [{"product_id": prod_id, "quantity": 1}],
    "customer_address_id": addr_id,
    "payment_method": "cash",
}
idem_key = f"smoke-key-{RUN_ID}"
r = requests.post(f"{API}/orders", json=order_body, headers={**H(customer), "Idempotency-Key": idem_key})
check("POST /orders -> 201", r.status_code == 201, f"{r.status_code} {r.text[:200]}")
order = r.json() if r.status_code == 201 else {}

if order:
    check("order status READY_FOR_DISPATCH", order["status"] == "READY_FOR_DISPATCH", order["status"])
    expected_total = float(order["subtotal"]) - float(order["discount_total"]) + float(order["delivery_fee"])
    check("order totals add up", abs(float(order["total_price"]) - expected_total) < 0.01, "")
    check("order has items", len(order["items"]) >= 1, "")
    order_no = order["order_no"]

    r = requests.post(f"{API}/orders", json=order_body, headers={**H(customer), "Idempotency-Key": idem_key})
    check("idempotent replay -> 409", r.status_code == 409, f"{r.status_code}")

    r = requests.get(f"{API}/orders", headers=H(customer))
    check("GET /orders (customer, own only)", r.status_code == 200 and all(o["customer_id"] == order["customer_id"] for o in r.json()["data"]), f"{r.status_code}")

    r = requests.get(f"{API}/orders?status=CANCELLED", headers=H(admin))
    check("GET /orders (admin sees all)", r.status_code == 200, f"{r.status_code}")

    r = requests.get(f"{API}/orders/{order_no}", headers=H(customer))
    check("GET /orders/{no} -> 200", r.status_code == 200 and r.json()["order_no"] == order_no, "")

    r = requests.get(f"{API}/orders/{order_no}/status", headers=H(customer))
    check("GET /orders/{no}/status", r.status_code == 200 and r.json()["status"] == "READY_FOR_DISPATCH", f"{r.status_code}")

    # public tracking
    r = requests.get(f"{API}/track/{order_no}")
    check("GET /track/{no} public", r.status_code == 200 and r.json()["order_no"] == order_no, f"{r.status_code}")

    # dispatch queue sees it
    r = requests.get(f"{API}/dispatch/queue", headers=H(admin))
    check("order lands in dispatch queue", r.status_code == 200 and any(o["order_no"] == order_no for o in r.json()["data"]), f"{r.status_code}")

    # payment: mark paid (staff)
    r = requests.post(f"{API}/payments", json={"order_no": order_no, "method": "cash"}, headers=H(admin))
    check("POST /payments -> paid", r.status_code == 200 and r.json()["status"] == "paid", f"{r.status_code} {r.text[:120]}")

    # cancel
    r = requests.post(f"{API}/orders/{order_no}/cancel", json={"reason": "Changed my mind"}, headers=H(customer))
    check("POST /orders/{no}/cancel -> CANCELLED", r.status_code == 200 and r.json()["status"] == "CANCELLED", f"{r.status_code}")

    r = requests.post(f"{API}/orders/{order_no}/cancel", json={"reason": "again"}, headers=H(customer))
    check("double cancel -> 409", r.status_code == 409, f"{r.status_code}")

    r = requests.post(f"{API}/orders/{order_no}/cancel", json={}, headers=H(customer))
    check("cancel w/o reason -> 422", r.status_code == 422, f"{r.status_code}")

# ── Notifications ───────────────────────────────────────────────
r = requests.get(f"{API}/notifications", headers=H(customer))
check("GET /notifications -> 200", r.status_code == 200, f"count={len(r.json().get('data', []))}")

r = requests.get(f"{API}/notifications", headers=H(admin))
check("GET /notifications staff -> 200", r.status_code == 200, f"{r.status_code}")

# ── Analytics (admin/ops) ───────────────────────────────────────
for path in ["stats", "top-products", "least-selling", "revenue-trend", "order-status-distribution", "category-performance"]:
    r = requests.get(f"{API}/analytics/{path}", headers=H(admin))
    check(f"GET /analytics/{path}", r.status_code == 200, f"{r.status_code}")

r = requests.get(f"{API}/analytics/stats", headers=H(customer))
check("customer /analytics -> 403", r.status_code == 403, f"{r.status_code}")

print("=" * 60)
print(f"RESULTS: {passed}/{passed + failed} passed, {failed} failed")
print("=" * 60)
