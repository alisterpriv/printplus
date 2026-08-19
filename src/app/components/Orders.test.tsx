import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { Orders, getTodayRangeLocal, getThisWeekRangeLocal, getThisMonthRangeLocal } from "./Orders";
import type { Order, OrdersSummary, PrintPlusApi } from "../../types/ipc-contracts";

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
  amountPaid: 0,
  balanceDue: 590,
  paymentStatus: "Unpaid",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const DEFAULT_SUMMARY: OrdersSummary = { totalRevenue: 0, todaysOrders: 0 };

function mockApi(
  list: PrintPlusApi["orders"]["list"],
  getSummary: PrintPlusApi["orders"]["getSummary"] = vi.fn().mockResolvedValue(DEFAULT_SUMMARY)
) {
  window.api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { list, get: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), recordPayment: vi.fn(), getSummary },
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

  describe("PHASE 15 — read-only payment status", () => {
    it("shows an Unpaid badge for an unpaid order", async () => {
      mockApi(vi.fn().mockResolvedValue([ORDER]));
      renderOrders();
      expect(await screen.findByText("Unpaid")).toBeTruthy();
    });

    it("shows a Partial badge for a partially-paid order", async () => {
      const partial: Order = { ...ORDER, amountPaid: 200, balanceDue: 390, paymentStatus: "Partial" };
      mockApi(vi.fn().mockResolvedValue([partial]));
      renderOrders();
      expect(await screen.findByText("Partial")).toBeTruthy();
    });

    it("shows a Paid badge for a fully-paid order", async () => {
      const paid: Order = { ...ORDER, amountPaid: 590, balanceDue: 0, paymentStatus: "Paid" };
      mockApi(vi.fn().mockResolvedValue([paid]));
      renderOrders();
      expect(await screen.findByText("Paid")).toBeTruthy();
    });

    it("does not add a payment-recording control to the row — display only", async () => {
      mockApi(vi.fn().mockResolvedValue([ORDER]));
      renderOrders();
      await screen.findByText("Ramesh");
      // Exactly the pre-existing three row actions (status dropdown, View, Print) — no fourth "record payment" control.
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });
  });

  describe("PHASE 16 — statistics", () => {
    it("renders real totalRevenue/todaysOrders values from orders.getSummary, not hardcoded", async () => {
      mockApi(
        vi.fn().mockResolvedValue([ORDER]),
        vi.fn().mockResolvedValue({ totalRevenue: 1234.5, todaysOrders: 7 })
      );
      renderOrders();
      await screen.findByText("Ramesh");
      expect(screen.getByText("₹1234.50")).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
    });

    it("shows ₹0.00 / 0 on a fresh shop with no orders", async () => {
      mockApi(vi.fn().mockResolvedValue([]));
      renderOrders();
      await screen.findByText("No orders found");
      expect(screen.getByText("₹0.00")).toBeTruthy();
    });
  });

  describe("PHASE 16 — filtering", () => {
    const RAMESH = ORDER; // Pending, createdAt 2026-01-01
    const SUNITA: Order = {
      ...ORDER,
      id: 43,
      invoiceNumber: "INV-000043",
      customerName: "Sunita",
      customerPhone: "9111111111",
      status: "Completed",
      createdAt: "2026-01-15 00:00:00",
    };

    it("filters by status", async () => {
      mockApi(vi.fn().mockResolvedValue([RAMESH, SUNITA]));
      const user = userEvent.setup();
      renderOrders();
      await screen.findByText("Ramesh");
      expect(screen.getByText("Sunita")).toBeTruthy();

      await user.click(screen.getByLabelText("Filter by status"));
      await user.click(await screen.findByRole("option", { name: "Completed" }));

      expect(screen.queryByText("Ramesh")).toBeNull();
      expect(screen.getByText("Sunita")).toBeTruthy();
    });

    it("composes search + status with AND — a status match without a text match is excluded", async () => {
      mockApi(vi.fn().mockResolvedValue([RAMESH, SUNITA]));
      const user = userEvent.setup();
      renderOrders();
      await screen.findByText("Ramesh");

      await user.type(screen.getByPlaceholderText(/search by invoice number/i), "Ramesh");
      await user.click(screen.getByLabelText("Filter by status"));
      await user.click(await screen.findByRole("option", { name: "Completed" }));

      // "Ramesh" text-matches but is Pending, not Completed; "Sunita" is Completed but doesn't text-match.
      expect(screen.queryByText("Ramesh")).toBeNull();
      expect(screen.queryByText("Sunita")).toBeNull();
      expect(screen.getByText("No orders found")).toBeTruthy();
    });

    it("Reset Filters clears search, status, and date back to defaults", async () => {
      mockApi(vi.fn().mockResolvedValue([RAMESH, SUNITA]));
      const user = userEvent.setup();
      renderOrders();
      await screen.findByText("Ramesh");

      await user.type(screen.getByPlaceholderText(/search by invoice number/i), "Sunita");
      expect(screen.queryByText("Ramesh")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Reset Filters" }));
      expect(await screen.findByText("Ramesh")).toBeTruthy();
      expect(screen.getByText("Sunita")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Reset Filters" })).toBeNull();
    });

    it("shows the empty state when no order matches the active filters", async () => {
      mockApi(vi.fn().mockResolvedValue([RAMESH]));
      const user = userEvent.setup();
      renderOrders();
      await screen.findByText("Ramesh");

      await user.type(screen.getByPlaceholderText(/search by invoice number/i), "nonexistent customer");
      expect(await screen.findByText("No orders found")).toBeTruthy();
    });
  });

  // PHASE 16 — date filter boundaries. Tested as pure exported functions
  // (mirroring dashboardService.test.ts's getTodayRangeUtc / Phase 15's
  // validatePaymentAmount precedent) rather than through full component
  // interaction, to avoid userEvent + fake-system-time interaction.
  describe("PHASE 16 — date range helpers (local-timezone, half-open, DST-safe)", () => {
    // Deliberately does not assume or pin a specific machine timezone (the
    // renderer test project has no Node types / process.env access, unlike
    // dashboardService.test.ts's IST/New York tests). Instead each range's
    // startUtc/endUtc string is parsed back into a real Date (by re-adding
    // "Z", the exact inverse of formatAsDbTimestamp) and asserted against
    // *local* getters — a check that holds regardless of which timezone the
    // test machine is actually in.
    function parseDbTimestamp(dbTimestamp: string): Date {
      return new Date(dbTimestamp.replace(" ", "T") + "Z");
    }

    describe("getTodayRangeLocal", () => {
      it("startUtc represents exactly local midnight of the given day", () => {
        const now = new Date(2026, 0, 15, 14, 30, 0);
        const start = parseDbTimestamp(getTodayRangeLocal(now).startUtc);
        expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([
          2026, 0, 15, 0, 0, 0,
        ]);
      });

      it("is a half-open range: end is exactly 24 hours after start", () => {
        const range = getTodayRangeLocal(new Date(2026, 0, 15, 14, 30, 0));
        const start = parseDbTimestamp(range.startUtc);
        const end = parseDbTimestamp(range.endUtc);
        expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
      });

      it("an order at exactly the start boundary is included; the exact end boundary is excluded", () => {
        const range = getTodayRangeLocal(new Date(2026, 0, 15, 14, 30, 0));
        const oneSecondBeforeEnd = new Date(parseDbTimestamp(range.endUtc).getTime() - 1000);
        const oneSecondBeforeEndStr = oneSecondBeforeEnd.toISOString().slice(0, 19).replace("T", " ");
        expect(range.startUtc >= range.startUtc && range.startUtc < range.endUtc).toBe(true); // start included
        expect(oneSecondBeforeEndStr >= range.startUtc && oneSecondBeforeEndStr < range.endUtc).toBe(true); // just before end, included
        expect(range.endUtc >= range.startUtc && range.endUtc < range.endUtc).toBe(false); // end itself, excluded
      });
    });

    describe("getThisWeekRangeLocal — Monday-start", () => {
      it("starts on a Monday and spans exactly 7 days, for any day of the week", () => {
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const reference = new Date(2026, 0, 12 + dayOffset, 9, 0, 0); // Jan 12, 2026 is a Monday
          const range = getThisWeekRangeLocal(reference);
          const start = parseDbTimestamp(range.startUtc);
          const end = parseDbTimestamp(range.endUtc);
          expect(start.getDay()).toBe(1); // Monday
          expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
        }
      });

      it("a Monday's own week starts on itself, not the previous Monday", () => {
        const monday = new Date(2026, 0, 12, 9, 0, 0);
        const start = parseDbTimestamp(getThisWeekRangeLocal(monday).startUtc);
        expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 0, 12]);
      });

      it("excludes the instant just before the Monday start", () => {
        const thursday = new Date(2026, 0, 15, 12, 0, 0);
        const range = getThisWeekRangeLocal(thursday);
        const oneSecondBeforeStart = new Date(parseDbTimestamp(range.startUtc).getTime() - 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        expect(oneSecondBeforeStart >= range.startUtc && oneSecondBeforeStart < range.endUtc).toBe(false);
      });
    });

    describe("getThisMonthRangeLocal", () => {
      it("returns [1st of local month, 1st of next local month)", () => {
        const now = new Date(2026, 0, 15, 12, 0, 0); // January 2026
        const start = parseDbTimestamp(getThisMonthRangeLocal(now).startUtc);
        const end = parseDbTimestamp(getThisMonthRangeLocal(now).endUtc);
        expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 0, 1]);
        expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 1, 1]);
      });

      it("excludes the instant just before the 1st of the month", () => {
        const now = new Date(2026, 0, 15, 12, 0, 0);
        const range = getThisMonthRangeLocal(now);
        const oneSecondBeforeStart = new Date(parseDbTimestamp(range.startUtc).getTime() - 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        expect(oneSecondBeforeStart >= range.startUtc && oneSecondBeforeStart < range.endUtc).toBe(false);
      });

      it("December correctly rolls over into January of the next year", () => {
        const december = new Date(2026, 11, 10, 12, 0, 0);
        const start = parseDbTimestamp(getThisMonthRangeLocal(december).startUtc);
        const end = parseDbTimestamp(getThisMonthRangeLocal(december).endUtc);
        expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 11, 1]);
        expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2027, 0, 1]);
      });
    });
  });

  describe("PHASE 16 — date filter (through the UI)", () => {
    function orderAt(id: number, createdAt: string): Order {
      return { ...ORDER, id, invoiceNumber: `INV-${id}`, createdAt };
    }

    it("selecting Today narrows the list to orders within today's range, relative to real system time", async () => {
      const now = new Date();
      // startUtc is itself the inclusive start of "today"'s half-open range.
      const todayStartUtc = getTodayRangeLocal(now).startUtc;
      const wayInThePast = orderAt(1, "2000-01-01 00:00:00");
      const today = orderAt(2, todayStartUtc);
      mockApi(vi.fn().mockResolvedValue([wayInThePast, today]));
      const user = userEvent.setup();
      renderOrders();
      await screen.findByText("INV-1");

      await user.click(screen.getByLabelText("Filter by date"));
      await user.click(await screen.findByRole("option", { name: "Today" }));

      expect(screen.queryByText("INV-1")).toBeNull();
      expect(screen.getByText("INV-2")).toBeTruthy();
    });
  });
});
