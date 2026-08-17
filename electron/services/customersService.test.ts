import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { listCustomers, createCustomer, updateCustomerValue, InvalidCustomerValueError } from "./customersService";
import { CustomerNotFoundError } from "../repositories/customersRepository";

describe("customersService", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("lists customers via the repository", () => {
    expect(listCustomers(db)).toHaveLength(0);
  });

  it("creates a valid customer", () => {
    const created = createCustomer(db, { name: "Ramesh", phone: "9876543210", email: "r@example.com", address: "Road" });
    expect(created.name).toBe("Ramesh");
  });

  it("trims whitespace from name before storing", () => {
    const created = createCustomer(db, { name: "  Ramesh  ", phone: null, email: null, address: null });
    expect(created.name).toBe("Ramesh");
  });

  it("rejects an empty name", () => {
    expect(() => createCustomer(db, { name: "", phone: null, email: null, address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("rejects a whitespace-only name", () => {
    expect(() => createCustomer(db, { name: "   ", phone: null, email: null, address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("normalizes an empty-string optional field to null", () => {
    const created = createCustomer(db, { name: "Ramesh", phone: "", email: "", address: "" });
    expect(created.phone).toBeNull();
    expect(created.email).toBeNull();
    expect(created.address).toBeNull();
  });

  it("accepts a customer with no optional fields at all", () => {
    expect(() => createCustomer(db, { name: "Ramesh", phone: null, email: null, address: null })).not.toThrow();
  });

  it("rejects an email with no '@'", () => {
    expect(() => createCustomer(db, { name: "Ramesh", phone: null, email: "not-an-email", address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("rejects an email with nothing before or after '@'", () => {
    expect(() => createCustomer(db, { name: "Ramesh", phone: null, email: "@example.com", address: null })).toThrow(
      InvalidCustomerValueError
    );
    expect(() => createCustomer(db, { name: "Ramesh", phone: null, email: "ramesh@", address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("accepts a phone number with a leading zero or a '+' prefix (stored as text, no reformatting)", () => {
    const created = createCustomer(db, { name: "Ramesh", phone: "+91 09876543210", email: null, address: null });
    expect(created.phone).toBe("+91 09876543210");
  });

  it("rejects a phone number longer than the sanity ceiling", () => {
    const tooLong = "1".repeat(21);
    expect(() => createCustomer(db, { name: "Ramesh", phone: tooLong, email: null, address: null })).toThrow(
      InvalidCustomerValueError
    );
  });

  it("accepts a phone number exactly at the sanity ceiling", () => {
    const atLimit = "1".repeat(20);
    expect(() => createCustomer(db, { name: "Ramesh", phone: atLimit, email: null, address: null })).not.toThrow();
  });

  it("propagates CustomerNotFoundError for a nonexistent id on update", () => {
    expect(() =>
      updateCustomerValue(db, 999999, { name: "Nobody", phone: null, email: null, address: null })
    ).toThrow(CustomerNotFoundError);
  });

  it("does not modify the customer when validation rejects the update", () => {
    const created = createCustomer(db, { name: "Original", phone: null, email: null, address: null });
    try {
      updateCustomerValue(db, created.id, { name: "", phone: null, email: null, address: null });
    } catch {
      // expected
    }
    expect(listCustomers(db).find((c) => c.id === created.id)!.name).toBe("Original");
  });
});
