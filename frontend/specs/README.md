# Frontend data contract — three planned dashboard features

This is the implementation contract for a future coding-agent session. It does **not**
implement anything: no React components, hooks, or fetch calls exist yet for the three
features below. Types live in `api-types.ts` and `param-types.ts`; component-level
behavior lives in `components.md`. This document ties both to the verified API and to the
original PM requirements.

**Verification method**: the backend (`backend/app/main.py`, FastAPI) was run locally with
`uvicorn app.main:app --host 127.0.0.1 --port 8000` on 2026-09-09. Every endpoint, field
name, type, and constraint referenced below was checked against the live OpenAPI schema
(`GET /openapi.json`) and/or exercised with live `curl` requests, and cross-referenced with
`backend/app/routes.py` and `backend/tests/test_routes.py`. Nothing here is taken from the
PM brief without independent API verification — where the brief and the API disagree, the
API wins (see "Discrepancies" under each feature).

---

## Feature 1 — Date range filter

### Endpoints

| Purpose | Method | Path |
|---|---|---|
| Available date range + filter options (always unfiltered) | `GET` | `/api/metrics/facets` |
| Movements the dashboard's KPIs/charts are computed from | `GET` | `/api/metrics` |

### Request types

`DateRangeFilter` (`param-types.ts`) — applied as `start_date`/`end_date` query params on
`GET /api/metrics`. `GET /api/metrics/facets` takes no parameters at all.

### Response types

`FacetsResponse` (`api-types.ts`, alias of the existing `MetricsFacets` in
`frontend/src/lib/financial-types.ts`) for `/api/metrics/facets`; the existing
`FinancialMovement[]` (already defined in `frontend/src/lib/financial-types.ts`) for
`/api/metrics`.

### Parameters

| Parameter | Type | Required | Valid values | Default | Format | Description |
|---|---|---|---|---|---|---|
| `start_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive lower bound. |
| `end_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive upper bound. |

`GET /api/metrics/facets` has no parameters — it always returns the full dataset's
`min_date`/`max_date`, independent of any active filter.

### UI behavior

See `components.md`, "Feature 1 — Date range filter", for the full `DateRangeFilterBar`
spec. In summary: two independent `<input type="date">` fields feeding a single
`DateRangeFilter` value; `KPIRow`, `IncomeOutcomeChart`, and `ProfitPercentChart` all
re-derive their data from the filtered `/api/metrics` response; `DashboardHeader`'s period
label keeps showing the full, unfiltered dataset range (a documented design decision, not
an API constraint).

### Edge cases

1. **Only `start_date` provided.** Request: `GET /api/metrics?start_date=2026-06-01`
   (no `end_date`). Verified backend behavior: returns every movement from that date
   onward, unbounded above. UI: KPI cards and both charts recompute from this partial
   result; the end-date input stays visibly empty (not auto-filled with `maxDate`).
2. **`end_date` earlier than `start_date` (inverted range).** Verified live:
   `GET /api/metrics?start_date=2026-08-01&end_date=2026-01-01` → HTTP 200, `[]` (not a
   422). UI consequence, verified against the EXISTING code (not hypothetical): `computeKPIs([])`
   in `frontend/src/lib/financial-utils.ts` returns `{ totalIncome: 0, totalOutcome: 0,
   profit: 0, profitPercent: 0 }` — a valid, non-null object — so `KPIRow` renders `"$0"` /
   `"0.0%"` via `formatCurrency`/`formatPercent`, NOT the `"—"` placeholder (that placeholder
   only appears while `metrics === null`, i.e. before the first load ever completes). The
   two charts DO already have a dedicated empty state: `hasData = data.some(d => d.income >
   0 || d.outcome > 0)` is `false` for an empty result, showing `"No data available to
   display"`. This inconsistency (zeroed KPI cards vs. an explicit empty-state message on
   the charts) already exists in the current codebase for any all-zero dataset and is not
   introduced by this feature — noted here so the implementing session does not mistake it
   for a new bug to fix.

---

## Feature 2 — Anomaly Alerts

### Endpoint

| Method | Path |
|---|---|
| `GET` | `/api/metrics/alerts` |

### Request type

`AlertsParams` (`param-types.ts`), extending `DateRangeFilter`.

### Response type

`AlertsResponse` (`= AlertEntry[]`, `api-types.ts`).

### Parameters

| Parameter | Type | Required | Valid values | Default | Format | Description |
|---|---|---|---|---|---|---|
| `threshold` | `number` | No | `>= 0`, no upper bound (verified) | `0.3` | decimal ratio | Minimum relative outcome increase to flag as an anomaly. |
| `start_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive lower bound. |
| `end_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive upper bound. |

Real, verified, but **not modeled/exposed** by this spec's component (out of the PM
brief's scope for this feature): `group_by` (`"day" \| "week" \| "month"`, default
`"month"`) and `business_type` (`"B2B" \| "B2C"`). Both exist on this endpoint per the
OpenAPI schema.

### UI behavior

See `components.md`, "Feature 2 — Anomaly Alerts", for the full `AnomalyAlertsPanel` spec:
a numeric threshold input (min `0`, no max, default `0.3`, decimals allowed) plus a table
mapping `period` / `outcome_total` / `baseline_average` / `increase_ratio` to
UI columns, with an explicit non-disappearing empty state.

### Edge cases

1. **Threshold high enough that nothing qualifies.** Verified live:
   `GET /api/metrics/alerts?threshold=5` → HTTP 200, `[]`. UI: the table's empty state
   renders (`"No spending anomalies detected for the current threshold (5) and date
   range."`), the `Card` stays mounted, and the threshold input keeps showing `5` (not
   reset to `0.3`).
2. **Date range narrowed to a single period.** Verified from
   `detect_outcome_alerts` (`backend/app/routes.py`): `historical_outcomes` starts empty
   on every call, so the FIRST period in any filtered/grouped series never has a
   `baseline_average` and can never be flagged — a date range that leaves only one period
   in scope always returns `[]`, for any `threshold`. UI: same empty state as case 1.

---

## Feature 3 — B2B vs B2C

### Endpoints

| Purpose | Method | Path |
|---|---|---|
| Top-5 income categories for one business segment | `GET` | `/api/metrics/categories/top` |
| (available filter values, for reference) | `GET` | `/api/metrics/facets` |

Two calls are made to the same endpoint — one with `business_type=B2B`, one with
`business_type=B2C` — not two different endpoints. `/api/metrics/b2b` and
`/api/metrics/b2c` also exist but return raw, unaggregated `FinancialMovement[]` (no
per-category totals) and are NOT used by this feature.

### Request type

`TopCategoriesParams` (`param-types.ts`), extending `DateRangeFilter`.

### Response type

`TopCategoriesResponse` (`= CategoryEntry[]`, `api-types.ts`).

### Parameters

| Parameter | Type | Required | Valid values | Default | Format | Description |
|---|---|---|---|---|---|---|
| `operation_type` | `OperationType` | No | `"income" \| "outcome"` | `"outcome"` | enum | This feature always sends `"income"` explicitly. |
| `limit` | `number` | No | integer, `1 <= limit <= 20` (verified: `0`→422, `21`→422) | `5` | integer | This feature always sends `5` explicitly (top 5, per brief). |
| `business_type` | `BusinessType` | No (required in practice for this feature) | `"B2B" \| "B2C"` | none (aggregates both if omitted) | enum | Selects which segment to aggregate; this feature always sets it. |
| `start_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive lower bound. |
| `end_date` | `string \| undefined` | No | any date | none (omitted) | `YYYY-MM-DD` | Inclusive upper bound. |

### UI behavior

See `components.md`, "Feature 3 — B2B vs B2C", for the full page spec: a new
`B2BVsB2CPage` (conceptual route `/b2b-vs-b2c`) with two side-by-side
`BusinessSegmentSection`s (top-5 table each) and a shared `B2BVsB2CComparisonChart`
below, all driven by the same `DateRangeFilter` used elsewhere in the dashboard.

**Verified gap**: `frontend/package.json` has no routing library and `App.tsx` is a single
unrouted page — adding "a new page" requires the implementing session to introduce routing
or use conditional rendering. This is called out in `components.md` and is not resolved
here (out of scope for a specification-only deliverable).

**Percentage discrepancy**: the API's `CategoryEntry`/`TopCategoryItem` has no percentage
or group-total field — only `total_amount`. Percentage-of-group must be derived
client-side as `total_amount / sum(all total_amount in the same response)`. This is exact
(not approximate) because `Category` is a closed 5-value enum (verified via the OpenAPI
schema) and `limit=5` is always requested, so the response is guaranteed to contain every
category with data for that segment.

### Edge cases

1. **B2B has zero income movements in range, B2C has some.** Verified pattern (same
   empty-array behavior confirmed for `/api/metrics` and `/api/metrics/categories/top`
   with out-of-range dates): the B2B request returns `[]`, the B2C request returns
   normally. UI: the B2B section shows its own empty message; the B2C section renders its
   table and percentages normally; the comparison chart shows a `0` bar for B2B and the
   real total for B2C (`sum([]) === 0`).
2. **Date range entirely outside `facets.min_date`–`facets.max_date`.** Verified pattern
   (confirmed live for `/api/metrics` with `start_date=1999-01-01&end_date=1999-01-02` →
   `[]`; the same date-filtering code path is shared by `/api/metrics/categories/top`):
   both the B2B and B2C requests return `[]`. UI: both sections show their empty state, and
   the comparison chart falls into its "neither group has data" branch (the explicit
   empty-state message, not two zero-height bars — see `components.md`).

---

## Traceability matrix

| PM requirement | API evidence | Type | Component spec |
|---|---|---|---|
| Date range filter with start/end inputs | `GET /api/metrics` — `start_date`/`end_date`, independently optional, nullable, `format: date` (verified OpenAPI + live requests) | `DateRangeFilter` (`param-types.ts`) | `DateRangeFilterBar` (`components.md`, Feature 1) |
| "Show available range" | `GET /api/metrics/facets` — flat `min_date`/`max_date`, no params, always unfiltered (verified OpenAPI + live request) | `FacetsResponse` (`api-types.ts`) | `DateRangeFilterBar` props `minDate`/`maxDate` (`components.md`, Feature 1) |
| Behavior with only one date filled | Verified live: `start_date` only → unbounded above; `end_date` only → unbounded below (`filter_movements_by_date`) | `DateRangeFilter` (both fields optional) | `DateRangeFilterBar` behavior list (`components.md`, Feature 1) |
| Threshold-based anomaly alerts, `0.01 <= threshold <= 1.0`, default `0.3` | `GET /api/metrics/alerts?threshold=` — verified OpenAPI: `minimum: 0` (not `0.01`), no maximum (verified live `threshold=1.5` → 200), `default: 0.3` | `AlertsParams.threshold` (`param-types.ts`) | `AnomalyAlertsPanel` threshold control (`components.md`, Feature 2) |
| Table: period / outcome / 3-period moving average / % increase | `GET /api/metrics/alerts` response — `MetricsAlert`/`AlertEntry`: `period`, `outcome_total`, `baseline_average` (verified: EXPANDING average of all prior periods, not 3-period), `increase_ratio` (verified: decimal ratio, not pre-multiplied by 100) | `AlertEntry`, `AlertsResponse` (`api-types.ts`) | `AnomalyAlertsPanel` table mapping (`components.md`, Feature 2) |
| Alerts empty state when no anomalies | Verified live: `threshold=5` → HTTP 200, `[]` (plain array, not wrapped, not an error) | `AlertsResponse = AlertEntry[]` (`api-types.ts`) | `AnomalyAlertsPanel` empty state (`components.md`, Feature 2) |
| B2B vs B2C top-5 income categories | `GET /api/metrics/categories/top?operation_type=income&business_type=B2B\|B2C&limit=5` (verified OpenAPI + live requests for both segments) | `TopCategoriesParams`, `CategoryEntry`, `TopCategoriesResponse` (`param-types.ts`/`api-types.ts`) | `BusinessSegmentSection` (`components.md`, Feature 3) |
| Percentage of group total per category | Verified: `TopCategoryItem`/`CategoryEntry` has no percentage/denominator field — only `total_amount` | `CategoryEntry.total_amount` (`api-types.ts`), derived percentage documented in JSDoc | `BusinessSegmentSection` table transformation column (`components.md`, Feature 3) |
| B2B/B2C empty states specified separately | Verified: each `business_type` value produces an independent request/response — one being `[]` implies nothing about the other | `TopCategoriesResponse = CategoryEntry[]` (`api-types.ts`) | `BusinessSegmentSection` empty states (`components.md`, Feature 3) |
| Chart comparing total B2B vs B2C income | Same two verified `/api/metrics/categories/top` responses, summed client-side | `TopCategoriesResponse` (`api-types.ts`) | `B2BVsB2CComparisonChart` (`components.md`, Feature 3) |

---

## Summary of discrepancies (PM brief vs. verified API)

| # | Brief said | Verified API reality | Resolution |
|---|---|---|---|
| 1 | Alert threshold: `0.01 <= threshold <= 1.0` | `threshold >= 0` (verified `ge: 0` in OpenAPI, `-0.1` → 422), NO maximum (verified `threshold=1.5` → HTTP 200) | Types and UI validation use the real `>= 0`, no-max constraint (`param-types.ts`, `components.md`). |
| 2 | Alerts table shows "moving average of the 3 previous periods" | `baseline_average` is an EXPANDING average of ALL prior periods in the series (verified in `detect_outcome_alerts`), not a fixed 3-period window | Column labeled "Average of prior periods" instead of claiming "3 periods"; exact behavior documented in JSDoc and `components.md`. |
| 3 | Alerts table shows a "percentage increase" | `increase_ratio` is a decimal ratio (e.g. `0.3388`), not pre-multiplied by 100 | UI transformation multiplies by 100 before display; documented in `api-types.ts` and `components.md`. |
| 4 | Top categories include a percentage of the group total | `TopCategoryItem`/`CategoryEntry` has no percentage or group-total field, only `total_amount` | Percentage derived client-side from the sum of the same response array (exact, given the closed 5-value `Category` enum and `limit=5`); documented in all three files. |

## Open uncertainties

None remaining unverified for the fields and behaviors this spec relies on — every claim
above was checked against a live, locally-running backend and/or `backend/tests/test_routes.py`
on 2026-09-09. Two items are explicitly flagged as **implementation decisions left open**,
not API uncertainties:

- Whether `DashboardHeader`'s period label should switch to reflect the active filter
  instead of the full dataset range (this spec keeps it unfiltered — see Feature 1).
- How the implementing session adds page/routing support for `B2BVsB2CPage`, since no
  routing library exists in `frontend/package.json` today (see Feature 3).
