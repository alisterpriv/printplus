import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { getBusinessSettings, updateBusinessSettings } from "./businessSettingsRepository";

describe("businessSettingsRepository", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("starts with a single seeded row: empty business name, null optional fields", () => {
    const settings = getBusinessSettings(db);
    expect(settings.businessName).toBe("");
    expect(settings.address).toBeNull();
    expect(settings.phone).toBeNull();
    expect(settings.email).toBeNull();
    expect(settings.gstin).toBeNull();
    expect(typeof settings.createdAt).toBe("string");
    expect(typeof settings.updatedAt).toBe("string");
  });

  it("updates the row and returns the persisted values", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "9876543210",
      email: "ramesh@example.com",
      gstin: "27ABCDE1234F1Z5",
    });

    expect(updated.businessName).toBe("Ramesh Printers");
    expect(updated.address).toBe("12 MG Road");
    expect(updated.phone).toBe("9876543210");
    expect(updated.email).toBe("ramesh@example.com");
    expect(updated.gstin).toBe("27ABCDE1234F1Z5");
  });

  it("persists the update — a subsequent get reflects it", () => {
    updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: null,
      gstin: null,
    });

    expect(getBusinessSettings(db).businessName).toBe("Ramesh Printers");
  });

  it("repeated updates overwrite the same row rather than accumulating", () => {
    updateBusinessSettings(db, { businessName: "First Name", address: null, phone: null, email: null, gstin: null });
    updateBusinessSettings(db, { businessName: "Second Name", address: null, phone: null, email: null, gstin: null });

    expect(getBusinessSettings(db).businessName).toBe("Second Name");
    const rows = db.prepare("SELECT * FROM business_settings").all();
    expect(rows).toHaveLength(1);
  });

  it("keeps id fixed at 1 after an update", () => {
    updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: null, email: null, gstin: null });
    const row = db.prepare("SELECT id FROM business_settings").get() as { id: number };
    expect(row.id).toBe(1);
  });

  it("never creates a second row, no matter how many updates run", () => {
    for (let i = 0; i < 5; i++) {
      updateBusinessSettings(db, { businessName: `Name ${i}`, address: null, phone: null, email: null, gstin: null });
    }
    const rows = db.prepare("SELECT * FROM business_settings").all();
    expect(rows).toHaveLength(1);
  });

  it("updates updated_at on save", () => {
    const before = getBusinessSettings(db).updatedAt;
    const after = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: null,
      gstin: null,
    }).updatedAt;
    expect(typeof before).toBe("string");
    expect(typeof after).toBe("string");
  });

  it("clears optional fields back to null when updated with null", () => {
    updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: "12 MG Road",
      phone: "123",
      email: "a@b.com",
      gstin: "27ABCDE1234F1Z5",
    });
    const cleared = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: null,
      gstin: null,
    });
    expect(cleared.address).toBeNull();
    expect(cleared.phone).toBeNull();
    expect(cleared.email).toBeNull();
    expect(cleared.gstin).toBeNull();
  });
});
