import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

/**
 * Ordered, append-only list of schema migrations. Each entry runs exactly
 * once against a given database (tracked in schema_migrations) — never
 * edit a migration that has already shipped; add a new one instead.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: "create_settings",
    up: (db) => {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    },
  },
];
