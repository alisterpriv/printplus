/**
 * Contracts shared between the renderer and the Electron main process.
 * Only the SHAPE of requests/responses crossing the process boundary
 * belongs here — never storage details (e.g. DatabaseSync, SQL, raw
 * table row shapes). See Phase 3 report for the full rule.
 */

export interface SettingsApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface PrintPlusApi {
  settings: SettingsApi;
}

declare global {
  interface Window {
    api: PrintPlusApi;
  }
}
