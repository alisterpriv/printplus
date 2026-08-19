import { app, dialog, ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import {
  createBackup,
  validateBackupFile,
  replaceLiveDatabase,
  InvalidBackupFileError,
  RestoreFailedError,
} from "../services/backupService";

export type BackupCreateOutcome =
  | { status: "success"; filePath: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export type BackupRestoreOutcome =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

function defaultBackupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `printplus-backup-${stamp}.db`;
}

/**
 * Non-destructive: only ever reads the live database via
 * createBackup's SQLite-consistent backup. Cancelling the save dialog is
 * a normal, expected outcome, not an error — it resolves with a distinct
 * "cancelled" status rather than rejecting, so Settings.tsx can render
 * cancellation silently instead of as a failure toast.
 */
export async function handleBackupCreate(db: DatabaseSync): Promise<BackupCreateOutcome> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save PrintPlus Backup",
    defaultPath: defaultBackupFileName(),
    filters: [{ name: "PrintPlus Backup", extensions: ["db"] }],
  });
  if (canceled || !filePath) {
    return { status: "cancelled" };
  }

  try {
    const result = await createBackup(db, filePath);
    return { status: "success", filePath: result.filePath };
  } catch (error) {
    console.error("[backup IPC] backup failed:", error);
    return { status: "error", message: "Backup failed. Please try again." };
  }
}

/**
 * Destructive. Flow: pick a file -> validate it -> explicit native
 * confirmation -> close the live connection -> replace the database file
 * -> restart the app in every outcome (success or failure), since
 * replaceLiveDatabase guarantees dbPath holds a consistent database
 * either way once db.close() has been called, and the app must never
 * keep running against a closed connection (see backupService.ts's
 * replaceLiveDatabase doc comment).
 *
 * The "success"/post-close "error" return values are unreachable in
 * real usage — app.exit() terminates the process before this promise's
 * caller (Settings.tsx) can observe them — but are still returned so the
 * pure logic here stays independently unit-testable.
 */
export async function handleBackupRestore(db: DatabaseSync, dbPath: string): Promise<BackupRestoreOutcome> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select a PrintPlus Backup to Restore",
    properties: ["openFile"],
    filters: [{ name: "PrintPlus Backup", extensions: ["db"] }],
  });
  if (canceled || filePaths.length === 0) {
    return { status: "cancelled" };
  }
  const selected = filePaths[0];

  try {
    validateBackupFile(selected);
  } catch (error) {
    if (error instanceof InvalidBackupFileError) {
      return { status: "invalid", message: error.message };
    }
    console.error("[backup IPC] restore validation failed:", error);
    return { status: "error", message: "Could not read the selected file." };
  }

  const confirmation = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Cancel", "Restore and Restart"],
    defaultId: 0,
    cancelId: 0,
    title: "Restore Backup",
    message: "This will replace all current PrintPlus data.",
    detail:
      "Restoring will permanently replace your current customers, orders, rates, and business settings with the contents of the selected backup. This cannot be undone. PrintPlus will restart to complete the restore.",
  });
  if (confirmation.response !== 1) {
    return { status: "cancelled" };
  }

  db.close();

  try {
    replaceLiveDatabase(dbPath, selected);
  } catch (error) {
    console.error("[backup IPC] restore failed:", error);
    const message =
      error instanceof RestoreFailedError ? error.message : "Restore failed unexpectedly.";
    dialog.showErrorBox("Restore Failed", message);
    app.relaunch();
    app.exit(0);
    return { status: "error", message };
  }

  app.relaunch();
  app.exit(0);
  return { status: "success" };
}

export function registerBackupHandlers(db: DatabaseSync, dbPath: string): void {
  ipcMain.handle("backup:create", () => handleBackupCreate(db));
  ipcMain.handle("backup:restore", () => handleBackupRestore(db, dbPath));
}
