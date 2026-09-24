# Sambast → Delivery & Logistics Platform — 5-Day Build Plan

> **Working checklist.** Rebuilds the existing Sambast Flask app into a
> Delivery & Logistics Management Platform on **React (Vite) + FastAPI + Neon
> Postgres**, executed by **4 people in 2 vertical teams**. Read together with:
> `README.md` (architecture blueprint — target schema, API surface, feature
> mapping) and the team-split doc (Team A = Customer & Order side, Team B =
> Dispatch, Driver & Route side).
>
> Tick boxes as you go. Every item has an owner tag: **BE-A**, **FE-A**,
> **BE-B**, **FE-B**, or **Joint**.

---

## Ground rules

1. **Contracts first.** Day 1 starts with a joint schema + API contract
   session before anyone splits off. The split doc calls this the #1 source of
   merge pain if skipped — treat `docs/contracts.md` as law; changing it
   requires both backend devs in the same PR.
2. **One PR per checklist item** into `main`; keep PRs small.
3. **Definition of done** for a feature: endpoint works in FastAPI `/docs`,
   frontend consumes it, and it's demo'd to the other pair.
4. **15-min sync every morning** — surface blockers, contract changes,
   integration points.
5. **The Flask app is reference, not runtime.** It lives untouched in
   `legacy/`; port logic from it, don't run it in production.
6. **Never trust client prices** — the quote endpoint recomputes everything
   server-side (ported from `legacy/app.py`).

---

## Team roles

| Person | Owns |
|---|---|
| **BE-A** (Backend A — Customer & Order) | `users`/auth, `orders`, `order_items`, `payments`, `customer_addresses`, notifications, catalog APIs, SSE channels, delivery costing |
| **FE-A** (Frontend A — Customer & Order) | Customer React app: auth pages, storefront/cart/checkout, order history, live tracking page; admin catalog screens |
| **BE-B** (Backend B — Dispatch/Driver/Route) | `drivers`, `vehicles`, `driver_shifts`, `routes`, `deliveries`, `delivery_stops`, `delivery_status_events`, `proof_of_delivery`, `locations`, geocoding, assignment + routing engines, ops analytics |
| **FE-B** (Frontend B — Dispatch/Driver/Route) | Dispatcher console, driver mobile-first views, ops manager dashboard |

---

## Day 0 — Pre-flight (before Day 1; ~1–2 hrs)

Environment + Neon + repo skeleton. Neon steps are run by whoever owns the
Neon account; everyone does their own toolchain install.

- [ ] **All:** Node ≥ **22.20** (`neon skills` needs it; CLI core needs ≥
  20.19), Python ≥ 3.11, Git. Verify: `node --version`, `python --version`.
- [ ] **All:** clone/pull latest `main`; create a `dev` branch or feature
  branches per checklist item.
- [ ] **Neon owner:** `npm i -g neon@latest`
- [ ] **Neon owner:** `neon auth` — browser sign-in (the docs call this
  `auth`; `neon login` may work as an alias, `auth` is canonical).
- [ ] **Neon owner:** `neon link --project-id falling-salad-70422753 --branch production -y`
  → writes `.neon` context + pulls `DATABASE_URL` /
  `DATABASE_URL_UNPOOLED` into `.env`.
- [ ] **Neon owner (optional):** `neon skills -y` and `neon mcp -y` — install
  Neon agent skills + MCP server for coding agents. Harmless, useful.
- [ ] **Skip:** `neon config init` / `neon.ts` with `auth: true` /
  `neon deploy`. Those provision Neon's *managed* Better Auth service, which
  we don't use — our auth is custom JWT in FastAPI. (Harmless if already run;
  just unused.)
- [ ] **Joint:** update `.gitignore` — add `node_modules/`, `dist/`,
  `backend/uploads/`, `*.local`. `.env` is already covered.
- [ ] **Joint decision:** commit `.neon` (recommended — it holds
  org/project/branch IDs, no secrets; saves every member running `link`).
- [ ] **Joint — repo restructure (one commit):**
  ```
  legacy/    ← app.py, templates/, static/, seed.py, seed_analytics.py,
               migrate_db.py, fix_fk.py, inspect_schema.py, requirements.txt,
               sambast_inventory_list_v2.csv
  backend/   ← new FastAPI app
  frontend/  ← new Vite + React app
  ```
  Nothing deleted — `legacy/` stays as the porting reference.
- [ ] **BE-A + BE-B:** scaffold `backend/`:
  ```
  backend/
    app/main.py            # app factory, CORS, router mounting
    app/core/config.py     # pydantic-settings reads .env
    app/core/security.py   # JWT + hashing
    app/core/deps.py       # get_db, role guards
    app/db/session.py      # SQLAlchemy engine/session
    app/models/            # one file per domain
    app/schemas/           # Pydantic DTOs
    app/routers/           # auth, catalog, orders, dispatch, drivers,
                           # vehicles, routes, deliveries, tracking,
                           # payments, notifications, analytics, admin
    app/services/          # pricing, costing, geocoding, assignment,
                           # routing, notifications
    alembic/               # migrations
    uploads/               # POD photos (gitignored)
    scripts/               # seed_demo.py
  ```
  `pip install fastapi "uvicorn[standard]" sqlalchemy alembic
  psycopg[binary] pydantic-settings python-jose[cryptography] passlib[bcrypt]
  httpx python-multipart`
- [ ] **BE-A + BE-B:** `backend/.env` gets `DATABASE_URL` (pooled Neon URL),
  `DATABASE_URL_DIRECT` (unpooled, for Alembic), `JWT_SECRET`, `JWT_ALGORITHM=HS256`,
  `SMTP_*` (reuse values from the legacy `.env`), `NOMINATIM_USER_AGENT=sambast-delivery/1.0`.
- [ ] **FE-A + FE-B:** scaffold `frontend/` — Vite + React + react-router +
  a shared `api/` client with JWT bearer interceptor + role-based layout
  shells; dev server proxies `/api` → `localhost:8000`.
- [ ] **Verify:** `uvicorn app.main:app` boots and hits Neon; Vite dev
  server proxies a request successfully.

---

## Day 1 — Shared schema + auth + CRUD

**Theme: contract morning, split afternoon.**

- [ ] **Joint — contract session, first hour.** All 4 agree and write
  `docs/contracts.md`:
  - Order lifecycle:
    `PENDING → CONFIRMED → READY_FOR_DISPATCH → ASSIGNED → OUT_FOR_DELIVERY → COMPLETED`
    with `CANCELLED` (reason required) reachable from any pre-delivery stage.
  - Delivery/stop lifecycle:
    `PENDING → EN_ROUTE → ARRIVED → DELIVERED | FAILED → (REATTEMPT) | RETURNED`
  - `users.role` ∈ `customer | driver | dispatcher | admin | ops_manager`;
    JWT claims `{sub, role}`; role guard dependency `require_role(...)`.
  - Order→Delivery handoff: an order reaching `READY_FOR_DISPATCH` appears in
    `GET /api/v1/dispatch/queue`. Assignment creates the `deliveries` row.
  - SSE event shape:
    `{event: "status", data: {delivery_id, order_no, status, lat, lng, ts}}`
    Channels: `GET /api/v1/track/{order_no}/stream` (customer),
    `GET /api/v1/fleet/stream` (dispatcher).
  - `Location` shape `{line1, line2, city, province, postal_code, lat, lng}`.
  - Error envelope `{error: {code, message, details?}}`; list endpoints take
    `?page=&pageSize=` and return `{data, pagination}`.
- [ ] **BE-A + BE-B (~2h, together): single Alembic baseline migration** with
  the full README §5 schema — this lands **all 11 required entities**:
  `users, drivers, vehicles, driver_shifts, audit_logs, categories, products,
  locations, customer_addresses, orders, order_items, payments, routes,
  deliveries, delivery_stops, delivery_status_events, proof_of_delivery,
  notifications`. Include `products.weight_kg_per_unit` (needed for vehicle
  capacity) and `orders.delivery_window_start/end` + `delivery_fee`.
- [ ] **BE-A:** auth — `POST /api/v1/auth/register`, `/auth/login`,
  `/auth/refresh`, `/auth/logout`; port the customer OTP→PIN flow from
  `legacy/app.py` (6-digit OTP, 10-min expiry, 5 attempts, 60s resend
  cooldown, max 3 resends — **keep the guardrails**); staff login with
  email+password; **do NOT port the hardcoded admin OTP `"123456"`**.
- [ ] **BE-B:** CRUD for `drivers`, `vehicles`, `driver_shifts`;
  `locations` model + `services/geocoding.py` (Nominatim lookup, manual
  lat/lng override field).
- [ ] **FE-A:** customer auth pages (register → OTP → set PIN → login)
  wired to BE-A endpoints.
- [ ] **FE-B:** dispatcher shell + driver/vehicle management screens.
- [ ] **Done when:** all 5 roles can log in; both frontends call the API
  with JWT; baseline migration runs clean on Neon.

---

## Day 2 — Order pipeline + dispatch queue

- [ ] **BE-A:** catalog endpoints (`GET /products`, `GET /categories`) +
  admin product/category CRUD ported from `legacy/app.py`.
- [ ] **BE-A:** port server-side quote/pricing (`services/pricing.py`) —
  unit options + multipliers + per-unit discounts, recomputed from DB.
- [ ] **BE-A:** `POST /api/v1/orders` — captures geocoded delivery address +
  `delivery_window_start/end`; computes `delivery_fee` via
  `services/costing.py` v1 (base fee + per-km); creates `payments` row
  (`method=cash`, `status=pending`); status → `READY_FOR_DISPATCH` on
  confirm. Plus `GET /orders`, `GET /orders/{no}`, `/orders/{no}/status`,
  `POST /orders/{no}/cancel` (reason required).
- [ ] **BE-B:** `GET /api/v1/dispatch/queue` (orders in
  `READY_FOR_DISPATCH`); `POST /dispatch/orders/{id}/assign` (manual) —
  creates `deliveries` row + first `delivery_status_events` entry.
- [ ] **BE-B:** auto-assignment v0 (`services/assignment.py`): filter drivers
  by (a) active shift now, (b) vehicle `max_weight_kg` ≥ order weight
  (`products.weight_kg_per_unit` × qty), (c) delivery-window fit; score by
  proximity to depot/first stop; `POST /dispatch/auto-assign` returns the
  pick + reason so the UI can show it.
- [ ] **FE-A:** storefront + cart + checkout — address form with geocode
  preview, delivery-window picker, fee from `/orders/quote`; order
  history + detail pages.
- [ ] **FE-B:** dispatcher queue UI — list → order detail → assign-driver
  dropdown showing the auto-assign suggestion; driver/vehicle/shift CRUD
  wired to Day-1 endpoints.
- [ ] **Joint EOD checkpoint:** customer places order → appears in dispatch
  queue → dispatcher assigns (manual AND auto) → `deliveries` row exists.

---

## Day 3 — Routing + driver app + real-time tracking

- [ ] **BE-B:** `routes` + `delivery_stops`; optimizer in
  `services/routing.py` — nearest-neighbor construction + 2-opt improvement
  over stop lat/lng (haversine distance), respecting time windows and
  vehicle capacity; endpoints `POST /routes` (build from a driver's assigned
  deliveries), `POST /routes/{id}/optimize`, `PATCH /routes/{id}` (manual
  reorder — doubles as the fallback if the optimizer slips).
- [ ] **BE-B:** driver endpoints — `GET /me/route` (manifest + ordered
  stops), `POST /stops/{id}/arrive`, `/complete`, `/fail`,
  `POST /deliveries/{id}/pod` (photo → `backend/uploads/`, recipient name,
  timestamp, lat/lng); failed delivery → reason codes + re-attempt flow
  (re-queue to dispatch); **every** status transition writes a
  `delivery_status_events` row.
- [ ] **BE-A:** SSE endpoints broadcasting new `delivery_status_events` —
  `GET /api/v1/track/{order_no}/stream` (customer), `/api/v1/fleet/stream`
  (dispatcher); notification triggers on status change → email via SMTP
  (reuse the `EmailMessage` pattern from `legacy/app.py`) for
  assigned / en-route / delivered / failed; log each send to
  `notifications`.
- [ ] **FE-B:** driver mobile-first views — today's manifest, ordered stop
  list, arrive / complete / fail actions, POD capture
  (`<input type="file" accept="image/*">`), failure-reason picker;
  dispatcher route detail (ordered stop list; add a Leaflet+OSM map only if
  ahead of schedule).
- [ ] **FE-A:** customer tracking page — SSE-driven status timeline + ETA +
  driver info; verify notification emails arrive.
- [ ] **Joint:** driver walks a multi-stop route on a phone; customer page
  updates live with no refresh; POD photo saved; failed delivery re-queues.

---

## Day 4 — Analytics + costing v2 + polish

- [ ] **BE-B:** ops analytics — `GET /analytics/driver-performance`
  (on-time %, deliveries/day, failure rate per driver),
  `/analytics/delivery-costs`, `/analytics/failed-deliveries`; costing v2 —
  distance × vehicle rate + driver time → `routes.cost`, reconcile
  `orders.delivery_fee`.
- [ ] **BE-A:** port admin analytics (`/admin/stats`, `/revenue-trend`,
  `/order-status-distribution`, `/category-performance`, top/least-selling
  products) — same queries as `legacy/app.py`, Postgres dialect; audit-log
  writes on staff actions.
- [ ] **FE-B:** ops manager dashboard (charts — Recharts or similar);
  dispatcher fleet view on the fleet SSE channel.
- [ ] **FE-A:** admin catalog/order screens finished; cancellation with
  reason + customer email; general UI polish.
- [ ] **Joint — full vertical E2E:** order → auto-assign → optimize route →
  driver delivers with POD → customer sees live updates → ops dashboard
  shows the metric. Run it twice, clean.
- [ ] **Done when:** all 12 complex features are demonstrable end-to-end.

---

## Day 5 — Hardening + demo

- [ ] **BE-A or BE-B:** `backend/scripts/seed_demo.py` (adapt
  `legacy/seed.py` + `legacy/seed_analytics.py`) — 3 drivers, 3 vehicles
  with distinct capacities, ~10 geocoded locations, ~100 orders spread
  across windows/statuses, all 5 role accounts with documented credentials.
- [ ] **All:** bugfix buffer. Priority: the route optimizer (biggest slip
  risk) — if it breaks, manual stop ordering still demos "multiple delivery
  stops".
- [ ] **Joint:** demo script + rehearsal: customer order → dispatch queue →
  auto-assign → optimized route → driver app → live tracking → POD → ops
  analytics.
- [ ] **Joint:** update README run instructions (backend `uvicorn`, frontend
  `vite`, required `.env` vars); final commit + tag.
- [ ] **Optional:** deploy (e.g. backend on Render/Railway, frontend on
  Vercel) — local demo is an acceptable fallback.

---

## Requirement traceability matrix

| Professor requirement | Owner | Day | Where |
|---|---|---|---|
| **Roles:** admin, dispatcher, driver, customer, ops manager | BE-A | 1 | `users.role` + JWT role guards |
| Customer places order / order enters system | BE-A + FE-A | 2 | `POST /orders`, checkout UI |
| Dispatcher reviews orders | BE-B + FE-B | 2 | `GET /dispatch/queue` |
| Automatic driver assignment | BE-B | 2 | `services/assignment.py` |
| Route optimization | BE-B | 3 | `services/routing.py` (NN + 2-opt) |
| Delivery time windows | BE-A (capture) + BE-B (enforce) | 2–3 | `orders.delivery_window_*` |
| Vehicle capacity constraints | BE-B | 1–3 | `vehicles.max_weight_kg`, `products.weight_kg_per_unit` |
| Driver availability | BE-B | 1–2 | `driver_shifts` |
| Multiple delivery stops | BE-B | 3 | `delivery_stops.sequence_no` |
| Failed delivery handling | BE-B | 3 | `FAILED` + reason codes + re-attempt |
| Proof of delivery | BE-B + FE-B | 3 | `proof_of_delivery`, photo upload |
| Real-time delivery status | BE-A + FE-A | 3 | SSE `/track/{order_no}/stream` |
| Customer notifications | BE-A | 3–4 | `notifications` + SMTP email |
| Driver performance analytics | BE-B + FE-B | 4 | `/analytics/driver-performance` |
| Delivery cost calculation | BE-A | 2 (v1) → 4 (v2) | `services/costing.py` |
| Customer tracks order | FE-A + BE-A | 3 | tracking page + SSE |
| Management analyzes performance | FE-B + BE-B | 4 | ops dashboard |
| **Entities:** Customer, Order, OrderItem, Driver, Vehicle, Delivery, DeliveryStop, Route, Location, Payment, DeliveryStatus | BE-A + BE-B | 1 | single baseline migration |

---

## Explicitly out of scope (5-day cut list)

Gemini AI features (chat/recs/insights/forecast/summaries), SMS
notifications, real payment gateway (GCash/PayMongo), S3/R2 object storage,
Google Maps UI, WebSockets, `pets` + lifestyle classification. Email-only
notifications; COD-only payments; local-disk uploads; Nominatim geocoding;
SSE realtime.

## Risks & fallbacks

| Risk | Fallback |
|---|---|
| Route optimizer slips | Manual stop ordering — still demos multi-stop routes |
| Nominatim unreliable / no network | Preset-zone coordinates (hardcoded barangay → lat/lng list) |
| SSE blocked by proxy/browser | 5s polling on the same status endpoints |
| Shared-schema drift | `docs/contracts.md` is law; changes need both BEs in one PR |
| `neon` CLI is brand-new (v6.0.0) | Neon console can link/create manually — only `DATABASE_URL` really matters |
| Scope creep (AI, maps, SMS) | It's on the cut list — defer to post-deadline |

---

*Execution plan for the Sambast Delivery & Logistics Management Platform.
Update checkboxes daily; keep `docs/contracts.md` in sync with reality.*
