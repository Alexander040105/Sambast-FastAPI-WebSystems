"""
Validation script for BE-A T3 — /api/v1/auth.

Covers: staff logins for all seeded roles, the full customer
register -> OTP verify -> PIN set -> token flow, refresh, logout
(+ audit row), and the negative/guardrail cases.

Prereqs: run `python scripts/seed_staff.py`, server live at BASE_URL
(default http://127.0.0.1:8000 — override via env var).

Run from backend/:  .venv/Scripts/python test_auth.py
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
API = f"{BASE}/api/v1"
AUTH = f"{API}/auth"
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


def err_code(r) -> str:
    return r.json().get("error", {}).get("code", "")


sys.path.insert(0, ".")
from app.core.security import decode_token, hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.audit_log import AuditLog  # noqa: E402
from app.models.user import User  # noqa: E402

TS = int(time.time())
TEST_EMAIL = f"test.auth.{TS}@sambast.com"
TEST_PHONE = f"09{TS % 1_000_000_000:09d}"
TEST_EMAIL_2 = f"test.auth2.{TS}@sambast.com"
TEST_PHONE_2 = f"08{TS % 1_000_000_000:09d}"
TEST_EMAIL_3 = f"test.auth3.{TS}@sambast.com"
TEST_PHONE_3 = f"07{TS % 1_000_000_000:09d}"
KNOWN_OTP = "654321"


def set_otp(email: str, code: str = KNOWN_OTP, expired=False, attempts=0,
            resend_count=None, stale_last_sent=False):
    """Inject a known OTP / manipulate OTP state directly in the DB."""
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        u.otp_code_hash = hash_password(code)
        u.otp_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=-1 if expired else 10)
        u.otp_attempts = attempts
        if resend_count is not None:
            u.otp_resend_count = resend_count
        if stale_last_sent:
            u.otp_last_sent_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════
# A — STAFF LOGINS (all seeded roles)
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("A — STAFF LOGINS")
print("=" * 60)

staff = [
    ("admin@sambast.com", "admin"),
    ("dispatcher@sambast.com", "dispatcher"),
    ("ops@sambast.com", "ops_manager"),
    ("driver1@sambast.com", "driver"),
]
tokens = {}
for email, role in staff:
    r = httpx.post(f"{AUTH}/login", json={"email": email, "password": "testpass123"})
    ok = r.status_code == 200
    log(f"A login {role}", ok, f"status={r.status_code}")
    if not ok:
        continue
    body = r.json()
    tokens[role] = body["access_token"]
    claims_ok = (
        body.get("token_type") == "bearer"
        and decode_token(body["access_token"]).get("type") == "access"
        and decode_token(body["access_token"]).get("role") == role
        and body.get("user", {}).get("role") == role
    )
    log(f"A {role} JWT claims + user shape", claims_ok)

# Role-permitted access to GET /api/v1/drivers (dispatcher/admin/ops allowed)
for role, expected in [("dispatcher", 200), ("admin", 200),
                       ("ops_manager", 200), ("driver", 403)]:
    r = httpx.get(f"{API}/drivers",
                  headers={"Authorization": f"Bearer {tokens.get(role, '')}"})
    log(f"A /drivers as {role} -> {expected}", r.status_code == expected,
        f"status={r.status_code}")

# Seeded customer PIN login -> customer JWT is rejected by /drivers
r = httpx.post(f"{AUTH}/login", json={"contact_no": "09123456789", "pin": "1234"})
log("A customer PIN login", r.status_code == 200, f"status={r.status_code}")
if r.status_code == 200:
    tokens["customer"] = r.json()["access_token"]
    r2 = httpx.get(f"{API}/drivers",
                   headers={"Authorization": f"Bearer {tokens['customer']}"})
    log("A /drivers as customer -> 403", r2.status_code == 403,
        f"status={r2.status_code}")


# ═══════════════════════════════════════════════════════════════════════
# B — FULL CUSTOMER FLOW
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("B — CUSTOMER REGISTER -> OTP -> PIN -> TOKENS")
print("=" * 60)

r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Auth Test", "contact_no": TEST_PHONE, "email": TEST_EMAIL},
    timeout=30)
body = r.json()
log("B register -> 200", r.status_code == 200, f"status={r.status_code}")
log("B register shape",
    body.get("user_id") is not None
    and body.get("email_masked", "").startswith("te")
    and body.get("resend_available_in") == 60,
    f"body={body}")

# Inject a known OTP (test can't read the real inbox)
set_otp(TEST_EMAIL)

r = httpx.post(f"{AUTH}/otp/verify", json={"email": TEST_EMAIL, "otp": "000000"})
log("B wrong OTP -> 400 OTP_INVALID",
    r.status_code == 400 and err_code(r) == "OTP_INVALID",
    f"{r.status_code} {r.json()}")

r = httpx.post(f"{AUTH}/otp/verify", json={"email": TEST_EMAIL, "otp": KNOWN_OTP})
log("B correct OTP -> verified", r.status_code == 200 and r.json().get("verified") is True,
    f"{r.status_code} {r.json()}")

r = httpx.post(f"{AUTH}/pin/set", json={
    "email": TEST_EMAIL, "pin": "4321", "pin_confirm": "1234"})
log("B pin mismatch -> 422", r.status_code == 422 and err_code(r) == "VALIDATION_ERROR",
    f"{r.status_code}")

r = httpx.post(f"{AUTH}/pin/set", json={
    "email": TEST_EMAIL, "pin": "4321", "pin_confirm": "4321"})
log("B pin/set -> tokens", r.status_code == 200
    and "access_token" in r.json() and "refresh_token" in r.json()
    and r.json().get("user", {}).get("role") == "customer",
    f"status={r.status_code}")
cust = r.json()

r = httpx.post(f"{AUTH}/refresh", json={"refresh_token": cust["refresh_token"]})
log("B refresh -> new access token",
    r.status_code == 200 and r.json().get("token_type") == "bearer"
    and decode_token(r.json()["access_token"]).get("type") == "access",
    f"status={r.status_code}")

r = httpx.post(f"{AUTH}/refresh", json={"refresh_token": cust["access_token"]})
log("B refresh w/ access token -> 401",
    r.status_code == 401 and err_code(r) == "INVALID_TOKEN_TYPE",
    f"{r.status_code} {r.json()}")

r = httpx.post(f"{AUTH}/login", json={"contact_no": TEST_PHONE, "pin": "4321"})
log("B login with new PIN -> 200", r.status_code == 200, f"status={r.status_code}")

r = httpx.post(f"{AUTH}/logout",
               headers={"Authorization": f"Bearer {cust['access_token']}"})
log("B logout -> 204", r.status_code == 204, f"status={r.status_code}")
db = SessionLocal()
audit = db.query(AuditLog).filter(
    AuditLog.user_id == cust["user"]["id"],
    AuditLog.action == "User logged out").first()
db.close()
log("B logout wrote audit_logs row", audit is not None,
    f"category={audit.category if audit else 'MISSING'}")


# ═══════════════════════════════════════════════════════════════════════
# C — NEGATIVES & GUARDRAILS
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("C — NEGATIVES & GUARDRAILS")
print("=" * 60)

# Validation
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Bad", "contact_no": "12345", "email": TEST_EMAIL_2})
log("C register bad contact_no -> 422",
    r.status_code == 422 and err_code(r) == "VALIDATION_ERROR", f"{r.status_code}")

r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Bad", "contact_no": TEST_PHONE_2, "email": "not-an-email"})
log("C register bad email -> 422",
    r.status_code == 422 and err_code(r) == "VALIDATION_ERROR", f"{r.status_code}")

# 409 — already-registered customer (seeded customer has pin_hash)
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Dup", "contact_no": "09123456789",
    "email": "customer@sambast.com"})
log("C register existing customer -> 409", r.status_code == 409, f"{r.status_code}")

# 409 — contact and email bound to DIFFERENT accounts
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Dup", "contact_no": "09123456789",
    "email": "admin@sambast.com"})
log("C register contact+email on diff accounts -> 409",
    r.status_code == 409, f"{r.status_code}")

# 409 — staff email can't be hijacked by registration
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Dup", "contact_no": TEST_PHONE_2,
    "email": "admin@sambast.com"})
log("C register staff email -> 409", r.status_code == 409, f"{r.status_code}")

# Re-register pending row (user 2) — resets and re-issues
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Pending Two", "contact_no": TEST_PHONE_2,
    "email": TEST_EMAIL_2}, timeout=30)
log("C register pending user -> 200", r.status_code == 200, f"{r.status_code}")

# Expired OTP
set_otp(TEST_EMAIL_2, expired=True)
r = httpx.post(f"{AUTH}/otp/verify", json={"email": TEST_EMAIL_2, "otp": KNOWN_OTP})
log("C expired OTP -> 400 OTP_EXPIRED",
    r.status_code == 400 and err_code(r) == "OTP_EXPIRED", f"{r.status_code}")

# Attempt lockout — 4 prior failures, wrong 5th locks it
set_otp(TEST_EMAIL_2, attempts=4)
r = httpx.post(f"{AUTH}/otp/verify", json={"email": TEST_EMAIL_2, "otp": "000000"})
log("C 5th wrong OTP -> locked",
    r.status_code == 400 and "Too many invalid attempts" in r.json().get("error", {}).get("message", ""),
    f"{r.status_code} {r.json()}")
r = httpx.post(f"{AUTH}/otp/verify", json={"email": TEST_EMAIL_2, "otp": KNOWN_OTP})
log("C correct OTP after lockout still rejected",
    r.status_code == 400 and err_code(r) == "OTP_MAX_ATTEMPTS", f"{r.status_code}")

# Resend cooldown — registered <60s ago
r = httpx.post(f"{AUTH}/otp/resend", json={"email": TEST_EMAIL_2})
log("C resend within 60s -> 429",
    r.status_code == 429 and err_code(r) == "RESEND_COOLDOWN"
    and r.json().get("error", {}).get("details", {}).get("retry_after") is not None,
    f"{r.status_code} {r.json()}")

# Resend limit — 3 used, cooldown expired
set_otp(TEST_EMAIL_2, resend_count=3, stale_last_sent=True)
r = httpx.post(f"{AUTH}/otp/resend", json={"email": TEST_EMAIL_2})
log("C 4th resend -> 429 RESEND_LIMIT",
    r.status_code == 429 and err_code(r) == "RESEND_LIMIT", f"{r.status_code}")

# pin/set without OTP verification
r = httpx.post(f"{AUTH}/register", json={
    "full_name": "Pending Three", "contact_no": TEST_PHONE_3,
    "email": TEST_EMAIL_3}, timeout=30)
log("C register user3 -> 200", r.status_code == 200, f"{r.status_code}")
r = httpx.post(f"{AUTH}/pin/set", json={
    "email": TEST_EMAIL_3, "pin": "1234", "pin_confirm": "1234"})
log("C pin/set unverified -> 403",
    r.status_code == 403 and err_code(r) == "OTP_NOT_VERIFIED", f"{r.status_code}")

# PIN login before PIN set -> PIN_NOT_SET
r = httpx.post(f"{AUTH}/login", json={"contact_no": TEST_PHONE_3, "pin": "1234"})
log("C login w/o PIN -> 403 PIN_NOT_SET",
    r.status_code == 403 and err_code(r) == "PIN_NOT_SET", f"{r.status_code}")

# Login failures
r = httpx.post(f"{AUTH}/login", json={
    "email": "admin@sambast.com", "password": "wrongpass"})
log("C staff wrong password -> 401",
    r.status_code == 401 and err_code(r) == "INVALID_CREDENTIALS", f"{r.status_code}")

r = httpx.post(f"{AUTH}/login", json={"contact_no": "09999999999", "pin": "0000"})
log("C unknown contact -> 401",
    r.status_code == 401 and err_code(r) == "INVALID_CREDENTIALS", f"{r.status_code}")

r = httpx.post(f"{AUTH}/login", json={"email": "admin@sambast.com"})
log("C login half-credentials -> 422", r.status_code == 422, f"{r.status_code}")

# Unauthenticated logout
r = httpx.post(f"{AUTH}/logout")
log("C logout no bearer -> 401/403", r.status_code in (401, 403),
    f"status={r.status_code} body={r.json()}")


# ═══════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════
print("\n--- Cleanup ---")
db = SessionLocal()
for email in [TEST_EMAIL, TEST_EMAIL_2, TEST_EMAIL_3]:
    u = db.query(User).filter(User.email == email).first()
    if u:
        db.query(AuditLog).filter(AuditLog.user_id == u.id).delete()
        db.delete(u)
db.commit()
db.close()
print("  Test users removed.")


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
