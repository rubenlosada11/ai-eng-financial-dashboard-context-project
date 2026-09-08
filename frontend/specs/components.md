# Component specifications — Financial Dashboard frontend

Status: **specification only**. No React components, hooks, or fetch calls exist yet for
any of the three features below. This document is meant to be implementable by another
coding agent without further questions. Every API fact referenced here was verified live
against the backend's OpenAPI schema and HTTP responses on 2026-09-09 — see
`README.md` for the full traceability matrix and discrepancies against the PM brief.

Naming/casing convention (verified from the existing codebase, kept consistent here):

- Component files: kebab-case (e.g. `dashboard-header.tsx`), exporting a `PascalCase`
  named function component (e.g. `DashboardHeader`) — see
  `frontend/src/components/dashboard/*.tsx`.
- Props that carry raw API fields keep the API's own snake_case names and types
  (`frontend/src/lib/financial-types.ts`, `.agents/rules/architecture.md`).
- Individual scalar component props (not raw API objects) use ordinary camelCase
  (`period`, `loading`, `minDate`, `maxDate`), matching existing props like
  `DashboardHeaderProps.period` and `KPIRowProps.loading`.
- `loading?: boolean` is the established convention for a skeleton/pending state
  (`KPIRow`, `IncomeOutcomeChart`, `ProfitPercentChart`).
- The established "no data" pattern for charts is a centered message inside the content
  area: `"No data available to display"` (see `income-outcome-chart.tsx`,
  `profit-percent-chart.tsx`). Table empty states below extend this same convention with
  feature-specific copy, since no table component exists yet in the codebase to copy from.
- All UI primitives referenced below (`Card`, `CardHeader`, `CardContent`, `CardTitle`,
  `CardDescription`, `Skeleton`) already exist in
  `frontend/src/components/ui/{card,skeleton}.tsx` and are reused, not reinvented.

Types referenced throughout (`DateRangeFilter`, `AlertsParams`, `TopCategoriesParams`,
`AlertEntry`, `AlertsResponse`, `CategoryEntry`, `TopCategoriesResponse`, `FacetsResponse`)
are defined in `frontend/specs/param-types.ts` and `frontend/specs/api-types.ts`.

---

## Feature 1 — Date range filter

### Component: `DateRangeFilterBar`

File (future): `frontend/src/components/dashboard/date-range-filter-bar.tsx`

> Named `DateRangeFilterBar`, not `DateRangeFilter`, to avoid colliding with the
> `DateRangeFilter` **type** in `param-types.ts` — the component and the value it
> produces are different things.

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `value` | `DateRangeFilter` | required | Current filter value (`{ start_date?: string; end_date?: string }`). Both fields optional, matching the verified API contract. |
| `onChange` | `(next: DateRangeFilter) => void` | required | Called whenever either date input changes. Always receives the FULL updated value (both fields), not a partial patch. |
| `minDate` | `string` (`YYYY-MM-DD`) | required | Lower bound of selectable dates. Sourced from `FacetsResponse.min_date` (`GET /api/metrics/facets`). |
| `maxDate` | `string` (`YYYY-MM-DD`) | required | Upper bound of selectable dates. Sourced from `FacetsResponse.max_date`. |
| `loading` | `boolean` | optional | While `true`, renders both inputs disabled with skeleton placeholders, matching `KPIRow`'s existing `loading` convention. Used while the initial `/api/metrics/facets` request for `minDate`/`maxDate` is in flight. |

**Verified, non-obvious fact driving `minDate`/`maxDate`**: `GET /api/metrics/facets` takes
no query parameters and always reports the FULL dataset range — it is never affected by
the currently-applied date filter. `minDate`/`maxDate` should therefore be fetched once
(e.g. on mount) and are NOT re-fetched or recomputed when `value` changes.

#### Structure

- Two native `<input type="date">` elements: "Start date" and "End date".
  - `min={minDate}`, `max={maxDate}` HTML attributes on both inputs (a soft UI guide only —
    the backend does not reject dates outside this range; see Feature 1, edge case 2 below
    and Feature 1 → date-out-of-range in `README.md`).
  - Native date inputs already emit/accept the `YYYY-MM-DD` string format required by the
    API — no `Date` object conversion needed anywhere in this component.
- A small text label showing the full available range, e.g. `Data available: {minDate} – {maxDate}`,
  reusing the same `"en-US", { month: "short", year: "numeric" }` formatting style already
  used by `formatPeriodLabel` in `frontend/src/lib/financial-utils.ts` for consistency —
  or the raw `minDate`/`maxDate` strings, at the implementer's discretion; this is a
  cosmetic choice, not a contract requirement.

#### Behavior

- **Initial value**: both `start_date` and `end_date` start `undefined` (both inputs
  empty) — i.e. no filter applied, equivalent to omitting both query params, which the
  verified backend treats as "return everything" (`filter_movements_by_date` returns
  `movements` unchanged when both are `None`). Do NOT pre-fill the inputs with
  `minDate`/`maxDate` — an explicit filter and "no filter" are behaviorally identical
  server-side, but pre-filling would misrepresent to the user that a filter is active.
- **Only start date filled**: `onChange` fires with `{ start_date: "2026-06-01" }` —
  `end_date` key must be `undefined` (omitted), never `""`. Verified backend behavior:
  returns every movement from `start_date` onward, unbounded above.
- **Only end date filled**: symmetric — `{ end_date: "2026-06-01" }`, `start_date`
  omitted. Verified backend behavior: every movement up to and including `end_date`,
  unbounded below.
- **Both filled**: `{ start_date, end_date }`, both inclusive bounds (verified via
  `backend/tests/test_routes.py::test_filter_movements_by_date_includes_range_edges`:
  requesting the exact same date for both bounds still returns that date's records).
- **Clearing a filled date**: the cleared field must revert to `undefined` in the value
  passed to `onChange`, not `""`. This is a hard requirement, not a style preference:
  sending `start_date=""` fails the backend's date parsing and returns HTTP 422 (verified
  live: a malformed date string returns
  `{"detail":[{"type":"date_from_datetime_parsing", ...}]}`, HTTP 422).
- **Invalid range (`end_date` before `start_date`)**: the component does not block this
  input combination or show a hard error. It is passed straight through — verified live
  that the backend does not error on an inverted range, it simply returns an empty result
  set (HTTP 200, `[]`) for every endpoint that filters by date. The component MAY show a
  soft inline hint (e.g. "End date is before start date") purely for user clarity, but
  this is a UI nicety, not a required validation gate, since the resulting empty state is
  already correctly handled downstream (see "Dashboard behavior" below and Feature 1 edge
  cases in `README.md`).

### Dashboard-wide integration

Per the PM brief's scope ("el rango afecta a todos los datos actualmente mostrados en la
página"), the following existing, already-implemented components must be re-driven by the
current `DateRangeFilter` value (i.e. their underlying `GET /api/metrics` request must
include the current `start_date`/`end_date`, each omitted when unset):

- `KPIRow` (`frontend/src/components/dashboard/kpi-row.tsx`) — its `metrics: KPIMetrics`
  prop must be recomputed (via the existing `computeKPIs`) from the filtered
  `FinancialMovement[]`.
- `IncomeOutcomeChart` and `ProfitPercentChart` — their `data: MonthlyDataPoint[]` prop
  must be recomputed (via the existing `computeMonthlyData`) from the same filtered
  `FinancialMovement[]`.

**Design decision (not an API fact):** `DashboardHeader`'s `period` label keeps showing
the FULL dataset range (unfiltered), exactly as it does today — it is sourced from
`GET /api/metrics/facets`, which (verified) is not filter-aware and always reports the
whole dataset. Its existing purpose is "what period does this dataset as a whole cover",
not "what is my current filter selection". The user's active filter selection remains
visible in the `DateRangeFilterBar` inputs themselves (and, optionally, the "Data
available" label described above shows the boundaries it was picked from). This spec does
not introduce a second, redundant "active filter" indicator elsewhere on the page — the
brief does not require one, and it is not implied by "must affect the data shown".

No new visualizations are introduced by this feature; only existing ones start consuming a
now-filterable data source.

---

## Feature 2 — Anomaly Alerts

### Component: `AnomalyAlertsPanel`

File (future): `frontend/src/components/dashboard/anomaly-alerts-panel.tsx`

Composes a threshold control (header area) and a results table (content area) inside a
single `Card`, matching the existing `Card` + `CardHeader` + `CardContent` structure used
by `IncomeOutcomeChart`/`ProfitPercentChart`.

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `data` | `AlertsResponse` (`AlertEntry[]`) | required | Already-fetched alerts for the current `threshold` and the dashboard's current `DateRangeFilter`. Data fetching itself is out of scope for this spec. |
| `threshold` | `number` | required | Current threshold value (controlled). |
| `onThresholdChange` | `(next: number) => void` | required | Fires with the parsed numeric value whenever the user edits the threshold input and it is valid. The parent is responsible for using this to request updated `data` — out of scope here. |
| `dateRange` | `DateRangeFilter` | required | The dashboard's current Feature 1 filter, passed through for the panel to reflect (e.g. in an empty-state message); this component does not own or mutate it. |
| `loading` | `boolean` | optional | Renders the existing `Skeleton`-based loading layout (see `IncomeOutcomeChart`'s `loading` branch) while a new `data` set is in flight after a `threshold`/`dateRange` change. |

#### Threshold configuration

| Aspect | Value | Source |
|---|---|---|
| Input type | `<input type="number">` | Component design choice |
| Real API minimum | `0` | Verified: OpenAPI `"minimum": 0`; `threshold=-0.1` → HTTP 422 |
| Real API maximum | none enforced | Verified live: `threshold=1.5` → HTTP 200, `[]` |
| Default | `0.3` | Verified: OpenAPI `"default": 0.3`, matches PM brief |
| Decimals | accepted | Verified: `threshold=0.2` accepted; API type is `number` (float) |
| HTML `min` attribute | `0` | Matches verified real API minimum (NOT `0.01` as the brief states — see README.md discrepancy) |
| HTML `max` attribute | none | Matches verified real API (no enforced maximum) |
| `step` attribute | `0.01` | Design choice for 1%-granularity input; not an API constraint |

- **On change**: call `onThresholdChange(value)` with the parsed number as soon as the
  input holds a syntactically valid, non-negative number. Do not require pressing Enter
  or blurring the field.
- **Validation / invalid value**: if the field is emptied or a value `< 0` is entered,
  do NOT call `onThresholdChange` — keep the last valid value active, and show an inline
  message near the input, e.g. `"Threshold must be 0 or greater."` This mirrors the real,
  verified API constraint (`>= 0`) rather than the brief's (unverified) `0.01` minimum.
- **Decimal input**: accepted and forwarded as-is (e.g. `0.275`); no rounding imposed by
  this component (the backend itself rounds `increase_ratio` to 4 decimals server-side,
  but does not round or reject the `threshold` input's precision).
- **Very large values (e.g. `5`, `50`)**: not rejected — these are valid per the real API
  and simply tend to produce an empty `data` result (see Empty state below). No client-side
  upper-bound error should ever be shown for this input.
- **Visual format**: displayed as a plain decimal (e.g. `0.3`), matching the value the API
  itself expects — not pre-formatted as a percentage string. An optional helper caption
  (e.g. `"0.3 = 30% increase"`) may be shown next to the input for user clarity; this is a
  cosmetic choice.

#### Table

Columns, mapped from the PM brief's concepts to the verified real API fields:

| UI label | API field (`AlertEntry`) | TS type | Transformation |
|---|---|---|---|
| Period | `period` | `string` | Displayed as-is (e.g. `"2025-12"`). |
| Outcome recorded | `outcome_total` | `number` | `formatCurrency(outcome_total)` (reuse existing helper from `frontend/src/lib/financial-utils.ts`). |
| Average of prior periods | `baseline_average` | `number` | `formatCurrency(baseline_average)`. **Label deliberately avoids the brief's "3 previous periods" phrasing** — the verified backend computes an expanding average of ALL prior periods in the series, not a fixed 3-period window (see README.md discrepancy). Do not label this column "3-period moving average"; it would misrepresent the real computation to the user. |
| Increase % | `increase_ratio` | `number` | `` `${(increase_ratio * 100).toFixed(1)}%` `` — multiply by 100; the API field is a decimal ratio, not a pre-computed percentage. |

Row order: as returned by the API (chronological by `period`, since `detect_outcome_alerts`
iterates the already-chronological `summary` list) — no client-side re-sort needed.

#### Empty state

Applies whenever `data.length === 0` (verified: the API returns `[]`, not an error or
`null`, when no period exceeds `threshold`).

- The `Card`/table container remains mounted and visible — it must NOT disappear or be
  replaced by `null`.
- Replace the row area with a single centered message, in the same visual style as the
  existing chart empty state (`"No data available to display"`), but with copy specific to
  this feature, e.g.:

  > "No spending anomalies detected for the current threshold ({threshold}) and date range."

- The threshold control remains fully visible, enabled, and unchanged — it must keep
  showing the value the user configured (do not reset it to the `0.3` default).

#### Integration with the date range filter (Feature 1)

`AlertsParams extends DateRangeFilter`, so the same rules from Feature 1 apply to the
request that produces `data`:

| `dateRange` state | Effect (verified via `filter_movements_by_date`, applied before `detect_outcome_alerts`) |
|---|---|
| Both `start_date` and `end_date` set | Alerts computed only from periods within `[start_date, end_date]`. |
| Only `start_date` set | Alerts computed from `start_date` onward, unbounded above. |
| Only `end_date` set | Alerts computed up to `end_date`, unbounded below. |
| Neither set | Alerts computed over the full dataset (12 months / 360 movements). |
| A previously-set field is cleared | Same as "omitted" above — sent as `undefined`, never `""` (see Feature 1). |

**Verified, non-obvious interaction to call out explicitly**: narrowing `dateRange`
changes which period is "first" in the resulting series, and the first period of any
series can never have a `baseline_average` (there is nothing before it) — so it can never
appear as an alert. A date range narrow enough to leave only one period in scope will
always yield `data = []`, regardless of `threshold`. This is a real, verified backend
behavior (`detect_outcome_alerts`'s `historical_outcomes` starts empty for every call),
not a bug to fix in this spec — components must simply render the same empty state
described above.

---

## Feature 3 — B2B vs B2C

### Page: `B2BVsB2CPage`

File (future): `frontend/src/pages/b2b-vs-b2c-page.tsx` (or equivalent — see routing note
below). Conceptual route: `/b2b-vs-b2c`.

> **Verified gap, flagged for the implementing session**: `frontend/package.json` has NO
> routing library (no `react-router-dom`, `wouter`, `@tanstack/react-router`, etc.), and
> `frontend/src/App.tsx` is a single unrouted page. Introducing "a new page" per the brief
> therefore requires the implementing session to either (a) add a routing library, or
> (b) implement simple conditional rendering / a tab switch inside `App.tsx`. Choosing
> between these is an implementation decision out of scope for this spec — it is called
> out here so the next session does not have to rediscover it.

#### Structure

```
B2BVsB2CPage
├─ page header (title, e.g. "B2B vs. B2C")
├─ DateRangeFilterBar (the SAME Feature 1 component/state, shared — not a second,
│   independent date picker)
├─ two-column layout (side by side on wide viewports, stacked on narrow ones,
│   matching the existing `grid grid-cols-1 xl:grid-cols-2` pattern used by
│   `IncomeOutcomeChart`/`ProfitPercentChart` in `App.tsx`)
│   ├─ BusinessSegmentSection (label="B2B")
│   └─ BusinessSegmentSection (label="B2C")
└─ B2BVsB2CComparisonChart (full width, below both sections)
```

#### Props: `B2BVsB2CPage`

| Prop | Type | Required | Description |
|---|---|---|---|
| `dateRange` | `DateRangeFilter` | required | Shared with the rest of the dashboard (Feature 1). Drives both the B2B and B2C requests below identically. |
| `b2bCategories` | `TopCategoriesResponse` | required | Result of `GET /api/metrics/categories/top` with `operation_type: "income", business_type: "B2B", limit: 5` plus the current `dateRange`. |
| `b2cCategories` | `TopCategoriesResponse` | required | Same request with `business_type: "B2C"`. |
| `loading` | `boolean` | optional | Renders both sections and the chart in their skeleton state. |

### Sub-component: `BusinessSegmentSection`

Rendered twice (once per segment) inside `B2BVsB2CPage`.

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `label` | `'B2B' \| 'B2C'` | required | Which segment this section represents; drives the section heading and empty-state copy. |
| `categories` | `TopCategoriesResponse` | required | The top-5 income categories for this segment (already fetched, already sorted descending — see below). |
| `loading` | `boolean` | optional | Skeleton state. |

#### Table

Columns, mapped to the verified real API fields:

| UI label | API field (`CategoryEntry`) | TS type | Transformation |
|---|---|---|---|
| Category | `category` | `Category` | Displayed as-is, or with a cosmetic title-case mapping (e.g. `"suppliers"` → `"Suppliers"`) — a display choice, not a contract requirement. |
| Total income | `total_amount` | `number` | `formatCurrency(total_amount)` (reuse existing helper). |
| % of group total | *(derived, no API field)* | `number` | `total_amount / sum(categories.map(c => c.total_amount)) * 100`, rendered to 1 decimal (e.g. `"42.3%"`). See discrepancy note below. |

**Percentage discrepancy (PM brief vs. verified API)**: the brief expects the API to
supply (or imply) a percentage per category. The verified `TopCategoryItem`/`CategoryEntry`
response has NO percentage field and NO separate group-total field — only `total_amount`
per category. The denominator must therefore be the sum of `total_amount` across the
`categories` array THIS component was given. This is exact, not approximate, because
`Category` is a closed 5-value enum (verified via the OpenAPI schema) and the request
always uses `limit=5` — so the response is guaranteed to already contain every category
with any data for that `operation_type` + `business_type` combination; there is no "6th
category" that could be missing from the sum.

**Order**: the backend already returns categories sorted descending by `total_amount`
(verified in `backend/tests/test_routes.py`). Render rows in the order received — do not
re-sort.

#### Empty states — specified separately per segment

- **B2B has no categories** (`b2bCategories.length === 0`): the B2B section shows an
  explicit message in place of its table, e.g. `"No B2B income recorded for the selected
  date range."` The B2C section is entirely unaffected and renders normally if it has data.
- **B2C has no categories**: symmetric — `"No B2C income recorded for the selected date
  range."`, independent of B2B's state.
- **Both empty simultaneously**: both sections show their own message independently; one
  being empty must never be inferred from the other being empty (they come from two
  separate API requests).

### Component: `B2BVsB2CComparisonChart`

Bar chart, built with `recharts` (already a project dependency — same library used by the
existing line charts), placed full-width below the two `BusinessSegmentSection`s.

| Aspect | Specification |
|---|---|
| Data source | The SAME `b2bCategories` and `b2cCategories` arrays already fetched for the two tables above — no additional API request. |
| Transformation | `totalB2B = sum(b2bCategories.map(c => c.total_amount))`; `totalB2C = sum(b2cCategories.map(c => c.total_amount))`. |
| X-axis / categories | Two categories: `"B2B"`, `"B2C"` (the business segment labels). |
| What each value represents | One bar per segment: that segment's total income (sum across its top-5 categories) for the currently active `dateRange`. |
| One group has no data | That segment's sum is `0` (sum of an empty array) — its bar renders at height 0. BOTH bars/segments still render; a zero-data segment is not hidden or omitted from the chart. |
| Neither group has data | Render the existing "No data available to display" empty-state pattern (same copy/style as `IncomeOutcomeChart`/`ProfitPercentChart`) INSTEAD of a chart with two zero-height bars — a comparison with nothing to compare has no value. This is a component-level design decision, not an API-driven requirement. |

### Dates

All four data sources on this page — B2B table, B2C table, and (derived from the same two)
the comparison chart — are driven by the exact same `dateRange: DateRangeFilter` value
shared with the rest of the dashboard (Feature 1). There is no independent date picker on
this page. The interaction rules (only start, only end, both, neither, cleared field) are
identical to those specified for Feature 1 and Feature 2 above.
