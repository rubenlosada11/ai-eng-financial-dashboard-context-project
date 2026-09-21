import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartDataTable } from "./chart-data-table";

describe("ChartDataTable", () => {
  it("exposes the chart data as a table named by its caption", () => {
    render(
      <ChartDataTable
        caption="Monthly income and outcome"
        headers={["Month", "Income", "Outcome"]}
        rows={[
          ["Jan 2026", "$1,000", "$400"],
          ["Feb 2026", "$2,000", "$500"],
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: "Monthly income and outcome" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Month", "Income", "Outcome"]);

    const february = within(table).getByRole("row", { name: /Feb 2026/ });
    expect(within(february).getByRole("rowheader")).toHaveTextContent("Feb 2026");
    expect(
      within(february)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["$2,000", "$500"]);
  });

  it("renders only the header row when there is no data", () => {
    render(<ChartDataTable caption="Empty" headers={["Month", "Income"]} rows={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
