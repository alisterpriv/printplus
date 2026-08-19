import { describe, it, expect, vi } from "vitest";
import { shouldQuitForSecondInstance, focusExistingWindow, formatFatalErrorDialog, type FocusableWindow } from "./lifecycle";

/**
 * PHASE 20 — main.ts itself imports "electron" and calls its APIs
 * (app.requestSingleInstanceLock(), app.on(...)) at module-load time, so
 * importing main.ts directly here would crash immediately under plain
 * Node/vitest ("electron" resolves to a path string outside a real
 * Electron process, not the real API) — this is exactly why main.ts has
 * never had test coverage. The lifecycle logic worth testing has been
 * extracted into lifecycle.ts, which has no "electron" import at all;
 * these tests exercise that logic directly, with plain values and fakes
 * instead of mocks. The remaining Electron-native behavior (real window
 * focusing, real second-instance IPC, real process exit) inherently
 * requires a real Electron process and is verified separately via the
 * real-Electron verification steps, not here.
 */

describe("shouldQuitForSecondInstance", () => {
  it("returns false when the lock was acquired (first instance) — startup continues", () => {
    expect(shouldQuitForSecondInstance(true)).toBe(false);
  });

  it("returns true when the lock could not be acquired (second instance) — must quit", () => {
    expect(shouldQuitForSecondInstance(false)).toBe(true);
  });
});

describe("focusExistingWindow", () => {
  function fakeWindow(overrides: Partial<FocusableWindow> = {}): FocusableWindow {
    return {
      isMinimized: vi.fn().mockReturnValue(false),
      restore: vi.fn(),
      focus: vi.fn(),
      ...overrides,
    };
  }

  it("does nothing when the window is null (closed/not yet created) — no throw", () => {
    expect(() => focusExistingWindow(null)).not.toThrow();
  });

  it("does nothing when the window is undefined — no throw", () => {
    expect(() => focusExistingWindow(undefined)).not.toThrow();
  });

  it("restores a minimized window before focusing it", () => {
    const win = fakeWindow({ isMinimized: vi.fn().mockReturnValue(true) });
    focusExistingWindow(win);
    expect(win.restore).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it("does not call restore on a window that is not minimized, only focus", () => {
    const win = fakeWindow({ isMinimized: vi.fn().mockReturnValue(false) });
    focusExistingWindow(win);
    expect(win.restore).not.toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it("always focuses regardless of minimized state (restore alone would not bring it to the foreground)", () => {
    const minimized = fakeWindow({ isMinimized: vi.fn().mockReturnValue(true) });
    const normal = fakeWindow({ isMinimized: vi.fn().mockReturnValue(false) });
    focusExistingWindow(minimized);
    focusExistingWindow(normal);
    expect(minimized.focus).toHaveBeenCalledTimes(1);
    expect(normal.focus).toHaveBeenCalledTimes(1);
  });
});

describe("formatFatalErrorDialog", () => {
  it("never includes the underlying error's message in the dialog content", () => {
    const dangerousError = new Error(
      "Query failed: SELECT phone FROM customers WHERE id=42 (path: /Users/shop/AppData/Roaming/PrintPlus/printplus.db)"
    );
    const result = formatFatalErrorDialog(dangerousError);
    expect(result.title).not.toContain("customers");
    expect(result.title).not.toContain("AppData");
    expect(result.message).not.toContain("customers");
    expect(result.message).not.toContain("AppData");
    expect(result.message).not.toContain("SELECT");
  });

  it("never includes the underlying error's stack trace in the dialog content", () => {
    const error = new Error("boom");
    const result = formatFatalErrorDialog(error);
    expect(result.message).not.toContain(error.stack ?? "__unreachable__");
    expect(result.title + result.message).not.toContain("main.ts");
  });

  it("returns the same generic, user-facing content regardless of what was thrown", () => {
    const fromError = formatFatalErrorDialog(new Error("x"));
    const fromString = formatFatalErrorDialog("a string was thrown");
    const fromNull = formatFatalErrorDialog(null);
    const fromUndefined = formatFatalErrorDialog(undefined);
    const fromObject = formatFatalErrorDialog({ some: "object", password: "hunter2" });

    expect(fromString).toEqual(fromError);
    expect(fromNull).toEqual(fromError);
    expect(fromUndefined).toEqual(fromError);
    expect(fromObject).toEqual(fromError);
  });

  it("returns non-empty title and message suitable for dialog.showErrorBox", () => {
    const result = formatFatalErrorDialog(new Error("anything"));
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("communicates that an unexpected error occurred and the application will close", () => {
    const result = formatFatalErrorDialog(new Error("anything"));
    expect(result.message.toLowerCase()).toMatch(/unexpected/);
    expect(result.message.toLowerCase()).toMatch(/close|restart/);
  });
});
