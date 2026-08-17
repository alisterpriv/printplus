import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  validateKey,
  validateValue,
  handleSettingsGet,
  handleSettingsSet,
  InvalidSettingInputError,
} from "./settingsHandlers";

describe("validateKey", () => {
  it("accepts a normal key", () => {
    expect(validateKey("shopName")).toBe("shopName");
  });

  it("rejects an empty string", () => {
    expect(() => validateKey("")).toThrow(InvalidSettingInputError);
  });

  it("rejects a non-string", () => {
    expect(() => validateKey(123)).toThrow(InvalidSettingInputError);
    expect(() => validateKey(null)).toThrow(InvalidSettingInputError);
    expect(() => validateKey(undefined)).toThrow(InvalidSettingInputError);
  });

  it("rejects disallowed characters", () => {
    expect(() => validateKey("shop name; DROP TABLE settings")).toThrow(InvalidSettingInputError);
  });

  it("rejects an over-long key", () => {
    expect(() => validateKey("a".repeat(101))).toThrow(InvalidSettingInputError);
  });
});

describe("validateValue", () => {
  it("accepts a normal string", () => {
    expect(validateValue("PrintPlus")).toBe("PrintPlus");
  });

  it("accepts an empty string as a valid value", () => {
    expect(validateValue("")).toBe("");
  });

  it("rejects a non-string", () => {
    expect(() => validateValue(42)).toThrow(InvalidSettingInputError);
  });

  it("rejects an over-long value", () => {
    expect(() => validateValue("x".repeat(10001))).toThrow(InvalidSettingInputError);
  });
});

describe("handleSettingsGet / handleSettingsSet", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("round-trips a value through the full handler logic", () => {
    handleSettingsSet(db, { key: "shopName", value: "PrintPlus" });
    expect(handleSettingsGet(db, "shopName")).toBe("PrintPlus");
  });

  it("returns null for a missing key", () => {
    expect(handleSettingsGet(db, "doesNotExist")).toBeNull();
  });

  it("rejects a get with an invalid key before touching the database", () => {
    expect(() => handleSettingsGet(db, "bad key with spaces")).toThrow(InvalidSettingInputError);
  });

  it("rejects a set with a malformed payload", () => {
    expect(() => handleSettingsSet(db, "not an object")).toThrow(InvalidSettingInputError);
    expect(() => handleSettingsSet(db, null)).toThrow(InvalidSettingInputError);
    expect(() => handleSettingsSet(db, { key: "ok" })).toThrow(InvalidSettingInputError);
  });
});
