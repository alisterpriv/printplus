import type { DatabaseSync } from "node:sqlite";
import { getSetting, setSetting } from "../repositories/settingsRepository";

/**
 * Translates between the repository's storage-shape (undefined for a
 * missing row) and the public contract's shape (null for "no value"),
 * per SettingsApi in src/types/ipc-contracts.ts. No SQL lives here —
 * only the repository is allowed to contain SQL.
 */
export function getSettingValue(db: DatabaseSync, key: string): string | null {
  const value = getSetting(db, key);
  return value ?? null;
}

export function setSettingValue(db: DatabaseSync, key: string, value: string): void {
  setSetting(db, key, value);
}
