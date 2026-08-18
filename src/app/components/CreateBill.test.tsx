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

const CREATED_ORDER: Order = {
  id: 42,
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
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function mockApi(overrides: Partial<PrintPlusApi["orders"]> = {}) {
  const api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn().mockResolvedValue([RATE]), update: vi.fn() },
    customers: {
      list: vi.fn().mockResolvedValue([CUSTOMER]),
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

function renderCreateBill() {
  render(
    <MemoryRouter initialEntries={["/create-bill"]}>
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
});
