import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { CreateBill } from "./CreateBill";
import type { Customer, Order, PrintPlusApi, Rate } from "../../types/ipc-contracts";

const RATE: Rate = {
  id: 1,
  printType: "Flex",
  rate: 100,
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const CUSTOMER: Customer = {
  id: 5,
  name: "Ramesh",
  phone: "9998887770",
  email: null,
  address: "MG Road",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const SECOND_CUSTOMER: Customer = {
  id: 9,
  name: "Sunita",
  phone: "9111111111",
  email: null,
  address: "Park Road",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const CREATED_ORDER: Order = {
  id: 42,
  invoiceNumber: "INV-000042",
  customerId: 5,
  customerName: "Ramesh",
  customerPhone: "9998887770",
  customerAddress: "MG Road",
  status: "Pending",
  items: [],
  subtotal: 600,
  discountPercent: 0,
  discountAmount: 0,
  gstPercent: 18,
  gstAmount: 108,
  grandTotal: 708,
  amountPaid: 0,
  balanceDue: 708,
  paymentStatus: "Unpaid",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function mockApi(overrides: Partial<PrintPlusApi["orders"]> = {}, customers: Customer[] = [CUSTOMER], rates: Rate[] = [RATE]) {
  const api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn().mockResolvedValue(rates), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    customers: {
      list: vi.fn().mockResolvedValue(customers),
      create: vi.fn(),
      update: vi.fn(),
    },
    orders: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn().mockResolvedValue(CREATED_ORDER),
      updateStatus: vi.fn(),
      ...overrides,
    },
  } as unknown as PrintPlusApi;
  window.api = api;
  return api;
}

function renderCreateBill(initialPath = "/create-bill") {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/create-bill" element={<CreateBill />} />
        <Route path="/invoice/:id" element={<div data-testid="invoice-route" />} />
      </Routes>
    </MemoryRouter>
  );
}

/** DOM order: [0] customer select, [1] print type select, [2] unit select. */
async function getEnabledComboboxes(): Promise<HTMLButtonElement[]> {
  await waitFor(() => {
    const boxes = screen.getAllByRole("combobox") as HTMLButtonElement[];
    expect(boxes[0].disabled).toBe(false);
    expect(boxes[1].disabled).toBe(false);
  });
  return screen.getAllByRole("combobox") as HTMLButtonElement[];
}

async function addOneFlexItem(user: ReturnType<typeof userEvent.setup>, selectCustomer: boolean) {
  const [customerTrigger, printTypeTrigger] = await getEnabledComboboxes();

  if (selectCustomer) {
    await user.click(customerTrigger);
    await user.click(await screen.findByText(/Ramesh/));
  }

  await user.click(printTypeTrigger);
  await user.click(await screen.findByText("Flex"));

  await user.type(screen.getByLabelText(/width/i), "2");
  await user.type(screen.getByLabelText(/height/i), "3");

  await user.click(screen.getByRole("button", { name: /add item/i }));
}

describe("CreateBill", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the order-creation contract built from the selected customer and bill items", async () => {
    const api = mockApi();
    const user = userEvent.setup();
    renderCreateBill();

    await addOneFlexItem(user, true);
    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    await waitFor(() => expect(api.orders.create).toHaveBeenCalledTimes(1));
    expect(api.orders.create).toHaveBeenCalledWith({
      customerId: 5,
      items: [
        {
          printType: "Flex",
          width: 2,
          height: 3,
          unit: "Meter",
          rate: 100,
          quantity: 1,
        },
      ],
      discountPercent: 0,
      gstPercent: 18,
    });
  });

  it("navigates to the persisted order's invoice after a successful order creation", async () => {
    mockApi();
    const user = userEvent.setup();
    renderCreateBill();

    await addOneFlexItem(user, true);
    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(await screen.findByTestId("invoice-route")).toBeTruthy();
  });

  it("does not create an order when no customer has been selected", async () => {
    const api = mockApi();
    const user = userEvent.setup();
    renderCreateBill();

    await addOneFlexItem(user, false);
    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(api.orders.create).not.toHaveBeenCalled();
  });

  describe("PHASE 8 — inline validation", () => {
    it("shows an inline error and does not add an item when width is zero", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);
      await user.click(await screen.findByText("Flex"));

      await user.type(screen.getByLabelText(/width/i), "0");
      await user.type(screen.getByLabelText(/height/i), "3");
      await user.click(screen.getByRole("button", { name: /add item/i }));

      expect(await screen.findByText("Width must be greater than zero.")).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("shows an inline error and does not add an item when rate is negative", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);
      await user.click(await screen.findByText("Flex"));

      await user.type(screen.getByLabelText(/width/i), "2");
      await user.type(screen.getByLabelText(/height/i), "3");
      const rateInput = screen.getByLabelText(/rate/i);
      await user.clear(rateInput);
      await user.type(rateInput, "-10");
      await user.click(screen.getByRole("button", { name: /add item/i }));

      expect(await screen.findByText("Rate must be greater than zero.")).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("rejects a fractional quantity with an inline error instead of silently truncating it", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);
      await user.click(await screen.findByText("Flex"));

      await user.type(screen.getByLabelText(/width/i), "2");
      await user.type(screen.getByLabelText(/height/i), "3");
      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, "2.5");
      await user.click(screen.getByRole("button", { name: /add item/i }));

      expect(await screen.findByText("Quantity must be a whole number of 1 or more.")).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("adds the item once the invalid field is corrected, clearing the inline error", async () => {
      mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);
      await user.click(await screen.findByText("Flex"));

      await user.type(screen.getByLabelText(/width/i), "0");
      await user.type(screen.getByLabelText(/height/i), "3");
      await user.click(screen.getByRole("button", { name: /add item/i }));
      expect(await screen.findByText("Width must be greater than zero.")).toBeTruthy();

      const widthInput = screen.getByLabelText(/width/i);
      await user.clear(widthInput);
      await user.type(widthInput, "2");
      expect(screen.queryByText("Width must be greater than zero.")).toBeNull();
    });

    it("blocks Print Invoice and shows an inline error when GST is out of range", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      await addOneFlexItem(user, true);

      const gstInput = screen.getByLabelText(/gst/i);
      await user.clear(gstInput);
      await user.type(gstInput, "150");
      await user.click(screen.getByRole("button", { name: /print invoice/i }));

      expect(await screen.findByText("Must be between 0 and 100.")).toBeTruthy();
      expect(api.orders.create).not.toHaveBeenCalled();
    });

    it("blocks Print Invoice and shows an inline error when discount is negative", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      renderCreateBill();

      await addOneFlexItem(user, true);

      const discountInput = screen.getByLabelText(/discount/i);
      await user.clear(discountInput);
      await user.type(discountInput, "-5");
      await user.click(screen.getByRole("button", { name: /print invoice/i }));

      expect(await screen.findByText("Must be between 0 and 100.")).toBeTruthy();
      expect(api.orders.create).not.toHaveBeenCalled();
    });
  });

  describe("PHASE 17 — customerId query-param pre-selection", () => {
    it("pre-selects the matching customer once customers have loaded", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill?customerId=9");

      const [customerTrigger] = await getEnabledComboboxes();
      expect(customerTrigger.textContent).toContain("Sunita");
    });

    it("waits for customers to finish loading before applying the pre-selection", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill?customerId=9");

      // Before customers resolve, the trigger is disabled and shows the loading placeholder.
      expect(screen.getByText(/loading customers/i)).toBeTruthy();
      const [customerTrigger] = await getEnabledComboboxes();
      expect(customerTrigger.textContent).toContain("Sunita");
    });

    it("an absent customerId leaves the default (empty) selection unchanged", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill");

      const [customerTrigger] = await getEnabledComboboxes();
      expect(customerTrigger.textContent).toContain("Select a customer");
    });

    it("an invalid (non-numeric) customerId leaves the default selection unchanged, without crashing", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill?customerId=not-a-number");

      const [customerTrigger] = await getEnabledComboboxes();
      expect(customerTrigger.textContent).toContain("Select a customer");
    });

    it("an unknown customerId (no matching customer) leaves the default selection unchanged, without crashing", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill?customerId=999999");

      const [customerTrigger] = await getEnabledComboboxes();
      expect(customerTrigger.textContent).toContain("Select a customer");
    });

    it("does not change any other Create Bill default (discount/GST stay at their normal defaults)", async () => {
      mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      renderCreateBill("/create-bill?customerId=9");
      await getEnabledComboboxes();

      expect((screen.getByLabelText(/discount/i) as HTMLInputElement).value).toBe("0");
      expect((screen.getByLabelText(/gst/i) as HTMLInputElement).value).toBe("18");
    });

    it("a pre-selected customer from the query param can still be used to submit an order normally", async () => {
      const api = mockApi({}, [CUSTOMER, SECOND_CUSTOMER]);
      const user = userEvent.setup();
      renderCreateBill("/create-bill?customerId=9");

      await getEnabledComboboxes();
      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);
      await user.click(await screen.findByText("Flex"));
      await user.type(screen.getByLabelText(/width/i), "2");
      await user.type(screen.getByLabelText(/height/i), "3");
      await user.click(screen.getByRole("button", { name: /add item/i }));
      await user.click(screen.getByRole("button", { name: /print invoice/i }));

      await waitFor(() => expect(api.orders.create).toHaveBeenCalledTimes(1));
      expect(api.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 9 })
      );
    });
  });

  describe("PHASE 19 — rate/print-type management regression", () => {
    it("a newly added print type (not previously known to Create Bill) appears as a selectable option", async () => {
      const NEW_TYPE: Rate = { id: 2, printType: "Foam Board", rate: 250, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" };
      mockApi({}, [CUSTOMER], [RATE, NEW_TYPE]);
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);

      expect(await screen.findByText("Foam Board")).toBeTruthy();
    });

    it("a deleted print type (no longer returned by rates.list) is not offered as an option", async () => {
      mockApi({}, [CUSTOMER], [RATE]); // only "Flex" — simulates "Banner" having been deleted
      const user = userEvent.setup();
      renderCreateBill();

      const [, printTypeTrigger] = await getEnabledComboboxes();
      await user.click(printTypeTrigger);

      expect(await screen.findByText("Flex")).toBeTruthy();
      expect(screen.queryByText("Banner")).toBeNull();
    });
  });
});
