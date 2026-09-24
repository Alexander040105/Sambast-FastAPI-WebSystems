# Sambast — Delivery & Logistics Management Platform

> **Refactoring blueprint.** This document is the single source of truth for
> rebuilding the existing Sambast e-commerce application into a full delivery &
> logistics management platform on a **React + FastAPI + PostgreSQL (Neon)**
> stack. It audits everything that exists today, defines the target
> architecture and data model, maps every feature to its disposition, and lays
> out a phased migration plan.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current-State Audit](#2-current-state-audit)
3. [Target Vision](#3-target-vision)
4. [Target Architecture](#4-target-architecture)
5. [Target Data Model](#5-target-data-model)
6. [Planned API Surface](#6-planned-api-surface)
7. [Feature Mapping & Gap Analysis](#7-feature-mapping--gap-analysis)
8. [Phased Migration Plan](#8-phased-migration-plan)
9. [Environment Variables](#9-environment-variables)
10. [Open Decisions](#10-open-decisions)

---

## 1. Project Overview

### What exists today

**Sambast** is a Philippine pet-supply / animal-feed e-commerce web app. It is
a monolithic **Flask** application backed by **SQLite** with server-rendered
**Jinja2** templates and per-page vanilla JS/CSS. Prices are in PHP (₱);
customers register with an 11-digit mobile number, verify an email OTP, and
sign in with a 4-digit PIN. Fulfillment today is **pickup-based** — orders move
through `Pending → Processing → Ready → Completed`, and customers are emailed
when an order is ready for pickup or cancelled.

### What it becomes

A **Delivery & Logistics Management Platform** for a mid-size delivery
operation receiving hundreds of orders per day. The store's ordering flow stays
("customer places order"); a dispatch/driver/route layer is added on top so
that orders are automatically assigned to drivers, routed across multiple
stops, tracked in real time by customers, and measured by management.

### Target tech stack

| Layer | Today | Target |
|---|---|---|
| Frontend | Jinja2 templates + vanilla JS/CSS | React SPA (Vite) |
| Backend | Flask monolith (`app.py`, ~5,200 lines) | FastAPI, domain routers + service layer |
| Database | SQLite (`database.db`) | PostgreSQL on **Neon** (serverless Postgres) |
| ORM / Migrations | Raw SQL + runtime `PRAGMA` checks | SQLAlchemy 2.x + Alembic |
| Auth | Flask session cookies | JWT access/refresh tokens, role-based |
| Realtime | Polling (`/orders/<order_no>/status`) | WebSockets / SSE |
| AI | Google Gemini (`gemini-2.5-flash`) | Gemini (carried over, server-side cached) |
| Email | EmailJS (status emails) + SMTP (OTP) | EmailJS or backend provider — see [Open Decisions](#10-open-decisions) |
| PDF export | reportlab | reportlab (carried over) |

---

## 2. Current-State Audit

### 2.1 Repository layout

```
app.py                        ~5,235-line Flask monolith: all routes, all logic
fix_fk.py                     one-off script: rebuilds `pets` FK to users
inspect_schema.py             dev tool: prints DDL for users/pets tables
migrate_db.py                 adds products.purpose/target_species/tags + pets table
seed.py                       seeds `products` from sambast_inventory_list_v2.csv
seed_analytics.py             generates 60 days of fake orders for analytics demo
requirements.txt              Flask, google-generativeai, python-dotenv, reportlab, requests
sambast_inventory_list_v2.csv product catalog source (name, description, ₱ price/kg, species)
sambast.db                    empty leftover file — the app actually uses database.db
templates/                    22 Jinja templates (8 admin, 14 user)
static/                       21 CSS files, 19 JS files, product images, uploads dir
```

### 2.2 Database schema (current, SQLite)

Created by `init_db()` plus runtime "migrations" (`_run_migrations`,
`ensure_startup_schema_guard`) that inspect `PRAGMA table_info` on every
connection.

| Table | Columns | Notes |
|---|---|---|
| `users` | user_id, email (unique), name, contact_no (unique, 11 digits), otp_code (hash), pin_hash, created_at | Customer accounts |
| `products` | product_id, name, category (free text), unit, price, stock_status (int qty), stock_quantity, image_filename, description, unit_options_json, discount_json, is_archived, archived_at, purpose, target_species, tags | `stock_status` and `stock_quantity` are parallel stock columns (tech debt); units/discounts stored as JSON strings |
| `categories` | id, name (unique), unit_options_json | Backfilled from `products.category` |
| `orders` | order_id, order_no (unique, `ORD-########`), user_id FK, total_price, status, cancellation_reason, created_at | Statuses: `Pending`, `Processing`, `Ready`, `Completed`, `Cancelled` |
| `order_items` | item_id, order_id FK, product_id FK, quantity, price_at_time, selected_unit, unit_multiplier, base_price_at_time, discount_amount_at_time | Full price snapshot per line |
| `admin` | admin_id, username (unique), email (unique), password_hash | Seeded with `REY` / `admin123` |
| `audit_logs` | log_id, admin_id FK, action_text, category, timestamp | Category inferred from action text |
| `pets` | id, user_id FK, name, species, breed, age_months, weight_kg, lifestyle_classification | AI-classified pet lifestyle |
| `lifestyle_ai_runs` | user_id PK, last_order_count, updated_at | Throttles AI reclassification (every 3 new orders, min 3 total) |

### 2.3 Route inventory (~60 endpoints)

**Pages (Jinja-rendered):**

| Route | Purpose |
|---|---|
| `GET /` | Landing page |
| `GET /admin`, `POST /admin` | Admin login page + auth |
| `GET /admin/dashboard` | Analytics dashboard |
| `GET /admin/orders` | Order management (status filter, enriched line items) |
| `GET /admin/inventory` | Product/category management |
| `GET /admin/audit` | Audit log viewer |
| `GET /admin/profile` | Admin profile |
| `GET /admin/forgot-password`, `/admin/verify-otp`, `/admin/reset-password` | Admin password reset |
| `GET /sign-in`, `GET /verify-otp`, `GET /set-pin`, `GET /verify-pin`, `GET /verify-code` | Customer auth pages |
| `GET /shop` | Storefront |
| `GET /cart`, `GET /checkout`, `GET /order-progress`, `GET /history`, `GET /profile` | Customer pages |

**Admin API / actions:**

| Route | Purpose |
|---|---|
| `POST /admin/orders/<id>/status` | Update status; deducts stock on `Completed`; emails on `Ready` |
| `POST /admin/orders/<id>/cancel` | Cancel with reason; emails customer |
| `POST /admin/categories/add`, `POST /admin/categories/<id>/edit` | Category CRUD + unit options |
| `POST /admin/products/add`, `POST /admin/products/edit/<id>`, `POST /admin/products/delete/<id>` | Product CRUD (soft-delete via `is_archived`) |
| `GET /api/admin/stats` | Dashboard KPIs |
| `GET /api/admin/top-products`, `/api/admin/least-selling-products` | Product rankings |
| `GET /api/admin/revenue-trend` | Daily/weekly revenue series |
| `GET /api/admin/order-status-distribution` | Status breakdown |
| `GET /api/admin/category-performance` | Revenue by category |
| `GET /api/admin/business-summary`, `/api/admin/business-summary-v2` | AI-generated business narrative + chart interpretation |
| `GET /api/admin/inventory-insights`, `/api/admin/inventory-forecast` | AI low-stock insights & reorder forecast |
| `GET /api/admin/audit-logs` | Filtered audit log JSON (search/category/date range) |
| `GET /admin/audit/export/csv`, `/admin/audit/export/pdf` | Audit log export (reportlab) |

**Customer API / actions:**

| Route | Purpose |
|---|---|
| `POST /register` | Create account → issues email OTP |
| `POST /verify-otp`, `POST /verify-otp/resend` | OTP verification with guardrails |
| `GET/POST /set-pin`, `POST /verify-pin`, `POST /sign-in` | PIN setup + sign-in |
| `GET /sign-out` | Logout |
| `GET /products` | Catalog JSON (filter/search/pagination params) |
| `POST /api/recommendations` | AI cart-based product recommendations |
| `POST /api/chat` | AI shopping assistant (budget bundles, product extraction, vet disclaimer) |
| `POST /orders/quote` | Server-validated price quote (units, multipliers, discounts) |
| `POST /orders` | Place order; triggers async lifestyle reclassification |
| `GET /orders/<order_no>/status`, `GET /orders/latest/status` | Status polling |
| `GET /orders/history` | Paginated order history |
| `GET/POST /api/user/profile` | Profile read/update (contact, email) |
| `GET/POST /api/user/pet` | Pet profile CRUD |
| `GET/POST /change-pin` | PIN change |
| `GET /product-image/<filename>` | Serves product images |

### 2.4 Integrations

- **Google Gemini** (`gemini-2.5-flash`) — chat assistant, cart
  recommendations, inventory insights/forecast, business summary v1/v2, pet
  lifestyle classification. Guardrails: in-memory TTL cache (2–30 min),
  per-endpoint rate limits (10–25 req/min), 90s quota cooldown, JSON extraction
  + schema normalization, deterministic fallbacks when AI fails.
- **EmailJS** (server-side REST call) — order status emails; templates for
  `ready` and `cancelled` (completed template not yet configured).
- **SMTP** (Gmail-compatible) — registration OTP emails.
- **reportlab** — audit-log PDF export.
- **python-dotenv** — `.env` for `GEMINI_API_KEY`, `SMTP_*`, `EMAILJS_*`.

### 2.5 Business rules worth preserving

- Order pricing is **fully server-validated**: products have unit options with
  multipliers (e.g. "1 sack" = 25 kg) and per-unit discount entries; the
  checkout quote recomputes everything from DB prices — client prices are never
  trusted.
- Stock is deducted **once**, at the transition to `Completed`, using
  `quantity × unit_multiplier`.
- Order statuses: `Pending → Processing → Ready → Completed`, or `Cancelled`
  with a mandatory-ish reason (drives customer email + feedback loop).
- Audit log categories are derived from action text (`get_log_category`).
- OTP guardrails: 6-digit code, 10-minute expiry, 5 attempts, 60s resend
  cooldown, max 3 resends.

### 2.6 Known issues & limitations (why we refactor)

- **Monolith**: one 5,200-line file mixes routes, SQL, business logic, AI
  orchestration, and email plumbing.
- **SQLite**: no concurrent writers, weak types, JSON-in-TEXT columns; not
  viable for a multi-role, realtime delivery workload.
- **Runtime "migrations"**: schema evolved via `PRAGMA table_info` + `ALTER
  TABLE` on every DB connection — needs Alembic.
- **Session-cookie auth** doesn't fit a SPA + mobile driver app; no role
  concept beyond "admin" vs "customer".
- **Security finding**: admin forgot-password accepts a **hardcoded OTP
  `"123456"`** (`/admin/forgot-password` → `session['temp_otp']`). This must
  not be ported — replace with real emailed OTP or token reset.
- **Hardcoded `app.secret_key = 'dev_key_for_session_management'`** in source.
- Parallel stock columns (`stock_status`, `stock_quantity`) — consolidate.
- **No delivery concepts**: no addresses/locations, no drivers/vehicles, no
  routes/stops, no payment records (method captured but never persisted), no
  proof of delivery.
- In-memory caches/rate limits won't survive multi-worker deployment —
  move to Redis or DB-backed storage.
- Customer tracking is **polling-based**; the spec requires real-time status.

---

## 3. Target Vision

### 3.1 Users / roles

| Role | Description |
|---|---|
| **System Administrator** | Manages users, staff accounts, catalog, system configuration, audit logs |
| **Dispatcher** | Reviews incoming orders, assigns/overrides drivers, manages routes and delivery windows |
| **Driver** | Receives assignments, follows route manifest, updates stop status, captures proof of delivery |
| **Customer** | Places orders, pays, tracks delivery in real time, receives notifications |
| **Operations Manager** | Analyzes performance: delivery times, driver metrics, costs, failed deliveries |

### 3.2 Core workflow

```
Customer places order
        ↓
Order enters system            (validated & priced server-side — existing logic)
        ↓
Dispatcher reviews orders      (order queue, delivery window, geocoded address)
        ↓
System assigns driver          (auto-assignment: availability, capacity, proximity)
        ↓
System generates delivery route(multi-stop optimization across assigned orders)
        ↓
Driver receives assignments    (driver app: manifest + route order)
        ↓
Driver updates delivery status (en route → arrived → delivered / failed + POD)
        ↓
Customer tracks order          (realtime status + ETA + notifications)
        ↓
Management analyzes performance(Ops dashboards: driver metrics, costs, failures)
```

### 3.3 Complex features (requirements checklist)

- [ ] Automatic driver assignment (availability + vehicle capacity + proximity)
- [ ] Route optimization (multi-stop ordering)
- [ ] Delivery time windows per order
- [ ] Vehicle capacity constraints (weight/volume vs. order load)
- [ ] Driver availability / shift scheduling
- [ ] Multiple delivery stops per route
- [ ] Failed delivery handling (reason codes, re-attempt, return-to-depot)
- [ ] Proof of delivery (photo, signature, recipient name, timestamp, geo)
- [ ] Real-time delivery status (WebSocket/SSE push)
- [ ] Customer notifications (status events via email; SMS optional)
- [ ] Driver performance analytics (on-time %, deliveries/day, failure rate)
- [ ] Delivery cost calculation (distance, vehicle, driver time)

---

## 4. Target Architecture

### 4.1 Repository restructure

```
backend/
  app/
    main.py                  FastAPI app factory, middleware, router mounting
    core/                    config (pydantic-settings), security, deps
    db/                      SQLAlchemy engine/session, Alembic env
    models/                  ORM models (one file per domain)
    schemas/                 Pydantic request/response schemas
    routers/                 auth, catalog, orders, dispatch, drivers,
                             vehicles, routes, deliveries, tracking,
                             payments, notifications, analytics, ai, admin
    services/                business logic (pricing, assignment, routing,
                             notifications, ai orchestration)
    workers/                 background tasks (notifications, AI refresh)
  alembic/                   migrations
  tests/
frontend/
  src/
    apps/ or routes/         customer storefront+tracking, dispatcher console,
                             driver app (mobile-first), admin/ops dashboards
    components/, lib/, api/  shared client, typed API hooks
```

### 4.2 Key architectural decisions

- **Database**: Neon serverless Postgres. Use pooled connection string for the
  API (`DATABASE_URL`), direct endpoint for Alembic migrations. Neon has **no
  realtime features** — realtime is our own WebSocket layer.
- **Auth**: JWT access + refresh tokens with a `role` claim
  (`customer | driver | dispatcher | admin | ops_manager`). Customer
  OTP-then-PIN flow is preserved (OTP via email; PIN hashed with bcrypt/
  passlib). Staff roles use email + password. **Do not port the hardcoded
  admin OTP.**
- **Order lifecycle** extends the current statuses into a delivery lifecycle:

  ```
  PENDING → CONFIRMED → READY_FOR_DISPATCH → ASSIGNED →
  OUT_FOR_DELIVERY → (per stop: ARRIVED → DELIVERED | FAILED) → COMPLETED
                                                    ↘ RETURNED
                          ↘ CANCELLED (with reason, any pre-delivery stage)
  ```

- **Realtime**: FastAPI WebSocket channels — customer subscribes to
  `order:{id}`, dispatchers to a fleet channel, drivers to their manifest.
- **Assignment engine** (service): scores available drivers by vehicle
  capacity fit, current route proximity (nearest-neighbor insertion), shift
  window, and existing load; falls back to dispatcher manual assignment.
- **Routing**: pluggable engine — start with nearest-neighbor + 2-opt in
  Python (OSRM/Valhalla/Google Routes as upgrade path). Stores ordered
  `delivery_stops` per `route`.
- **AI carry-over**: port Gemini features as async FastAPI endpoints backed by
  a shared cache (Redis or Postgres table) instead of in-process dicts.
- **File storage**: POD photos/signatures and product images → object storage
  (S3-compatible, e.g. Cloudflare R2). Product images migrate from `static/`.
- **Notifications**: event-driven — order/delivery status changes emit events;
  a worker sends emails (EmailJS or direct SMTP — see decisions) and can push
  WebSocket messages.

---

## 5. Target Data Model

PostgreSQL schema. **Bold** = new entity required by the spec; others are
carried over and evolved. All PKs become `BIGSERIAL`/`UUID`; money becomes
`NUMERIC(12,2)`; timestamps `TIMESTAMPTZ`.

### 5.1 Identity & access

| Table | Key columns | Mapping |
|---|---|---|
| `users` | id, role (`customer`, `driver`, `dispatcher`, `admin`, `ops_manager`), email, phone, password_hash, pin_hash, otp fields, is_active, created_at | Merges `users` + `admin` into one table with `role`; customers keep PIN, staff keep password |
| **`drivers`** | id, user_id FK, license_no, status (`active`,`off_duty`,`suspended`), home_location_id FK | New — driver profile attached to a `role=driver` user |
| **`vehicles`** | id, plate_no, type, max_weight_kg, max_volume_m3, is_active | New — capacity constraints live here |
| **`driver_shifts`** | id, driver_id FK, vehicle_id FK, starts_at, ends_at, status | New — driver availability + vehicle assignment |
| `audit_logs` | id, user_id FK, action, category, metadata JSONB, created_at | Ported; `admin_id` → `user_id` |

### 5.2 Catalog (carried over)

| Table | Key columns | Mapping |
|---|---|---|
| `categories` | id, name, unit_options JSONB | JSON strings → `JSONB` |
| `products` | id, category_id FK, name, description, base_price, unit, unit_options JSONB, discounts JSONB, weight_kg_per_unit, stock_quantity, image_url, is_archived, purpose, target_species, tags | `category` text → FK; merge `stock_status`+`stock_quantity`; add `weight_kg_per_unit` (needed for vehicle capacity) |
| `pets` | id, customer_id FK, name, species, breed, age_months, weight_kg, lifestyle_classification | Optional carry-over for AI features |

### 5.3 Ordering & delivery

| Table | Key columns | Mapping |
|---|---|---|
| `customers` | (use `users` where `role=customer`) + `customer_addresses` | `users` carried over; addresses split out |
| **`locations`** | id, label, line1, line2, city, province, postal_code, lat, lng, place_id | New — geocoded addresses; used by customers, depot, stops |
| `orders` | id, order_no, customer_id FK, delivery_location_id FK, delivery_window_start/end, status, subtotal, discount_total, delivery_fee, total_price, payment_id FK, cancellation_reason, created_at | Carried over + delivery address, time window, delivery fee |
| `order_items` | id, order_id FK, product_id FK, quantity, selected_unit, unit_multiplier, base_price_at_time, discount_amount_at_time, price_at_time | Carried over unchanged (price snapshots) |
| **`payments`** | id, order_id FK, method (`cash`,`gcash`,`card`,…), amount, status, reference, paid_at | New — currently `payment_method` is accepted but never stored |
| **`routes`** | id, driver_id FK, vehicle_id FK, shift_id FK, date, status (`planned`,`active`,`completed`), total_distance_km, est_duration_min, cost | New — one route = one driver's run |
| **`deliveries`** | id, order_id FK, route_id FK, driver_id FK, status, assigned_at, attempt_no, failure_reason, cost | New — an order's delivery execution |
| **`delivery_stops`** | id, route_id FK, delivery_id FK, location_id FK, sequence_no, planned_eta, arrived_at, departed_at, status | New — ordered stops within a route |
| **`delivery_status_events`** | id, delivery_id FK, status, note, lat, lng, actor_user_id, created_at | New — immutable status history (also powers customer tracking + audit) |
| **`proof_of_delivery`** | id, delivery_id FK, type (`photo`,`signature`,`otp`), file_url, recipient_name, captured_at, lat, lng | New |
| `notifications` | id, user_id FK, channel, template, payload JSONB, status, sent_at | New — replaces ad-hoc fire-and-forget email calls |

### 5.4 Required-entity coverage check

Spec entity → table(s): Customer → `users`(role=customer) + `customer_addresses`;
Order → `orders`; OrderItem → `order_items`; Driver → `drivers` + `users`;
Vehicle → `vehicles`; Delivery → `deliveries`; DeliveryStop → `delivery_stops`;
Route → `routes`; Location → `locations`; Payment → `payments`;
DeliveryStatus → `delivery_status_events` (+ `deliveries.status`). ✅ All covered.

---

## 6. Planned API Surface

REST under `/api/v1`, JWT bearer auth, consistent error envelope
(`{ "error": { "code", "message", "details?" } }`), pagination on all list
endpoints (`?page=&pageSize=&sortBy=`).

| Group | Endpoints (summary) | Consumers |
|---|---|---|
| `auth` | `POST /auth/register`, `/auth/otp/verify`, `/auth/otp/resend`, `/auth/pin/set`, `/auth/login`, `/auth/refresh`, `/auth/logout`, password reset | all |
| `catalog` | `GET /products`, `GET /categories`; admin CRUD under `/admin/products`, `/admin/categories` | customer, admin |
| `orders` | `POST /orders/quote`, `POST /orders`, `GET /orders`, `GET /orders/{no}`, `GET /orders/{no}/status`, `POST /orders/{no}/cancel` | customer |
| `dispatch` | `GET /dispatch/queue`, `POST /dispatch/orders/{id}/assign`, `POST /dispatch/auto-assign`, `POST /routes`, `POST /routes/{id}/optimize`, `PATCH /routes/{id}` | dispatcher |
| `drivers` | `GET /drivers`, `POST /drivers`, `PATCH /drivers/{id}`, `GET /drivers/{id}/manifest`, `POST /shifts` | dispatcher, admin |
| `vehicles` | `GET/POST/PATCH /vehicles[/{id}]` | dispatcher, admin |
| `driver-app` | `GET /me/route`, `POST /stops/{id}/arrive`, `POST /stops/{id}/complete`, `POST /stops/{id}/fail`, `POST /deliveries/{id}/pod` | driver |
| `tracking` | `GET /track/{order_no}` (public), `WS /ws/track/{order_no}`, `WS /ws/fleet` | customer, dispatcher |
| `payments` | `POST /payments`, `GET /payments/{id}`, webhook endpoint if provider | customer, system |
| `notifications` | `GET /notifications`, `POST /notifications/test` (admin) | all |
| `analytics` | port: `/admin/stats`, `/top-products`, `/least-selling`, `/revenue-trend`, `/order-status-distribution`, `/category-performance` + new `/driver-performance`, `/delivery-costs`, `/failed-deliveries` | admin, ops |
| `ai` | port: `/ai/chat`, `/ai/recommendations`, `/ai/inventory-insights`, `/ai/inventory-forecast`, `/ai/business-summary` | admin, customer |
| `admin` | user/staff management, `GET /audit-logs`, `GET /audit-logs/export.{csv,pdf}` | admin |

---

## 7. Feature Mapping & Gap Analysis

### 7.1 Carry-over (existing feature → disposition)

| Existing feature | Disposition | Notes |
|---|---|---|
| Customer registration (email OTP + PIN) | **Port** | Same flow, JWT tokens instead of session |
| Admin login + profile | **Port + fix** | Staff roles (admin/dispatcher/ops); replace hardcoded OTP reset |
| Product catalog + categories + images | **Port** | `category` text → FK; images → object storage |
| Unit options & per-unit discounts, server-side quote | **Port** | Core pricing logic moves to `services/pricing.py` |
| Cart + checkout → `POST /orders` | **Port + extend** | Add delivery address, window, fee calculation |
| Order statuses + cancellation reason | **Port + extend** | Extend to delivery lifecycle (see §4.2) |
| Stock deduction on completion | **Port** | Trigger on delivery `COMPLETED` |
| Order history + status polling | **Port + upgrade** | Polling → realtime tracking |
| Email notifications (ready/cancelled) | **Port + extend** | Event-driven; add assigned/en-route/delivered/failed templates |
| Audit logs + CSV/PDF export | **Port** | Actor becomes any staff `user_id` |
| Analytics endpoints (stats, trends, rankings) | **Port** | Same queries on Postgres |
| Gemini AI (chat, recs, insights, forecast, summary, lifestyle) | **Port** | Shared cache/rate-limit → Redis/DB |
| Pets profile + lifestyle classification | **Port (optional)** | Keep if AI features retained |
| Seeding scripts | **Rewrite** | `seed.py` → Alembic data migration / CLI; `seed_analytics.py` → fixture generator |

### 7.2 New build (target feature → components)

| Target feature | New components |
|---|---|
| Delivery addresses + geocoding | `locations`, address capture at checkout, geocoding provider |
| Driver & vehicle management | `drivers`, `vehicles`, `driver_shifts`, admin/dispatcher CRUD |
| Automatic driver assignment | `services/assignment.py`, capacity + availability + proximity scoring |
| Route optimization | `services/routing.py`, `routes` + `delivery_stops`, dispatcher UI |
| Delivery time windows | `orders.delivery_window_*`, constraint checks in assignment/routing |
| Multi-stop routes | `delivery_stops.sequence_no`, route manifest |
| Failed delivery handling | status `FAILED` + reason codes, re-attempt flow, return handling |
| Proof of delivery | `proof_of_delivery` + upload endpoint + object storage |
| Real-time tracking | WebSocket channels + `delivery_status_events` |
| Customer notifications | `notifications` + event worker + templates |
| Driver performance analytics | queries over `deliveries`/`stops`/status events; ops dashboard |
| Delivery cost calculation | `services/costing.py` (distance × vehicle rate + driver time) → `orders.delivery_fee`, `routes.cost` |
| Payments | `payments` table + method handling (start with COD, provider optional) |

---

## 8. Phased Migration Plan

> Each phase is independently shippable. The Flask app stays running until
> Phase 7 cutover.

**Phase 0 — Foundation**
- Restructure repo into `backend/` + `frontend/`; keep legacy app untouched in
  `legacy/` during transition.
- Provision Neon project; set `DATABASE_URL`; scaffold FastAPI + SQLAlchemy 2.x
  + Alembic; baseline migration for the full target schema.
- Scaffold Vite + React app; shared typed API client; design-system baseline.

**Phase 1 — Auth + Catalog + Checkout parity**
- Unified `users` table + JWT auth; port OTP→PIN customer flow; staff login.
- Port catalog/products/categories CRUD + image storage.
- Port server-side quote + `POST /orders` + order history.
- React customer storefront + checkout.
- Data migration: SQLite `users/products/categories/orders/order_items` →
  Postgres (script in `backend/scripts/`).

**Phase 2 — Dispatcher foundation**
- `locations` + geocoding; attach delivery address + window to orders.
- `drivers`, `vehicles`, `driver_shifts` CRUD; dispatcher console (order queue,
  manual assignment); `deliveries` + `delivery_status_events`.

**Phase 3 — Auto-assignment + routing**
- Assignment scoring service; `routes` + `delivery_stops`; route optimizer
  (nearest-neighbor + 2-opt; engine-pluggable); capacity & window constraints;
  dispatcher override UI.

**Phase 4 — Driver app**
- Mobile-first React views: manifest, stop sequencing, arrive/complete/fail
  actions, POD capture (photo/signature/OTP), failure reasons, re-attempts.

**Phase 5 — Realtime + notifications + payments**
- WebSocket tracking (customer order channel, dispatcher fleet channel);
  notifications worker + templates for every lifecycle event; `payments`
  (COD first); delivery-fee calculation at checkout.

**Phase 6 — Analytics + AI**
- Port analytics endpoints; add driver-performance / cost / failure-rate
  dashboards for ops; port Gemini features behind shared cache; audit logs +
  exports.

**Phase 7 — Cutover**
- Final SQLite→Postgres delta migration; DNS/URL cutover; freeze Flask app;
  remove `legacy/`; archive `sambast.db`/`database.db`.

---

## 9. Environment Variables

| Variable | Used for | Status |
|---|---|---|
| `DATABASE_URL` | Neon pooled Postgres connection | **new** |
| `DATABASE_URL_DIRECT` | Neon direct endpoint for Alembic | **new** |
| `JWT_SECRET`, `JWT_ALGORITHM`, token TTLs | Auth | **new** |
| `GEMINI_API_KEY` | AI features | carried over |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | OTP + notification emails | carried over |
| `EMAILJS_SERVICE_ID/PUBLIC_KEY/PRIVATE_KEY/TEMPLATE_*` | Status emails (if kept) | carried over — see decisions |
| `GEOCODING_API_KEY` | Address geocoding | **new** |
| `ROUTING_PROVIDER` / engine URL | Route optimization | **new** |
| `S3_*` / `R2_*` | POD + product image storage | **new** |
| `REDIS_URL` | AI cache, rate limiting, WS pub/sub | **new (optional)** |

---

## 10. Open Decisions

| # | Question | Options / default |
|---|---|---|
| 1 | Customer OTP channel | Email (current, SMTP) vs SMS (e.g. Semaphore/Twilio PH). Default: email. |
| 2 | Email provider | Keep EmailJS server-side vs consolidate to SMTP/Resend. Default: keep EmailJS initially. |
| 3 | Geocoding/maps | Google Maps vs Mapbox vs OSM/Nominatim. Needed for `locations` + assignment/routing. |
| 4 | Routing engine | In-house heuristic (default, Phase 3) vs OSRM/Valhalla/Google Routes later. |
| 5 | Object storage | Cloudflare R2 vs S3 vs Neon-adjacent. Needed for POD photos + product images. |
| 6 | Payments | COD only (default, matches current `cash`) vs GCash/Maya integration. |
| 7 | Realtime transport | WebSockets (default) vs SSE for tracking channels. |
| 8 | Keep `pets` + lifestyle AI? | Optional carry-over — keep if AI roadmap retained. |
| 9 | Monorepo vs split repos | Default: monorepo (`backend/` + `frontend/`). |

---

*Generated as the refactoring blueprint for the Sambast Delivery & Logistics
Management Platform. Update this document as decisions in §10 are made.*
