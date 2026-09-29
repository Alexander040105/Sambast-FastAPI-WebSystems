# Sambast — Delivery & Logistics Management Platform

Sambast is a delivery & logistics platform for a mid-size delivery operation.
Customers place orders through the storefront; dispatchers review the order
queue and assign drivers; the system builds optimized multi-stop routes;
drivers work a mobile manifest and capture proof of delivery; customers track
orders live; and management watches performance analytics.

Stack: **React (Vite) · FastAPI · SQLAlchemy 2.x · Alembic · PostgreSQL (Neon)**
Realtime: server-sent events (SSE). Email: SMTP.

## Roles

| Role | Surface | Home |
|---|---|---|
| System administrator | Catalog CRUD, staff provisioning, all orders | `/admin/catalog` |
| Dispatcher | Fleet (drivers/vehicles/shifts), dispatch queue, routes | `/dispatcher/fleet` |
| Driver | Route manifest, stop lifecycle, POD capture | `/driver` |
| Customer | Storefront, cart/checkout, orders, live tracking | `/customer` |
| Operations manager | Performance, costs, failed deliveries | `/ops` |

## Feature checklist

- Automatic driver assignment (active shift, vehicle capacity, delivery
  window, proximity scoring) with manual override
- Route optimization — nearest-neighbor + 2-opt with time-window penalties
- Delivery time windows per order
- Vehicle capacity constraints (weight/volume)
- Driver availability via `driver_shifts`
- Multiple delivery stops per route
- Failed delivery handling — reason codes, auto re-queue, terminal `RETURNED`
  after 3 attempts or `delivery_declined`
- Proof of delivery — photo upload, recipient name, geo tag
- Real-time delivery status — SSE streams for customer tracking and fleet
- Customer notifications — emailed on order placed, assigned,
  out-for-delivery, delivered, failed/returned; logged in `notifications`
- Driver performance analytics + admin catalog/order stats
- Delivery cost calculation — per-order delivery fee and per-route cost

## Repository layout

```
backend/
  app/
    main.py             FastAPI app, error envelope, router mounting
    core/               config, security (JWT/bcrypt), deps, errors
    db/                 engine/session
    models/             ORM models — customers, orders, deliveries, routes,
                        drivers, vehicles, delivery_stops, locations,
                        payments, delivery_statuses, proof_of_delivery, ...
    schemas/            Pydantic request/response models
    routers/            auth, orders, dispatch, routes, driver_app, tracking,
                        notifications, analytics, admin, catalog, fleet, ...
    services/           pricing, assignment, routing, costing, geocoding,
                        notifications, email, otp, sse
  alembic/              migrations (baseline + customer split)
  scripts/              seed_demo.py, seed_dispatch_demo.py, seed_staff.py, ...
frontend/
  src/
    api/                client + endpoint modules
    auth/               token storage, role map
    components/         ProtectedRoute, AdminRoute, RequireRole
    layouts/            CustomerLayout, AdminLayout, DispatcherLayout,
                        DriverLayout, OpsManagerLayout + router
    pages/              auth, storefront, cart, checkout, orders, tracking,
                        notifications, admin, dispatcher, driver, ops
legacy_code/            original Flask app — reference only, do not run
```

## Setup

Requires Python ≥ 3.11 and Node ≥ 22.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Create `backend/.env` (never commit it):

```
DATABASE_URL=<Neon pooled URL>
DATABASE_URL_DIRECT=<Neon direct URL, for alembic>
JWT_SECRET=<random secret>
JWT_ALGORITHM=HS256
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail address>
SMTP_PASSWORD=<app password>
```

Run migrations and seed demo data:

```bash
cd backend
alembic upgrade head
.venv/Scripts/python scripts/seed_staff.py      # staff + test customer
.venv/Scripts/python scripts/seed_demo.py       # catalog + customers + orders
.venv/Scripts/python scripts/seed_dispatch_demo.py  # drivers, vehicles, locations
uvicorn app.main:app --reload                   # http://localhost:8000/docs
```

Note: the seed scripts truncate tables — only run them on a demo database.

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :8000
npm run build        # production build
```

## Demo flow

Demo credentials are in `DEMO_ACCOUNTS.md` — everyone signs in with
email + `testpass123` (staff and customers alike).

1. Customer logs in (email + password) → storefront → cart → checkout
   (delivery address + time window) → order placed (`READY_FOR_DISPATCH`).
2. Dispatcher logs in → `/dispatcher/queue`
   shows the new order → auto-assign or manual assign → create/optimize a
   route.
3. Driver logs in → `/driver` shows today's manifest → start → arrive →
   complete with POD photo → or fail (order re-queues for another attempt).
4. Customer watches `/customer/orders/:no/track` — SSE updates without
   refresh; status emails fire at each transition.
5. Ops manager at `/ops` sees updated driver performance, delivery cost, and
   failed-delivery analytics.

## API surface

All endpoints are under `/api/v1` with JWT bearer auth and a consistent
error envelope `{ "error": { "code", "message" } }`. Full interactive docs at
`/docs` when the backend is running.

- `auth` — register, login (staff + customer, email + password),
  refresh, logout; OTP verify/resend + PIN set retained for the legacy
  contact_no + PIN login path
- `products`, `categories` — catalog browse; admin CRUD
- `orders` — quote, create, list, detail, status, cancel
- `dispatch` — queue, manual assign, auto-assign
- `drivers`, `vehicles`, `shifts`, `locations` — fleet management
- `routes` — create, list, detail, optimize, reorder
- driver workflow — `/me/route`, `/stops/{id}/start|arrive|complete|fail`,
  `/deliveries/{id}/pod`
- `tracking` — `GET /track/{order_no}`, `/track/{order_no}/stream` (SSE),
  `/fleet/stream` (SSE)
- `notifications` — list, test
- `analytics` — driver performance, delivery costs, failed deliveries,
  admin stats/rankings/trends
- `admin` — staff user provisioning
