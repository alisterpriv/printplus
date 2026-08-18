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

let db: DatabaseSync | undefined;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "../../dist/index.html"));
}

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

app.on("before-quit", () => {
  db?.close();
});
