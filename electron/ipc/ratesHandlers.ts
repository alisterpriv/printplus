import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import { listRates as listRatesService, updateRateValue, InvalidRateValueError } from "../services/ratesService";
import { RateNotFoundError, type Rate } from "../repositories/ratesRepository";

/** Thrown for a structurally malformed request (wrong type/shape). */
export class InvalidRateRequestError extends Error {}

export function validateRateId(id: unknown): number {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new InvalidRateRequestError("Invalid rate id");
  }
  return id;
}

export function validateRateNumber(rate: unknown): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    throw new InvalidRateRequestError("Invalid rate value");
  }
  return rate;
}

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleRatesList(db: DatabaseSync): Rate[] {
  return listRatesService(db);
}

export function handleRatesUpdate(db: DatabaseSync, payload: unknown): void {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidRateRequestError("Invalid payload");
  }
  const { id, rate } = payload as { id?: unknown; rate?: unknown };
  const validId = validateRateId(id);
  const validRate = validateRateNumber(rate);
  updateRateValue(db, validId, validRate);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. Recognized validation/not-found errors pass
 * their (already-safe) message through as-is; anything else is logged
 * in full here and replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[rates IPC]", error);
  if (
    error instanceof InvalidRateRequestError ||
    error instanceof InvalidRateValueError ||
    error instanceof RateNotFoundError
  ) {
    return new Error(error.message);
  }
  return new Error("Something went wrong while accessing rates. Please try again.");
}

export function registerRatesHandlers(db: DatabaseSync): void {
  ipcMain.handle("rates:list", () => {
    try {
      return handleRatesList(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("rates:update", (_event, payload: unknown) => {
    try {
      handleRatesUpdate(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
