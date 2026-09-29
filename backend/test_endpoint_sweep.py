"""
Endpoint sweep — hits every GET route with seeded ids and each role's token.

Requires the dev server running at BASE and the seed scripts applied.
Prints a status matrix; exit 1 if any route returns 5xx or an unexpected 401/403.

Usage: python test_endpoint_sweep.py
"""

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api/v1"

PASS = "PASS"
FAIL = "FAIL"
results = []


def request(method, path, token=None, body=None, timeout=15):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, json.loads(res.read() or b"null")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read() or b"null")
        except Exception:
            return exc.code, None
    except Exception as exc:
        return -1, str(exc)


def login(email, password):
    status, data = request("POST", "/auth/login", body={"email": email, "password": password})
    if status != 200:
        print(f"[FATAL] login {email} -> {status} {data}")
        raise SystemExit(1)
    return data["access_token"]


def check(role, method, path, token, allowed, note=""):
    status, data = request(method, path, token=token, body=None)
    ok = status in allowed
    results.append((ok, role, method, path, status, note))
    tag = "OK " if ok else "!! "
    print(f"  [{tag}] {role:11s} {method} {path:52s} -> {status} {note}")


print("=" * 72)
print("ENDPOINT SWEEP — every GET, per role")
print("=" * 72)

admin = login("admin@sambast.com", "testpass123")
dispatcher = login("dispatcher@sambast.com", "testpass123")
ops = login("ops@sambast.com", "testpass123")
customer = login("customer@sambast.com", "testpass123")

def items_of(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("items", "data", "results"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


# Resolve seeded ids
_, cats = request("GET", "/categories", token=admin)
cat_id = items_of(cats)[0]["id"] if items_of(cats) else 1

_, prods = request("GET", "/products?limit=1", token=admin)
prod_id = items_of(prods)[0]["id"] if items_of(prods) else 1

_, drivers = request("GET", "/drivers", token=dispatcher)
driver_id = items_of(drivers)[0]["id"] if items_of(drivers) else 1

_, orders = request("GET", "/orders", token=customer)
order_no = items_of(orders)[0]["order_no"] if items_of(orders) else "ORD-00000000"

_, vehicles = request("GET", "/vehicles", token=dispatcher)
veh_id = items_of(vehicles)[0]["id"] if items_of(vehicles) else 1

_, shifts = request("GET", "/shifts", token=dispatcher)
shift_id = items_of(shifts)[0]["id"] if items_of(shifts) else 1

_, routes_l = request("GET", "/routes", token=dispatcher)
route_id = items_of(routes_l)[0]["id"] if items_of(routes_l) else 1

_, addrs = request("GET", "/customer_addresses", token=customer)
addr_id = items_of(addrs)[0]["id"] if items_of(addrs) else None

print(f"\nseeded ids: cat={cat_id} prod={prod_id} driver={driver_id} order={order_no} veh={veh_id} shift={shift_id} route={route_id} addr={addr_id}")

STAFF_READS = [
    ("GET", "/analytics/stats"),
    ("GET", "/analytics/revenue-trend"),
    ("GET", "/analytics/order-status-distribution"),
    ("GET", "/analytics/top-products"),
    ("GET", "/analytics/least-selling"),
    ("GET", "/analytics/category-performance"),
    ("GET", "/analytics/delivery-costs"),
    ("GET", "/analytics/driver-performance"),
    ("GET", "/analytics/failed-deliveries"),
    ("GET", "/categories"),
    ("GET", f"/categories/{cat_id}"),
    ("GET", "/products"),
    ("GET", f"/products/{prod_id}"),
    ("GET", "/dispatch/queue"),
    ("GET", "/drivers"),
    ("GET", f"/drivers/{driver_id}"),
    ("GET", f"/drivers/{driver_id}/manifest"),
    ("GET", "/shifts"),
    ("GET", "/vehicles"),
    ("GET", f"/vehicles/{veh_id}"),
    ("GET", "/routes"),
    ("GET", f"/routes/{route_id}"),
]

print("\n--- admin ---")
for method, path in STAFF_READS:
    check("admin", method, path, admin, {200})

print("\n--- dispatcher ---")
for method, path in STAFF_READS:
    # dispatcher is denied admin-only surfaces: analytics cost/driver reports
    allowed = {200} if not path.startswith("/analytics/") else {200, 403}
    check("dispatcher", method, path, dispatcher, allowed)

print("\n--- ops_manager ---")
for method, path in STAFF_READS:
    allowed = {200} if not (path.startswith("/dispatch/") or path.startswith("/drivers") or path.startswith("/shifts") or path.startswith("/vehicles") or path.startswith("/routes")) else {200, 403}
    check("ops", method, path, ops, allowed)

print("\n--- customer reads ---")
check("customer", "GET", "/customer_addresses", customer, {200})
if addr_id is not None:
    check("customer", "GET", f"/customer_addresses/{addr_id}", customer, {200})
else:
    print("  [OK ] customer    GET /customer_addresses/{id}      -> skipped (no saved addresses)")
check("customer", "GET", "/orders", customer, {200})
check("customer", "GET", f"/orders/{order_no}", customer, {200})
check("customer", "GET", f"/orders/{order_no}/status", customer, {200})
check("customer", "GET", "/notifications", customer, {200})
check("customer", "GET", "/products", customer, {200})
check("customer", "GET", f"/products/{prod_id}", customer, {200})
check("customer", "GET", "/categories", customer, {200})
check("customer", "GET", "/dispatch/queue", customer, {403})
check("customer", "GET", "/drivers", customer, {403})
check("customer", "GET", "/analytics/stats", customer, {403})

print("\n--- driver role on staff surfaces ---")
driver_tok = login("driver1@sambast.com", "testpass123")
check("driver", "GET", "/drivers", driver_tok, {403})
check("driver", "GET", "/dispatch/queue", driver_tok, {403})
check("driver", "GET", "/me/route", driver_tok, {200, 404}, "(404 ok if no route assigned today)")

print("\n--- public ---")
status, _ = request("GET", "/health".replace(API, ""), timeout=10) if False else (None, None)
req = urllib.request.Request(f"{BASE}/health")
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        print(f"  [OK ] public     GET /health -> {res.status}")
        results.append((res.status == 200, "public", "GET", "/health", res.status, ""))
except Exception as exc:
    print(f"  [!! ] public     GET /health -> {exc}")
    results.append((False, "public", "GET", "/health", -1, str(exc)))

check("public", "GET", f"/track/{order_no}", None, {200})
check("public", "GET", "/orders", None, {401, 403})
check("public", "GET", "/drivers", None, {401, 403})

# SSE headers check (2s open then close)
print("\n--- SSE streams (headers only) ---")
for name, url, tok in [
    ("order stream", f"{API}/track/{order_no}/stream", customer),
    ("fleet stream", f"{API}/fleet/stream", dispatcher),
]:
    r = urllib.request.Request(url)
    if tok:
        r.add_header("Authorization", f"Bearer {tok}")
    try:
        res = urllib.request.urlopen(r, timeout=10)
        ctype = res.headers.get("Content-Type", "")
        ok = res.status == 200 and "text/event-stream" in ctype
        res.close()
        print(f"  [{'OK ' if ok else '!! '}] {name}: {res.status} {ctype}")
        results.append((ok, "sse", "GET", url, res.status, ctype))
    except Exception as exc:
        print(f"  [!! ] {name}: {exc}")
        results.append((False, "sse", "GET", url, -1, str(exc)))

fails = [row for row in results if not row[0]]
print("\n" + "=" * 72)
print(f"RESULTS: {len(results) - len(fails)}/{len(results)} passed")
for _, role, method, path, status, note in fails:
    print(f"  FAIL {role} {method} {path} -> {status} {note}")
print("=" * 72)
raise SystemExit(1 if fails else 0)
