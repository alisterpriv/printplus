import { DatabaseSync } from "node:sqlite";

/**
 * Opens a SQLite connection with WAL journaling and foreign key
 * enforcement enabled.
 *
 * WAL has no effect on ":memory:" databases — SQLite silently reports
 * journal_mode "memory" in that case instead of "wal". This is expected
 * SQLite behavior, not a bug, and only matters for real file-backed
 * connections (see connection.test.ts).
 */
export function createConnection(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
