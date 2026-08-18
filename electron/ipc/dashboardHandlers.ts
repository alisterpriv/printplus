import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import { getDashboardSummary, type DashboardSummary } from "../services/dashboardService";

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleDashboardGetSummary(db: DatabaseSync): DashboardSummary {
  return getDashboardSummary(db);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. getSummary takes no renderer-supplied input, so
 * there is no "recognized validation error" case to pass through as-is
 * here (unlike settings/rates/customers/orders) — any failure is
 * necessarily an unexpected internal one, logged in full here and
 * replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[dashboard IPC]", error);
  return new Error("Something went wrong while loading the dashboard. Please try again.");
}

export function registerDashboardHandlers(db: DatabaseSync): void {
  ipcMain.handle("dashboard:getSummary", () => {
    try {
      return handleDashboardGetSummary(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
