/**
 * Verified query-parameter types for the same three planned frontend
 * features covered by `api-types.ts`. Every field name, type, and
 * constraint below was checked against the live OpenAPI schema served at
 * http://localhost:8000/openapi.json and exercised with live HTTP requests
 * against a locally running backend (`uvicorn app.main:app`) on 2026-09-09.
 * See `frontend/specs/README.md` for the full traceability matrix and the
 * discrepancies found between the PM brief and the real API.
 *
 * This file defines TYPES ONLY. No fetch calls, hooks, or components.
 */

import type { OperationType, BusinessType } from "./api-types";

/**
 * DateRangeFilter — optional inclusive date range shared by every feature
 * that filters financial data by date:
 *   - Feature 1 (date range filter) against `GET /api/metrics`
 *   - Feature 2 (anomaly alerts) against `GET /api/metrics/alerts`
 *   - Feature 3 (B2B vs B2C) against `GET /api/metrics/categories/top`
 *
 * Verified: `start_date` / `end_date` are independently optional, nullable,
 * `type: string, format: date` query parameters on every one of the above
 * endpoints (also on `/api/metrics/summary`, `/api/metrics/b2b`,
 * `/api/metrics/b2c`), confirmed both in the OpenAPI schema and in
 * `filter_movements_by_date` (`backend/app/routes.py`).
 *
 * Both fields are independent: either may be provided alone, both may be
 * provided together, or both may be omitted entirely.
 *
 * Critical wire-contract detail (verified live): when a field has no
 * value, it must be OMITTED from the request entirely — never sent as an
 * empty string. An empty-string date fails Pydantic's date parsing and
 * returns HTTP 422 (verified: `start_date=2026/08/01` → 422; the same
 * failure mode applies to `start_date=""`). "Cleared" must map to
 * `undefined` in this type, not `""`.
 *
 * Also verified live: if `end_date` precedes `start_date` (an inverted
 * range), the backend does NOT raise an error — it returns an empty
 * result set with HTTP 200 (confirmed against
 * `GET /api/metrics?start_date=2026-08-01&end_date=2026-01-01` → `[]`).
 * Frontend components must rely on each endpoint's existing empty-result
 * handling for this case rather than inventing a client-side validation
 * error.
 */
export interface DateRangeFilter {
  /**
   * Inclusive lower bound of the date range.
   * Format: YYYY-MM-DD (ISO 8601 date, no time component).
   * Optional — omit (do not send) to leave the range unbounded below.
   */
  start_date?: string;
  /**
   * Inclusive upper bound of the date range.
   * Format: YYYY-MM-DD (ISO 8601 date, no time component).
   * Optional — omit (do not send) to leave the range unbounded above.
   */
  end_date?: string;
}

/**
 * AlertsParams — query parameters `GET /api/metrics/alerts` needs for
 * Feature 2 (Anomaly Alerts), scoped to what the PM brief's component
 * exposes in the UI.
 *
 * PM brief vs. verified API (see README.md traceability matrix):
 * - Brief: `0.01 <= threshold <= 1.0`, default `0.3`.
 * - Verified (OpenAPI + live requests, 2026-09-09): `threshold` is a
 *   `number`, minimum `0` (NOT `0.01`), with NO maximum enforced —
 *   `threshold=1.5` returns HTTP 200 with a valid (here, empty) result,
 *   not a validation error. Default `0.3` matches the brief. The type
 *   below reflects the real, verified constraint (`>= 0`, no upper
 *   bound); any recommended UI input range is a component-level design
 *   choice, described in `components.md`, not a type-level constraint.
 *
 * Deliberately NOT modeled here, even though verified real and present on
 * this endpoint: `group_by` (`"day" | "week" | "month"`, default
 * `"month"`) and `business_type` (`"B2B" | "B2C"`). Both exist on
 * `GET /api/metrics/alerts` per the OpenAPI schema, but neither is part
 * of the PM brief for Feature 2 and neither is exposed by this spec's
 * component — see README.md, "Anomaly Alerts" section.
 */
export interface AlertsParams extends DateRangeFilter {
  /**
   * Minimum relative increase (as a decimal ratio, e.g. `0.3` = 30%) a
   * period's `outcome_total` must exceed over its `baseline_average` to
   * be reported as an anomaly.
   * Real API constraint: `number`, `>= 0`, no enforced upper bound.
   * Default applied server-side when omitted: `0.3`.
   */
  threshold?: number;
}

/**
 * TopCategoriesParams — query parameters `GET /api/metrics/categories/top`
 * needs for Feature 3 (B2B vs B2C), verified against the OpenAPI schema.
 *
 * There is no dedicated "B2B/B2C" parameter distinct from `business_type`:
 * the same `business_type` enum used across the rest of the API (e.g.
 * `/api/metrics/summary`, `/api/metrics/alerts`) is reused here. Separate
 * `/api/metrics/b2b` and `/api/metrics/b2c` endpoints also exist, but they
 * return raw `FinancialMovement[]` with no per-category aggregation or
 * totals, so Feature 3 must use THIS endpoint with `business_type` set —
 * not those two endpoints. See README.md, "B2B vs B2C" section.
 */
export interface TopCategoriesParams extends DateRangeFilter {
  /**
   * Which operation type to aggregate. Real API default: `"outcome"`.
   * Feature 3 always requests `"income"` explicitly (per the PM brief:
   * top income categories), so this spec's component never relies on the
   * server-side default.
   */
  operation_type?: OperationType;
  /**
   * Maximum number of categories to return, already sorted descending by
   * `total_amount` by the backend.
   * Real API constraint: integer, `1 <= limit <= 20` (verified:
   * `limit=0` → 422, `limit=21` → 422), default `5`.
   * Feature 3 always requests `5` explicitly (per the PM brief: top 5).
   */
  limit?: number;
  /**
   * Restricts the aggregation to a single business segment. Optional at
   * the API level (omitting it aggregates B2B and B2C together), but
   * this spec's Feature 3 component always sets it explicitly — it issues
   * two separate requests, one with `"B2B"` and one with `"B2C"`, to
   * build the two side-by-side sections described in `components.md`.
   */
  business_type?: BusinessType;
}
