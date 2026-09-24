# MEGAPLAN — Sambast Delivery & Logistics Management Platform

> **How to use this file.** This is a single self-contained prompt for an AI
> coding agent (SWE-2 Max). Paste it in full to kick off the build, or paste
> individual Day sections as scoped tasks. It is also the team's step-by-step
> guide: every step has an owner tag — **BE-A**, **FE-A**, **BE-B**, **FE-B**,
> or **Joint** — for our group of 4 working over 5 days.
>
> Team split: **Team A (BE-A + FE-A)** owns Customer & Order side.
> **Team B (BE-B + FE-B)** owns Dispatch, Driver & Route side.

---

## 1. Role & Mission

You are an autonomous senior full-stack engineering agent. Rebuild the legacy
Sambast e-commerce app — a Flask + SQLite monolith living in `legacy_code/` —
into a **Delivery & Logistics Management Platform**.

The business problem: a medium-sized delivery company receives hundreds of
orders per day. Dispatchers currently assign deliveries to drivers manually,
producing inefficient routes, overloaded drivers, delayed deliveries, and poor
visibility. Build the platform that manages the entire delivery operation
end-to-end.

The legacy app is **porting reference only, never runtime**. Read its business
logic (pricing, OTP guardrails, audit categories, stock deduction) from
`legacy_code/app.py` and port it — do not run or patch it as part of this build.

---

## 2. Tech Stack — Non-Negotiable

| Layer | Technology |
|---|---|
| Frontend | **React** (Vite) + **Tailwind CSS** + react-router |
| Backend | **FastAPI** (Python ≥ 3.11) + `uvicorn[standard]` |
| Database | **PostgreSQL hosted on Neon** (serverless) — SQLAlchemy 2.x + Alembic migrations |
| Auth | JWT access + refresh tokens (`python-jose[cryptography]`), bcrypt via `passlib` |
| Realtime | Server-Sent Events (SSE) — not WebSockets |
| Geocoding | Nominatim (OSM) with manual lat/lng override |
| Notifications | Email via SMTP (reuse `EmailMessage` pattern from legacy) |
| File uploads | Local disk `backend/uploads/` (POD photos, product images) |
| Payments | COD only (`method='cash'`) |

Python deps: `fastapi "uvicorn[standard]" sqlalchemy alembic psycopg[binary]
pydantic-settings python-jose[cryptography] passlib[bcrypt] httpx
python-multipart`.

Node ≥ 22.20 (Neon CLI needs it), Python ≥ 3.11, Git.

---

## 3. Users & Roles

Implement all 5 roles via a single `users` table with a `role` column and JWT
claims `{sub, role}` enforced by a `require_role(...)` dependency:

| Role | Capabilities |
|---|---|
| **System Administrator** | Manages users, staff accounts, catalog, system config, audit logs |
| **Dispatcher** | Reviews incoming orders, assigns/overrides drivers, manages routes and delivery windows |
| **Driver** | Receives assignments, follows route manifest, updates stop status, captures proof of delivery |
| **Customer** | Places orders, pays (COD), tracks delivery in real time, receives notifications |
| **Operations Manager** | Analyzes performance: delivery times, driver metrics, costs, failed deliveries |

Customers keep the legacy **email-OTP → 4-digit PIN** flow. Staff roles use
email + password. Seed all 5 role accounts with documented credentials.

---

## 4. Core Workflow (the pipeline you must implement)

```
Customer places order
        ↓
Order enters system            (validated & priced server-side)
        ↓
Dispatcher reviews orders      (dispatch queue: window, geocoded address)
        ↓
System assigns driver          (auto-assignment: availability, capacity, proximity)
        ↓
System generates delivery route(multi-stop optimization across assigned orders)
        ↓
Driver receives assignments    (driver app: manifest + route order)
        ↓
Driver updates delivery status (en route → arrived → delivered/failed + POD)
        ↓
Customer tracks order          (realtime status + ETA + notifications)
        ↓
Management analyzes performance(ops dashboards: driver metrics, costs, failures)
```

---

## 5. Required Complex Features — All 12 Must Ship

1. **Automatic driver assignment** — `services/assignment.py`: filter drivers
   by active shift, vehicle `max_weight_kg` ≥ order weight
   (`products.weight_kg_per_unit` × qty × unit_multiplier), delivery-window
   fit; score by proximity to depot/first stop. Return the pick + reasoning so
   the UI can display it. Dispatcher can always override manually.
2. **Route optimization** — `services/routing.py`: nearest-neighbor
   construction + 2-opt improvement over stop lat/lng (haversine), respecting
   time windows and vehicle capacity. `PATCH /routes/{id}` manual reorder is
   the required fallback.
3. **Delivery time windows** — `orders.delivery_window_start/end` captured at
   checkout; enforced by assignment + routing.
4. **Vehicle capacity constraints** — `vehicles.max_weight_kg` /
   `max_volume_m3` vs. computed order load; hard-filter in assignment.
5. **Driver availability** — `driver_shifts` (driver + vehicle + start/end);
   only on-shift drivers are assignable.
6. **Multiple delivery stops** — `delivery_stops.sequence_no` ordering per
   route; one route = one driver's run.
7. **Failed delivery handling** — `FAILED` status + reason codes + re-attempt
   flow (re-queue to dispatch) + `RETURNED` terminal state.
8. **Proof of delivery** — `proof_of_delivery` table; photo upload
   (`<input type="file" accept="image/*">` → `backend/uploads/`), recipient
   name, timestamp, lat/lng.
9. **Real-time delivery status** — SSE channels:
   `GET /api/v1/track/{order_no}/stream` (customer),
   `GET /api/v1/fleet/stream` (dispatcher). Event shape:
   `{event:"status", data:{delivery_id, order_no, status, lat, lng, ts}}`.
10. **Customer notifications** — `notifications` table + SMTP emails on
    assigned / en-route / delivered / failed.
11. **Driver performance analytics** — on-time %, deliveries/day, failure
    rate per driver.
12. **Delivery cost calculation** — `services/costing.py`: v1 = base fee +
    per-km (Day 2); v2 = distance × vehicle rate + driver time →
    `routes.cost`, reconcile `orders.delivery_fee` (Day 4).

---

## 6. Data Model — Single Baseline Alembic Migration

PostgreSQL. All PKs `BIGSERIAL` or `UUID`; money `NUMERIC(12,2)`; timestamps
`TIMESTAMPTZ`; JSON strings from legacy become `JSONB`.

### Identity & access
- `users`: id, role (`customer|driver|dispatcher|admin|ops_manager`), email,
  phone, password_hash, pin_hash, otp fields, is_active, created_at
- `drivers`: id, user_id FK, license_no, status (`active|off_duty|suspended`),
  home_location_id FK
- `vehicles`: id, plate_no, type, max_weight_kg, max_volume_m3, is_active
- `driver_shifts`: id, driver_id FK, vehicle_id FK, starts_at, ends_at, status
- `audit_logs`: id, user_id FK, action, category, metadata JSONB, created_at

### Catalog (ported from legacy)
- `categories`: id, name, unit_options JSONB
- `products`: id, category_id FK, name, description, base_price, unit,
  unit_options JSONB, discounts JSONB, **weight_kg_per_unit**, stock_quantity
  (merge legacy `stock_status`+`stock_quantity` into one column), image_url,
  is_archived, purpose, target_species, tags

### Ordering & delivery (the required entities)
- `locations`: id, label, line1, line2, city, province, postal_code, lat, lng,
  place_id
- `customer_addresses`: id, customer_id FK, location_id FK, label, is_default
- `orders`: id, order_no, customer_id FK, delivery_location_id FK,
  delivery_window_start, delivery_window_end, status, subtotal,
  discount_total, delivery_fee, total_price, payment_id FK,
  cancellation_reason, created_at
- `order_items`: id, order_id FK, product_id FK, quantity, selected_unit,
  unit_multiplier, base_price_at_time, discount_amount_at_time, price_at_time
- `payments`: id, order_id FK, method, amount, status, reference, paid_at
- `routes`: id, driver_id FK, vehicle_id FK, shift_id FK, date, status
  (`planned|active|completed`), total_distance_km, est_duration_min, cost
- `deliveries`: id, order_id FK, route_id FK, driver_id FK, status,
  assigned_at, attempt_no, failure_reason, cost
- `delivery_stops`: id, route_id FK, delivery_id FK, location_id FK,
  sequence_no, planned_eta, arrived_at, departed_at, status
- `delivery_status_events`: id, delivery_id FK, status, note, lat, lng,
  actor_user_id, created_at — immutable history; powers tracking + audit
- `proof_of_delivery`: id, delivery_id FK, type (`photo|signature|otp`),
  file_url, recipient_name, captured_at, lat, lng
- `notifications`: id, user_id FK, channel, template, payload JSONB, status,
  sent_at

**Required-entity coverage check** — spec → table(s): Customer → `users`
(role=customer) + `customer_addresses`; Order → `orders`; OrderItem →
`order_items`; Driver → `drivers` + `users`; Vehicle → `vehicles`; Delivery →
`deliveries`; DeliveryStop → `delivery_stops`; Route → `routes`; Location →
`locations`; Payment → `payments`; DeliveryStatus → `delivery_status_events`
(+ `deliveries.status`). All 11 covered.

---

## 7. API Contract & REST Standards — Treat as Law

REST under `/api/v1`, JWT bearer auth. This section is the team's standard for
every endpoint; changing it requires both backend devs in the same PR.

### 7.1 REST conventions

**Resource naming**

- Plural nouns, lowercase, hyphenate multi-word: `/delivery-stops`,
  `/driver-shifts`, `/customer-addresses`
- **No verbs in paths** — ❌ `/getOrders`, `/createDriver`,
  `/orders/{id}/updateStatus`; ✅ `GET /orders`, `POST /drivers`
- Nested paths only for true sub-resources that can't stand alone
  (`/orders/{no}/items`). If the child has its own identity, keep it flat:
  `/stops/{id}`, not `/routes/{id}/stops/{sid}`.

**HTTP method semantics**

| Method | Use | Rules |
|---|---|---|
| `GET` | Read one resource or a list | Safe + idempotent; must never mutate state |
| `POST` | Create a resource, or invoke a lifecycle action (see below) | 201 + created resource, or 200 + action result |
| `PATCH` | Partial update | Only provided fields change; never requires the full object |
| `PUT` | Full replace | Discouraged — prefer `PATCH` |
| `DELETE` | Remove | 204 on success, 404 if not found |

**State transitions use action endpoints.** Any change that fires side effects
(writes `delivery_status_events`, pushes SSE, sends email, deducts stock) is a
verb-action endpoint: `POST /{resource}/{id}/{action}`.

- ✅ `POST /stops/{id}/arrive` · `/complete` · `/fail`
- ✅ `POST /orders/{no}/cancel` · `POST /routes/{id}/optimize` ·
  `POST /dispatch/orders/{id}/assign`
- ❌ `PATCH /stops/{id} {"status": "arrived"}` — hides side effects and
  weakens transition validation

**Status codes**

| Code | When |
|---|---|
| 200 | Successful read, update, or action |
| 201 | Resource created — return the created resource |
| 204 | Success with no body (DELETE) |
| 400 | Malformed request (bad JSON, missing required field) |
| 401 | Not authenticated (missing/expired JWT) |
| 403 | Authenticated but role not permitted |
| 404 | Resource not found |
| 409 | Conflict — duplicate unique value, or invalid state transition (e.g. completing an already-`COMPLETED` stop) |
| 422 | Pydantic validation failure — field details in the error envelope |
| 500 | Unexpected — never leak internals or stack traces |

**JSON conventions**

- Fields: `snake_case` everywhere — matches Pydantic/SQLAlchemy directly, no
  alias layer; the frontend uses `snake_case` too
- Timestamps: ISO-8601 UTC (`"2026-09-24T13:10:19Z"`)
- Money: `NUMERIC(12,2)` → JSON number with 2 decimals (`180.00`)
- Booleans: `is_`/`has_`/`can_` prefix (`is_active`, `has_pod`)
- Enum values: `UPPER_SNAKE` strings (`"READY_FOR_DISPATCH"`)
- IDs: `id` on the resource, `{resource}_id` for foreign keys

**Validation at the boundary.** Pydantic schemas validate in routers only;
services and models trust the types. External data (Nominatim responses,
webhooks) is untrusted — validate before use.

**Filtering, sorting, pagination**

- Filters are query params: `?status=PENDING&driver_id=3`
- Sorting: `?sort_by=created_at&sort_order=desc`
- Pagination: `?page=1&page_size=20` →
  `{ "data": [...], "pagination": { "page", "page_size", "total_items", "total_pages" } }`

**Idempotency**

- `POST /orders` accepts an `Idempotency-Key` header — store the key and
  dedupe client retries/double-submits.
- `GET`, `PATCH`, `DELETE` are naturally idempotent.
- Retry-safe actions: repeating an already-applied transition returns `409`,
  never a silent double-apply.

**Versioning.** Everything under `/api/v1`. Within v1 only additive changes:
new optional fields and new endpoints are fine; never rename, retype, or
remove an existing field — that requires a v2.

**Exceptions.** SSE streams (`GET /track/{no}/stream`, `/fleet/stream`) are
long-lived GETs — exempt from envelope/pagination rules; events use the §7.2
SSE shape.

### 7.2 Domain contract

- **Error envelope**: `{ "error": { "code", "message", "details?" } }`
- **Pagination**: all list endpoints take `?page=&page_size=&sort_by=` and
  return `{data, pagination}`.
- **Location shape**: `{line1, line2, city, province, postal_code, lat, lng}`
- **Order lifecycle**:
  `PENDING → CONFIRMED → READY_FOR_DISPATCH → ASSIGNED → OUT_FOR_DELIVERY → COMPLETED`;
  `CANCELLED` (reason required) reachable from any pre-delivery stage.
- **Delivery/stop lifecycle**:
  `PENDING → EN_ROUTE → ARRIVED → DELIVERED | FAILED → (REATTEMPT) | RETURNED`
- **Order→Delivery handoff**: an order reaching `READY_FOR_DISPATCH` appears
  in `GET /api/v1/dispatch/queue`. Assignment creates the `deliveries` row.
- **Every status transition writes a `delivery_status_events` row.**

### 7.3 Endpoint map

| Group | Endpoints |
|---|---|
| `auth` | `POST /auth/register`, `/auth/otp/verify`, `/auth/otp/resend`, `/auth/pin/set`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| `catalog` | `GET /products`, `GET /categories`; admin CRUD under `/admin/products`, `/admin/categories` |
| `orders` | `POST /orders/quote`, `POST /orders`, `GET /orders`, `GET /orders/{no}`, `GET /orders/{no}/status`, `POST /orders/{no}/cancel` |
| `dispatch` | `GET /dispatch/queue`, `POST /dispatch/orders/{id}/assign`, `POST /dispatch/auto-assign` |
| `routes` | `POST /routes`, `POST /routes/{id}/optimize`, `PATCH /routes/{id}` |
| `drivers` | `GET/POST/PATCH /drivers[/{id}]`, `GET /drivers/{id}/manifest`, `POST /shifts` |
| `vehicles` | `GET/POST/PATCH /vehicles[/{id}]` |
| `driver-app` | `GET /me/route`, `POST /stops/{id}/arrive`, `POST /stops/{id}/complete`, `POST /stops/{id}/fail`, `POST /deliveries/{id}/pod` |
| `tracking` | `GET /track/{order_no}` (public), `GET /track/{order_no}/stream`, `GET /fleet/stream` |
| `payments` | `POST /payments`, `GET /payments/{id}` |
| `notifications` | `GET /notifications`, `POST /notifications/test` (admin) |
| `analytics` | ported `/admin/stats`, `/top-products`, `/least-selling`, `/revenue-trend`, `/order-status-distribution`, `/category-performance` + new `/analytics/driver-performance`, `/analytics/delivery-costs`, `/analytics/failed-deliveries` |
| `admin` | user/staff management, `GET /audit-logs`, `GET /audit-logs/export.{csv,pdf}` |

---

## 8. Business Rules to Preserve from Legacy

- **Never trust client prices.** The quote endpoint recomputes unit options,
  multipliers (e.g. "1 sack" = 25 kg), and per-unit discounts from DB rows —
  port to `services/pricing.py`.
- **Stock deducts once**, on transition to `COMPLETED`, using
  `quantity × unit_multiplier`.
- **OTP guardrails** (port exactly): 6-digit code, 10-min expiry, 5 attempts,
  60s resend cooldown, max 3 resends.
- **Audit log categories** derived from action text (Order Process / Product
  Management / User Activity / System Actions — see `get_log_category` in
  `legacy_code/app.py`).
- **DO NOT port**: the hardcoded admin OTP `"123456"` in
  `/admin/forgot-password` (security bug) or the hardcoded Flask
  `secret_key`. Use real emailed OTP / token reset and env-configured secrets.

---

## 9. Execution — 5 Days, 4 People, Step by Step

**Ground rules:** contracts first (this file's §7 is law); one PR per
checklist item into `main`; a feature is done when the endpoint works in
FastAPI `/docs`, the frontend consumes it, and it's demo'd to the other pair;
15-min sync every morning.

### Day 0 — Pre-flight (~1–2 hrs, before Day 1)

- [ ] **All:** verify Node ≥ 22.20, Python ≥ 3.11, Git. Pull latest `main`;
      work on feature branches per checklist item.
- [ ] **Neon owner:** `npm i -g neon@latest` → `neon auth` →
      `neon link --project-id falling-salad-70422753 --branch production -y`
      (writes `.neon` context + `DATABASE_URL` / `DATABASE_URL_UNPOOLED` into
      `.env`). Commit `.neon` — it holds IDs only, no secrets.
- [ ] **Skip** `neon config init` / `neon.ts auth:true` / `neon deploy` —
      those provision Neon's managed Better Auth, which we don't use (our
      auth is custom JWT).
- [ ] **Joint:** restructure repo — `legacy_code/` stays untouched as the
      porting reference; create `backend/` and `frontend/`. Add
      `node_modules/`, `dist/`, `backend/uploads/` to `.gitignore`.
- [ ] **BE-A + BE-B:** scaffold `backend/` — `app/main.py` (factory, CORS,
      router mounting), `app/core/{config,security,deps}.py`,
      `app/db/session.py`, `app/models/`, `app/schemas/`, `app/routers/`,
      `app/services/`, `alembic/`, `uploads/`, `scripts/`. Install deps.
      `backend/.env`: `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT`
      (unpooled, for Alembic), `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `SMTP_*`,
      `NOMINATIM_USER_AGENT`.
- [ ] **FE-A + FE-B:** scaffold `frontend/` — Vite + React + Tailwind +
      react-router; shared `api/` client with JWT bearer interceptor;
      role-based layout shells; dev proxy `/api` → `localhost:8000`.
- [ ] **Verify:** `uvicorn app.main:app` boots and hits Neon; Vite proxies a
      request successfully.

### Day 1 — Shared schema + auth + CRUD

- [ ] **Joint (first hour):** confirm §7 contract — lifecycles, roles, SSE
      shape, Location shape, error envelope, pagination.
- [ ] **BE-A + BE-B (~2h together):** write the **single Alembic baseline
      migration** covering every table in §6. Include
      `products.weight_kg_per_unit` and `orders.delivery_window_start/end` +
      `delivery_fee`.
- [ ] **BE-A:** auth — register / OTP verify / OTP resend / PIN set / login /
      refresh / logout. Port the customer OTP→PIN flow with all guardrails;
      staff login with email+password; **do NOT port the hardcoded admin
      OTP `"123456"`**.
- [ ] **BE-B:** CRUD for `drivers`, `vehicles`, `driver_shifts`; `locations`
      model + `services/geocoding.py` (Nominatim + manual lat/lng override).
- [ ] **FE-A:** customer auth pages (register → OTP → set PIN → login) wired
      to BE-A endpoints.
- [ ] **FE-B:** dispatcher shell + driver/vehicle management screens.
- [ ] **Done when:** all 5 roles can log in; both frontends call the API
      with JWT; baseline migration runs clean on Neon.

### Day 2 — Order pipeline + dispatch queue

- [ ] **BE-A:** catalog endpoints (`GET /products`, `GET /categories`) +
      admin product/category CRUD ported from legacy.
- [ ] **BE-A:** `services/pricing.py` — server-side quote (unit options,
      multipliers, per-unit discounts, recomputed from DB).
- [ ] **BE-A:** `POST /api/v1/orders` — geocoded delivery address +
      `delivery_window_start/end`; `delivery_fee` via `services/costing.py`
      v1 (base + per-km); creates `payments` row (`cash`/`pending`); status →
      `READY_FOR_DISPATCH` on confirm. Plus `GET /orders`, `/orders/{no}`,
      `/orders/{no}/status`, `POST /orders/{no}/cancel` (reason required).
- [ ] **BE-B:** `GET /api/v1/dispatch/queue`; `POST
      /dispatch/orders/{id}/assign` (manual) — creates `deliveries` row +
      first `delivery_status_events` entry.
- [ ] **BE-B:** `services/assignment.py` v0 (auto-assign per §5.1);
      `POST /dispatch/auto-assign` returns pick + reason.
- [ ] **FE-A:** storefront + cart + checkout — address form with geocode
      preview, delivery-window picker, fee from `/orders/quote`; order
      history + detail pages.
- [ ] **FE-B:** dispatcher queue UI — order detail → assign-driver dropdown
      showing the auto-assign suggestion; driver/vehicle/shift CRUD wired to
      Day-1 endpoints.
- [ ] **Joint EOD checkpoint:** customer places order → appears in dispatch
      queue → dispatcher assigns (manual AND auto) → `deliveries` row exists.

### Day 3 — Routing + driver app + real-time tracking

- [ ] **BE-B:** `routes` + `delivery_stops`; `services/routing.py` optimizer
      (nearest-neighbor + 2-opt over haversine, time-window + capacity
      aware). `POST /routes`, `POST /routes/{id}/optimize`, `PATCH
      /routes/{id}` (manual reorder = optimizer fallback).
- [ ] **BE-B:** driver endpoints — `GET /me/route`, `POST /stops/{id}/arrive`,
      `/complete`, `/fail`, `POST /deliveries/{id}/pod` (photo →
      `backend/uploads/`, recipient name, timestamp, lat/lng); failed
      delivery → reason codes + re-queue; **every transition writes a
      `delivery_status_events` row**.
- [ ] **BE-A:** SSE endpoints broadcasting new `delivery_status_events` —
      `/track/{order_no}/stream` + `/fleet/stream`; notification triggers →
      SMTP email on assigned/en-route/delivered/failed; log sends to
      `notifications`.
- [ ] **FE-B:** driver mobile-first views — today's manifest, ordered stops,
      arrive/complete/fail actions, POD capture, failure-reason picker;
      dispatcher route detail (ordered stop list; Leaflet+OSM map only if
      ahead of schedule).
- [ ] **FE-A:** customer tracking page — SSE-driven timeline + ETA + driver
      info; verify emails arrive.
- [ ] **Joint:** driver walks a multi-stop route on a phone; customer page
      updates live with no refresh; POD photo saved; failed delivery
      re-queues.

### Day 4 — Analytics + costing v2 + polish

- [ ] **BE-B:** `GET /analytics/driver-performance` (on-time %,
      deliveries/day, failure rate), `/analytics/delivery-costs`,
      `/analytics/failed-deliveries`; costing v2 (distance × vehicle rate +
      driver time → `routes.cost`; reconcile `orders.delivery_fee`).
- [ ] **BE-A:** port admin analytics (`/admin/stats`, `/revenue-trend`,
      `/order-status-distribution`, `/category-performance`, top/least-selling
      products) — same queries as legacy, Postgres dialect; audit-log writes
      on staff actions.
- [ ] **FE-B:** ops manager dashboard (Recharts or similar); dispatcher fleet
      view on `/fleet/stream`.
- [ ] **FE-A:** admin catalog/order screens finished; cancellation with
      reason + customer email; UI polish.
- [ ] **Joint — full vertical E2E (run twice, clean):** order → auto-assign →
      optimized route → driver delivers with POD → customer live updates →
      ops dashboard shows the metric.
- [ ] **Done when:** all 12 complex features are demonstrable end-to-end.

### Day 5 — Hardening + demo

- [ ] **BE-A or BE-B:** `backend/scripts/seed_demo.py` (adapt
      `legacy_code/seed.py` + `seed_analytics.py`) — 3 drivers, 3 vehicles
      with distinct capacities, ~10 geocoded locations, ~100 orders across
      windows/statuses, all 5 role accounts with documented credentials.
- [ ] **All:** bugfix buffer. Priority: route optimizer (biggest slip risk) —
      if it breaks, manual stop ordering still demos "multiple delivery
      stops".
- [ ] **Joint:** demo script + rehearsal — customer order → dispatch queue →
      auto-assign → optimized route → driver app → live tracking → POD → ops
      analytics.
- [ ] **Joint:** update README run instructions (`uvicorn`, `vite`, required
      `.env` vars); final commit + tag.
- [ ] **Optional:** deploy (backend on Render/Railway, frontend on Vercel) —
      local demo is an acceptable fallback.

---

## 10. Acceptance Criteria

- [ ] All 5 roles log in via JWT and are gated by `require_role`.
- [ ] Customer places an order with address + delivery window; price computed
      server-side; `payments` row created.
- [ ] Order appears in dispatch queue; auto-assign picks a valid driver
      (shift + capacity + window + proximity) and explains why; manual
      override works.
- [ ] Route has ordered multi-stop manifest; optimizer improves naive order.
- [ ] Driver advances stops through the lifecycle on a phone-sized UI; POD
      photo + recipient + geo captured; failed delivery re-queues.
- [ ] Customer tracking page updates via SSE without refresh; emails arrive
      on status changes.
- [ ] Ops dashboard renders driver performance, costs, and failure metrics.
- [ ] Baseline migration runs clean on Neon; `seed_demo.py` produces a fully
      demoable dataset.
- [ ] Requirement traceability: every row of §5 (12 features) and §6 (11
      entities) maps to working code.

---

## 11. Explicitly Out of Scope (5-day cut list — do not build)

Gemini AI features (chat/recs/insights/forecast/summaries), SMS
notifications, real payment gateway (GCash/PayMongo), S3/R2 object storage,
Google Maps UI, WebSockets (SSE covers realtime), `pets` + lifestyle
classification. Email-only notifications; COD-only payments; local-disk
uploads; Nominatim geocoding.

---

## 12. Risks & Fallbacks

| Risk | Fallback |
|---|---|
| Route optimizer slips | Manual stop ordering (`PATCH /routes/{id}`) still demos multi-stop |
| Nominatim unreliable / no network | Preset-zone coordinates (hardcoded barangay → lat/lng list) |
| SSE blocked by proxy/browser | 5s polling on the same status endpoints |
| Shared-schema drift | §7 contract is law; changes need both BEs in one PR |
| `neon` CLI issues | Neon console can link/create manually — only `DATABASE_URL` really matters |
| Scope creep (AI, maps, SMS) | On the cut list — defer to post-deadline |

---

*Execute Days 0–5 in order. Keep §7's contract in sync with reality — if
reality diverges, update the contract in the same PR.*
