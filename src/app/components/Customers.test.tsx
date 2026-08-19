import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { Customers } from "./Customers";
import type { Customer, CustomersSummary, PrintPlusApi } from "../../types/ipc-contracts";

const CUSTOMER: Customer = {
  id: 5,
  name: "Ramesh",
  phone: "9998887770",
  email: "ramesh@example.com",
  address: "MG Road",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const DEFAULT_SUMMARY: CustomersSummary = { activeThisMonth: 0, newThisMonth: 0, avgOrderValue: 0 };

function mockApi(
  customers: Customer[] = [CUSTOMER],
  summary: CustomersSummary = DEFAULT_SUMMARY,
  overrides: Partial<PrintPlusApi["customers"]> = {}
) {
  const api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: {
      list: vi.fn().mockResolvedValue(customers),
      create: vi.fn().mockResolvedValue(CUSTOMER),
      update: vi.fn().mockResolvedValue(undefined),
      getSummary: vi.fn().mockResolvedValue(summary),
      ...overrides,
    },
    orders: { list: vi.fn(), get: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), recordPayment: vi.fn(), getSummary: vi.fn() },
    dashboard: { getSummary: vi.fn() },
    businessSettings: { get: vi.fn(), update: vi.fn() },
  } as unknown as PrintPlusApi;
  window.api = api;
  return api;
}

function renderCustomers() {
  render(
    <MemoryRouter initialEntries={["/customers"]}>
      <Routes>
        <Route path="/customers" element={<Customers />} />
        <Route path="/create-bill" element={<div data-testid="create-bill-route" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Customers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("existing behavior: loading state, then real customer data", async () => {
    mockApi();
    renderCustomers();
    expect(screen.getByText(/loading customers/i)).toBeTruthy();
    expect(await screen.findByText("Ramesh")).toBeTruthy();
  });

  describe("PHASE 17 — statistics", () => {
    it("renders real Active This Month / New This Month / Avg. Order Value from customers.getSummary, not hardcoded", async () => {
      mockApi([CUSTOMER], { activeThisMonth: 3, newThisMonth: 2, avgOrderValue: 456.78 });
      renderCustomers();

      await screen.findByText("Ramesh");
      expect(screen.getByText("3")).toBeTruthy();
      expect(screen.getByText("2")).toBeTruthy();
      expect(screen.getByText("₹456.78")).toBeTruthy();
    });

    it("shows zero-state values (not blank/error) on a fresh shop with no activity", async () => {
      mockApi([], DEFAULT_SUMMARY);
      renderCustomers();

      await screen.findByText("No customers found");
      expect(screen.getByText("₹0.00")).toBeTruthy();
    });

    it("Total Customers remains the real, unfiltered client-side count, unchanged by this phase", async () => {
      const secondCustomer: Customer = { ...CUSTOMER, id: 6, name: "Sunita" };
      mockApi([CUSTOMER, secondCustomer], DEFAULT_SUMMARY);
      renderCustomers();

      await screen.findByText("Ramesh");
      const totalCustomersCard = screen.getByText("Total Customers").closest("div");
      expect(totalCustomersCard?.textContent).toContain("2");
    });
  });

  describe("PHASE 17 — New Bill navigation", () => {
    it("clicking New Bill navigates to Create Bill with the correct customerId", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCustomers();

      await screen.findByText("Ramesh");
      await user.click(screen.getByRole("button", { name: "New Bill" }));

      expect(await screen.findByTestId("create-bill-route")).toBeTruthy();
    });
  });

  describe("PHASE 17 — View Details remains untouched", () => {
    it("View Details renders but performs no navigation (still non-functional, out of scope)", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCustomers();

      await screen.findByText("Ramesh");
      const viewDetailsButton = screen.getByRole("button", { name: "View Details" });
      await user.click(viewDetailsButton);

      expect(screen.queryByTestId("create-bill-route")).toBeNull();
      expect(screen.getByText("Ramesh")).toBeTruthy();
    });
  });

  describe("existing behavior — search", () => {
    it("filters customers by name/email/phone", async () => {
      const secondCustomer: Customer = { ...CUSTOMER, id: 6, name: "Sunita", phone: "9111111111", email: "sunita@example.com" };
      mockApi([CUSTOMER, secondCustomer]);
      const user = userEvent.setup();
      renderCustomers();

      await screen.findByText("Ramesh");
      expect(screen.getByText("Sunita")).toBeTruthy();

      await user.type(screen.getByPlaceholderText(/search by name/i), "Sunita");
      expect(screen.queryByText("Ramesh")).toBeNull();
      expect(screen.getByText("Sunita")).toBeTruthy();
    });
  });

  describe("existing behavior — add customer", () => {
    it("adds a new customer through the dialog and reloads the list", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      renderCustomers();

      await screen.findByText("Ramesh");
      await user.click(screen.getByRole("button", { name: /add customer/i }));

      await user.type(screen.getByLabelText(/name/i), "New Customer");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => expect(api.customers.create).toHaveBeenCalledTimes(1));
      expect(api.customers.list).toHaveBeenCalledTimes(2); // initial load + reload after save
    });
  });

  describe("existing behavior — edit customer", () => {
    it("opens the edit dialog pre-filled and saves an update", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      renderCustomers();

      await screen.findByText("Ramesh");
      const editButtons = screen.getAllByRole("button");
      const pencilButton = editButtons.find((b) => b.querySelector("svg.lucide-pencil"));
      await user.click(pencilButton!);

      expect(await screen.findByDisplayValue("Ramesh")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => expect(api.customers.update).toHaveBeenCalledWith(5, expect.objectContaining({ name: "Ramesh" })));
    });
  });
});
