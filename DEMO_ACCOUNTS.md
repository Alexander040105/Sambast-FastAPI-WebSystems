# Demo Accounts — Login Credentials

All accounts seeded by `backend/scripts/seed_staff.py` and
`backend/scripts/seed_demo.py`. Login endpoint is
`POST /api/v1/auth/login` — the request shape differs per account type.

## Staff accounts — `users` table

Login with **email + password**:

```json
POST /api/v1/auth/login
{ "email": "<email>", "password": "testpass123" }
```

| Role | Email | Password | Notes |
|---|---|---|---|
| `admin` | `admin@sambast.com` | `testpass123` | Full access — admin, dispatch, analytics |
| `admin` | `alexanderjonsolis0401@gmail.com` | `testpass123` | Full access — admin, dispatch, analytics |
| `dispatcher` | `dispatcher@sambast.com` | `testpass123` | Fleet + dispatch queue |
| `ops_manager` | `ops@sambast.com` | `testpass123` | Fleet read + analytics |
| `driver` | `driver1@sambast.com` | `testpass123` | Also has a `drivers` profile row (shows up in `GET /drivers`) |

## Customer accounts — `customers` table

Login with **contact number + PIN**:

```json
POST /api/v1/auth/login
{ "contact_no": "<phone>", "pin": "1234" }
```

| Customer | Contact No. | PIN | Email (receives OTP/order updates) | Source |
|---|---|---|---|---|
| Test Customer | `09123456789` | `1234` | `customer@sambast.com` | `seed_staff.py` |
| Maria Santos | `09170000001` | `1234` | `maria.santos.demo@gmail.com` | `seed_demo.py` |
| Jose Rizal | `09170000002` | `1234` | `jose.rizal.demo@gmail.com` | `seed_demo.py` |
| Ana Reyes | `09170000003` | `1234` | `ana.reyes.demo@gmail.com` | `seed_demo.py` |
| Adobo Free | `09170000004` | `1234` | `adobofree@gmail.com` (real inbox) | `seed_demo.py` |

## Self-registration flows (make new accounts at runtime)

- **New customer:** `POST /auth/register` → `POST /auth/otp/verify`
  (code sent via SMTP email — check `AUTH_GUIDE.md`) →
  `POST /auth/pin/set` → then PIN login above.
- **New driver:** `POST /auth/register/driver` with
  `{email, password, name, license_no, ...}` — returns tokens
  immediately, no OTP needed.

## Non-working legacy rows (leftover from baseline seed)

These rows exist in the DB but **cannot log in** — they were seeded by
the original colleague seed with unknown credentials:

- `dispatch@sambast.local` (users, dispatcher) — rejects `testpass123`
- `driver@sambast.local` (users, driver) — rejects `testpass123`
- `dispatch@sambast.local` in `customers` (id=1, no phone/PIN) — leftover
  row from the customer-split migration; unreachable via any login flow

## Email overrides

`seed_staff.py` reads `SEED_ADMIN_EMAIL`, `SEED_DISPATCHER_EMAIL`,
`SEED_OPS_EMAIL`, `SEED_DRIVER_EMAIL`, `SEED_CUSTOMER_EMAIL` env vars —
set them to real Gmail addresses before seeding if you want OTP emails
delivered to actual inboxes.
