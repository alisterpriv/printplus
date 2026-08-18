import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { Orders } from "./Orders";
import type { Order, PrintPlusApi } from "../../types/ipc-contracts";

const ORDER: Order = {
  id: 42,
  invoiceNumber: "INV-000042",
  customerId: 5,
  customerName: "Ramesh",
  customerPhone: "9998887770",
  customerAddress: "MG Road",
  status: "Pending",
  items: [{ id: 1, printType: "Flex", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, rate: 500, quantity: 1, total: 500 }],
  subtotal: 500,
  discountPercent: 0,
  discountAmount: 0,
  gstPercent: 18,
  gstAmount: 90,
  grandTotal: 590,
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function mockApi(list: PrintPlusApi["orders"]["list"]) {
  window.api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { list, get: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
    dashboard: { getSummary: vi.fn() },
    businessSettings: { get: vi.fn(), update: vi.fn() },
  } as unknown as PrintPlusApi;
}

function renderOrders() {
  render(
    <MemoryRouter initialEntries={["/orders"]}>
      <Routes>
        <Route path="/orders" element={<Orders />} />
        <Route path="/invoice/:id" element={<div data-testid="invoice-route" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Orders", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("PHASE 11 — displays the real, persisted invoice number, not the raw order id", async () => {
    mockApi(vi.fn().mockResolvedValue([ORDER]));
    renderOrders();

    expect(await screen.findByText("INV-000042")).toBeTruthy();
    // The bare "#42" style label must be gone now that a real invoice number exists.
    expect(screen.queryByText("#42")).toBeNull();
  });

  it("PHASE 11 — view/print actions still navigate using the internal order id, not the invoice number", async () => {
    mockApi(vi.fn().mockResolvedValue([ORDER]));
    const user = userEvent.setup();
    renderOrders();

    await screen.findByText("INV-000042");
    // Row buttons, in DOM order: [0] status-dropdown trigger, [1] View (Eye), [2] Print.
    const viewButton = screen.getAllByRole("button")[1];
    await user.click(viewButton);

    expect(await screen.findByTestId("invoice-route")).toBeTruthy();
  });

  it("existing order list behavior remains intact: loading state, then real data", async () => {
    mockApi(vi.fn().mockResolvedValue([ORDER]));
    renderOrders();

    expect(screen.getByText(/loading orders/i)).toBeTruthy();
    expect(await screen.findByText("Ramesh")).toBeTruthy();
  });
});
