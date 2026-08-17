import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { getSettingValue, setSettingValue } from "./settingsService";

describe("settingsService", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("returns null (not undefined) for a missing key", () => {
    expect(getSettingValue(db, "doesNotExist")).toBeNull();
  });

  it("round-trips a value", () => {
    setSettingValue(db, "shopName", "PrintPlus");
    expect(getSettingValue(db, "shopName")).toBe("PrintPlus");
  });

  it("updates an existing value", () => {
    setSettingValue(db, "shopName", "PrintPlus");
    setSettingValue(db, "shopName", "PrintPlus Updated");
    expect(getSettingValue(db, "shopName")).toBe("PrintPlus Updated");
  });
});
