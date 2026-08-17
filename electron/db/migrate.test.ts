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
    runMigrations(db);
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

    runMigrations(db); // full, real list — should apply only the newly-pending migration 3

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
