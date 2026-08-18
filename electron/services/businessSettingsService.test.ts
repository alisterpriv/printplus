import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { getBusinessSettings, updateBusinessSettings, InvalidBusinessSettingsValueError } from "./businessSettingsService";

describe("businessSettingsService", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("reads the seeded default via the repository", () => {
    expect(getBusinessSettings(db).businessName).toBe("");
  });

  it("accepts valid minimal input (name only)", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: null,
      gstin: null,
    });
    expect(updated.businessName).toBe("Ramesh Printers");
  });

  it("rejects an empty business name", () => {
    expect(() =>
      updateBusinessSettings(db, { businessName: "", address: null, phone: null, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("rejects a whitespace-only business name", () => {
    expect(() =>
      updateBusinessSettings(db, { businessName: "   ", address: null, phone: null, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("trims whitespace from the business name before storing", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "  Ramesh Printers  ",
      address: null,
      phone: null,
      email: null,
      gstin: null,
    });
    expect(updated.businessName).toBe("Ramesh Printers");
  });

  it("rejects a business name longer than the sanity ceiling", () => {
    const tooLong = "A".repeat(201);
    expect(() =>
      updateBusinessSettings(db, { businessName: tooLong, address: null, phone: null, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("accepts a business name exactly at the sanity ceiling", () => {
    const atLimit = "A".repeat(200);
    expect(() =>
      updateBusinessSettings(db, { businessName: atLimit, address: null, phone: null, email: null, gstin: null })
    ).not.toThrow();
  });

  it("trims and stores the address", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: "  12 MG Road  ",
      phone: null,
      email: null,
      gstin: null,
    });
    expect(updated.address).toBe("12 MG Road");
  });

  it("rejects an address longer than the sanity ceiling", () => {
    const tooLong = "A".repeat(501);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: tooLong, phone: null, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("normalizes empty-string optional fields to null", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: "",
      phone: "",
      email: "",
      gstin: "",
    });
    expect(updated.address).toBeNull();
    expect(updated.phone).toBeNull();
    expect(updated.email).toBeNull();
    expect(updated.gstin).toBeNull();
  });

  it("normalizes whitespace-only optional fields to null", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: "   ",
      phone: "   ",
      email: "   ",
      gstin: "   ",
    });
    expect(updated.address).toBeNull();
    expect(updated.phone).toBeNull();
    expect(updated.email).toBeNull();
    expect(updated.gstin).toBeNull();
  });

  it("rejects a phone number longer than the sanity ceiling", () => {
    const tooLong = "1".repeat(21);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: tooLong, email: null, gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("accepts a phone number exactly at the sanity ceiling", () => {
    const atLimit = "1".repeat(20);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: atLimit, email: null, gstin: null })
    ).not.toThrow();
  });

  it("rejects an email with no '@'", () => {
    expect(() =>
      updateBusinessSettings(db, {
        businessName: "Ramesh Printers",
        address: null,
        phone: null,
        email: "not-an-email",
        gstin: null,
      })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("rejects an email with nothing before or after '@'", () => {
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: null, email: "@example.com", gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: null, email: "ramesh@", gstin: null })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("accepts a valid email", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: "shop@example.com",
      gstin: null,
    });
    expect(updated.email).toBe("shop@example.com");
  });

  it("rejects a GSTIN longer than the sanity ceiling", () => {
    const tooLong = "1".repeat(21);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: null, email: null, gstin: tooLong })
    ).toThrow(InvalidBusinessSettingsValueError);
  });

  it("accepts a GSTIN exactly at the sanity ceiling", () => {
    const atLimit = "1".repeat(20);
    expect(() =>
      updateBusinessSettings(db, { businessName: "Ramesh Printers", address: null, phone: null, email: null, gstin: atLimit })
    ).not.toThrow();
  });

  it("accepts a realistic 15-character GSTIN", () => {
    const updated = updateBusinessSettings(db, {
      businessName: "Ramesh Printers",
      address: null,
      phone: null,
      email: null,
      gstin: "27ABCDE1234F1Z5",
    });
    expect(updated.gstin).toBe("27ABCDE1234F1Z5");
  });

  it("does not modify the persisted settings when validation rejects the update", () => {
    updateBusinessSettings(db, { businessName: "Original Name", address: null, phone: null, email: null, gstin: null });
    try {
      updateBusinessSettings(db, { businessName: "", address: null, phone: null, email: null, gstin: null });
    } catch {
      // expected
    }
    expect(getBusinessSettings(db).businessName).toBe("Original Name");
  });
});
