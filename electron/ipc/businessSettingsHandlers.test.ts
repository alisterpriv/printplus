import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  validateBusinessSettingsInput,
  handleBusinessSettingsGet,
  handleBusinessSettingsUpdate,
  InvalidBusinessSettingsRequestError,
} from "./businessSettingsHandlers";
import { InvalidBusinessSettingsValueError } from "../services/businessSettingsService";

describe("validateBusinessSettingsInput", () => {
  it("accepts a fully-populated payload", () => {
    const input = validateBusinessSettingsInput({
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "123",
      email: "a@b.com",
      gstin: "27ABCDE1234F1Z5",
    });
    expect(input).toEqual({
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "123",
      email: "a@b.com",
      gstin: "27ABCDE1234F1Z5",
    });
  });

  it("treats missing optional fields as null", () => {
    const input = validateBusinessSettingsInput({ businessName: "Ramesh Printers" });
    expect(input).toEqual({ businessName: "Ramesh Printers", address: null, phone: null, email: null, gstin: null });
  });

  it("rejects a payload with a non-string business name", () => {
    expect(() => validateBusinessSettingsInput({ businessName: 123 })).toThrow(InvalidBusinessSettingsRequestError);
    expect(() => validateBusinessSettingsInput({})).toThrow(InvalidBusinessSettingsRequestError);
  });

  it("rejects a payload with a non-string optional field", () => {
    expect(() => validateBusinessSettingsInput({ businessName: "Ramesh Printers", phone: 123 })).toThrow(
      InvalidBusinessSettingsRequestError
    );
  });

  it("rejects a non-object payload", () => {
    expect(() => validateBusinessSettingsInput("not an object")).toThrow(InvalidBusinessSettingsRequestError);
    expect(() => validateBusinessSettingsInput(null)).toThrow(InvalidBusinessSettingsRequestError);
  });
});

describe("handleBusinessSettingsGet / handleBusinessSettingsUpdate", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("gets the seeded default on a fresh database", () => {
    const result = handleBusinessSettingsGet(db);
    expect(result.businessName).toBe("");
    expect(result.address).toBeNull();
  });

  it("updates through the full handler logic and returns the persisted shape", () => {
    const updated = handleBusinessSettingsUpdate(db, {
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "123",
      email: "a@b.com",
      gstin: "27ABCDE1234F1Z5",
    });
    expect(updated).toEqual({
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "123",
      email: "a@b.com",
      gstin: "27ABCDE1234F1Z5",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(handleBusinessSettingsGet(db).businessName).toBe("Ramesh Printers");
  });

  it("rejects a malformed update payload before touching the database", () => {
    expect(() => handleBusinessSettingsUpdate(db, "not an object")).toThrow(InvalidBusinessSettingsRequestError);
    expect(() => handleBusinessSettingsUpdate(db, null)).toThrow(InvalidBusinessSettingsRequestError);
    expect(() => handleBusinessSettingsUpdate(db, {})).toThrow(InvalidBusinessSettingsRequestError);
  });

  it("propagates a business-rule rejection from the service", () => {
    expect(() =>
      handleBusinessSettingsUpdate(db, { businessName: "", address: null, phone: null, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("does not leak internal error details when the database is unusable", () => {
    db.close();
    expect(() => handleBusinessSettingsGet(db)).toThrow();
  });
});
