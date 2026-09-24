# TASKS.md — 5-Day Build Task Board

> Step-by-step task list for the group of 4 building the **Sambast Delivery &
> Logistics Management Platform** (React + Tailwind + FastAPI + PostgreSQL/Neon).
> Derived from `MEGAPLAN.md` — read §7 (API Contract & REST Standards) before
> writing any endpoint; **it is law**.
>
> **How to use:** find your track, work top to bottom. Every task shows its
> dependencies (*Needs:*) and completion bar (*Done when:*). If blocked, check
> the dependency map and jump to the next unblocked task — never sit idle.

## Roles

| Tag | Member owns |
|---|---|
| **BE-A** | Backend — Customer & Order: `users`/auth, `orders`, `order_items`, `payments`, `customer_addresses`, notifications, catalog APIs, SSE channels, delivery costing |
| **FE-A** | Frontend — Customer & Order: auth pages, storefront/cart/checkout, order history, live tracking, admin catalog screens |
| **BE-B** | Backend — Dispatch/Driver/Route: `drivers`, `vehicles`, `driver_shifts`, `routes`, `deliveries`, `delivery_stops`, `delivery_status_events`, `proof_of_delivery`, `locations`, geocoding, assignment + routing engines, ops analytics |
| **FE-B** | Frontend — Dispatch/Driver/Route: dispatcher console, driver mobile-first views, ops manager dashboard |
| **Joint** | All four together |

## Rules

1. **Contract is law** — MEGAPLAN §7. Changes need both BEs in the same PR.
2. **One PR per task** into `main`; keep them small.
3. **Definition of done**: endpoint works in FastAPI `/docs` + frontend consumes
   it + demo'd to the other pair.
4. **15-min sync every morning** — blockers, contract changes, integration.
5. **`legacy_code/` is reference only** — port logic, never run/patch it.
6. **Never trust client prices** — quote recomputes server-side.
7. **JSON is `snake_case`**; enums `UPPER_SNAKE`; state changes use action
   endpoints (`POST /stops/{id}/arrive`), never `PATCH {status}`.

## Dependency map — what unblocks what

| Unlocks | Blocked by |
|---|---|
| Everything | Baseline migration (Joint, D1-T1) |
| FE-A auth pages | BE-A auth endpoints |
| FE-B dispatch queue UI | BE-B dispatch queue + auto-assign |
| FE-A checkout | BE-A `/orders/quote` + `POST /orders` |
| FE-B driver app | BE-B `/me/route` + stop actions |
| FE-A tracking page | BE-A SSE stream endpoints |
| FE-B ops dashboard | BE-B analytics endpoints |
| Auto-assign real data | `driver_shifts`, `vehicles`, geocoded `locations` |
| Route optimizer | `deliveries` + `delivery_stops` + geocoded stops |

**While blocked:** build screens/services against the §7 contract with mocked
responses — the contract won't change, so mocks stay valid.

---

## Dev environment — how to run what's already installed

Prereqs: Node ≥ 22.20 (`node --version`), Python ≥ 3.11 (`python --version`), Git.

### Backend — `backend/` (FastAPI)

```bash
cd backend
python -m venv .venv                 # first time only (already done on the setup machine)
.venv\Scripts\activate               # PowerShell/CMD — Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt      # first time only — pinned deps
uvicorn app.main:app --reload        # → http://127.0.0.1:8000 — Swagger UI at /docs
```

Create `backend/.env` (never committed — share values privately) with:

```
DATABASE_URL=          # pooled Neon URL — from `neon link` (T0-2)
DATABASE_URL_DIRECT=   # unpooled Neon URL — used by Alembic
JWT_SECRET=            # any long random string
JWT_ALGORITHM=HS256
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=             # Gmail address for OTP/notification emails
SMTP_PASSWORD=         # Gmail app password
NOMINATIM_USER_AGENT=sambast-delivery/1.0
```

### Frontend — `frontend/` (React + Tailwind)

```bash
cd frontend
npm install    # first time only
npm run dev    # → http://localhost:5173
```

Requests to `/api/*` proxy to `localhost:8000` (already configured in
`vite.config.js`) — the backend must be running.

### Neon database — one person only (task T0-2)

```bash
npm i -g neon@latest
neon auth                                                    # browser sign-in
neon link --project-id falling-salad-70422753 --branch production -y
```

This writes `.neon` context + pulls `DATABASE_URL`/`DATABASE_URL_UNPOOLED`.
Everyone else just copies the values into their own `backend/.env`.

### Daily workflow

1. `git pull` → create a feature branch per task
2. Terminal 1: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload`
3. Terminal 2: `cd frontend && npm run dev`
4. After model changes: `alembic revision --autogenerate -m "..."` then
   `alembic upgrade head` (uses `DATABASE_URL_DIRECT`)

---

## Day 0 — Joint pre-flight (~2 hrs, everyone)

- [ ] **T0-1 — All:** verify `node --version` ≥ 22.20, `python --version` ≥
      3.11, Git. Pull latest `main`. One feature branch per task.
- [ ] **T0-2 — Neon owner (assign one person, default BE-B):**
      `npm i -g neon@latest` → `neon auth` →
      `neon link --project-id falling-salad-70422753 --branch production -y`
      → commit `.neon` (IDs only, no secrets). Create `backend/.env` with
      `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT` (unpooled, for Alembic),
      `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `SMTP_*` (reuse legacy values),
      `NOMINATIM_USER_AGENT=sambast-delivery/1.0`. **Skip** `neon config init`
      / `neon deploy` — those provision managed auth we don't use.
- [ ] **T0-3 — Joint:** update `.gitignore` — add `node_modules/`, `dist/`,
      `backend/uploads/`. `legacy_code/` stays untouched as porting reference.
- [ ] **T0-4 — BE-A + BE-B:** scaffold `backend/`:
      `app/main.py` (app factory, CORS, router mounting),
      `app/core/{config,security,deps}.py` (pydantic-settings, JWT+hashing,
      `get_db` + `require_role` guards), `app/db/session.py`,
      `app/models/`, `app/schemas/`, `app/routers/`, `app/services/`,
      `alembic/`, `uploads/`, `scripts/`.
      `pip install fastapi "uvicorn[standard]" sqlalchemy alembic
      psycopg[binary] pydantic-settings python-jose[cryptography]
      passlib[bcrypt] httpx python-multipart`
- [ ] **T0-5 — FE-A + FE-B:** scaffold `frontend/` — Vite + React +
      Tailwind + react-router; shared `src/api/` client with JWT bearer
      interceptor; role-based layout shells; dev proxy `/api` →
      `localhost:8000`.
- [ ] **T0-6 — All verify:** `uvicorn app.main:app` boots and connects to
      Neon; Vite dev server proxies one request successfully.

---

## Track BE-A — Customer & Order Backend

### Day 1

- [ ] **T1 — Contract session (Joint, first hour).** Confirm MEGAPLAN §7:
      order lifecycle `PENDING → CONFIRMED → READY_FOR_DISPATCH → ASSIGNED →
      OUT_FOR_DELIVERY → COMPLETED` (+ `CANCELLED` w/ reason); stop lifecycle
      `PENDING → EN_ROUTE → ARRIVED → DELIVERED | FAILED → REATTEMPT |
      RETURNED`; roles `customer|driver|dispatcher|admin|ops_manager`; JWT
      `{sub, role}`; SSE shape `{event:"status", data:{delivery_id, order_no,
      status, lat, lng, ts}}`; Location `{line1, line2, city, province,
      postal_code, lat, lng}`; envelope `{error:{code,message,details?}}`;
      `{data, pagination}` lists.
- [ ] **T2 — Baseline Alembic migration (with BE-B, ~2h).** All §6 tables:
      `users, drivers, vehicles, driver_shifts, audit_logs, categories,
      products, locations, customer_addresses, orders, order_items, payments,
      routes, deliveries, delivery_stops, delivery_status_events,
      proof_of_delivery, notifications`. `BIGSERIAL`/`UUID` PKs,
      `NUMERIC(12,2)` money, `TIMESTAMPTZ`, `JSONB`. Include
      `products.weight_kg_per_unit`, `orders.delivery_window_start/end`,
      `orders.delivery_fee`. *Done when:* `alembic upgrade head` runs clean
      on Neon.
- [ ] **T3 — Auth.** `POST /api/v1/auth/register`, `/auth/otp/verify`,
      `/auth/otp/resend`, `/auth/pin/set`, `/auth/login`, `/auth/refresh`,
      `/auth/logout`. Port OTP guardrails from `legacy_code/app.py` exactly:
      6-digit code, 10-min expiry, 5 attempts, 60s resend cooldown, max 3
      resends. Staff = email+password. **Never port the hardcoded admin OTP
      `"123456"`.** *Needs:* T2. *Done when:* all 5 roles can log in via JWT.

### Day 2

- [ ] **T4 — Catalog APIs.** `GET /products` (filter/search/pagination),
      `GET /categories`; admin CRUD `/admin/products`, `/admin/categories`
      ported from legacy. *Needs:* T2.
- [ ] **T5 — Pricing service.** `services/pricing.py` — quote recomputes unit
      options, multipliers, per-unit discounts from DB rows. Client prices
      never trusted. *Needs:* T4. *Done when:* `POST /orders/quote` returns
      server-computed totals matching legacy logic.
- [ ] **T6 — Orders.** `POST /api/v1/orders` (geocoded delivery address,
      `delivery_window_start/end`, `delivery_fee` via `services/costing.py`
      v1 = base + per-km, `payments` row `cash`/`pending`, →
      `READY_FOR_DISPATCH` on confirm, `Idempotency-Key` dedupe);
      `GET /orders`, `GET /orders/{no}`, `GET /orders/{no}/status`,
      `POST /orders/{no}/cancel` (reason required → `CANCELLED`).
      *Needs:* T5 + BE-B T3 (locations). *Done when:* a placed order lands in
      `GET /dispatch/queue`.

### Day 3

- [ ] **T7 — SSE streams.** `GET /api/v1/track/{order_no}/stream` (customer),
      `GET /api/v1/fleet/stream` (dispatcher) — broadcast new
      `delivery_status_events` rows using the §7.2 event shape.
      *Needs:* BE-B T6 (status events exist).
- [ ] **T8 — Notifications.** On each status change → SMTP email (assigned /
      en-route / delivered / failed; reuse `EmailMessage` pattern from
      legacy); log every send to `notifications`. *Needs:* T7.

### Day 4

- [ ] **T9 — Admin analytics port.** `/admin/stats`, `/top-products`,
      `/least-selling`, `/revenue-trend`, `/order-status-distribution`,
      `/category-performance` — same queries as `legacy_code/app.py`,
      Postgres dialect. Audit-log writes on all staff actions.
- [ ] **T10 — Cancellation email + order admin endpoints** for FE-A admin
      screens. Polish, edge cases.

### Day 5

- [ ] **T11 — `scripts/seed_demo.py`** (or pair with BE-B): adapt
      `legacy_code/seed.py` + `seed_analytics.py` — 3 drivers, 3 vehicles
      (distinct capacities), ~10 geocoded locations, ~100 orders across
      windows/statuses, all 5 role accounts w/ documented credentials.
- [ ] **T12 — Bugfix buffer + README run instructions** (`uvicorn`, `.env`
      vars). Demo rehearsal.

---

## Track FE-A — Customer & Order Frontend

### Day 1

- [ ] **T1 — Contract session (Joint).** Same as BE-A T1.
- [ ] **T2 — Frontend scaffold (with FE-B).** From Day-0 T0-5: finalize
      `src/api/` client (JWT bearer interceptor, `snake_case` bodies, error
      envelope handling), role-based layout shells, react-router route map,
      Tailwind theme baseline. *Done when:* app shells render per role.
- [ ] **T3 — Customer auth pages.** Register → OTP → set PIN → login, wired
      to BE-A T3 endpoints. *Needs:* BE-A T3. *Done when:* a real customer can
      register and log in end-to-end.

### Day 2

- [ ] **T4 — Storefront + cart.** Product list (pagination/filter/search),
      product detail with unit options, cart state. *Needs:* BE-A T4.
- [ ] **T5 — Checkout.** Address form w/ geocode preview (BE-B geocoding),
      delivery-window picker, live fee from `POST /orders/quote`, submit →
      `POST /orders` with `Idempotency-Key`. *Needs:* BE-A T5/T6.
- [ ] **T6 — Order history + detail.** List w/ status badges; detail page
      showing items + status timeline. *Needs:* BE-A T6.

### Day 3

- [ ] **T7 — Live tracking page.** SSE-driven status timeline + ETA + driver
      info on `GET /track/{order_no}/stream`; graceful fallback to 5s polling
      on `GET /track/{order_no}` if SSE fails. *Needs:* BE-A T7.
- [ ] **T8 — Notification UX.** In-page status toasts/banner; verify emails
      arrive. *Needs:* BE-A T8.

### Day 4

- [ ] **T9 — Admin catalog/order screens.** Product/category CRUD, order
      list + cancel-with-reason wired to BE-A T9/T10.
- [ ] **T10 — UI polish** across customer app; empty states, loading,
      mobile check.

### Day 5

- [ ] **T11 — Bugfix buffer.** Customer-facing bugs first.
- [ ] **T12 — Demo rehearsal** — you drive the customer side of the demo
      script (order → tracking).

---

## Track BE-B — Dispatch/Driver/Route Backend

### Day 1

- [ ] **T1 — Contract session (Joint).** Same as BE-A T1.
- [ ] **T2 — Baseline Alembic migration (with BE-A, ~2h).** Same task as
      BE-A T2 — pair on it.
- [ ] **T3 — Fleet CRUD + locations.** `GET/POST/PATCH /drivers[/{id}]`,
      `/vehicles[/{id}]`, `POST /shifts`; `locations` model +
      `services/geocoding.py` (Nominatim lookup + manual lat/lng override).
      *Needs:* T2. *Done when:* dispatcher can CRUD drivers, vehicles,
      shifts via API.

### Day 2

- [ ] **T4 — Dispatch queue.** `GET /api/v1/dispatch/queue` — orders in
      `READY_FOR_DISPATCH` w/ window + geocoded address. *Needs:* T2.
- [ ] **T5 — Manual assign.** `POST /dispatch/orders/{id}/assign` — creates
      `deliveries` row + first `delivery_status_events` entry; order →
      `ASSIGNED`. *Needs:* T4.
- [ ] **T6 — Auto-assign v0.** `services/assignment.py`: filter drivers by
      (a) active shift now, (b) `vehicle.max_weight_kg` ≥ order weight
      (`products.weight_kg_per_unit` × qty × unit_multiplier), (c) window
      fit; score by proximity to depot/first stop.
      `POST /dispatch/auto-assign` returns pick + reason for UI display.
      *Needs:* T3, T4. *Done when:* returns valid driver + explanation, and
      refuses cleanly when none qualify.

### Day 3

- [ ] **T7 — Routes + stops.** `POST /routes` (build route from a driver's
      assigned deliveries), `delivery_stops` w/ `sequence_no`, `planned_eta`.
      *Needs:* T5.
- [ ] **T8 — Route optimizer.** `services/routing.py` — nearest-neighbor +
      2-opt over stop lat/lng (haversine), respecting windows + capacity.
      `POST /routes/{id}/optimize`, `PATCH /routes/{id}` (manual reorder —
      required fallback). *Needs:* T7.
- [ ] **T9 — Driver app endpoints.** `GET /me/route` (manifest + ordered
      stops), `POST /stops/{id}/arrive`, `/complete`, `/fail`; `POST
      /deliveries/{id}/pod` (photo → `backend/uploads/`, recipient name,
      timestamp, lat/lng); fail → reason codes + re-queue to dispatch;
      **every transition writes a `delivery_status_events` row** and emits
      the SSE event. *Needs:* T7. *Done when:* full stop lifecycle works in
      `/docs` and events appear in `delivery_status_events`.

### Day 4

- [ ] **T10 — Ops analytics.** `GET /analytics/driver-performance` (on-time
      %, deliveries/day, failure rate), `/analytics/delivery-costs`,
      `/analytics/failed-deliveries`. *Needs:* T9 (event data exists).
- [ ] **T11 — Costing v2.** distance × vehicle rate + driver time →
      `routes.cost`; reconcile `orders.delivery_fee` (shared with BE-A T6).

### Day 5

- [ ] **T12 — Seed or bugfix** (seed_demo.py if not done by BE-A; else own
      optimizer fixes — highest slip risk).
- [ ] **T13 — Demo rehearsal** — you drive dispatch + driver portions.

---

## Track FE-B — Dispatch/Driver/Route Frontend

### Day 1

- [ ] **T1 — Contract session (Joint).** Same as BE-A T1.
- [ ] **T2 — Frontend scaffold (with FE-A).** Same task as FE-A T2 — pair on
      it.
- [ ] **T3 — Dispatcher shell + fleet CRUD.** Layout, nav, driver/vehicle/
      shift management screens wired to BE-B T3. *Needs:* BE-B T3.

### Day 2

- [ ] **T4 — Dispatch queue UI.** Order list (window, address, weight) →
      order detail → assign-driver dropdown **showing the auto-assign
      suggestion + reason**; manual override + `POST /dispatch/auto-assign`
      button. *Needs:* BE-B T4–T6.

### Day 3

- [ ] **T5 — Driver mobile-first views.** Today's manifest (`GET /me/route`),
      ordered stop list, arrive/complete/fail buttons, POD capture
      (`<input type="file" accept="image/*">`), failure-reason picker.
      Design for a phone viewport. *Needs:* BE-B T9.
- [ ] **T6 — Route detail view.** Ordered stop list per route; manual reorder
      (`PATCH /routes/{id}`); Leaflet+OSM map **only if ahead of schedule**.
      *Needs:* BE-B T7/T8.

### Day 4

- [ ] **T7 — Ops manager dashboard.** Charts (Recharts) for driver
      performance, delivery costs, failed deliveries. *Needs:* BE-B T10.
- [ ] **T8 — Dispatcher fleet view.** Live fleet statuses on
      `GET /fleet/stream` (SSE). *Needs:* BE-A T7.

### Day 5

- [ ] **T9 — Bugfix buffer.** Dispatcher/driver-facing bugs first.
- [ ] **T10 — Demo rehearsal** — you drive the dispatcher console +
      ops dashboard in the demo.

---

## Joint checkpoints (do not skip)

| When | Checkpoint | Passes when |
|---|---|---|
| Day 1 EOD | Auth + schema | 5 roles log in; JWT works both frontends; migration clean on Neon |
| Day 2 EOD | Order → dispatch | Order placed → in queue → manual AND auto assign → `deliveries` row |
| Day 3 EOD | Live delivery | Driver walks multi-stop route on phone; customer page updates w/o refresh; POD saved; failed delivery re-queues |
| Day 4 EOD | Full vertical E2E | Order → auto-assign → optimized route → POD → live tracking → ops metric — run **twice**, clean |
| Day 5 | Demo | Script rehearsed: customer → dispatch → driver → tracking → ops; README updated; final commit + tag |

## Fastest-path notes

- **Start in parallel:** FE-A/FE-B build against §7 contract with mocked
  responses while BE catches up — the contract is law, so mocks stay valid.
- **Critical path:** contract session → baseline migration → auth → orders →
  dispatch → routing. Protect it; everything else is parallel slack.
- **Optimizer is the biggest slip risk.** If it breaks Day 5, manual
  `PATCH /routes/{id}` reorder still demos "multiple delivery stops" — don't
  sink the demo for it.
- **Nominatim down?** Fall back to the preset barangay → lat/lng list.
- **SSE blocked?** 5s polling on the same status endpoints.
- **Cut list is final:** no Gemini AI, SMS, real payments, object storage,
  Google Maps, WebSockets, pets. Scope creep = missed deadline.
