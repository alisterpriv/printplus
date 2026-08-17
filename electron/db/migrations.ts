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
  {
    version: 2,
    name: "create_rates",
    up: (db) => {
      db.exec(`
        CREATE TABLE rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          print_type TEXT NOT NULL,
          rate_paise INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (print_type)
        )
      `);

      // Seeds the same 8 rates RateSettings.tsx has always hardcoded, so a
      // fresh install looks identical to today's out-of-box experience.
      // Order matters here only for readability — display order is
      // preserved by the repository's "ORDER BY id ASC", not this list.
      const insert = db.prepare(
        `INSERT INTO rates (print_type, rate_paise, created_at, updated_at)
         VALUES (?, ?, datetime('now'), datetime('now'))`
      );
      const defaultRates: [string, number][] = [
        ["Flex", 1000],
        ["Banner", 1200],
        ["Vinyl", 1500],
        ["Sunboard", 1800],
        ["Canvas", 2000],
        ["Sticker", 800],
        ["Backlit", 2500],
        ["One Way Vision", 2200],
      ];
      for (const [printType, ratePaise] of defaultRates) {
        insert.run(printType, ratePaise);
      }
    },
  },
];
