# Demo Accounts — Login Credentials

All accounts seeded by `backend/scripts/seed_staff.py` and
`backend/scripts/seed_demo.py`. Login endpoint is
`POST /api/v1/auth/login` — everyone signs in with **email + password**
(the same form serves customers and staff).

## Staff accounts — `users` table

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

```json
POST /api/v1/auth/login
{ "email": "<email>", "password": "testpass123" }
```

| Customer | Email | Password | Contact No. | Source |
|---|---|---|---|---|
| Test Customer | `customer@sambast.com` | `testpass123` | `09123456789` | `seed_staff.py` |
| Maria Santos | `maria.santos.demo@gmail.com` | `testpass123` | `09170000001` | `seed_demo.py` |
| Jose Rizal | `jose.rizal.demo@gmail.com` | `testpass123` | `09170000002` | `seed_demo.py` |
| Ana Reyes | `ana.reyes.demo@gmail.com` | `testpass123` | `09170000003` | `seed_demo.py` |
| Adobo Free | `adobofree@gmail.com` (real inbox) | `testpass123` | `09170000004` | `seed_demo.py` |

Legacy PIN login still works over the API — seeded customers also carry
`pin_hash` (PIN `1234`):

```json
POST /api/v1/auth/login
{ "contact_no": "<phone>", "pin": "1234" }
```

## Self-registration flows (make new accounts at runtime)

- **New customer:** `/register` in the UI (or `POST /auth/register` with
  `{full_name, contact_no, email, password}`) — returns tokens
  immediately, signed in on success.
- **New driver / staff:** hidden page **`/staff/register`** — type the URL
  directly; it is intentionally not linked from `/register` or anywhere
  in nav.
  - **Driver** — public self-serve (no login needed). Anonymous visitors
    are signed in and land on `/driver`; admins creating a driver keep
    their admin session.
  - **Admin / Dispatcher / Ops Manager** — requires an admin session
    (sign in first, then return to `/staff/register`). Calls
    `POST /api/v1/admin/users` behind the scenes.
- `POST /auth/register/driver` and `POST /admin/users` remain available
  via `/docs` for API-level demos.
- The OTP/PIN endpoints (`/auth/otp/verify`, `/auth/otp/resend`,
  `/auth/pin/set`) remain available but unused by the UI — retained for
  the legacy contact_no + PIN login path.

## Non-working legacy rows (leftover from baseline seed)

These rows exist in the DB but **cannot log in** — they were seeded by
the original colleague seed with unknown credentials:

- `dispatch@sambast.local` (users, dispatcher) — rejects `testpass123`
- `driver@sambast.local` (users, driver) — rejects `testpass123`
- `customer@sambast.local` in `customers` (dispatch seed placeholder, no
  password/PIN) — unreachable via any login flow

## Email overrides

`seed_staff.py` reads `SEED_ADMIN_EMAIL`, `SEED_DISPATCHER_EMAIL`,
`SEED_OPS_EMAIL`, `SEED_DRIVER_EMAIL`, `SEED_CUSTOMER_EMAIL` env vars —
set them to real Gmail addresses before seeding if you want OTP emails
delivered to actual inboxes.
