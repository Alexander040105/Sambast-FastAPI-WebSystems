# Developer BE-B: Defense & Live Demonstration Script
> **Project:** Sambast — Delivery & Logistics Management Platform  
> **Role:** Backend Developer B (BE-B: Dispatch, Driver, Route, Fleet & Analytics)  
> **Stack:** FastAPI, SQLAlchemy 2.x, PostgreSQL (Neon), Alembic, Pydantic, Vite/React

---

## Quick Reference: Test Credentials
*All demo accounts use password:* `testpass123`

| Role | Account Email | In-App Display Name | Key Surface URL |
| :--- | :--- | :--- | :--- |
| **Dispatcher** | `dispatcher@sambast.com` | Dispatcher User | `http://localhost:5173/dispatcher/queue` |
| **Driver 1** | `driver1@sambast.com` | Driver #1 · Driver One | `http://localhost:5173/driver` |
| **Driver 2** | `driver2@sambast.local` | Driver #2 · Driver Dave 2 | `http://localhost:5173/driver` |
| **Driver 3** | `driver3@sambast.local` | Driver #3 · Driver Dave 3 | `http://localhost:5173/driver` |
| **Ops Manager** | `ops@sambast.com` | Operations Manager | `http://localhost:5173/ops` |

---

## 1. Live Demonstration Script (Step-by-Step Flow)

### Step 1: Dispatcher Console — Auto-Assignment & Route Optimization
1. Go to `http://localhost:5173/login`.
2. Sign in as **Dispatcher** (`dispatcher@sambast.com` / `testpass123`).
3. Navigate to **Dispatch Queue** (`/dispatcher/queue`).
4. Select an order in `READY_FOR_DISPATCH`.
5. **Demo Action:** Click **Auto-Assign** (or observe the suggestion card).
   * *What you say:* "Our auto-assignment engine evaluates candidate drivers in real time. It checks active shift windows, dynamic vehicle weight capacity, and depot proximity, and displays a transparent explanation of why this driver was selected."
6. Assign the order to **Driver 1**.
7. Navigate to **Routes** (`/dispatcher/routes`) and open Driver 1's active route.
8. **Demo Action:** Click **Optimize Route**.
   * *What you say:* "When I click Optimize, our heuristic engine executes a two-phase optimization: a greedy Nearest-Neighbor initialization followed by a 2-Opt local search. Notice how stops are re-ordered to respect customer time windows and minimize total travel distance, while recalculating planned ETAs with 10-minute service dwell times."

---

### Step 2: Driver Mobile Workflow — Execution & POD Capture
1. In an incognito window or after logging out, go to `http://localhost:5173/login`.
2. Sign in as **Driver 1** (`driver1@sambast.com` / `testpass123`).
3. You will land on the mobile-responsive route manifest (`/driver`).
4. **Demo Action:** On Stop 1, click **Start Delivery**.
   * *What you say:* "The stop transitions to `EN_ROUTE`, updates the parent delivery, and marks the customer order as `OUT_FOR_DELIVERY`. This immediately emits a Server-Sent Event (SSE) to update the customer's live tracking screen."
5. **Demo Action:** Click **Arrived** $\rightarrow$ Click **Capture POD** $\rightarrow$ Upload a photo and enter recipient name $\rightarrow$ Click **Complete Delivery**.
   * *What you say:* "Completing the stop triggers atomic business logic on the backend: inventory is deducted once (`quantity × unit_multiplier`), COD payment records are reconciled to `paid`, and the photo is securely stored with a unique UUID on disk."

---

### Step 3: Edge Case Handling — Failure & Automatic Re-Queue
1. On Stop 2, click **Mark Failed**.
2. Select **Recipient unavailable** and submit.
   * *What you say:* "Notice that because this is attempt #1, the stop is marked `FAILED`, but our backend automatically resets the order status back to `READY_FOR_DISPATCH`. If an order reaches 3 failed attempts or is declined, it moves to terminal `RETURNED`. Otherwise, it automatically re-queues."
3. Switch back to the Dispatcher account at `/dispatcher/queue` to prove the order has reappeared in the queue ready for another dispatch attempt.

---

### Step 4: Operations Manager — Analytics & Costing
1. Sign in as **Ops Manager** (`ops@sambast.com` / `testpass123`).
2. Navigate to **Operations Overview** (`/ops`).
   * *What you say:* "Our analytics dashboard computes driver performance metrics dynamically from the database. It calculates on-time delivery rates with a 15-minute grace tolerance, displays Costing v2 calculations based on vehicle rate cards and driver hours, and categorizes failure reasons."

---

## 2. "How Did I Make It?" — Underlying Logic & Algorithms

When examiners or teammates ask: *"Sure, it does X, but how did you actually build it?"*, use these explanations:

---

### Feature A: 3-Tier Geocoding Engine
* **File:** `backend/app/services/geocoding.py`
* **Question:** *"How do you handle address geocoding, and what if the API fails or is rate-limited?"*
* **Underlying Logic & Defense:**
  1. **Tier 1 (Manual Coordinates):** If `manual_lat` and `manual_lng` are provided by the user or dispatcher, it bypasses network calls entirely.
  2. **Tier 2 (OpenStreetMap Nominatim):** Queries the OSM Nominatim REST endpoint asynchronously via `httpx.AsyncClient` with a custom `User-Agent`.
  3. **Tier 3 (Preset-Zone Fallback):** If Nominatim is blocked, offline, or rate-limited, the system scans the address against 19 Metro Manila preset zone centroids (Makati, BGC, Ortigas, Quezon City, Alabang, etc.) and defaults to the NCR geographic center (`14.5547, 121.0244`).
  * **Key Decision:** Third-party API failures must **never** block checkout or dispatch. The engine returns fallback coordinates rather than throwing a 500 error.

---

### Feature B: The Auto-Assignment Engine
* **File:** `backend/app/services/assignment.py` (`get_auto_assign_suggestion`)
* **Question:** *"How does the auto-assign algorithm pick the best driver?"*
* **Underlying Logic & Defense:**
  1. **Dynamic Payload Aggregation:** Computes order total weight by querying order items and products:
     $$\text{Total Weight} = \sum (\text{weight\_kg\_per\_unit} \times \text{quantity} \times \text{unit\_multiplier})$$
  2. **Active Shift Constraint:** Filters drivers where `starts_at <= now <= ends_at`, shift status is `active` or `scheduled`, and driver status is `active`.
  3. **Cumulative Vehicle Load Check:** Unlike naive systems that only check a single order, our engine queries all current in-flight deliveries (`PENDING`, `EN_ROUTE`, `ARRIVED`) assigned to that driver, calculates their combined weight, and enforces:
     $$\text{Current In-Flight Load} + \text{New Order Weight} \le \text{vehicle.max\_weight\_kg}$$
  4. **Timezone-Normalized Window Check:** Converts naive DB datetimes to UTC. If the order window has expired, falls back to allow any active shift today for urgent dispatch.
  5. **Depot Proximity Scoring:** Computes Haversine distance between the driver's home depot (or central depot in Makati) and the customer location.
  6. **Candidate Ranking:** Sorts valid candidates by distance ascending ($O(N \log N)$), assigns the top driver, and generates a formatted audit explanation string.

---

### Feature C: Route Optimizer & Heuristic Scheduling
* **File:** `backend/app/services/routing.py` (`optimize_route`)
* **Question:** *"What algorithm did you implement for route optimization, and how do you handle constraints?"*
* **Underlying Logic & Defense:**
  1. **Null-Island Protection:** Un-geocoded stops default to `(0.0, 0.0)`. Calculating Haversine distance from Manila to `(0.0, 0.0)` produces an 11,000 km jump into the Atlantic Ocean. The algorithm intercepts `(0.0, 0.0)` and treats it as a nominal 2.0 km urban hop.
  2. **Soft-Constraint Cost Function:** Simulates driving at 30 km/h:
     * If the driver arrives before `window_start`, they wait until the window opens.
     * If they arrive after `window_end`, a severe penalty of **500 penalty-km per hour late** is added to the route score.
  3. **State-Preserving Partitioning:**
     * Active stops (`DELIVERED`, `ARRIVED`, `EN_ROUTE`, `FAILED`) are **frozen** at the beginning of the route in their exact historical sequence.
     * Only unserviced `PENDING` stops are passed to the optimizer.
  4. **Phase 1: Nearest-Neighbor Construction (Greedy):**
     * Seeds the sequence with the stop having the earliest `delivery_window_start`.
     * Iteratively selects the pending stop that minimizes total incremental cost ($\text{distance} + \text{lateness penalty}$).
  5. **Phase 2: 2-Opt Local Search (Improvement Phase):**
     * Systematically tests 2-edge swaps by reversing subsections `optimized[i:j][::-1]`.
     * If a swap lowers total cost by $> 0.0001$, the improvement is accepted, repeating until local optimality.
  6. **ETA Recalculation:** Traverses the final sequence, computes planned arrival times with a 10-minute service dwell time per stop, and saves `total_distance_km` and `est_duration_min` directly to the `Route` row.

---

### Feature D: Mobile Driver Workflow, Stock Deduction & Idempotency
* **File:** `backend/app/routers/driver_app.py`
* **Question:** *"How do you prevent race conditions, double completions, and ensure stock integrity?"*
* **Underlying Logic & Defense:**
  1. **Horizontal Authorization (`check_stop_permission`):** Cross-checks `current_user.id` $\rightarrow$ `Driver` $\rightarrow$ `Route.driver_id`. If Driver A tries to alter Driver B's stop, the endpoint returns `403 Forbidden`.
  2. **Idempotency Guards:** If a driver taps "Complete" or "Fail" multiple times on a slow connection, the server checks current stop status and raises `409 Conflict` instead of repeating side effects.
  3. **Stock Deduction on Completion:** When a stop reaches `DELIVERED` and order status becomes `COMPLETED`, inventory is deducted once:
     $$\text{stock\_quantity} = \max(0, \text{current\_stock} - (\text{quantity} \times \text{unit\_multiplier}))$$
  4. **COD Payment Synchronization:** Automatically marks COD payments as `paid`, sets `paid_at = now()`, and updates `payment.amount = order.total_price`.
  5. **Terminal `RETURNED` vs Auto Re-Queue:**
     * If `attempt_no >= 3` or reason is `delivery_declined`, transitions to terminal `RETURNED`.
     * Otherwise, delivery is marked `FAILED` and order status resets to `READY_FOR_DISPATCH`, making it immediately eligible for re-dispatch.
  6. **Binary POD Upload:** Supports multipart binary file uploads (`UploadFile`), generates collision-proof UUID filenames (`pod_{delivery_id}_{uuid}.jpg`), stores files in `backend/uploads/`, and creates a `ProofOfDelivery` database record.

---

### Feature E: Costing v2 & Dynamic Route Allocation
* **File:** `backend/app/services/costing.py` (`calculate_route_cost`)
* **Question:** *"How is route cost calculated and how does it relate to customer delivery fees?"*
* **Underlying Logic & Defense:**
  1. **Vehicle Rate Cards:** Motorcycle (1.0/km), Van (1.5/km), Truck (2.5/km).
  2. **Labor Rate:** Driver time calculated at $20.00/hr.
  3. **Formula:**
     $$\text{Route Cost} = (\text{Total Distance km} \times \text{Vehicle Rate}) + \left(\frac{\text{Duration Minutes}}{60} \times \text{Driver Hourly Rate}\right)$$
  4. **Allocation & Reconciliation:** Allocates route cost equally among deliveries on that route (`per_delivery_cost`), updates `order.delivery_fee`, and recalibrates `order.total_price`.

---

### Feature F: Operations Analytics Engine
* **File:** `backend/app/routers/analytics.py`
* **Question:** *"How are ops manager metrics calculated?"*
* **Underlying Logic & Defense:**
  1. **Period Boundaries:** Computes dynamic Monday 00:00:00 to Sunday 23:59:59 UTC intervals for `this_week` vs `previous_week`.
  2. **On-Time Performance Rate:** Evaluates delivered stops with a 15-minute grace tolerance window:
     $$\text{On Time if } \text{departed\_at} \le \text{planned\_eta} + 15\text{ minutes}$$
  3. **Role Guards:** Endpoints are strictly protected via `require_role("ops_manager", "admin", "dispatcher")`.

---

## 3. Automated Verification Command

Run this command in the terminal to demonstrate 100% test passing across all 9 BE-B verification scenarios:

```powershell
cd c:\Users\Brent\Desktop\WebSys-Midterms\Sambast-FastAPI-WebSystems\backend
.venv\Scripts\python scripts/test_beb_fixes.py
```

### Expected Output:
```text
[PASS] Fix 1: Geocoding fallback presets verified with (14.5547, 121.0244).
[PASS] Fix 2: Null Island optimizer protection verified.
[PASS] Fix 3: GET /drivers/{driver_id}/manifest verified.
[PASS] Fix 4: Analytics security guards verified.
[PASS] Fix 5: Global error response format verified.
[PASS] Fix 6: Stock deduction and COD reconciliation verified.
[PASS] Fix 7: Stop completion idempotency and 409 Conflict verified.
[PASS] Fix 8: Route optimization preserves fixed/delivered stops verified.
[PASS] Fix 9: Dispatch assign 409 Conflict on re-assignment verified.

ALL BE-B FIXES VERIFIED SUCCESSFULLY!
```
