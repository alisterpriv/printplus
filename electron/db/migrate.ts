import type { DatabaseSync } from "node:sqlite";
import { migrations as defaultMigrations, type Migration } from "./migrations";

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function appliedVersions(db: DatabaseSync): Set<number> {
  const rows = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
  return new Set(rows.map((row) => row.version));
}

/**
 * Applies any migration not yet recorded in schema_migrations, in
 * ascending version order, each wrapped in its own transaction. If a
 * migration throws, its transaction is rolled back and the error
 * propagates — no partial schema change is left behind, and the
 * migration is not recorded as applied.
 *
 * `migrationList` defaults to the real, shipped migration list; tests
 * pass a custom list to exercise failure/idempotency behavior in
 * isolation.
 */
export function runMigrations(db: DatabaseSync, migrationList: Migration[] = defaultMigrations): void {
  ensureMigrationsTable(db);
  const applied = appliedVersions(db);

  const pending = migrationList.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.exec("BEGIN");
    try {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))").run(
        migration.version
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
