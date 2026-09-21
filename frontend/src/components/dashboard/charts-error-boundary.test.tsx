import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChartsErrorBoundary } from "./charts-error-boundary";

function Broken(): never {
  throw new Error("Failed to fetch dynamically imported module");
}

describe("ChartsErrorBoundary", () => {
  it("renders its children when nothing fails", () => {
    render(
      <ChartsErrorBoundary>
        <p>chart content</p>
      </ChartsErrorBoundary>,
    );

    expect(screen.getByText("chart content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an alert and keeps the rest of the page when a child throws", () => {
    // Silence React's expected console.error for the throw, then restore it.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <>
          <h1>Financial Overview</h1>
          <ChartsErrorBoundary>
            <Broken />
          </ChartsErrorBoundary>
        </>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Charts could not be loaded. Reload the page to try again.",
      );
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
