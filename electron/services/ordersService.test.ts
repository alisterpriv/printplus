import { describe, it, expect, beforeEach } from "vitest";
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

  it("does not reject a zero width — preserves the Phase 2 discovered billing issue rather than fixing it", () => {
    expect(() =>
      createOrder(
        db,
        baseInput(customerId, {
          items: [{ printType: "Flex", width: 0, height: 3, unit: "Meter", rate: 500, quantity: 1 }],
        })
      )
    ).not.toThrow();
  });

  it("does not reject a negative rate — preserves pricing.ts's documented pass-through behavior", () => {
    const order = createOrder(
      db,
      baseInput(customerId, {
        items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: -10, quantity: 1 }],
      })
    );
    expect(order.items[0].total).toBe(-10);
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
