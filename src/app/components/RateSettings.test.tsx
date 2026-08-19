import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { RateSettings } from "./RateSettings";
import type { Rate, PrintPlusApi } from "../../types/ipc-contracts";

const FLEX: Rate = { id: 1, printType: "Flex", rate: 10, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" };
const BANNER: Rate = { id: 2, printType: "Banner", rate: 12, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" };

function mockApi(overrides: Partial<PrintPlusApi["rates"]> = {}, rates: Rate[] = [FLEX, BANNER]) {
  const api = {
    settings: { get: vi.fn(), set: vi.fn() },
    rates: {
      list: vi.fn().mockResolvedValue(rates),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      ...overrides,
    },
    customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { list: vi.fn(), get: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), recordPayment: vi.fn(), getSummary: vi.fn() },
    dashboard: { getSummary: vi.fn() },
    businessSettings: { get: vi.fn(), update: vi.fn() },
    backup: { create: vi.fn(), restore: vi.fn() },
  } as unknown as PrintPlusApi;
  window.api = api;
  return api;
}

describe("RateSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("existing behavior: shows a loading state, then real rates", async () => {
    mockApi();
    render(<RateSettings />);
    expect(screen.getByText(/loading rates/i)).toBeTruthy();
    expect(await screen.findByText("Flex")).toBeTruthy();
    expect(screen.getByText("Banner")).toBeTruthy();
  });

  describe("existing behavior — edit/save/cancel", () => {
    it("edits and saves a rate", async () => {
      const api = mockApi({ update: vi.fn().mockResolvedValue(undefined) });
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
      await user.click(editButtons[0]);

      const input = screen.getByDisplayValue("10");
      await user.clear(input);
      await user.type(input, "15");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      expect(api.rates.update).toHaveBeenCalledWith(1, 15);
      expect(await screen.findByText("₹15")).toBeTruthy();
    });

    it("cancels an edit without calling update", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));

      expect(api.rates.update).not.toHaveBeenCalled();
      expect(screen.getByText("₹10")).toBeTruthy();
    });

    it("rejects an invalid edited rate without calling update", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
      const input = screen.getByDisplayValue("10");
      await user.clear(input);
      await user.type(input, "0");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      expect(api.rates.update).not.toHaveBeenCalled();
    });
  });

  describe("PHASE 19 — Add Print Type", () => {
    it("opens the Add Print Type dialog", async () => {
      mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));

      expect(await screen.findByRole("heading", { name: "Add Print Type" })).toBeTruthy();
      expect(screen.getByLabelText(/print type name/i)).toBeTruthy();
    });

    it("creates a new print type and reloads the list", async () => {
      const newRate: Rate = { id: 3, printType: "Foam Board", rate: 25, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" };
      const list = vi.fn().mockResolvedValueOnce([FLEX, BANNER]).mockResolvedValueOnce([FLEX, BANNER, newRate]);
      const api = mockApi({ list, create: vi.fn().mockResolvedValue(newRate) });
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));
      await user.type(screen.getByLabelText(/print type name/i), "Foam Board");
      await user.type(screen.getByLabelText(/price per sq meter/i), "25");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      expect(api.rates.create).toHaveBeenCalledWith("Foam Board", 25);
      expect(await screen.findByText("Foam Board")).toBeTruthy();
    });

    it("blocks creation and does not call the API when the name is empty", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));
      await user.type(screen.getByLabelText(/price per sq meter/i), "25");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      expect(api.rates.create).not.toHaveBeenCalled();
    });

    it("blocks creation and does not call the API when the price is invalid", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));
      await user.type(screen.getByLabelText(/print type name/i), "Foam Board");
      await user.type(screen.getByLabelText(/price per sq meter/i), "0");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      expect(api.rates.create).not.toHaveBeenCalled();
    });

    it("shows an error toast and keeps the dialog open on a duplicate-name rejection", async () => {
      const errorSpy = vi.spyOn(toast, "error");
      const api = mockApi({ create: vi.fn().mockRejectedValue(new Error('A print type named "Flex" already exists')) });
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));
      await user.type(screen.getByLabelText(/print type name/i), "Flex");
      await user.type(screen.getByLabelText(/price per sq meter/i), "10");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledWith('A print type named "Flex" already exists'));
      expect(api.rates.create).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("heading", { name: "Add Print Type" })).toBeTruthy(); // dialog still open
    });

    it("cancelling the Add dialog does not call the API", async () => {
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getByRole("button", { name: /add print type/i }));
      await user.type(screen.getByLabelText(/print type name/i), "Foam Board");
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));

      expect(api.rates.create).not.toHaveBeenCalled();
    });
  });

  describe("PHASE 19 — Delete Print Type", () => {
    it("does nothing when the confirmation is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const api = mockApi();
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);

      expect(api.rates.delete).not.toHaveBeenCalled();
      expect(screen.getByText("Flex")).toBeTruthy();
    });

    it("deletes the rate after a confirmed deletion, removing it from the list", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const api = mockApi({ delete: vi.fn().mockResolvedValue(undefined) });
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);

      expect(api.rates.delete).toHaveBeenCalledWith(1);
      await vi.waitFor(() => expect(screen.queryByText("Flex")).toBeNull());
      expect(screen.getByText("Banner")).toBeTruthy();
    });

    it("shows an error toast when deletion fails, without removing the row", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const errorSpy = vi.spyOn(toast, "error");
      mockApi({ delete: vi.fn().mockRejectedValue(new Error("Failed to delete print type")) });
      const user = userEvent.setup();
      render(<RateSettings />);

      await screen.findByText("Flex");
      await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);

      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(screen.getByText("Flex")).toBeTruthy();
    });
  });
});
