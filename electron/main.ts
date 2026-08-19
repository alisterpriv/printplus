import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "./db/connection";
import { runMigrations } from "./db/migrate";
import { registerSettingsHandlers } from "./ipc/settingsHandlers";
import { registerRatesHandlers } from "./ipc/ratesHandlers";
import { registerCustomersHandlers } from "./ipc/customersHandlers";
import { registerOrdersHandlers } from "./ipc/ordersHandlers";
import { registerDashboardHandlers } from "./ipc/dashboardHandlers";
import { registerBusinessSettingsHandlers } from "./ipc/businessSettingsHandlers";
import { registerBackupHandlers } from "./ipc/backupHandlers";
import { shouldQuitForSecondInstance, focusExistingWindow, formatFatalErrorDialog } from "./lifecycle";

let db: DatabaseSync | undefined;
let mainWindow: BrowserWindow | null = null;

/**
 * PHASE 20 — a top-level safety net for anything that escapes every
 * other try/catch in the main process. Deliberately never surfaces the
 * real error to the user (see formatFatalErrorDialog's doc comment) —
 * only logs it for developer debugging — and always exits rather than
 * continuing in an unknown state. Guarded against firing twice (e.g. a
 * second failure while already exiting) and against calling
 * dialog.showErrorBox before the app is ready, which Electron does not
 * support and would itself throw.
 */
let isHandlingFatalError = false;
function handleFatalError(context: string, error: unknown): void {
  if (isHandlingFatalError) return;
  isHandlingFatalError = true;

  console.error(`[${context}]`, error);

  if (app.isReady()) {
    try {
      const { title, message } = formatFatalErrorDialog(error);
      dialog.showErrorBox(title, message);
    } catch (dialogError) {
      console.error("[fatal error] failed to show the error dialog:", dialogError);
    }
  }

  app.exit(1);
}

process.on("uncaughtException", (error) => handleFatalError("uncaughtException", error));
process.on("unhandledRejection", (reason) => handleFatalError("unhandledRejection", reason));

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
}

function startApp(): void {
  app.on("second-instance", () => {
    focusExistingWindow(mainWindow);
  });

  app.whenReady().then(() => {
    try {
      const dbPath = path.join(app.getPath("userData"), "printplus.db");
      db = createConnection(dbPath);
      runMigrations(db);
      registerSettingsHandlers(db);
      registerRatesHandlers(db);
      registerCustomersHandlers(db);
      registerOrdersHandlers(db);
      registerDashboardHandlers(db);
      registerBusinessSettingsHandlers(db);
      registerBackupHandlers(db, dbPath);
    } catch (error) {
      console.error("[startup] failed to initialize the database:", error);
      dialog.showErrorBox(
        "PrintPlus failed to start",
        "PrintPlus could not initialize its local database and needs to close. Please try restarting the application."
      );
      app.quit();
      return;
    }

    createWindow();
  });

  // PHASE 20 — this app has no menu, no tray, and no way to recreate a
  // closed window (no "activate" handler), so leaving the process alive
  // after the only window closes would just be an invisible, unkillable
  // (short of a task manager) background process holding the SQLite
  // connection open. Quitting unconditionally, on every platform, is
  // deliberate for this single-window utility app.
  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    db?.close();
  });
}

// PHASE 20 — single-instance lock. A second launch attempt can never
// acquire the lock, so it must not create a window or open a second
// SQLite connection against the same file — it quits immediately,
// before any of startApp()'s setup runs. The first (already-running)
// instance instead receives "second-instance" and refocuses its window.
const gotLock = app.requestSingleInstanceLock();

if (shouldQuitForSecondInstance(gotLock)) {
  app.quit();
} else {
  startApp();
}
