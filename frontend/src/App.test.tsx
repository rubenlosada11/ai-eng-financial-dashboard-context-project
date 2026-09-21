import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { FinancialMovement, MetricsFacets } from "@/lib/financial-types";

// Mid-month dates keep month labels stable in any timezone.
const movements: FinancialMovement[] = [
  { create_date: "2026-01-15", amount: 1000, operation_type: "income", category: "sales", business_type: "B2B" },
  { create_date: "2026-01-20", amount: 400, operation_type: "outcome", category: "suppliers", business_type: "B2B" },
  { create_date: "2026-02-15", amount: 2000, operation_type: "income", category: "sales", business_type: "B2C" },
  { create_date: "2026-02-20", amount: 500, operation_type: "outcome", category: "operational", business_type: "B2C" },
];

const facets: MetricsFacets = {
  operation_types: ["income", "outcome"],
  business_types: ["B2B", "B2C"],
  categories: ["administrative", "operational", "others", "sales", "suppliers"],
  min_date: "2026-01-15",
  max_date: "2026-02-20",
};

// The lazy chart chunk is imported on demand, so the first render can take a moment.
// Keep it below Vitest's 5s test timeout so a failure reports the missing element.
const LAZY_CHART_TIMEOUT = { timeout: 4000 };

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function respondWithDashboardData(input: RequestInfo | URL) {
  const path = String(input);
  return path.endsWith("/api/metrics/facets") ? json(facets) : json(movements);
}

function mockApi(handler: (input: RequestInfo | URL) => Response | Promise<Response>) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input) => Promise.resolve(handler(input)));
}

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("announces loading, then loaded, and shows KPIs and the data period", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi(async (input) => {
      await gate;
      return respondWithDashboardData(input);
    });

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading financial data…");
    expect(screen.queryByText("$3,000")).not.toBeInTheDocument();

    release();

    expect(await screen.findByText("$3,000")).toBeInTheDocument();
    expect(screen.getByText("$900")).toBeInTheDocument();
    expect(screen.getByText("$2,100")).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();
    expect(screen.getByText("Jan 2026 – Feb 2026")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Financial data loaded.");
  });

  it("gives each chart a heading and a data table as text alternative", async () => {
    mockApi(respondWithDashboardData);

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Income vs. Outcome" }, LAZY_CHART_TIMEOUT),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Profit Margin %" })).toBeInTheDocument();

    const incomeTable = screen.getByRole("table", { name: "Monthly income and outcome" });
    expect(within(incomeTable).getByRole("row", { name: /Feb 2026/ })).toHaveTextContent(
      "$2,000$500",
    );

    const marginTable = screen.getByRole("table", { name: "Monthly profit margin" });
    expect(within(marginTable).getByRole("row", { name: /Jan 2026/ })).toHaveTextContent("60.0%");
  });

  it("shows an alert marked as Spanish when the API fails, and keeps the page usable", async () => {
    mockApi(() => new Response("boom", { status: 500 }));

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar la informacion financiera.");
    expect(alert).toHaveAttribute("lang", "es");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("heading", { level: 1, name: "Financial Overview" })).toBeInTheDocument();
    expect(
      await screen.findAllByText("No data available to display", {}, LAZY_CHART_TIMEOUT),
    ).toHaveLength(2);
  });
});
