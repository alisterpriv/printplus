/**
 * Every window.api.* rejection already carries a safe, user-facing message
 * (electron/ipc/*Handlers.ts's toSafeError strips anything unsafe before it
 * crosses the IPC boundary) — so it's always safe to show error.message
 * directly instead of a generic string that discards it.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
