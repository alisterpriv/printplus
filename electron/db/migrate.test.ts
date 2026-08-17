import { describe, it, expect } from "vitest";
import { createConnection } from "./connection";
import { runMigrations } from "./migrate";
import { migrations as realMigrations, type Migration } from "./migrations";

describe("runMigrations", () => {
  it("applies migration 1 to a fresh database and creates the settings table", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it("records the applied migration version", () => {
    const db = createConnection(":memory:");
    runMigrations(db);
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
