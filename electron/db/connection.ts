import { DatabaseSync } from "node:sqlite";

/**
 * Opens a SQLite connection with WAL journaling, foreign key
 * enforcement, and a busy timeout enabled.
 *
 * WAL has no effect on ":memory:" databases — SQLite silently reports
 * journal_mode "memory" in that case instead of "wal". This is expected
 * SQLite behavior, not a bug, and only matters for real file-backed
 * connections (see connection.test.ts).
 *
 * PHASE 20 — busy_timeout makes SQLite retry for up to 5 seconds instead
 * of immediately throwing SQLITE_BUSY when a write finds the database
 * momentarily locked by another connection, rather than failing the
 * operation outright. Defense in depth alongside Phase 20's single-
 * instance lock, which is the primary mechanism preventing two live
 * connections to the same file in the first place.
 */
export function createConnection(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}
