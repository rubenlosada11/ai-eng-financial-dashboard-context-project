import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

// Simulates the lazy chart chunk failing to load (stale hashed file after a deploy, flaky network).
vi.mock("@/components/dashboard/income-outcome-chart", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("App when the chart chunk fails to load", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the header and KPIs and tells the user the charts are unavailable", async () => {
    // Silence React's expected console.error for the failed import.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        String(input).endsWith("/api/metrics/facets")
          ? new Response(
              JSON.stringify({
                operation_types: ["income", "outcome"],
                business_types: ["B2B", "B2C"],
                categories: ["sales"],
                min_date: "2026-01-15",
                max_date: "2026-02-20",
              }),
            )
          : new Response(
              JSON.stringify([
                { create_date: "2026-01-15", amount: 1000, operation_type: "income", category: "sales", business_type: "B2B" },
                { create_date: "2026-01-20", amount: 300, operation_type: "outcome", category: "suppliers", business_type: "B2B" },
              ]),
            ),
      ),
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Charts could not be loaded. Reload the page to try again.",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Financial Overview" })).toBeInTheDocument();
    expect(await screen.findByText("$1,000")).toBeInTheDocument();
  });
});
