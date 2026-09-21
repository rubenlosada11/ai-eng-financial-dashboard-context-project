import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so RTL cannot register its own auto-cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has no layout engine or ResizeObserver, which Recharts' ResponsiveContainer needs.
// Chart drawing and keyboard exploration are checked in a real browser, not here.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
