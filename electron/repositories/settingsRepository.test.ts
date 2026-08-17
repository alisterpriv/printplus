import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { getSetting, setSetting } from "./settingsRepository";

describe("settingsRepository", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("returns undefined for a key that was never set", () => {
    expect(getSetting(db, "doesNotExist")).toBeUndefined();
  });

  it("round-trips a value through set then get", () => {
    setSetting(db, "shopName", "PrintPlus");
    expect(getSetting(db, "shopName")).toBe("PrintPlus");
  });

  it("updates an existing key rather than creating a duplicate row (upsert)", () => {
    setSetting(db, "shopName", "PrintPlus");
    setSetting(db, "shopName", "PrintPlus Updated");

    expect(getSetting(db, "shopName")).toBe("PrintPlus Updated");
    const rows = db.prepare("SELECT * FROM settings WHERE key = ?").all("shopName");
    expect(rows).toHaveLength(1);
  });

  it("stores an updated_at timestamp", () => {
    setSetting(db, "shopName", "PrintPlus");
    const row = db.prepare("SELECT updated_at FROM settings WHERE key = ?").get("shopName") as {
      updated_at: string;
    };
    expect(typeof row.updated_at).toBe("string");
    expect(row.updated_at.length).toBeGreaterThan(0);
  });

  it("keeps different keys independent", () => {
    setSetting(db, "shopName", "PrintPlus");
    setSetting(db, "gst", "18");
    expect(getSetting(db, "shopName")).toBe("PrintPlus");
    expect(getSetting(db, "gst")).toBe("18");
  });
});
