import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { PrintInvoice } from "./PrintInvoice";
import type { Order, PrintPlusApi } from "../../types/ipc-contracts";

// The historical snapshot this test renders deliberately differs from
// what a "live" customer/rate lookup would return, so a test that
// accidentally re-fetches current data instead of trusting the persisted
// order would show the wrong values and fail.
const PERSISTED_ORDER: Order = {
  id: 42,
  customerId: 5,
  customerName: "Ramesh (as of order date)",
  customerPhone: "9998887770",
  customerAddress: "Old MG Road",
  status: "Pending",
  items: [
    {
      id: 1,
      printType: "Flex",
      width: 2,
      height: 3,
      unit: "Meter",
      areaSquareMeters: 6,
      rate: 55, // the rate actually charged, not today's rate
      quantity: 1,
      total: 330,
    },
  ],
  subtotal: 330,
  discountPercent: 0,
  discountAmount: 0,
  gstPercent: 18,
  gstAmount: 59.4,
  grandTotal: 389.4,
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function renderInvoiceForOrder42(orders: Partial<PrintPlusApi["orders"]>) {
  window.api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      ...orders,
    },
  } as unknown as PrintPlusApi;

  render(
    <MemoryRouter initialEntries={["/invoice/42"]}>
      <Routes>
        <Route path="/invoice/:id" element={<PrintInvoice />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PrintInvoice", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the persisted order's historical snapshot rather than re-deriving it from current data", async () => {
    const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
    renderInvoiceForOrder42({ get: getOrder });

    expect(await screen.findByText("Ramesh (as of order date)")).toBeTruthy();
    expect(screen.getByText("Old MG Road")).toBeTruthy();
    expect(screen.getByText(/₹55/)).toBeTruthy();
    expect(screen.getByText(/₹389\.40/)).toBeTruthy();

    expect(getOrder).toHaveBeenCalledWith(42);
    // No customers/rates lookups exist to blend in current data — this
    // component only reads the order it was asked to display.
    expect(window.api.customers.list).not.toHaveBeenCalled();
    expect(window.api.rates.list).not.toHaveBeenCalled();
  });

  it("shows a not-found state instead of a blank/crashed page for an order that no longer resolves", async () => {
    const getOrder = vi.fn().mockRejectedValue(new Error("Order not found"));
    renderInvoiceForOrder42({ get: getOrder });

    expect(await screen.findByText(/invoice not found/i)).toBeTruthy();
  });
});
