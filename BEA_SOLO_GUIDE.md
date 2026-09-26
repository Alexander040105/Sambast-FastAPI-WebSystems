# Sambast BE-A Solo Checklist — Days 2–5

**Stack:** FastAPI + SQLAlchemy 2 + Neon Postgres · Contract: `MEGAPLAN.md` §7 is law · Branch: `customer-team-2`

---

## Every morning

- [ ] `git pull` on `customer-team-2`
- [ ] `git checkout -b feat/be-a-dayN-tN-name`
- [ ] Terminal 1: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload`
- [ ] Terminal 2 (only if testing FE): `cd frontend && npm run dev`
- [ ] Sanity: `http://localhost:8000/health` returns `{"status":"ok"}`

## Rules that apply to every task

- [ ] snake_case JSON · `{error:{code,message,details?}}` · `{data, pagination}` lists · UPPER_SNAKE enums
- [ ] State changes = action endpoints (`POST /orders/{no}/cancel`), never `PATCH {status}`
- [ ] Never trust client prices/totals — always recompute from DB
- [ ] One PR per task → `customer-team-2`; commit style `feat(BE-A): ...`
- [ ] "Done" = works in `/docs` + test script or FE consumes it
- [ ] Cut list is final — no Gemini, SMS, real payments, maps, WebSockets

---

## 🟦 Day 2 — Catalog → Pricing → Orders *(critical path)*

### T4 — Catalog APIs

- [ ] Read legacy inventory queries in `legacy_code/app.py` (~line 2100+, `_get_product_unit_options`)
- [ ] Create `app/schemas/catalog.py` — `ProductOut`, `CategoryOut`, pagination
- [ ] Create `app/routers/catalog.py`:
  - [ ] `GET /products` — `?search=&category_id=&page=&page_size=` → `{data, pagination}`
  - [ ] `GET /categories`
  - [ ] Return `unit_options`/`discounts` JSONB raw
- [ ] Create `app/routers/admin_catalog.py` — product/category CRUD, `require_role("admin","ops_manager")`, audit-log each mutation
- [ ] Register both routers in `main.py` under `/api/v1`
- [ ] Test in `/docs`: list, filter, search, paginate, create+patch product
- [ ] ✅ PR merged

### T5 — Pricing service

- [ ] Create `app/services/pricing.py`: `(items[]) → totals` recomputed **only from DB** — `base_price × unit_multiplier − discounts`
- [ ] Port unit-option multiplier + discount math from legacy (`unit_options_json`/`discount_json` handling)
- [ ] Write `backend/test_pricing.py` — pure unit test, no server needed
- [ ] ✅ PR merged

### T6 — Orders *(biggest task — budget the most time)*

- [ ] Create `app/schemas/orders.py` — `QuoteRequest/Out`, `OrderCreate`, `OrderOut`, `OrderStatusOut`, `CancelRequest` (reason required)
- [ ] Create `app/services/costing.py` — v1: `base_fee + per_km × haversine(depot→address)`
- [ ] Create `app/routers/orders.py`:
  - [ ] `POST /orders/quote` → pricing service totals + `delivery_fee`
  - [ ] `POST /orders` — geocode address via existing `services/geocoding.py` (manual lat/lng override); `Idempotency-Key` header → store + dedupe; create `locations` / `orders` (PENDING→READY_FOR_DISPATCH) / `order_items` (price snapshots) / `payments` (cash, pending) rows
  - [ ] `GET /orders` — customers see only their own
  - [ ] `GET /orders/{no}` + `GET /orders/{no}/status`
  - [ ] `POST /orders/{no}/cancel` — action endpoint, reason required → `CANCELLED`
- [ ] Register router in `main.py`
- [ ] **Done when:** `POST /orders` → order appears in `GET /api/v1/dispatch/queue` (already works — verify with the seeded dispatcher token)
- [ ] ✅ PR merged
- [ ] 🏁 **Day-2 EOD checkpoint:** order → dispatch queue → manual assign, all clean

---

## 🟩 Day 3 — SSE streams + notifications

### T7 — SSE streams

- [ ] Create `app/services/events.py` — subscriber registry per `order_no` (in-process pub/sub, or poll `delivery_statuses` every ~2s inside the stream — polling is acceptable for demo)
- [ ] Create `app/routers/tracking.py`:
  - [ ] `GET /track/{order_no}` — public snapshot endpoint
  - [ ] `GET /track/{order_no}/stream` — public SSE, event shape `{event:"status", data:{delivery_id, order_no, status, lat, lng, ts}}`
  - [ ] `GET /fleet/stream` — `require_role("dispatcher","admin","ops_manager")`
- [ ] Register router; test with `curl -N http://localhost:8000/api/v1/track/ORD-SEED-0001/stream` while assigning an order in `/docs`
- [ ] Fallback note if SSE blocks: 5s polling on the snapshot endpoint is allowed by the board
- [ ] ✅ PR merged

### T8 — Notifications

- [ ] Extend `app/services/email.py` with a `send_status_email(to, order_no, status)` helper
- [ ] Hook transitions (ASSIGNED / OUT_FOR_DELIVERY / DELIVERED / FAILED) → email + insert `notifications` row
- [ ] `GET /notifications` — logged-in user's own
- [ ] Test: trigger assign → email arrives → row exists
- [ ] ✅ PR merged
- [ ] 🏁 **Day-3 EOD checkpoint:** status change → SSE event + email + notification row

---

## 🟨 Day 4 — Analytics + admin endpoints

### T9 — Admin analytics port

- [ ] Read legacy analytics (~`app.py:1410`, `_analytics_signature` region) + `get_log_category` (`app.py:371`)
- [ ] Create `app/routers/admin_analytics.py`, `require_role("admin","ops_manager")`:
  - [ ] `GET /admin/stats`
  - [ ] `GET /admin/top-products`
  - [ ] `GET /admin/least-selling`
  - [ ] `GET /admin/revenue-trend`
  - [ ] `GET /admin/order-status-distribution`
  - [ ] `GET /admin/category-performance`
- [ ] Same query logic as legacy, Postgres dialect (no `strftime` — use `date_trunc`/`to_char`)
- [ ] Audit-log write on every staff mutation (helper dep: `app/services/audit.py`)
- [ ] ✅ PR merged

### T10 — Order admin + cancel email

- [ ] `GET /admin/orders` — all orders, `?status=&page=` filters (for FE-A admin screens)
- [ ] Cancellation email via `services/email.py` on `POST /orders/{no}/cancel`
- [ ] Edge cases: cancel already-delivered → 409; cancel nonexistent → 404
- [ ] ✅ PR merged
- [ ] 🏁 **Day-4 EOD checkpoint:** full E2E — order → assign → events → email → analytics row

---

## 🟧 Day 5 — Seed + stabilize

### T11 — Demo seed script

- [ ] Create `backend/scripts/seed_demo.py` adapting `legacy_code/seed.py` + `seed_analytics.py`:
  - [ ] Products from `legacy_code/sambast_inventory_list_v2.csv`
  - [ ] ~100 orders across statuses/windows (realistic spread for analytics)
  - [ ] 3 drivers, 3 vehicles (distinct capacities), ~10 geocoded locations
  - [ ] All 5 role accounts; **print credentials table at end**
- [ ] Run it → spot-check `/dispatch/queue`, `/admin/stats` return real numbers
- [ ] ✅ PR merged

### T12 — Bugfix + docs

- [ ] Fix your own bugs first (customer-facing > cosmetic)
- [ ] README "Run" section: venv setup, `.env` var list (no values), `uvicorn`, seed, test scripts
- [ ] Rehearse demo path: register → OTP → PIN → order → queue → assign → track → email
- [ ] Final commit + tag `midterm-demo`
- [ ] 🏁 **Done:** demo script runs clean twice

---

## Appendix — keep handy

| I need… | It's at… |
|---|---|
| Contract (law) | `MEGAPLAN.md` §7 lines 188–308 |
| OTP/PIN logic to port | `legacy_code/app.py` 86–90, 318–346, 4126–4405 |
| Pricing/discount logic | `legacy_code/app.py` ~2116 + checkout recompute |
| Analytics queries | `legacy_code/app.py` ~1410 |
| Audit categories | `legacy_code/app.py:371` `get_log_category` |
| Product catalog CSV | `legacy_code/sambast_inventory_list_v2.csv` |
| Geocoding (done) | `backend/app/services/geocoding.py` |
| Dispatch queue (done) | `backend/app/routers/dispatch.py` |
| Test style to copy | `backend/test_t1_t3.py` |
| Re-seed + FE login | `backend/dev_seed.py` → `localhost:5173/dev-login.html` |

**Coordination watch-outs:** don't rename/retype order statuses (BE-B's driver app depends); `delivery_fee`/`costing.py` is shared with BE-B T11 — keep it extensible; SSE shape feeds FE-A tracking — match §7.2 exactly.
