/**
 * Verified API response types for three planned frontend features:
 *   1. Date range filter (GET /api/metrics/facets, GET /api/metrics)
 *   2. Anomaly alerts (GET /api/metrics/alerts)
 *   3. B2B vs B2C top categories (GET /api/metrics/categories/top)
 *
 * Every shape below was checked against the live OpenAPI schema served at
 * http://localhost:8000/openapi.json by `backend/app/main.py` (FastAPI),
 * cross-referenced with the Pydantic models in `backend/app/routes.py`, and
 * exercised with live HTTP requests against a locally running backend
 * (`uvicorn app.main:app`) on 2026-09-09. No field name, type, or
 * optionality below is guessed from the PM brief — see
 * `frontend/specs/README.md` for the full traceability matrix and the
 * discrepancies found between the brief and the real API.
 *
 * This file defines TYPES ONLY. No fetch calls, hooks, or components.
 */

import type {
  OperationType,
  Category,
  BusinessType,
  FinancialMovement,
  MetricsFacets,
} from "../src/lib/financial-types";

// Re-exported so every type this spec needs is importable from this single
// file, without forcing a second import from "../src/lib/financial-types".
export type { OperationType, Category, BusinessType, FinancialMovement };

/**
 * FacetsResponse — response body of `GET /api/metrics/facets`.
 *
 * This is a type alias, not a new interface: `frontend/src/lib/financial-types.ts`
 * already declares `MetricsFacets` with this exact shape (verified field-by-field
 * against the OpenAPI `MetricsFacets` schema), and it is already consumed by
 * `frontend/src/App.tsx` for the dashboard's period label. Re-declaring an
 * equivalent interface here would create a second, independently-maintained
 * copy of the same contract — exactly what `.agents/rules/architecture.md`
 * warns against ("cualquier divergencia... rompe el parseo en runtime sin que
 * TypeScript lo detecte"). `FacetsResponse` exists as the name required by
 * this spec, aliased onto the canonical existing type.
 *
 * Verified behavior: this endpoint takes NO query parameters. It always
 * reports the full dataset's available range/options, regardless of any
 * date filter currently applied elsewhere in the UI (Feature 1). There is
 * no separate "available range" endpoint or nested range object — `min_date`
 * and `max_date` are flat top-level properties.
 */
export type FacetsResponse = MetricsFacets;

/**
 * AlertEntry — one anomaly entry, as returned inside the array from
 * `GET /api/metrics/alerts`. Verified against the OpenAPI `MetricsAlert`
 * schema and against the `detect_outcome_alerts` implementation in
 * `backend/app/routes.py`.
 *
 * PM brief vs. verified API (see README.md traceability matrix for detail):
 * - The brief describes `baseline_average` as "a moving average of the
 *   3 previous periods". The verified implementation instead computes an
 *   EXPANDING average of ALL periods before this one within the requested
 *   series (`historical_outcomes` accumulates every prior period, with no
 *   3-period window). This file documents the real, verified behavior.
 * - The brief calls the last field a "percentage increase". The API
 *   returns a decimal ratio (e.g. `0.3388` means +33.88%), not a value
 *   already multiplied by 100.
 */
export interface AlertEntry {
  /**
   * Period label this alert belongs to. Format depends on the `group_by`
   * grouping used for the request that produced it. This spec's Feature 2
   * component always relies on the backend's default grouping ("month"),
   * which produces the format `YYYY-MM` (e.g. `"2025-12"`) — verified via
   * live response inspection. `group_by` itself is not exposed by this
   * spec's component (see `param-types.ts`, `AlertsParams`).
   */
  period: string;
  /**
   * Total outcome (expense) amount recorded for this period. Same unit as
   * `FinancialMovement.amount` (a plain number; the API returns no
   * currency code).
   */
  outcome_total: number;
  /**
   * Expanding average of `outcome_total` across every period strictly
   * before this one, within the same filtered series (NOT a fixed
   * 3-period moving average — see discrepancy note above). Consequently,
   * the first period of any filtered/grouped series has no prior periods
   * and can never produce an alert entry.
   */
  baseline_average: number;
  /**
   * Relative increase of `outcome_total` over `baseline_average`,
   * expressed as a decimal ratio (e.g. `0.3388` = +33.88%), rounded to 4
   * decimals server-side. NOT pre-multiplied by 100 — multiply by 100 to
   * render as a percentage.
   */
  increase_ratio: number;
}

/**
 * AlertsResponse — full response body of `GET /api/metrics/alerts`.
 *
 * Verified: the endpoint returns a plain JSON array directly (never an
 * object wrapper, never `null`). An empty array (`[]`) is a normal,
 * successful (HTTP 200) result meaning no period exceeded the requested
 * `threshold` — it is not an error and must not be treated as one.
 */
export type AlertsResponse = AlertEntry[];

/**
 * CategoryEntry — one category total, as returned inside the array from
 * `GET /api/metrics/categories/top`. Verified against the OpenAPI
 * `TopCategoryItem` schema.
 *
 * PM brief vs. verified API: the brief expects each category to carry "a
 * percentage of the group total". The verified response does NOT include
 * a percentage field, nor any group-total/denominator field — only
 * `total_amount`. The percentage must be derived on the frontend (see
 * Feature 3 in `components.md` and the traceability matrix in
 * `README.md`) by summing `total_amount` across every entry returned for
 * the same `operation_type` + `business_type` request. This is safe
 * (not an approximation) because `Category` is a closed 5-value enum
 * (verified via the OpenAPI schema's `enum`) and the request always sets
 * `limit=5`, so the response is guaranteed to already include every
 * category that has any data for that group.
 */
export interface CategoryEntry {
  /** Category this total belongs to. One of the 5 verified `Category` values. */
  category: Category;
  /** Echoes the `operation_type` query parameter used for this request. */
  operation_type: OperationType;
  /**
   * Sum of `amount` across every movement in this category matching the
   * requested `operation_type` / `business_type` / date range. Already
   * sorted descending by this field server-side — verified in
   * `backend/tests/test_routes.py::test_top_categories_returns_limited_sorted_categories`
   * (`payload[0]["total_amount"] >= payload[1]["total_amount"]`). The
   * frontend must not re-sort.
   */
  total_amount: number;
}

/**
 * TopCategoriesResponse — full response body of
 * `GET /api/metrics/categories/top`.
 *
 * Verified: plain JSON array, already sorted descending by `total_amount`,
 * never an object wrapper. An empty array (`[]`) means no movement matched
 * the requested `operation_type` + `business_type` (+ optional date range)
 * combination — a normal, successful (HTTP 200) result, not an error.
 */
export type TopCategoriesResponse = CategoryEntry[];
