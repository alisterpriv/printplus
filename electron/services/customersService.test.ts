import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  listCustomers,
  createCustomer,
  updateCustomerValue,
  getCustomersSummary,
  getThisMonthRangeUtc,
  InvalidCustomerValueError,
} from "./customersService";
import { CustomerNotFoundError } from "../repositories/customersRepository";
import { createOrder, recordPayment } from "../repositories/ordersRepository";

function baseOrderInput(customerId: number, overrides: Partial<Parameters<typeof createOrder>[1]> = {}) {
  return {
    customerId,
    customerName: "Ramesh Kumar",
    customerPhone: "9876543210",
    customerAddress: "12 MG Road",
    status: "Pending",
    subtotalPaise: 50000,
    discountPercent: 0,
    discountPaise: 0,
    gstPercent: 18,
    gstPaise: 9000,
    grandTotalPaise: 59000,
    items: [
      {
        printType: "Flex",
        width: 2,
        height: 3,
        unit: "Meter",
        areaSquareMeters: 6,
        ratePaise: 50000,
        quantity: 1,
        totalPaise: 50000,
      },
    ],
    ...overrides,
  };
}

/** Bypasses createOrder (always datetime('now')) so tests can control created_at precisely. */
function insertOrderAt(db: DatabaseSync, customerId: number, createdAt: string, grandTotalPaise = 59000) {
  const result = db
    .prepare(
      `INSERT INTO orders (
         customer_id, customer_name, customer_phone, customer_address, status,
         subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
         invoice_number, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
    )
    .run(customerId, "Ramesh Kumar", "9876543210", "12 MG Road", "Pending", 50000, 0, 0, 18, 9000, grandTotalPaise, createdAt, createdAt);
  const id = result.lastInsertRowid as number;
  db.prepare("UPDATE orders SET invoice_number = ? WHERE id = ?").run(`INV-${id}`, id);
}

/** Bypasses createCustomer (always datetime('now')) so tests can control created_at precisely. */
function insertCustomerAt(db: DatabaseSync, createdAt: string, name = "Backdated Customer"): number {
  const result = db
    .prepare(
      `INSERT INTO customers (name, phone, email, address, created_at, updated_at)
       VALUES (?, NULL, NULL, NULL, ?, ?)`
    )
    .run(name, createdAt, createdAt);
  return result.lastInsertRowid as number;
}

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

  describe("PHASE 17 — getThisMonthRangeUtc (duplicated from dashboardService.ts/ordersService.ts)", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("computes the correct UTC range for a local month in a timezone ahead of UTC (IST, +5:30)", () => {
      process.env.TZ = "Asia/Kolkata";
      // 8:00 PM UTC on Aug 18 is 1:30 AM IST on Aug 19 -> local month is August 2026,
      // which starts at 2026-07-31 18:30:00 UTC and ends 2026-08-31 18:30:00 UTC.
      const now = new Date("2026-08-18T20:00:00.000Z");
      const range = getThisMonthRangeUtc(now);
      expect(range).toEqual({ startUtc: "2026-07-31 18:30:00", endUtc: "2026-08-31 18:30:00" });
    });

    it("computes the correct UTC range for a local month in a timezone behind UTC (New York, -4:00 in August/DST)", () => {
      process.env.TZ = "America/New_York";
      const now = new Date("2026-08-18T20:00:00.000Z"); // 4:00 PM in New York, still August there
      const range = getThisMonthRangeUtc(now);
      expect(range).toEqual({ startUtc: "2026-08-01 04:00:00", endUtc: "2026-09-01 04:00:00" });
    });

    it("December correctly rolls over into January of the next year", () => {
      process.env.TZ = "UTC";
      const now = new Date("2026-12-10T12:00:00.000Z");
      const range = getThisMonthRangeUtc(now);
      expect(range).toEqual({ startUtc: "2026-12-01 00:00:00", endUtc: "2027-01-01 00:00:00" });
    });
  });

  describe("PHASE 17 — getCustomersSummary", () => {
    let customerId: number;

    beforeEach(() => {
      customerId = createCustomer(db, { name: "Ramesh Kumar", phone: "9876543210", email: null, address: "12 MG Road" }).id;
    });

    it("returns zero state on a database with only the customer created in beforeEach and no orders", () => {
      const summary = getCustomersSummary(db, new Date("2026-06-15T12:00:00.000Z"));
      // The beforeEach customer was created "now" (real time), not within the fixed reference month, so newThisMonth is 0.
      expect(summary.activeThisMonth).toBe(0);
      expect(summary.avgOrderValue).toBe(0);
    });

    it("converts average paise to rupees exactly once at the service boundary", () => {
      insertOrderAt(db, customerId, "2026-01-10 00:00:00", 1010); // 10.10
      const summary = getCustomersSummary(db, new Date("2026-01-15T00:00:00.000Z"));
      expect(summary.avgOrderValue).toBe(10.1);
    });

    it("activeThisMonth counts a customer with multiple orders in the month only once", () => {
      insertOrderAt(db, customerId, "2026-01-05 00:00:00");
      insertOrderAt(db, customerId, "2026-01-20 00:00:00");
      const summary = getCustomersSummary(db, new Date("2026-01-25T00:00:00.000Z"));
      expect(summary.activeThisMonth).toBe(1);
    });

    it("activeThisMonth excludes orders from a previous month", () => {
      insertOrderAt(db, customerId, "2025-12-31 23:59:59");
      const summary = getCustomersSummary(db, new Date("2026-01-15T00:00:00.000Z"));
      expect(summary.activeThisMonth).toBe(0);
    });

    it("newThisMonth counts customers created within the current local month", () => {
      insertCustomerAt(db, "2026-01-10 00:00:00", "New This Month");
      insertCustomerAt(db, "2025-12-31 23:59:59", "Not This Month");
      const summary = getCustomersSummary(db, new Date("2026-01-15T00:00:00.000Z"));
      expect(summary.newThisMonth).toBe(1);
    });

    it("avgOrderValue is all-time, unaffected by which month is 'current'", () => {
      insertOrderAt(db, customerId, "2020-01-01 00:00:00", 1000);
      insertOrderAt(db, customerId, "2026-06-15 00:00:00", 3000);
      const summary = getCustomersSummary(db, new Date("2026-06-20T00:00:00.000Z"));
      expect(summary.avgOrderValue).toBe(20); // (1000 + 3000) / 2 = 2000 paise = ₹20
    });

    it("avgOrderValue is unaffected by recordPayment — booked value, not collected cash", () => {
      const order = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      const before = getCustomersSummary(db).avgOrderValue;
      recordPayment(db, order.id, 30000);
      const after = getCustomersSummary(db).avgOrderValue;
      expect(after).toBe(before);
    });

    it("returns all three fields together in the correct shape", () => {
      insertOrderAt(db, customerId, "2026-03-05 00:00:00", 2000);
      insertCustomerAt(db, "2026-03-10 00:00:00", "New Customer");
      const summary = getCustomersSummary(db, new Date("2026-03-15T00:00:00.000Z"));
      expect(summary).toEqual({ activeThisMonth: 1, newThisMonth: 1, avgOrderValue: 20 });
    });
  });
});
