import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import { getSettingValue, setSettingValue } from "../services/settingsService";

const KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;
const MAX_VALUE_LENGTH = 10000;

/** Thrown for bad renderer input; its message is safe to send back as-is. */
export class InvalidSettingInputError extends Error {}

export function validateKey(key: unknown): string {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
    throw new InvalidSettingInputError("Invalid setting key");
  }
  return key;
}

export function validateValue(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
    throw new InvalidSettingInputError("Invalid setting value");
  }
  return value;
}

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleSettingsGet(db: DatabaseSync, key: unknown): string | null {
  const validKey = validateKey(key);
  return getSettingValue(db, validKey);
}

export function handleSettingsSet(db: DatabaseSync, payload: unknown): void {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidSettingInputError("Invalid payload");
  }
  const { key, value } = payload as { key?: unknown; value?: unknown };
  const validKey = validateKey(key);
  const validValue = validateValue(value);
  setSettingValue(db, validKey, validValue);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. Validation errors are safe to pass through
 * (their message is intentionally generic); anything else is logged in
 * full here and replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[settings IPC]", error);
  if (error instanceof InvalidSettingInputError) {
    return new Error(error.message);
  }
  return new Error("Something went wrong while accessing settings. Please try again.");
}

export function registerSettingsHandlers(db: DatabaseSync): void {
  ipcMain.handle("settings:get", (_event, key: unknown) => {
    try {
      return handleSettingsGet(db, key);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("settings:set", (_event, payload: unknown) => {
    try {
      handleSettingsSet(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
