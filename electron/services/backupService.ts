import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "../db/migrations";

export interface BackupCreateResult {
  filePath: string;
}

/**
 * Uses node:sqlite's backup() — a thin wrapper around SQLite's own Online
 * Backup API (sqlite3_backup_init/step/finish) — rather than a raw file
 * copy. This connection runs in WAL mode (connection.ts), so a plain
 * fs.copyFile of the live .db file could miss committed data still
 * sitting in the -wal file; the Online Backup API reads through the WAL
 * correctly and produces a valid, standalone database even while this
 * same connection stays open and in active use. Verified empirically
 * against a live WAL-mode database with uncommitted-to-disk writes
 * before this was relied on here.
 */
export async function createBackup(db: DatabaseSync, destinationPath: string): Promise<BackupCreateResult> {
  await sqliteBackup(db, destinationPath);
  return { filePath: destinationPath };
}

const MAX_KNOWN_MIGRATION_VERSION = Math.max(...migrations.map((m) => m.version));

/** Thrown when a candidate restore file fails validation. */
export class InvalidBackupFileError extends Error {}

/**
 * Opens the candidate file read-only, in a connection completely separate
 * from the live database, and never writes to it. Confirms it is (a) a
 * structurally valid, non-corrupt SQLite database via PRAGMA
 * integrity_check, and (b) a PrintPlus database whose schema this exact
 * app version understands — a backup whose highest applied migration is
 * newer than anything in this build's migrations.ts is rejected outright,
 * since running this app's code against schema it doesn't know about is
 * unsafe. An older-but-valid backup is accepted: the normal startup
 * runMigrations() pass will catch it up after restore, the same way it
 * already does for any pre-existing database.
 */
export function validateBackupFile(filePath: string): void {
  let checkDb: DatabaseSync;
  try {
    checkDb = new DatabaseSync(filePath, { readOnly: true });
  } catch {
    throw new InvalidBackupFileError("The selected file could not be opened.");
  }

  try {
    let integrity: { integrity_check: string };
    try {
      integrity = checkDb.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    } catch {
      throw new InvalidBackupFileError("The selected file is not a valid database.");
    }
    if (integrity.integrity_check !== "ok") {
      throw new InvalidBackupFileError("The selected file failed a database integrity check.");
    }

    let maxVersion: number;
    try {
      const row = checkDb.prepare("SELECT MAX(version) as maxVersion FROM schema_migrations").get() as {
        maxVersion: number | null;
      };
      maxVersion = row.maxVersion ?? -1;
    } catch {
      throw new InvalidBackupFileError("The selected file is not a PrintPlus backup.");
    }
    if (maxVersion < 0) {
      throw new InvalidBackupFileError("The selected file is not a PrintPlus backup.");
    }
    if (maxVersion > MAX_KNOWN_MIGRATION_VERSION) {
      throw new InvalidBackupFileError(
        "This backup was created by a newer version of PrintPlus and cannot be restored here."
      );
    }
  } finally {
    checkDb.close();
  }
}

export interface RestoreResult {
  restoredPath: string;
}

/** Thrown when replacing the live database file fails. */
export class RestoreFailedError extends Error {}

function removeIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function sidecarSuffixes(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`];
}

/**
 * Replaces the live database file with an already-validated backup.
 * Never mutates the live file in place:
 *
 *   1. Copy the backup to a temp file alongside the live database, and
 *      re-run validateBackupFile against that copy (defense in depth
 *      against a truncated/failed copy, e.g. from a full disk).
 *   2. Move the live database (and any -wal/-shm sidecars) aside to a
 *      pre-restore-<timestamp> path — not deleted.
 *   3. Atomically rename the verified temp file into the live path.
 *
 * If step 2 or 3 fails, the moved-aside original is renamed straight
 * back before this function throws, so a failed restore never leaves the
 * app without a working database at dbPath. If even that rollback fails,
 * the thrown error names the pre-restore path as a manual recovery
 * location — deliberately, since a shop's only copy of its data being
 * findable is more important here than the app's usual "never surface a
 * filesystem path" convention (see backupHandlers.ts for that
 * convention's normal application).
 *
 * The moved-aside original is deliberately left on disk even on success
 * — this is a one-shot safety net for *this* restore operation, not a
 * backup-history feature (explicitly out of scope for this phase).
 *
 * The caller is responsible for closing `db` before calling this (file
 * replacement must not race an open connection) and for restarting the
 * application afterward, in every outcome, so the next startup's normal
 * runMigrations() pass reopens whatever ends up at dbPath — the restored
 * backup on success, or the recovered original on failure.
 */
export function replaceLiveDatabase(dbPath: string, validatedBackupPath: string): RestoreResult {
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const tmpPath = path.join(dir, `${base}.restoring-tmp`);
  const preRestorePath = path.join(dir, `${base}.pre-restore-${Date.now()}`);

  removeIfExists(tmpPath);
  try {
    fs.copyFileSync(validatedBackupPath, tmpPath);
    validateBackupFile(tmpPath);
  } catch (error) {
    removeIfExists(tmpPath);
    throw new RestoreFailedError(
      error instanceof InvalidBackupFileError
        ? `The backup could not be copied into place: ${error.message}`
        : "The backup could not be copied into place."
    );
  }

  const movedAsideSidecars: [live: string, asidePath: string][] = [];
  try {
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, preRestorePath);
    }
    for (const sidecar of sidecarSuffixes(dbPath)) {
      if (fs.existsSync(sidecar)) {
        const asideSidecar = `${preRestorePath}${sidecar.slice(dbPath.length)}`;
        fs.renameSync(sidecar, asideSidecar);
        movedAsideSidecars.push([sidecar, asideSidecar]);
      }
    }

    fs.renameSync(tmpPath, dbPath);
  } catch (error) {
    let rolledBack = true;
    try {
      if (!fs.existsSync(dbPath) && fs.existsSync(preRestorePath)) {
        fs.renameSync(preRestorePath, dbPath);
      }
      for (const [original, asideSidecar] of movedAsideSidecars) {
        if (!fs.existsSync(original) && fs.existsSync(asideSidecar)) {
          fs.renameSync(asideSidecar, original);
        }
      }
    } catch {
      rolledBack = false;
    }
    removeIfExists(tmpPath);

    const detail = error instanceof Error ? error.message : "Unknown error.";
    throw new RestoreFailedError(
      rolledBack
        ? `Restore failed; your original data was restored. ${detail}`
        : `Restore failed and automatic recovery also failed. Your original database was preserved at ${preRestorePath}. ${detail}`
    );
  }

  return { restoredPath: dbPath };
}
