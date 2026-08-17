import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  getCustomerById,
  CustomerNotFoundError,
} from "./customersRepository";

describe("customersRepository", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("starts with zero customers on a fresh database", () => {
    expect(listCustomers(db)).toHaveLength(0);
  });

  it("creates a customer with all fields and returns it", () => {
    const created = createCustomer(db, {
      name: "Ramesh Kumar",
      phone: "9876543210",
      email: "ramesh@example.com",
      address: "12 MG Road",
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Ramesh Kumar");
    expect(created.phone).toBe("9876543210");
    expect(created.email).toBe("ramesh@example.com");
    expect(created.address).toBe("12 MG Road");
    expect(typeof created.createdAt).toBe("string");
    expect(typeof created.updatedAt).toBe("string");
  });

  it("creates a customer with only a name, leaving optional fields null", () => {
    const created = createCustomer(db, { name: "Suresh", phone: null, email: null, address: null });
    expect(created.phone).toBeNull();
    expect(created.email).toBeNull();
    expect(created.address).toBeNull();
  });

  it("lists customers in id order", () => {
    createCustomer(db, { name: "First", phone: null, email: null, address: null });
    createCustomer(db, { name: "Second", phone: null, email: null, address: null });
    const names = listCustomers(db).map((c) => c.name);
    expect(names).toEqual(["First", "Second"]);
  });

  it("allows two customers with the same name (no uniqueness constraint)", () => {
    createCustomer(db, { name: "Ramesh", phone: null, email: null, address: null });
    createCustomer(db, { name: "Ramesh", phone: null, email: null, address: null });
    expect(listCustomers(db)).toHaveLength(2);
  });

  it("allows two customers with the same phone number", () => {
    createCustomer(db, { name: "Family Member A", phone: "9999999999", email: null, address: null });
    createCustomer(db, { name: "Family Member B", phone: "9999999999", email: null, address: null });
    expect(listCustomers(db)).toHaveLength(2);
  });

  it("updates only the targeted customer, leaving others untouched", () => {
    const first = createCustomer(db, { name: "First", phone: null, email: null, address: null });
    const second = createCustomer(db, { name: "Second", phone: null, email: null, address: null });

    updateCustomer(db, first.id, { name: "First Updated", phone: "111", email: null, address: null });

    const after = listCustomers(db);
    expect(after.find((c) => c.id === first.id)!.name).toBe("First Updated");
    expect(after.find((c) => c.id === second.id)!.name).toBe("Second");
  });

  it("updates the updated_at timestamp", () => {
    const created = createCustomer(db, { name: "First", phone: null, email: null, address: null });
    updateCustomer(db, created.id, { name: "First", phone: null, email: null, address: null });
    const after = listCustomers(db).find((c) => c.id === created.id)!;
    expect(typeof after.updatedAt).toBe("string");
    expect(after.updatedAt.length).toBeGreaterThan(0);
  });

  it("throws CustomerNotFoundError for a nonexistent id", () => {
    expect(() =>
      updateCustomer(db, 999999, { name: "Nobody", phone: null, email: null, address: null })
    ).toThrow(CustomerNotFoundError);
  });

  it("getCustomerById returns the matching customer", () => {
    const created = createCustomer(db, { name: "Ramesh", phone: "123", email: null, address: "Road" });
    const found = getCustomerById(db, created.id);
    expect(found).toEqual(created);
  });

  it("getCustomerById throws CustomerNotFoundError for a nonexistent id", () => {
    expect(() => getCustomerById(db, 999999)).toThrow(CustomerNotFoundError);
  });
});
