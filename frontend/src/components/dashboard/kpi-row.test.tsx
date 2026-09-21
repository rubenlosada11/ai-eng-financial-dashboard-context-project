import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KPIRow } from "./kpi-row";

const metrics = {
  totalIncome: 1258147,
  totalOutcome: 762132,
  profit: 496015,
  profitPercent: 39.4,
};

describe("KPIRow", () => {
  it("shows the four KPIs with formatted values", () => {
    render(<KPIRow metrics={metrics} />);

    expect(screen.getByText("Total Income")).toBeInTheDocument();
    expect(screen.getByText("$1,258,147")).toBeInTheDocument();
    expect(screen.getByText("Total Outcome")).toBeInTheDocument();
    expect(screen.getByText("$762,132")).toBeInTheDocument();
    expect(screen.getByText("Profit")).toBeInTheDocument();
    expect(screen.getByText("$496,015")).toBeInTheDocument();
    expect(screen.getByText("Profit Margin")).toBeInTheDocument();
    expect(screen.getByText("39.4%")).toBeInTheDocument();
  });

  it("shows a placeholder for every KPI when metrics are unavailable", () => {
    render(<KPIRow metrics={null} />);

    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("shows neither labels nor values while loading", () => {
    render(<KPIRow metrics={metrics} loading />);

    expect(screen.queryByText("Total Income")).not.toBeInTheDocument();
    expect(screen.queryByText("$1,258,147")).not.toBeInTheDocument();
  });
});
