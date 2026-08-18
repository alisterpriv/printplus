import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Settings } from "./Settings";
import type { BusinessSettings, PrintPlusApi } from "../../types/ipc-contracts";

const PERSISTED: BusinessSettings = {
  businessName: "Ramesh Printers",
  address: "12 MG Road",
  phone: "9876543210",
  email: "shop@example.com",
  gstin: "27ABCDE1234F1Z5",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

const EMPTY_PERSISTED: BusinessSettings = {
  businessName: "",
  address: null,
  phone: null,
  email: null,
  gstin: null,
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

function mockApi(get: PrintPlusApi["businessSettings"]["get"], update: PrintPlusApi["businessSettings"]["update"]) {
  window.api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: { list: vi.fn(), update: vi.fn() },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { list: vi.fn(), get: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
    dashboard: { getSummary: vi.fn() },
    businessSettings: { get, update },
  } as unknown as PrintPlusApi;
}

describe("Settings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state before the business settings resolve", () => {
    mockApi(
      vi.fn((): Promise<BusinessSettings> => new Promise(() => {})),
      vi.fn()
    );
    render(<Settings />);
    expect(screen.getByText(/loading business information/i)).toBeTruthy();
  });

  it("renders persisted business information, with no fake placeholder values remaining", async () => {
    mockApi(vi.fn().mockResolvedValue(PERSISTED), vi.fn());
    render(<Settings />);

    expect(await screen.findByDisplayValue("Ramesh Printers")).toBeTruthy();
    expect(screen.getByDisplayValue("12 MG Road")).toBeTruthy();
    expect(screen.getByDisplayValue("9876543210")).toBeTruthy();
    expect(screen.getByDisplayValue("shop@example.com")).toBeTruthy();
    expect(screen.getByDisplayValue("27ABCDE1234F1Z5")).toBeTruthy();

    // The old hardcoded fake defaults must never appear.
    expect(screen.queryByDisplayValue("PrintPlus")).toBeNull();
    expect(screen.queryByDisplayValue("contact@printplus.com")).toBeNull();
    expect(screen.queryByDisplayValue("+91 98500 57887")).toBeNull();
    expect(screen.queryByDisplayValue(/123 Main Street/i)).toBeNull();
    expect(screen.queryByDisplayValue("27XXXXX1234X1Z5")).toBeNull();
  });

  it("renders the empty seeded state honestly (blank fields, not fake data)", async () => {
    mockApi(vi.fn().mockResolvedValue(EMPTY_PERSISTED), vi.fn());
    render(<Settings />);

    const nameInput = (await screen.findByLabelText(/business name/i)) as HTMLInputElement;
    expect(nameInput.value).toBe("");
  });

  it("allows editing the business name field", async () => {
    mockApi(vi.fn().mockResolvedValue(PERSISTED), vi.fn());
    const user = userEvent.setup();
    render(<Settings />);

    const nameInput = (await screen.findByDisplayValue("Ramesh Printers")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Printers");
    expect(nameInput.value).toBe("Updated Printers");
  });

  it("saves successfully and shows the returned, normalized values (no second fetch)", async () => {
    const update = vi.fn().mockResolvedValue({ ...PERSISTED, businessName: "Trimmed Name" });
    const get = vi.fn().mockResolvedValue(PERSISTED);
    mockApi(get, update);
    const user = userEvent.setup();
    render(<Settings />);

    const nameInput = (await screen.findByDisplayValue("Ramesh Printers")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "  Trimmed Name  ");

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    await user.click(saveButton);

    expect(await screen.findByDisplayValue("Trimmed Name")).toBeTruthy();
    expect(update).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1); // only the initial load, no redundant re-fetch after save
  });

  it("shows a success toast after saving", async () => {
    const successSpy = vi.spyOn(toast, "success");
    mockApi(vi.fn().mockResolvedValue(PERSISTED), vi.fn().mockResolvedValue(PERSISTED));
    const user = userEvent.setup();
    render(<Settings />);

    await screen.findByDisplayValue("Ramesh Printers");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await vi.waitFor(() => expect(successSpy).toHaveBeenCalledWith("Business information saved"));
  });

  it("shows an error toast and preserves the user's edits when saving fails", async () => {
    const errorSpy = vi.spyOn(toast, "error");
    mockApi(vi.fn().mockResolvedValue(PERSISTED), vi.fn().mockRejectedValue(new Error("Business name is required")));
    const user = userEvent.setup();
    render(<Settings />);

    const nameInput = (await screen.findByDisplayValue("Ramesh Printers")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Attempted Name");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledWith("Business name is required"));
    expect(nameInput.value).toBe("Attempted Name");
  });

  it("blocks save and does not call the update API when the business name is empty", async () => {
    const update = vi.fn();
    mockApi(vi.fn().mockResolvedValue(PERSISTED), update);
    const user = userEvent.setup();
    render(<Settings />);

    const nameInput = (await screen.findByDisplayValue("Ramesh Printers")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByText(/business name is required/i)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks save and does not call the update API when the business name is whitespace-only", async () => {
    const update = vi.fn();
    mockApi(vi.fn().mockResolvedValue(PERSISTED), update);
    const user = userEvent.setup();
    render(<Settings />);

    const nameInput = (await screen.findByDisplayValue("Ramesh Printers")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "   ");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(update).not.toHaveBeenCalled();
  });
});
