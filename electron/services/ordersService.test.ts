import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer, updateCustomer, CustomerNotFoundError } from "../repositories/customersRepository";
import { updateRate, listRates } from "../repositories/ratesRepository";
import { OrderNotFoundError } from "../repositories/ordersRepository";
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  recordPayment,
  getOrdersSummary,
  getTodayRangeUtc,
  InvalidOrderValueError,
  ORDER_STATUSES,
  type NewOrderInput,
} from "./ordersService";

function baseInput(customerId: number, overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return {
    customerId,
    items: [{ printType: "Flex", width: 2, height: 3, unit: "Meter", rate: 500, quantity: 1 }],
    discountPercent: 0,
    gstPercent: 18,
    ...overrides,
  };
}

describe("ordersService", () => {
  let db: DatabaseSync;
  let customerId: number;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
    customerId = createCustomer(db, { name: "Ramesh", phone: "123", email: null, address: "Road" }).id;
  });

  it("lists orders via the repository", () => {
    expect(listOrders(db)).toHaveLength(0);
  });

  it("creates a valid order, defaulting status to Pending", () => {
    const order = createOrder(db, baseInput(customerId));
    expect(order.status).toBe("Pending");
    expect(order.customerId).toBe(customerId);
  });

  it("recomputes area and total using pricing.ts, matching the documented formula", () => {
    const order = createOrder(
      db,
      baseInput(customerId, {
        items: [{ printType: "Flex", width: 2, height: 3, unit: "Meter", rate: 500, quantity: 2 }],
      })
    );
    // area = 2 * 3 * 1 * 1 = 6 sq meters; total = 6 * 500 * 2 = 6000
    expect(order.items[0].areaSquareMeters).toBe(6);
    expect(order.items[0].total).toBe(6000);
  });

  it("applies unit conversion identically to pricing.ts (Centimeter)", () => {
    const order = createOrder(
      db,
      baseInput(customerId, {
        items: [{ printType: "Flex", width: 100, height: 100, unit: "Centimeter", rate: 10, quantity: 1 }],
      })
    );
    // 100cm * 0.01 = 1m per side; area = 1 * 1 = 1 sq meter
    expect(order.items[0].areaSquareMeters).toBe(1);
  });

  it("computes subtotal/discount/gst/grandTotal via calculateBillSummary, matching Create Bill's sequence", () => {
    const order = createOrder(
      db,
      baseInput(customerId, {
        items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 100, quantity: 1 }],
        discountPercent: 10,
        gstPercent: 18,
      })
    );
    expect(order.subtotal).toBe(100);
    expect(order.discountAmount).toBe(10);
    expect(order.gstAmount).toBeCloseTo(16.2, 5); // (100-10) * 18%
    expect(order.grandTotal).toBeCloseTo(106.2, 5);
  });

  it("rejects an order with zero items", () => {
    expect(() => createOrder(db, baseInput(customerId, { items: [] }))).toThrow(InvalidOrderValueError);
  });

  it("propagates CustomerNotFoundError for a nonexistent customer id", () => {
    expect(() => createOrder(db, baseInput(999999))).toThrow(CustomerNotFoundError);
  });

  describe("PHASE 8 — item validation", () => {
    it("rejects a zero width", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 0, height: 3, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative width", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: -2, height: 3, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a zero height", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 2, height: 0, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative height", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 2, height: -3, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("accepts decimal dimensions", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 2.5, height: 1.25, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).not.toThrow();
    });

    it("rejects a dimension above the sanity ceiling (normalized to meters)", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1001, height: 1, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a dimension above the sanity ceiling even in a small unit (Centimeter)", () => {
      // 1000 meters = 100,000 cm — one cm over that should still be rejected.
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 100_001, height: 1, unit: "Centimeter", rate: 500, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("accepts a dimension exactly at the sanity ceiling", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1000, height: 1, unit: "Meter", rate: 500, quantity: 1 }],
          })
        )
      ).not.toThrow();
    });

    it("rejects a zero rate", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 0, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative rate", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: -10, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a rate above the shared MAX_RATE ceiling", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 1_000_001, quantity: 1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("accepts a rate exactly at the MAX_RATE ceiling", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 1_000_000, quantity: 1 }],
          })
        )
      ).not.toThrow();
    });

    it("rejects a zero quantity", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 0 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative quantity", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: -1 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a fractional quantity instead of silently truncating it", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 2.5 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("rejects a quantity above the sanity ceiling", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 100_001 }],
          })
        )
      ).toThrow(InvalidOrderValueError);
    });

    it("accepts a quantity exactly at the sanity ceiling", () => {
      expect(() =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 100_000 }],
          })
        )
      ).not.toThrow();
    });
  });

  describe("PHASE 8 — discount/GST validation", () => {
    it("accepts 0% discount and 0% GST", () => {
      expect(() => createOrder(db, baseInput(customerId, { discountPercent: 0, gstPercent: 0 }))).not.toThrow();
    });

    it("accepts 100% discount and 100% GST", () => {
      expect(() => createOrder(db, baseInput(customerId, { discountPercent: 100, gstPercent: 100 }))).not.toThrow();
    });

    it("rejects a negative discount", () => {
      expect(() => createOrder(db, baseInput(customerId, { discountPercent: -1 }))).toThrow(InvalidOrderValueError);
    });

    it("rejects a discount above 100", () => {
      expect(() => createOrder(db, baseInput(customerId, { discountPercent: 101 }))).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative GST", () => {
      expect(() => createOrder(db, baseInput(customerId, { gstPercent: -1 }))).toThrow(InvalidOrderValueError);
    });

    it("rejects a GST above 100", () => {
      expect(() => createOrder(db, baseInput(customerId, { gstPercent: 101 }))).toThrow(InvalidOrderValueError);
    });
  });

  describe("PHASE 8 — deterministic paise-integer money", () => {
    it("produces a grand total that exactly equals subtotal - discount + gst, for float-drift-prone inputs", () => {
      // 10.10 + 20.20 famously does not equal a clean 30.30 in IEEE-754 —
      // this is the exact scenario the paise-integer summary math (rather
      // than a rupee-float round trip) is meant to make deterministic.
      const order = createOrder(
        db,
        baseInput(customerId, {
          items: [
            { printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 10.1, quantity: 1 },
            { printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 20.2, quantity: 1 },
          ],
          discountPercent: 10,
          gstPercent: 18,
        })
      );
      const subtotalPaise = Math.round(order.subtotal * 100);
      const discountPaise = Math.round(order.discountAmount * 100);
      const gstPaise = Math.round(order.gstAmount * 100);
      const grandTotalPaise = Math.round(order.grandTotal * 100);
      expect(grandTotalPaise).toBe(subtotalPaise - discountPaise + gstPaise);
      expect(subtotalPaise).toBe(3030); // 10.10 + 20.20 = 30.30 exactly, in paise
    });

    it("rounding is deterministic across repeated identical calls", () => {
      const makeOrder = () =>
        createOrder(
          db,
          baseInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 33.335, quantity: 3 }],
            discountPercent: 12.5,
            gstPercent: 18,
          })
        );
      const first = makeOrder();
      const second = makeOrder();
      expect(second.grandTotal).toBe(first.grandTotal);
      expect(second.gstAmount).toBe(first.gstAmount);
    });
  });

  it("rounds rupee amounts to the nearest paisa at the persistence boundary", () => {
    const order = createOrder(
      db,
      baseInput(customerId, {
        items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 10.999, quantity: 1 }],
      })
    );
    expect(order.items[0].total).toBe(11);
  });

  describe("status", () => {
    it("accepts each of the three known statuses", () => {
      const order = createOrder(db, baseInput(customerId));
      for (const status of ORDER_STATUSES) {
        expect(() => updateOrderStatus(db, order.id, status)).not.toThrow();
      }
    });

    it("rejects an unknown status", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(() => updateOrderStatus(db, order.id, "Cancelled")).toThrow(InvalidOrderValueError);
    });

    it("propagates OrderNotFoundError for a nonexistent order id", () => {
      expect(() => updateOrderStatus(db, 999999, "Completed")).toThrow(OrderNotFoundError);
    });
  });

  describe("historical rate", () => {
    it("an order keeps the rate actually charged, even after the current rate changes", () => {
      const flex = listRates(db).find((r) => r.printType === "Flex")!;
      updateRate(db, flex.id, 500); // Flex = ₹500 at order time

      const order = createOrder(
        db,
        baseInput(customerId, {
          items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 1 }],
        })
      );
      expect(order.items[0].rate).toBe(500);

      updateRate(db, flex.id, 650); // Flex changes afterward

      const reloaded = getOrder(db, order.id);
      expect(reloaded.items[0].rate).toBe(500); // unaffected by the later rate change
      expect(listRates(db).find((r) => r.printType === "Flex")!.rate).toBe(650); // current rate really did change
    });
  });

  describe("PHASE 15 — recordPayment", () => {
    // baseInput's default single item (2m x 3m Flex @ ₹500) => subtotal 3000,
    // gst 18% = 540, grandTotal 3540.

    it("records a valid partial payment and returns updated payment fields", () => {
      const order = createOrder(db, baseInput(customerId));
      const updated = recordPayment(db, order.id, 1000);
      expect(updated.amountPaid).toBe(1000);
      expect(updated.balanceDue).toBe(2540);
      expect(updated.paymentStatus).toBe("Partial");
    });

    it("converts a decimal rupee amount to paise without float drift", () => {
      const order = createOrder(db, baseInput(customerId));
      const updated = recordPayment(db, order.id, 10.5);
      expect(updated.amountPaid).toBe(10.5);
    });

    it("rejects a zero payment amount", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(() => recordPayment(db, order.id, 0)).toThrow(InvalidOrderValueError);
    });

    it("rejects a negative payment amount", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(() => recordPayment(db, order.id, -50)).toThrow(InvalidOrderValueError);
    });

    it("rejects a non-finite payment amount (NaN)", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(() => recordPayment(db, order.id, NaN)).toThrow(InvalidOrderValueError);
    });

    it("rejects a non-finite payment amount (Infinity)", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(() => recordPayment(db, order.id, Infinity)).toThrow(InvalidOrderValueError);
    });

    it("rejects a payment amount that exceeds the current balance, with a friendly message naming the balance", () => {
      const order = createOrder(db, baseInput(customerId)); // grandTotal 3540
      expect(() => recordPayment(db, order.id, 4000)).toThrow(InvalidOrderValueError);
      try {
        recordPayment(db, order.id, 4000);
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).toMatch(/balance due of ₹3540\.00/);
      }
    });

    it("rejects a payment that exceeds the balance after a prior partial payment reduces it", () => {
      const order = createOrder(db, baseInput(customerId)); // grandTotal 3540
      recordPayment(db, order.id, 3000);
      expect(() => recordPayment(db, order.id, 1000)).toThrow(InvalidOrderValueError); // only 540 remains
    });

    it("reaching the full grand total transitions paymentStatus to Paid", () => {
      const order = createOrder(db, baseInput(customerId)); // grandTotal 3540
      const paid = recordPayment(db, order.id, 3540);
      expect(paid.paymentStatus).toBe("Paid");
      expect(paid.balanceDue).toBe(0);
    });

    it("propagates OrderNotFoundError for a nonexistent order id", () => {
      expect(() => recordPayment(db, 999999, 100)).toThrow(OrderNotFoundError);
    });

    it("an already fully-paid order rejects any further payment", () => {
      const order = createOrder(db, baseInput(customerId));
      recordPayment(db, order.id, 3540);
      expect(() => recordPayment(db, order.id, 1)).toThrow();
    });

    it("does not modify grand total, discount, or GST when recording a payment", () => {
      const order = createOrder(db, baseInput(customerId));
      const updated = recordPayment(db, order.id, 1000);
      expect(updated.grandTotal).toBe(order.grandTotal);
      expect(updated.discountAmount).toBe(order.discountAmount);
      expect(updated.gstAmount).toBe(order.gstAmount);
    });
  });

  describe("PHASE 16 — getTodayRangeUtc (duplicated from dashboardService.ts)", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("computes the correct UTC range for local midnight in a timezone ahead of UTC (IST, +5:30)", () => {
      process.env.TZ = "Asia/Kolkata";
      const now = new Date("2026-08-18T20:00:00.000Z");
      const range = getTodayRangeUtc(now);
      expect(range).toEqual({ startUtc: "2026-08-18 18:30:00", endUtc: "2026-08-19 18:30:00" });
    });

    it("computes the correct UTC range for local midnight in a timezone behind UTC (New York)", () => {
      process.env.TZ = "America/New_York";
      const now = new Date("2026-08-18T20:00:00.000Z");
      const range = getTodayRangeUtc(now);
      expect(range).toEqual({ startUtc: "2026-08-18 04:00:00", endUtc: "2026-08-19 04:00:00" });
    });
  });

  describe("PHASE 16 — getOrdersSummary", () => {
    it("returns zero state on a fresh database", () => {
      expect(getOrdersSummary(db)).toEqual({ totalRevenue: 0, todaysOrders: 0 });
    });

    it("converts paise to rupees exactly once at the service boundary", () => {
      // subtotal 10.10 -> subtotalPaise 1010; gst 18% -> round(1010*0.18)=182 paise (₹1.82); grandTotal 1192 paise = ₹11.92.
      createOrder(db, baseInput(customerId, { items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 10.1, quantity: 1 }] }));
      expect(getOrdersSummary(db).totalRevenue).toBe(11.92);
    });

    it("totalRevenue sums every order's grand total, regardless of creation date", () => {
      createOrder(db, baseInput(customerId));
      createOrder(db, baseInput(customerId));
      const summary = getOrdersSummary(db, new Date());
      expect(summary.totalRevenue).toBeCloseTo(3540 * 2, 5);
    });

    it("recording a payment does not change totalRevenue (booked value, not collected cash)", () => {
      const order = createOrder(db, baseInput(customerId)); // grandTotal 3540
      const before = getOrdersSummary(db).totalRevenue;
      recordPayment(db, order.id, 1000);
      const after = getOrdersSummary(db).totalRevenue;
      expect(after).toBe(before);
    });

    it("todaysOrders counts only orders created within today's local range", () => {
      const now = new Date();
      createOrder(db, baseInput(customerId)); // created "now" via datetime('now')
      const summary = getOrdersSummary(db, now);
      expect(summary.todaysOrders).toBe(1);
    });

    it("todaysOrders excludes historical orders from before today", () => {
      const result = db
        .prepare(
          `INSERT INTO orders (
             customer_id, customer_name, customer_phone, customer_address, status,
             subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
             invoice_number, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '2020-01-01 00:00:00', '2020-01-01 00:00:00')`
        )
        .run(customerId, "Ramesh", "123", "Road", "Pending", 50000, 0, 0, 18, 9000, 59000);
      const id = result.lastInsertRowid as number;
      db.prepare("UPDATE orders SET invoice_number = ? WHERE id = ?").run(`INV-${id}`, id);

      const summary = getOrdersSummary(db, new Date());
      expect(summary.todaysOrders).toBe(0);
      expect(summary.totalRevenue).toBeCloseTo(590, 5); // still counted in the all-time total
    });
  });

  describe("historical customer snapshot", () => {
    it("an order keeps the customer info as it was at creation time, even after the customer record changes", () => {
      const order = createOrder(db, baseInput(customerId));
      expect(order.customerAddress).toBe("Road");

      updateCustomer(db, customerId, { name: "Ramesh", phone: "123", email: null, address: "New Address" });

      const reloaded = getOrder(db, order.id);
      expect(reloaded.customerAddress).toBe("Road"); // unaffected by the later customer update
    });
  });
});
