import { describe, it, expect } from "vitest";
import { createConnection } from "./connection";
import { runMigrations } from "./migrate";
import { migrations as realMigrations, type Migration } from "./migrations";

describe("runMigrations", () => {
  it("applies migration 1 to a fresh database and creates the settings table", () => {
    const db = createConnection(":memory:");
    runMigrations(db, [realMigrations[0]]);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it("records the applied migration version", () => {
    const db = createConnection(":memory:");
    runMigrations(db, [realMigrations[0]]);
    const rows = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
    expect(rows.map((r) => r.version)).toEqual([1]);
    db.close();
  });

  it("is safe to run twice and does not re-run an already-applied migration", () => {
    const db = createConnection(":memory:");
    let callCount = 0;
    const tracked: Migration[] = [
      {
        version: 1,
        name: "create_settings",
        up: (d) => {
          callCount++;
          d.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
        },
      },
    ];

    runMigrations(db, tracked);
    runMigrations(db, tracked);

    expect(callCount).toBe(1);
    const rows = db.prepare("SELECT version FROM schema_migrations").all();
    expect(rows).toHaveLength(1);
    db.close();
  });

  it("rolls back a failing migration's own transaction and does not record it as applied", () => {
    const db = createConnection(":memory:");
    const failing: Migration[] = [
      {
        version: 1,
        name: "broken",
        up: (d) => {
          d.exec("CREATE TABLE broken_table (id INTEGER PRIMARY KEY)");
          d.exec("THIS IS NOT VALID SQL");
        },
      },
    ];

    expect(() => runMigrations(db, failing)).toThrow();

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'broken_table'").all();
    expect(tables).toHaveLength(0);

    const applied = db.prepare("SELECT * FROM schema_migrations").all();
    expect(applied).toHaveLength(0);
    db.close();
  });

  it("applies only newly added migrations on top of an already-migrated database", () => {
    const db = createConnection(":memory:");
    runMigrations(db, [realMigrations[0]]);

    let secondCalled = false;
    const withSecond: Migration[] = [
      realMigrations[0],
      {
        version: 2,
        name: "add_test_table",
        up: (d) => {
          secondCalled = true;
          d.exec("CREATE TABLE test_table_v2 (id INTEGER PRIMARY KEY)");
        },
      },
    ];

    runMigrations(db, withSecond);
    expect(secondCalled).toBe(true);
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
    db.close();
  });
});

describe("the real, shipped migration list (v1 settings + v2 rates)", () => {
  it("creates both settings and rates tables from a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'rates')")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual(["rates", "settings"]);
    db.close();
  });

  it("records both migration versions", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 2));
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
    db.close();
  });

  it("seeds exactly 8 rates, in the original hardcoded order, on a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const rows = db.prepare("SELECT print_type FROM rates ORDER BY id ASC").all() as { print_type: string }[];
    expect(rows.map((r) => r.print_type)).toEqual([
      "Flex",
      "Banner",
      "Vinyl",
      "Sunboard",
      "Canvas",
      "Sticker",
      "Backlit",
      "One Way Vision",
    ]);
    db.close();
  });

  it("upgrades an existing v1-only database (simulating a real prior install) by applying only migration 2", () => {
    const db = createConnection(":memory:");
    runMigrations(db, [realMigrations[0]]);

    const ratesTableBefore = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rates'")
      .all();
    expect(ratesTableBefore).toHaveLength(0);

    runMigrations(db, realMigrations.slice(0, 2)); // v1+v2 list — should apply only the newly-pending migration 2

    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual([1, 2]);

    const rates = db.prepare("SELECT * FROM rates").all();
    expect(rates).toHaveLength(8);
    db.close();
  });

  it("running the full list twice is safe and does not duplicate seed data", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    runMigrations(db);
    const rates = db.prepare("SELECT * FROM rates").all();
    expect(rates).toHaveLength(8);
    db.close();
  });
});

describe("the real, shipped migration list (v1 settings + v2 rates + v3 customers)", () => {
  it("creates the settings, rates, and customers tables from a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'rates', 'customers')")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual(["customers", "rates", "settings"]);
    db.close();
  });

  it("records all three migration versions", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 3));
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    db.close();
  });

  it("creates an empty customers table on a fresh database (no invented seed data)", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const customers = db.prepare("SELECT * FROM customers").all();
    expect(customers).toHaveLength(0);
    db.close();
  });

  it("does not disturb settings or rates data when adding migration 3", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 2));
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(
      "phase3Test",
      "still here"
    );

    runMigrations(db, realMigrations.slice(0, 3)); // v1+v2+v3 list — should apply only the newly-pending migration 3

    const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'phase3Test'").get() as
      | { value: string }
      | undefined;
    expect(settingRow?.value).toBe("still here");

    const rates = db.prepare("SELECT * FROM rates").all();
    expect(rates).toHaveLength(8);

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
    db.close();
  });

  it("running the full list twice is safe and does not duplicate anything", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    runMigrations(db);
    const customers = db.prepare("SELECT * FROM customers").all();
    const rates = db.prepare("SELECT * FROM rates").all();
    expect(customers).toHaveLength(0);
    expect(rates).toHaveLength(8);
    db.close();
  });
});

describe("the real, shipped migration list (v1-v4, orders)", () => {
  it("creates the orders and order_items tables from a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('orders', 'order_items')")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual(["order_items", "orders"]);
    db.close();
  });

  it("records migration versions 1 through 4 among the applied set", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    db.close();
  });

  it("creates empty orders/order_items tables on a fresh database (no invented seed data)", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    expect(db.prepare("SELECT * FROM orders").all()).toHaveLength(0);
    expect(db.prepare("SELECT * FROM order_items").all()).toHaveLength(0);
    db.close();
  });

  it("upgrades an existing v1+v2+v3 database (simulating a real prior install) by applying only migration 4", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 3));

    const before = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'")
      .all();
    expect(before).toHaveLength(0);

    runMigrations(db); // full, real list — applies migration 4 (and any later ones) on top of 1-3

    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((r) => r.version)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    db.close();
  });

  it("does not disturb settings, rates, or customers data when adding migration 4", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 3));
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(
      "phase3Test",
      "still here"
    );
    db.prepare(
      "INSERT INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run("Ramesh", "123", null, "Road");

    runMigrations(db);

    const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'phase3Test'").get() as
      | { value: string }
      | undefined;
    expect(settingRow?.value).toBe("still here");
    expect(db.prepare("SELECT * FROM rates").all()).toHaveLength(8);
    expect(db.prepare("SELECT * FROM customers").all()).toHaveLength(1);
    db.close();
  });

  it("running the full list twice is safe and does not duplicate anything", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    runMigrations(db);
    expect(db.prepare("SELECT * FROM orders").all()).toHaveLength(0);
    expect(db.prepare("SELECT * FROM rates").all()).toHaveLength(8);
    db.close();
  });
});

describe("the real, shipped migration list (v1-v5, dashboard indexes)", () => {
  function indexNames(db: DatabaseSync): string[] {
    return (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all() as {
        name: string;
      }[]
    ).map((row) => row.name);
  }

  it("creates all three dashboard indexes on a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    expect(indexNames(db).sort()).toEqual(["idx_order_items_order_id", "idx_orders_created_at", "idx_orders_status"]);
    db.close();
  });

  it("records migration version 5 among the applied set", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((v) => v.version)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    db.close();
  });

  it("applies cleanly to an existing v1-v4 database (simulating a real prior install) by applying only migration 5", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 4));
    expect(indexNames(db)).toHaveLength(0);

    runMigrations(db); // full, real list — should apply only the newly-pending migration 5 (and any later ones)

    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((v) => v.version)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    expect(indexNames(db).sort()).toEqual(["idx_order_items_order_id", "idx_orders_created_at", "idx_orders_status"]);
    db.close();
  });

  it("leaves existing orders/order_items/customers/rates data untouched when adding the indexes", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 4));

    db.prepare(
      "INSERT INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run("Ramesh", "123", null, "Road");
    const customerId = db.prepare("SELECT id FROM customers WHERE name = 'Ramesh'").get() as { id: number };
    db.prepare(
      `INSERT INTO orders (
         customer_id, customer_name, customer_phone, customer_address, status,
         subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(customerId.id, "Ramesh", "123", "Road", "Pending", 5000, 0, 0, 18, 900, 5900);

    runMigrations(db); // applies migration 5 on top of existing real data

    expect(db.prepare("SELECT * FROM customers").all()).toHaveLength(1);
    expect(db.prepare("SELECT * FROM orders").all()).toHaveLength(1);
    expect(db.prepare("SELECT * FROM rates").all()).toHaveLength(8);
    db.close();
  });

  it("running the full list twice is safe and does not duplicate indexes", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    runMigrations(db);
    expect(indexNames(db).sort()).toEqual(["idx_order_items_order_id", "idx_orders_created_at", "idx_orders_status"]);
    db.close();
  });
});

describe("the real, shipped migration list (v1-v6, business_settings)", () => {
  it("creates the business_settings table on a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'business_settings'")
      .all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it("seeds exactly one row on a fresh database", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const rows = db.prepare("SELECT * FROM business_settings").all();
    expect(rows).toHaveLength(1);
    db.close();
  });

  it("seeds the row with id = 1", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const row = db.prepare("SELECT id FROM business_settings").get() as { id: number };
    expect(row.id).toBe(1);
    db.close();
  });

  it("seeds business_name as an empty string, not fabricated data", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const row = db.prepare("SELECT business_name FROM business_settings").get() as { business_name: string };
    expect(row.business_name).toBe("");
    db.close();
  });

  it("seeds optional fields as NULL", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const row = db.prepare("SELECT address, phone, email, gstin FROM business_settings").get() as {
      address: string | null;
      phone: string | null;
      email: string | null;
      gstin: string | null;
    };
    expect(row.address).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.email).toBeNull();
    expect(row.gstin).toBeNull();
    db.close();
  });

  it("records migration version 6 among the applied set", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((v) => v.version)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    db.close();
  });

  it("applies cleanly to an existing v1-v5 database (simulating a real prior install) by applying only migration 6", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 5));

    const before = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'business_settings'")
      .all();
    expect(before).toHaveLength(0);

    runMigrations(db); // full, real list — should apply only the newly-pending migration 6

    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(rows.map((v) => v.version)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    expect(db.prepare("SELECT * FROM business_settings").all()).toHaveLength(1);
    db.close();
  });

  it("leaves existing customers/orders/rates/settings data untouched when adding business_settings", () => {
    const db = createConnection(":memory:");
    runMigrations(db, realMigrations.slice(0, 5));

    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(
      "phase10Test",
      "still here"
    );
    db.prepare(
      "INSERT INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run("Ramesh", "123", null, "Road");

    runMigrations(db); // applies migration 6 on top of existing real data

    const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'phase10Test'").get() as
      | { value: string }
      | undefined;
    expect(settingRow?.value).toBe("still here");
    expect(db.prepare("SELECT * FROM customers").all()).toHaveLength(1);
    expect(db.prepare("SELECT * FROM rates").all()).toHaveLength(8);
    db.close();
  });

  it("running the full list twice is safe and does not duplicate the business_settings row", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    runMigrations(db);
    expect(db.prepare("SELECT * FROM business_settings").all()).toHaveLength(1);
    db.close();
  });
});
