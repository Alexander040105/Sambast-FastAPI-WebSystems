# Auth Guide — How to Register & Log In Every Role

**Stack:** FastAPI + Neon Postgres · All endpoints under `http://localhost:8000/api/v1` · Contract: `MEGAPLAN.md` §7

---

## Role hierarchy

```
admin ──────► can do EVERYTHING a dispatcher can, PLUS admin-only work
              (create staff accounts, delete drivers, audit logs, …)

dispatcher ─► can create drivers & do fleet/dispatch work,
              but CANNOT do admin work (403 on /admin/*)

ops_manager ► fleet read/analytics side
driver      ► own deliveries only (driver-app endpoints)
customer    ► own orders only — registers publicly with OTP → PIN
```

**Admins are dispatchers-plus.** Every endpoint that allows `dispatcher`
also allows `admin`. Nothing that requires `admin` allows `dispatcher`.

**Two tables, two kinds of identity:** staff (`admin`, `dispatcher`,
`ops_manager`, `driver`) live in `users`; customers live in their own
`customers` table (it owns contact_no/PIN/OTP state). JWTs carry a
`role` claim — `customer` tokens resolve against `customers`, everything
else against `users`.

## The 5 roles at a glance

| Role | How the account is created | How they log in |
|---|---|---|
| `customer` | **Self-service** — public register → OTP → PIN | `POST /auth/login` `{contact_no, pin}` |
| `admin` | Seed script, or another admin via `POST /admin/users` | `POST /auth/login` `{email, password}` |
| `dispatcher` | Seed script, or `POST /admin/users` (admin only) | `POST /auth/login` `{email, password}` |
| `ops_manager` | Seed script, or `POST /admin/users` (admin only) | `POST /auth/login` `{email, password}` |
| `driver` | **Self-service** — `POST /auth/register/driver`, or `POST /drivers` by a dispatcher/admin (creates user+profile in one call), or `POST /admin/users` | `POST /auth/login` `{email, password}` |

> **Customers and drivers** register themselves publicly — drivers get a
> `users` row + `drivers` profile atomically, no OTP (trusted like staff
> provisioning). Admin / dispatcher / ops_manager are **seeded or
> provisioned** — a public staff-signup endpoint would let anyone claim
> admin, so it doesn't exist.

---

## 0. Prereqs

```bash
cd backend
.venv\Scripts\activate
python scripts/seed_staff.py     # seeds one account per role (idempotent)
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Seeded credentials (password `testpass123` for staff, PIN `1234` for customer):

```
admin@sambast.com · dispatcher@sambast.com · ops@sambast.com · driver1@sambast.com
customer@sambast.com → phone 09123456789, pin 1234
```

---

## 1. Customer — register → OTP → set PIN (self-service)

### Step 1 — Register

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Juan Cruz", "contact_no": "09171234567", "email": "juan@gmail.com"}'
```

```json
{ "user_id": 24, "email_masked": "ju**@gmail.com", "resend_available_in": 60 }
```

- `contact_no` = exactly 11 digits; a real email is needed (the OTP is emailed).
- Re-registering a half-finished account **resets it** and sends a fresh OTP.
- `409` = contact and/or email belongs to a finished (or staff) account.

### Step 2 — Verify the OTP from the inbox

```bash
curl -X POST http://localhost:8000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "juan@gmail.com", "otp": "123456"}'
```

```json
{ "verified": true }
```

- 6 digits, **10-min expiry**, **5 attempts** max (then resend).

### Step 2b (optional) — Resend

```bash
curl -X POST http://localhost:8000/api/v1/auth/otp/resend \
  -H "Content-Type: application/json" \
  -d '{"email": "juan@gmail.com"}'
```

- `429 RESEND_COOLDOWN` within 60s (`error.details.retry_after`); `429 RESEND_LIMIT` after 3 resends.

### Step 3 — Set the PIN (auto-logs you in)

```bash
curl -X POST http://localhost:8000/api/v1/auth/pin/set \
  -H "Content-Type: application/json" \
  -d '{"email": "juan@gmail.com", "pin": "4321", "pin_confirm": "4321"}'
```

```json
{
  "access_token": "eyJhbGciOiJI...",
  "refresh_token": "eyJhbGciOiJI...",
  "token_type": "bearer",
  "user": { "id": 24, "role": "customer", "name": "Juan Cruz", "email": "juan@gmail.com" }
}
```

### Step 4 — Later logins

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"contact_no": "09171234567", "pin": "4321"}'
```

PIN never set → `403 PIN_NOT_SET` (route the user back to registration).

---

## 2. Staff with real Gmail — `POST /admin/users` (admin only)

Admins provision dispatcher / ops_manager / other-admin / driver accounts:

```bash
# log in as admin first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@sambast.com", "password": "testpass123"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# create a dispatcher using THEIR OWN gmail
curl -X POST http://localhost:8000/api/v1/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.real@gmail.com", "name": "Alex Dispatcher", "password": "theirPass123", "role": "dispatcher"}'
```

→ `201 {"id": 27, "role": "dispatcher", "name": "...", "email": "..."}`

- `role` must be one of `admin | dispatcher | ops_manager | driver`
  (`customer` is rejected — customers use the public PIN flow).
- `password` min 8 chars; duplicate email → `409`.
- Writes an `audit_logs` row. **Dispatchers/customers calling this → 403.**
- There is no OTP/email-verify step for staff — they're trusted
  provisioning, so hand them the password you set.

The new dispatcher then logs in normally:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.real@gmail.com", "password": "theirPass123"}'
```

---

## 3. Drivers — self-register, or a dispatcher creates them

**Option A — driver self-registration** (no login needed):

```bash
curl -X POST http://localhost:8000/api/v1/auth/register/driver \
  -H "Content-Type: application/json" \
  -d '{"email": "driver.real@gmail.com", "password": "driverPass1", "name": "Real Driver", "license_no": "L-0001"}'
```

→ `201` with access + refresh tokens — the driver is logged in
immediately. Creates the `users` row (`role="driver"`) **and** the
`drivers` profile atomically. `license_no`/`phone` are optional.
Duplicate email (in `users` **or** `customers`) → `409`. No OTP — same
trusted model as staff provisioning.

**Option B — dispatcher/admin provisions them:** send
`email/name/password` instead of `user_id` and the endpoint creates the
**user account + driver profile in one call**:

```bash
curl -X POST http://localhost:8000/api/v1/drivers \
  -H "Authorization: Bearer <dispatcher_or_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "driver.real@gmail.com", "name": "Real Driver", "password": "driverPass1", "license_no": "L-0001", "status": "active"}'
```

→ `201` with the driver profile (`id`, `user_id`, `license_no`, …).

- The old way still works: `{"user_id": 18, "license_no": "..."}` to link a
  pre-existing `role="driver"` user.
- Duplicate email → `409`; duplicate driver profile → `409`.
- Driver then logs in with `{email, password}` like staff.

---

## 4. Using the tokens

```bash
# Authenticated call
curl http://localhost:8000/api/v1/drivers -H "Authorization: Bearer <access_token>"

# Access token expired? (30 min)
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
# -> {"access_token": "...", "token_type": "bearer"}   (refresh lives 7 days)

# Logout — writes an audit_logs row for staff, returns 204
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

---

## 5. Error codes you'll hit

| Code | When |
|---|---|
| `VALIDATION_ERROR` | 422 — bad field format (contact_no ≠ 11 digits, bad email, PIN ≠ 4 digits, pin mismatch, bad role) |
| `CONFLICT` | 409 — register collision; duplicate email on `/admin/users` or `/drivers` |
| `OTP_NOT_FOUND` | 400 — no pending registration for that email |
| `OTP_EXPIRED` | 400 — code older than 10 min → resend |
| `OTP_INVALID` | 400 — wrong code (message shows attempts left) |
| `OTP_MAX_ATTEMPTS` | 400 — 5 wrong tries → resend a new code |
| `OTP_NOT_VERIFIED` | 403 — pin/set before OTP verify |
| `PIN_ALREADY_SET` | 409 — pin/set on a finished account |
| `PIN_NOT_SET` | 403 — PIN login on a half-registered account |
| `RESEND_COOLDOWN` | 429 — `error.details.retry_after` seconds to wait |
| `RESEND_LIMIT` | 429 — 3 resends used → register again |
| `INVALID_CREDENTIALS` | 401 — wrong email/password or contact/pin |
| `ACCOUNT_INACTIVE` | 401 — account disabled |
| `UNAUTHORIZED` / `FORBIDDEN` | 401 no/bad JWT · 403 role not permitted (e.g. dispatcher → `/admin/*`) |
| `INVALID_TOKEN` / `INVALID_TOKEN_TYPE` | 401 — bad JWT / access token sent to `/refresh` |
| `EMAIL_SEND_FAILED` | 503 — SMTP down or creds missing |

---

## 6. Quickest path (demo day)

| You need... | Do this |
|---|---|
| A customer | `register` → inbox → `otp/verify` → `pin/set` |
| An admin/dispatcher/ops account | log in as admin → `POST /admin/users` with their real Gmail |
| A driver | they self-register via `POST /auth/register/driver`, OR log in as dispatcher → `POST /drivers` |
| Any login | staff: `{email, password}` · customer: `{contact_no, pin}` |
| Fresh tokens | `login` (or `refresh` if you kept the refresh token) |
