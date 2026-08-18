import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import {
  getBusinessSettings as getBusinessSettingsService,
  updateBusinessSettings as updateBusinessSettingsService,
  InvalidBusinessSettingsValueError,
} from "../services/businessSettingsService";
import type { BusinessSettings, BusinessSettingsInput } from "../repositories/businessSettingsRepository";

/** Thrown for a structurally malformed request (wrong type/shape). */
export class InvalidBusinessSettingsRequestError extends Error {}

function validateOptionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidBusinessSettingsRequestError(`Invalid ${fieldName}`);
  }
  return value;
}

export function validateBusinessSettingsInput(payload: unknown): BusinessSettingsInput {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidBusinessSettingsRequestError("Invalid payload");
  }
  const { businessName, address, phone, email, gstin } = payload as {
    businessName?: unknown;
    address?: unknown;
    phone?: unknown;
    email?: unknown;
    gstin?: unknown;
  };
  if (typeof businessName !== "string") {
    throw new InvalidBusinessSettingsRequestError("Invalid business name");
  }
  return {
    businessName,
    address: validateOptionalString(address, "address"),
    phone: validateOptionalString(phone, "phone"),
    email: validateOptionalString(email, "email"),
    gstin: validateOptionalString(gstin, "gstin"),
  };
}

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleBusinessSettingsGet(db: DatabaseSync): BusinessSettings {
  return getBusinessSettingsService(db);
}

export function handleBusinessSettingsUpdate(db: DatabaseSync, payload: unknown): BusinessSettings {
  const input = validateBusinessSettingsInput(payload);
  return updateBusinessSettingsService(db, input);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. Recognized validation errors pass their
 * (already-safe) message through as-is; anything else is logged in full
 * here and replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[businessSettings IPC]", error);
  if (
    error instanceof InvalidBusinessSettingsRequestError ||
    error instanceof InvalidBusinessSettingsValueError
  ) {
    return new Error(error.message);
  }
  return new Error("Something went wrong while accessing business settings. Please try again.");
}

export function registerBusinessSettingsHandlers(db: DatabaseSync): void {
  ipcMain.handle("businessSettings:get", () => {
    try {
      return handleBusinessSettingsGet(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("businessSettings:update", (_event, payload: unknown) => {
    try {
      return handleBusinessSettingsUpdate(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
