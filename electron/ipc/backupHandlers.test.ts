import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";

const { showSaveDialog, showOpenDialog, showMessageBox, showErrorBox, relaunch, exit } = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    relaunch: (...args: unknown[]) => relaunch(...args),
    exit: (...args: unknown[]) => exit(...args),
  },
  dialog: {
    showSaveDialog: (...args: unknown[]) => showSaveDialog(...args),
    showOpenDialog: (...args: unknown[]) => showOpenDialog(...args),
    showMessageBox: (...args: unknown[]) => showMessageBox(...args),
    showErrorBox: (...args: unknown[]) => showErrorBox(...args),
  },
  ipcMain: { handle: vi.fn() },
}));

const { handleBackupCreate, handleBackupRestore } = await import("./backupHandlers");

function tempDbPath(name: string): string {
  return path.join(os.tmpdir(), `printplus-backuphandlers-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanupDbFiles(dbPath: string): void {
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(base)) fs.unlinkSync(path.join(dir, entry));
  }
}

describe("handleBackupCreate", () => {
  let dbPath: string;
  let db: DatabaseSync;

  beforeEach(() => {
    vi.clearAllMocks();
    dbPath = tempDbPath("create-source");
    db = createConnection(dbPath);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    cleanupDbFiles(dbPath);
  });

  it("returns cancelled, without touching the database, when the save dialog is cancelled", async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const result = await handleBackupCreate(db);
    expect(result).toEqual({ status: "cancelled" });
  });

  it("creates a backup at the chosen path and returns success", async () => {
    const dest = tempDbPath("create-dest");
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: dest });

    const result = await handleBackupCreate(db);
    expect(result).toEqual({ status: "success", filePath: dest });
    expect(fs.existsSync(dest)).toBe(true);
    cleanupDbFiles(dest);
  });

  it("returns a safe error status, without throwing, when the backup write fails", async () => {
    const badDest = path.join(os.tmpdir(), `printplus-no-such-dir-${Date.now()}`, "backup.db");
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: badDest });

    const result = await handleBackupCreate(db);
    expect(result.status).toBe("error");
    expect((result as { message: string }).message).not.toMatch(/ENOENT|errno|stack/i);
  });
});

describe("handleBackupRestore", () => {
  let liveDbPath: string;
  let validBackupPath: string;
  let db: DatabaseSync;

  beforeEach(() => {
    vi.clearAllMocks();
    liveDbPath = tempDbPath("restore-live");
    validBackupPath = tempDbPath("restore-backup");
    db = createConnection(liveDbPath);
    runMigrations(db);

    const backupDb = createConnection(validBackupPath);
    runMigrations(backupDb);
    backupDb.close();
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // already closed by a restore test
    }
    cleanupDbFiles(liveDbPath);
    cleanupDbFiles(validBackupPath);
  });

  it("returns cancelled when the open dialog is cancelled, and never touches the live database", async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const result = await handleBackupRestore(db, liveDbPath);
    expect(result).toEqual({ status: "cancelled" });
    expect(showMessageBox).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
  });

  it("returns invalid, without confirming or restarting, when the selected file is not a valid backup", async () => {
    const junkPath = tempDbPath("junk");
    fs.writeFileSync(junkPath, "not a database");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [junkPath] });

    const result = await handleBackupRestore(db, liveDbPath);
    expect(result.status).toBe("invalid");
    expect(showMessageBox).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
    fs.unlinkSync(junkPath);
  });

  it("returns cancelled, without closing the database, when the destructive confirmation is declined", async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [validBackupPath] });
    showMessageBox.mockResolvedValue({ response: 0 }); // Cancel

    const result = await handleBackupRestore(db, liveDbPath);
    expect(result).toEqual({ status: "cancelled" });
    expect(relaunch).not.toHaveBeenCalled();
    // The live connection must still be open and usable.
    expect(() => db.prepare("SELECT 1").get()).not.toThrow();
  });

  it("closes the database, replaces the file, and restarts the app after confirmation", async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [validBackupPath] });
    showMessageBox.mockResolvedValue({ response: 1 }); // Restore and Restart

    await handleBackupRestore(db, liveDbPath);

    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(showErrorBox).not.toHaveBeenCalled();
  });

  it("shows an error dialog but still restarts, preserving recoverability, when replacement fails", async () => {
    // Force a failure by pointing at a backup path that vanishes between
    // validation and replacement.
    const vanishingPath = tempDbPath("vanishing");
    const vanishingDb = createConnection(vanishingPath);
    runMigrations(vanishingDb);
    vanishingDb.close();

    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [vanishingPath] });
    showMessageBox.mockImplementation(async () => {
      // Delete the backup file after validation passes but before replacement runs.
      cleanupDbFiles(vanishingPath);
      return { response: 1 };
    });

    await handleBackupRestore(db, liveDbPath);

    expect(showErrorBox).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);

    // The original live database must still be intact on disk.
    expect(fs.existsSync(liveDbPath)).toBe(true);
  });
});
