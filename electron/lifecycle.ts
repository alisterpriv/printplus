/**
 * PHASE 20 — small, framework-independent lifecycle helpers used by
 * main.ts. Kept in their own file, deliberately with no "electron"
 * import at all, specifically so they can be unit-tested directly: any
 * module that imports "electron" and calls its APIs at module-load time
 * (as main.ts does — app.requestSingleInstanceLock(), app.on(...))
 * crashes immediately if imported under plain Node/vitest, since
 * "electron" resolves to a path string outside a real Electron process,
 * not the real API. That is the reason main.ts itself has never had test
 * coverage. Nothing in this file touches "electron", so all of it can be
 * tested with plain values and fakes, with zero mocking.
 */

/** A second launch attempt that could not acquire the single-instance lock must quit. */
export function shouldQuitForSecondInstance(gotLock: boolean): boolean {
  return !gotLock;
}

/**
 * The minimal shape main.ts's real BrowserWindow satisfies — narrowed
 * down to only what focusExistingWindow needs, so tests can pass a plain
 * fake object instead of a real (or mocked) BrowserWindow.
 */
export interface FocusableWindow {
  isMinimized(): boolean;
  restore(): void;
  focus(): void;
}

/**
 * Brings the existing window back to the foreground when a second launch
 * attempt is detected. A minimized window is restored first; a null/
 * undefined window (e.g. closed but not yet nulled out, or closed
 * between events) is safely ignored rather than throwing.
 */
export function focusExistingWindow(win: FocusableWindow | null | undefined): void {
  if (!win) return;
  if (win.isMinimized()) {
    win.restore();
  }
  win.focus();
}

export interface FatalErrorDialog {
  title: string;
  message: string;
}

/**
 * Builds the user-facing content for an unexpected main-process crash.
 * Deliberately ignores everything about the real `error` value — no
 * message, no stack, no cause — and always returns the same fixed,
 * generic text. The real error is the caller's job to log (e.g. via
 * console.error) for developer debugging; this function's entire purpose
 * is to guarantee nothing error-shaped (which could contain a raw SQL
 * statement, a file path, or real customer data) ever reaches a dialog
 * the operator sees.
 */
export function formatFatalErrorDialog(error: unknown): FatalErrorDialog {
  void error;
  return {
    title: "PrintPlus — Unexpected Error",
    message: "PrintPlus encountered an unexpected error and needs to close. Please restart the application.",
  };
}
