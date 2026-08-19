import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { PrintInvoice, validatePaymentAmount } from "./PrintInvoice";
import type { BusinessSettings, Order, PrintPlusApi } from "../../types/ipc-contracts";

// The historical snapshot this test renders deliberately differs from
// what a "live" customer/rate lookup would return, so a test that
// accidentally re-fetches current data instead of trusting the persisted
// order would show the wrong values and fail.
const PERSISTED_ORDER: Order = {
  id: 42,
  invoiceNumber: "INV-000042",
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
  amountPaid: 0,
  balanceDue: 389.4,
  paymentStatus: "Unpaid",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

// Default live business settings used by every test that isn't
// specifically exercising business-identity behavior — deliberately
// distinct strings from anything else asserted in this file, so no test
// can accidentally pass due to string collision between order data and
// business identity data.
const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "Default Test Print Shop",
  address: "1 Default Test Road",
  phone: "9000000000",
  email: "default@test-shop.test",
  gstin: "27DEFAULTTEST1Z5",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function renderInvoiceForOrder42(
  orders: Partial<PrintPlusApi["orders"]>,
  businessSettings: Partial<PrintPlusApi["businessSettings"]> = {}
) {
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
    dashboard: { getSummary: vi.fn() },
    businessSettings: {
      get: vi.fn().mockResolvedValue(DEFAULT_BUSINESS_SETTINGS),
      update: vi.fn(),
      ...businessSettings,
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
    // PERSISTED_ORDER is unpaid, so ₹389.40 legitimately appears twice
    // (Grand Total and Balance Due) — scope to Grand Total specifically.
    expect(screen.getByText("Grand Total:").closest("div")?.textContent).toContain("₹389.40");

    expect(getOrder).toHaveBeenCalledWith(42);
    // No customers/rates lookups exist to blend in current data — this
    // component only reads the order it was asked to display.
    expect(window.api.customers.list).not.toHaveBeenCalled();
    expect(window.api.rates.list).not.toHaveBeenCalled();
  });

  it("PHASE 11 — displays the real, persisted invoice number, not the raw internal order id", async () => {
    const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
    renderInvoiceForOrder42({ get: getOrder });

    expect(await screen.findByText(/Invoice #:\s*INV-000042/)).toBeTruthy();
    // The raw id must never stand in for the invoice number on its own —
    // it's still used internally for routing/fetching (window.api.orders.get(42)
    // above), just never presented to the user as "Order #: 42" anymore.
    expect(screen.queryByText(/Order #:\s*42/)).toBeNull();
  });

  it("shows a not-found state instead of a blank/crashed page for an order that no longer resolves", async () => {
    const getOrder = vi.fn().mockRejectedValue(new Error("Order not found"));
    renderInvoiceForOrder42({ get: getOrder });

    expect(await screen.findByText(/invoice not found/i)).toBeTruthy();
  });

  describe("PHASE 12 — business identity", () => {
    const CONFIGURED_SETTINGS: BusinessSettings = {
      businessName: "Phase12 Configured Prints",
      address: "42 Configured Avenue, Test City",
      phone: "9998887771",
      email: "configured@phase12.test",
      gstin: "27CONFIGURED1Z5",
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-01-01 00:00:00",
    };

    function renderWithConfiguredSettings() {
      const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
      const getBusinessSettings = vi.fn().mockResolvedValue(CONFIGURED_SETTINGS);
      renderInvoiceForOrder42({ get: getOrder }, { get: getBusinessSettings });
      return { getOrder, getBusinessSettings };
    }

    it("renders the configured business name", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("Phase12 Configured Prints")).toBeTruthy();
    });

    it("renders the configured address", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("42 Configured Avenue, Test City")).toBeTruthy();
    });

    it("renders the configured phone", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("Phone: 9998887771")).toBeTruthy();
    });

    it("renders the configured email", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("Email: configured@phase12.test")).toBeTruthy();
    });

    it("renders the configured GSTIN with a clear GSTIN label, distinct from the order's GST amount", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("GSTIN: 27CONFIGURED1Z5")).toBeTruthy();
    });

    it("never renders the old hardcoded/fake business identity once real settings differ", async () => {
      renderWithConfiguredSettings();
      await screen.findByText("Phase12 Configured Prints");

      expect(screen.queryByText("PrintPlus")).toBeNull();
      expect(screen.queryByText(/123 Main Street/)).toBeNull();
      expect(screen.queryByText(/Mumbai, Maharashtra/)).toBeNull();
      expect(screen.queryByText(/\+91 12345 67890/)).toBeNull();
      expect(screen.queryByText(/contact@printplus\.com/)).toBeNull();
      expect(screen.queryByText(/27XXXXX1234X1Z5/)).toBeNull();
      expect(screen.queryByText(/Thank you for choosing PrintPlus/)).toBeNull();
    });

    it("omits empty/null optional business fields instead of showing placeholder text", async () => {
      const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
      const getBusinessSettings = vi.fn().mockResolvedValue({
        businessName: "Minimal Business",
        address: null,
        phone: null,
        email: null,
        gstin: null,
        createdAt: "2026-01-01 00:00:00",
        updatedAt: "2026-01-01 00:00:00",
      });
      renderInvoiceForOrder42({ get: getOrder }, { get: getBusinessSettings });

      expect(await screen.findByText("Minimal Business")).toBeTruthy();
      // Only the customer's own "Phone:" line (Bill To) should exist — the
      // business header's phone line must be omitted entirely, not shown
      // as "Phone: " with nothing after it.
      expect(screen.getAllByText(/^Phone:/)).toHaveLength(1);
      expect(screen.getByText(/^Phone:/).textContent).toBe(`Phone: ${PERSISTED_ORDER.customerPhone}`);
      expect(screen.queryByText(/^Email:/)).toBeNull();
      expect(screen.queryByText(/^GSTIN:/)).toBeNull();
      expect(screen.queryByText(/Not configured/i)).toBeNull();
      expect(screen.queryByText(/N\/A/i)).toBeNull();
    });

    it("footer shows the configured business name, not the old hardcoded one", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("Thank you for choosing Phase12 Configured Prints!")).toBeTruthy();
      expect(screen.queryByText(/Thank you for choosing PrintPlus/)).toBeNull();
    });

    it("footer falls back to a neutral message, with no fabricated identity, when business name is empty", async () => {
      const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
      const getBusinessSettings = vi.fn().mockResolvedValue({
        businessName: "",
        address: null,
        phone: null,
        email: null,
        gstin: null,
        createdAt: "2026-01-01 00:00:00",
        updatedAt: "2026-01-01 00:00:00",
      });
      renderInvoiceForOrder42({ get: getOrder }, { get: getBusinessSettings });

      await screen.findByText("Ramesh (as of order date)"); // wait for load to finish
      expect(screen.queryByText(/Thank you for choosing/)).toBeNull();
      expect(screen.getByText(/Thank you for your business/i)).toBeTruthy();
    });

    it("the order's GST amount is unaffected by business identity and stays distinct from GSTIN", async () => {
      renderWithConfiguredSettings();
      expect(await screen.findByText("GSTIN: 27CONFIGURED1Z5")).toBeTruthy();
      expect(screen.getByText("+ ₹59.40")).toBeTruthy(); // order.gstAmount, from Totals — not the business GSTIN
    });

    it("customer, item, and total information remain correct alongside the new business identity", async () => {
      renderWithConfiguredSettings();
      await screen.findByText("Phase12 Configured Prints");

      expect(screen.getByText("Ramesh (as of order date)")).toBeTruthy();
      expect(screen.getByText("Old MG Road")).toBeTruthy();
      expect(screen.getByText("Grand Total:").closest("div")?.textContent).toContain("₹389.40");
      expect(screen.getByText(/INV-000042/)).toBeTruthy();
    });

    it("enters the safe not-found state when businessSettings.get() fails", async () => {
      const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
      const getBusinessSettings = vi.fn().mockRejectedValue(new Error("Failed to load business settings"));
      renderInvoiceForOrder42({ get: getOrder }, { get: getBusinessSettings });

      expect(await screen.findByText(/invoice not found/i)).toBeTruthy();
    });

    it("never renders a partial invoice (order-only, no business identity) when the business-settings fetch fails", async () => {
      const getOrder = vi.fn().mockResolvedValue(PERSISTED_ORDER);
      const getBusinessSettings = vi.fn().mockRejectedValue(new Error("Failed to load business settings"));
      renderInvoiceForOrder42({ get: getOrder }, { get: getBusinessSettings });

      await screen.findByText(/invoice not found/i);
      // Order data must not leak through on a failed combined load.
      expect(screen.queryByText("Ramesh (as of order date)")).toBeNull();
      expect(screen.queryByText(/INV-000042/)).toBeNull();
    });
  });

  describe("PHASE 15 — payment tracking", () => {
    const PARTIAL_ORDER: Order = { ...PERSISTED_ORDER, amountPaid: 100, balanceDue: 289.4, paymentStatus: "Partial" };
    const PAID_ORDER: Order = { ...PERSISTED_ORDER, amountPaid: 389.4, balanceDue: 0, paymentStatus: "Paid" };

    it("shows Paid ₹0.00, full balance due, and Unpaid status for a brand-new order", async () => {
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PERSISTED_ORDER) });
      await screen.findByText("Ramesh (as of order date)");

      expect(screen.getByText("Paid:").closest("div")?.textContent).toContain("₹0.00");
      expect(screen.getByText("Balance Due:").closest("div")?.textContent).toContain("₹389.40");
      expect(screen.getByText("Unpaid")).toBeTruthy();
    });

    it("shows the correct amounts and Partial status for a partially-paid order", async () => {
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");

      expect(screen.getByText("Paid:").closest("div")?.textContent).toContain("₹100.00");
      expect(screen.getByText("Balance Due:").closest("div")?.textContent).toContain("₹289.40");
      expect(screen.getByText("Partial")).toBeTruthy();
    });

    it("shows Paid in full, ₹0.00 balance, and Paid status for a fully-paid order", async () => {
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PAID_ORDER) });
      await screen.findByText("Ramesh (as of order date)");

      expect(screen.getByText("Paid:").closest("div")?.textContent).toContain("₹389.40");
      expect(screen.getByText("Balance Due:").closest("div")?.textContent).toContain("₹0.00");
      expect(screen.getByText("Paid")).toBeTruthy(); // the payment status badge
    });

    it("disables the Record Payment action for an already fully-paid order", async () => {
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PAID_ORDER) });
      await screen.findByText("Ramesh (as of order date)");
      expect(screen.getByRole("button", { name: /record payment/i })).toHaveProperty("disabled", true);
    });

    it("opens the payment dialog pre-filled with the current balance due", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");

      await user.click(screen.getByRole("button", { name: /record payment/i }));

      expect(await screen.findByText("Already Paid")).toBeTruthy();
      const amountInput = screen.getByLabelText("Amount") as HTMLInputElement;
      expect(amountInput.value).toBe("289.40");
    });

    it("shows Total/Already Paid/Balance Due summary inside the dialog", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      expect(await screen.findByText("Total")).toBeTruthy();
      expect(screen.getByText("Already Paid")).toBeTruthy();
      // Dialog and Totals section both render "Balance Due" — assert at least one shows the right amount.
      expect(screen.getAllByText("₹289.40").length).toBeGreaterThan(0);
    });

    it("rejects an empty payment amount", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      const amountInput = await screen.findByLabelText("Amount");
      await user.clear(amountInput);
      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      expect(await screen.findByText(/please enter a payment amount/i)).toBeTruthy();
    });

    it("rejects a zero payment amount", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      const amountInput = await screen.findByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "0");
      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      expect(await screen.findByText(/must be greater than zero/i)).toBeTruthy();
    });

    it("rejects a negative payment amount", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      const amountInput = await screen.findByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "-50");
      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      expect(await screen.findByText(/must be greater than zero/i)).toBeTruthy();
    });

    // A native <input type="number"> never actually exposes a malformed,
    // non-empty string to onChange (browsers/jsdom sanitize keystrokes as
    // they're typed — "12.3.4" lands as "12.34"), so this branch of
    // validatePaymentAmount can't be triggered through the rendered form.
    // It's still real defense-in-depth (e.g. against a non-keyboard input
    // source), verified directly here instead.
    it("validatePaymentAmount treats a non-finite parse as an invalid amount, not silently as zero", () => {
      expect(validatePaymentAmount("not-a-number", 289.4)).toMatch(/please enter a valid payment amount/i);
      expect(validatePaymentAmount("NaN", 289.4)).toMatch(/please enter a valid payment amount/i);
    });

    it("rejects an amount exceeding the current balance, naming the balance in the message", async () => {
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER) }); // balance 289.40
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      const amountInput = await screen.findByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "500");
      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      expect(await screen.findByText(/cannot exceed the balance due of ₹289\.40/i)).toBeTruthy();
    });

    it("shows a loading state and disables actions while the payment is being recorded", async () => {
      let resolveRecordPayment: (order: Order) => void;
      const recordPayment = vi.fn(
        () =>
          new Promise<Order>((resolve) => {
            resolveRecordPayment = resolve;
          })
      );
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER), recordPayment });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));
      await screen.findByLabelText("Amount");

      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      expect(await screen.findByRole("button", { name: /recording/i })).toHaveProperty("disabled", true);
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveProperty("disabled", true);

      resolveRecordPayment!({ ...PARTIAL_ORDER, amountPaid: 389.4, balanceDue: 0, paymentStatus: "Paid" });
      await screen.findByRole("button", { name: /^record payment$/i }); // dialog closes, action button reverts
    });

    it("on success: updates the displayed order and closes the dialog", async () => {
      const updatedOrder: Order = { ...PARTIAL_ORDER, amountPaid: 389.4, balanceDue: 0, paymentStatus: "Paid" };
      const recordPayment = vi.fn().mockResolvedValue(updatedOrder);
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER), recordPayment });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));
      await screen.findByLabelText("Amount");

      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      await screen.findByText("Paid"); // the payment status badge, after re-render
      expect(recordPayment).toHaveBeenCalledWith(42, 289.4);
      expect(screen.queryByLabelText("Amount")).toBeNull(); // dialog closed
      expect(screen.getByText("Balance Due:").closest("div")?.textContent).toContain("₹0.00");
    });

    it("on failure: shows a safe error and preserves the currently-displayed payment state", async () => {
      const recordPayment = vi.fn().mockRejectedValue(new Error("Payment amount cannot exceed the balance due of ₹289.40."));
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER), recordPayment });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));
      await screen.findByLabelText("Amount");

      await user.click(screen.getByRole("button", { name: /^record payment$/i }));

      // The dialog stays open and the underlying order display is untouched.
      expect(await screen.findByLabelText("Amount")).toBeTruthy();
      expect(screen.getByText("Paid:").closest("div")?.textContent).toContain("₹100.00"); // unchanged
    });

    it("cancelling the dialog discards the entered amount without recording anything", async () => {
      const recordPayment = vi.fn();
      const user = userEvent.setup();
      renderInvoiceForOrder42({ get: vi.fn().mockResolvedValue(PARTIAL_ORDER), recordPayment });
      await screen.findByText("Ramesh (as of order date)");
      await user.click(screen.getByRole("button", { name: /record payment/i }));

      const amountInput = await screen.findByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "50");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByLabelText("Amount")).toBeNull();
      expect(recordPayment).not.toHaveBeenCalled();
    });
  });
});
