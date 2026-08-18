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
  {
    version: 3,
    name: "create_customers",
    up: (db) => {
      // No seed data here, unlike rates: there is no existing hardcoded
      // customer list to preserve continuity with, and inventing sample
      // customers would misrepresent a real shop's data. A fresh install
      // simply starts with zero customers.
      db.exec(`
        CREATE TABLE customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    },
  },
  {
    version: 4,
    name: "create_orders",
    up: (db) => {
      // order_items has no foreign key to rates: it stores the price
      // actually charged at order time (rate_paise), not a live reference
      // that would silently change if a rate is edited later. This also
      // lets "Custom" print-type items persist, since Custom has no row
      // in rates at all.
      db.exec(`
        CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          customer_address TEXT,
          status TEXT NOT NULL,
          subtotal_paise INTEGER NOT NULL,
          discount_percent REAL NOT NULL,
          discount_paise INTEGER NOT NULL,
          gst_percent REAL NOT NULL,
          gst_paise INTEGER NOT NULL,
          grand_total_paise INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(id),
          print_type TEXT NOT NULL,
          width REAL NOT NULL,
          height REAL NOT NULL,
          unit TEXT NOT NULL,
          area_sq_meters REAL NOT NULL,
          rate_paise INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          total_paise INTEGER NOT NULL
        )
      `);
    },
  },
  {
    version: 5,
    name: "add_dashboard_indexes",
    up: (db) => {
      // Purely additive — no data change, safe on a database that already
      // contains real orders/order_items. Added for Phase 9's dashboard
      // aggregate queries (status counts, date-range sums, recent-order
      // listing, per-order item lookups), which would otherwise be full
      // table scans.
      db.exec(`CREATE INDEX idx_orders_status ON orders(status)`);
      db.exec(`CREATE INDEX idx_orders_created_at ON orders(created_at)`);
      db.exec(`CREATE INDEX idx_order_items_order_id ON order_items(order_id)`);
    },
  },
];
