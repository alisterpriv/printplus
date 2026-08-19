import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  validateCustomerId,
  validateCustomerInput,
  handleCustomersList,
  handleCustomersCreate,
  handleCustomersUpdate,
  handleCustomersGetSummary,
  InvalidCustomerRequestError,
} from "./customersHandlers";
import { InvalidCustomerValueError } from "../services/customersService";
import { CustomerNotFoundError } from "../repositories/customersRepository";

describe("validateCustomerId", () => {
  it("accepts a positive integer", () => {
    expect(validateCustomerId(1)).toBe(1);
  });

  it("rejects a non-number", () => {
    expect(() => validateCustomerId("1")).toThrow(InvalidCustomerRequestError);
    expect(() => validateCustomerId(null)).toThrow(InvalidCustomerRequestError);
    expect(() => validateCustomerId(undefined)).toThrow(InvalidCustomerRequestError);
  });

  it("rejects a non-integer", () => {
    expect(() => validateCustomerId(1.5)).toThrow(InvalidCustomerRequestError);
  });

  it("rejects zero and negative values", () => {
    expect(() => validateCustomerId(0)).toThrow(InvalidCustomerRequestError);
    expect(() => validateCustomerId(-1)).toThrow(InvalidCustomerRequestError);
  });
});

describe("validateCustomerInput", () => {
  it("accepts a fully-populated payload", () => {
    const input = validateCustomerInput({ name: "Ramesh", phone: "123", email: "a@b.com", address: "Road" });
    expect(input).toEqual({ name: "Ramesh", phone: "123", email: "a@b.com", address: "Road" });
  });

  it("treats missing optional fields as null", () => {
    const input = validateCustomerInput({ name: "Ramesh" });
    expect(input).toEqual({ name: "Ramesh", phone: null, email: null, address: null });
  });

  it("rejects a payload with a non-string name", () => {
    expect(() => validateCustomerInput({ name: 123 })).toThrow(InvalidCustomerRequestError);
    expect(() => validateCustomerInput({})).toThrow(InvalidCustomerRequestError);
  });

  it("rejects a payload with a non-string optional field", () => {
    expect(() => validateCustomerInput({ name: "Ramesh", phone: 123 })).toThrow(InvalidCustomerRequestError);
  });

  it("rejects a non-object payload", () => {
    expect(() => validateCustomerInput("not an object")).toThrow(InvalidCustomerRequestError);
    expect(() => validateCustomerInput(null)).toThrow(InvalidCustomerRequestError);
  });
});

describe("handleCustomersList / handleCustomersCreate / handleCustomersUpdate", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("lists customers (empty on a fresh database)", () => {
    expect(handleCustomersList(db)).toHaveLength(0);
  });

  it("creates a customer through the full handler logic", () => {
    const created = handleCustomersCreate(db, { name: "Ramesh", phone: "123", email: null, address: null });
    expect(handleCustomersList(db)).toHaveLength(1);
    expect(created.name).toBe("Ramesh");
  });

  it("updates a customer through the full handler logic", () => {
    const created = handleCustomersCreate(db, { name: "Ramesh", phone: null, email: null, address: null });
    handleCustomersUpdate(db, { id: created.id, name: "Ramesh Updated", phone: null, email: null, address: null });
    expect(handleCustomersList(db)[0].name).toBe("Ramesh Updated");
  });

  it("rejects a malformed create payload before touching the database", () => {
    expect(() => handleCustomersCreate(db, "not an object")).toThrow(InvalidCustomerRequestError);
    expect(() => handleCustomersCreate(db, null)).toThrow(InvalidCustomerRequestError);
    expect(() => handleCustomersCreate(db, {})).toThrow(InvalidCustomerRequestError);
  });

  it("rejects a malformed update payload before touching the database", () => {
    expect(() => handleCustomersUpdate(db, "not an object")).toThrow(InvalidCustomerRequestError);
    expect(() => handleCustomersUpdate(db, { name: "Ramesh" })).toThrow(InvalidCustomerRequestError);
  });

  it("propagates a business-rule rejection from the service", () => {
    expect(() => handleCustomersCreate(db, { name: "", phone: null, email: null, address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("propagates CustomerNotFoundError for a nonexistent id", () => {
    expect(() =>
      handleCustomersUpdate(db, { id: 999999, name: "Nobody", phone: null, email: null, address: null })
    ).toThrow(CustomerNotFoundError);
  });

  describe("PHASE 17 — handleCustomersGetSummary", () => {
    it("returns zero state on a fresh database", () => {
      expect(handleCustomersGetSummary(db)).toEqual({ activeThisMonth: 0, newThisMonth: 0, avgOrderValue: 0 });
    });

    it("returns the correct response shape", () => {
      handleCustomersCreate(db, { name: "Ramesh", phone: null, email: null, address: null });
      const summary = handleCustomersGetSummary(db);
      expect(summary).toHaveProperty("activeThisMonth");
      expect(summary).toHaveProperty("newThisMonth");
      expect(summary).toHaveProperty("avgOrderValue");
      expect(typeof summary.activeThisMonth).toBe("number");
      expect(typeof summary.newThisMonth).toBe("number");
      expect(typeof summary.avgOrderValue).toBe("number");
    });

    it("newThisMonth reflects a customer just created through the handler", () => {
      handleCustomersCreate(db, { name: "Ramesh", phone: null, email: null, address: null });
      expect(handleCustomersGetSummary(db).newThisMonth).toBe(1);
    });
  });
});
