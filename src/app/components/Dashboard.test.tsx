import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { Dashboard } from "./Dashboard";
import type { DashboardSummary, PrintPlusApi } from "../../types/ipc-contracts";

const POPULATED_SUMMARY: DashboardSummary = {
  todaysRevenue: 1234.5,
  todaysOrders: 3,
  totalOrders: 42,
  pendingOrders: 5,
  completedOrders: 30,
  totalCustomers: 12,
  recentOrders: [
    { id: 42, customerName: "Ramesh", status: "Pending", grandTotal: 708, createdAt: "2026-01-01 10:00:00" },
    { id: 41, customerName: "Suresh", status: "Completed", grandTotal: 354.5, createdAt: "2026-01-01 09:00:00" },
  ],
  mostUsedPrintType: "Flex",
};

const ZERO_SUMMARY: DashboardSummary = {
  todaysRevenue: 0,
  todaysOrders: 0,
  totalOrders: 0,
  pendingOrders: 0,
  completedOrders: 0,
  totalCustomers: 0,
  recentOrders: [],
  mostUsedPrintType: null,
};

function mockApi(getSummary: PrintPlusApi["dashboard"]["getSummary"]) {
  window.api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { list: vi.fn(), get: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
    dashboard: { getSummary },
  } as unknown as PrintPlusApi;
}

function renderDashboard() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoice/:id" element={<div data-testid="invoice-route" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state before the summary resolves", () => {
    mockApi(vi.fn((): Promise<DashboardSummary> => new Promise(() => {})));
    renderDashboard();
    expect(screen.getByText(/loading dashboard/i)).toBeTruthy();
  });

  it("renders real, populated data with no fake/static values remaining", async () => {
    mockApi(vi.fn().mockResolvedValue(POPULATED_SUMMARY));
    renderDashboard();

    expect(await screen.findByText("₹1234.50")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy(); // Today's Orders
    expect(screen.getByText("42")).toBeTruthy(); // Total Orders stat (order row shows "#42", a distinct string)
    expect(screen.getByText("5")).toBeTruthy(); // Pending Orders
    expect(screen.getByText("30")).toBeTruthy(); // Completed Orders
    expect(screen.getByText("12")).toBeTruthy(); // Total Customers
    expect(screen.getByText("Ramesh")).toBeTruthy();
    expect(screen.getByText("Suresh")).toBeTruthy();
    expect(screen.getByText("Flex")).toBeTruthy();

    // The old hardcoded placeholders must be gone.
    expect(screen.queryByText("No recent bills")).toBeNull();
    expect(screen.queryByText("Bills Generated Today")).toBeNull();
  });

  it("renders an honest zero-data state, not fake placeholder numbers", async () => {
    mockApi(vi.fn().mockResolvedValue(ZERO_SUMMARY));
    renderDashboard();

    expect(await screen.findByText("₹0.00")).toBeTruthy();
    expect(screen.getByText("No orders yet")).toBeTruthy();
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("shows an error state instead of a blank or fake-zero screen when the summary request fails", async () => {
    mockApi(vi.fn().mockRejectedValue(new Error("Something went wrong while loading the dashboard. Please try again.")));
    renderDashboard();

    expect(await screen.findByText("Something went wrong while loading the dashboard. Please try again.")).toBeTruthy();
    // Must not silently show a zero-data dashboard on failure.
    expect(screen.queryByText("₹0.00")).toBeNull();
  });

  it("navigates to the invoice when a recent order row is clicked", async () => {
    mockApi(vi.fn().mockResolvedValue(POPULATED_SUMMARY));
    const user = userEvent.setup();
    renderDashboard();

    const row = await screen.findByText("Ramesh");
    await user.click(row);

    expect(await screen.findByTestId("invoice-route")).toBeTruthy();
  });
});
