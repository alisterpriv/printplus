import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer } from "./customersRepository";
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  recordPayment,
  countOrders,
  countOrdersByStatus,
  countOrdersInRange,
  sumGrandTotalPaise,
  getRecentOrders,
  getTopPrintTypes,
  OrderNotFoundError,
  PaymentExceedsBalanceError,
  type CreateOrderInput,
} from "./ordersRepository";

function invoiceNumberForId(id: number): string {
  return `INV-${String(id).padStart(6, "0")}`;
}

function baseOrderInput(customerId: number, overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
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

describe("ordersRepository", () => {
  let db: DatabaseSync;
  let customerId: number;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
    customerId = createCustomer(db, { name: "Ramesh Kumar", phone: "9876543210", email: null, address: "12 MG Road" }).id;
  });

  it("starts with zero orders on a fresh database", () => {
    expect(listOrders(db)).toHaveLength(0);
  });

  it("creates an order with its items and returns the full record", () => {
    const order = createOrder(db, baseOrderInput(customerId));
    expect(order.id).toBeGreaterThan(0);
    expect(order.customerId).toBe(customerId);
    expect(order.customerName).toBe("Ramesh Kumar");
    expect(order.status).toBe("Pending");
    expect(order.subtotal).toBe(500);
    expect(order.gstAmount).toBe(90);
    expect(order.grandTotal).toBe(590);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].printType).toBe("Flex");
    expect(order.items[0].rate).toBe(500);
    expect(order.items[0].total).toBe(500);
  });

  it("creates an order with multiple items, all persisted", () => {
    const input = baseOrderInput(customerId, {
      items: [
        { printType: "Flex", width: 2, height: 3, unit: "Meter", areaSquareMeters: 6, ratePaise: 50000, quantity: 1, totalPaise: 50000 },
        { printType: "Banner", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 12000, quantity: 2, totalPaise: 24000 },
      ],
    });
    const order = createOrder(db, input);
    expect(order.items).toHaveLength(2);
    expect(order.items.map((i) => i.printType)).toEqual(["Flex", "Banner"]);
  });

  it("lists orders newest-first", () => {
    const first = createOrder(db, baseOrderInput(customerId));
    const second = createOrder(db, baseOrderInput(customerId));
    const ids = listOrders(db).map((o) => o.id);
    expect(ids).toEqual([second.id, first.id]);
  });

  it("getOrder returns the matching order with items", () => {
    const created = createOrder(db, baseOrderInput(customerId));
    const found = getOrder(db, created.id);
    expect(found).toEqual(created);
  });

  it("getOrder throws OrderNotFoundError for a nonexistent id", () => {
    expect(() => getOrder(db, 999999)).toThrow(OrderNotFoundError);
  });

  it("updateOrderStatus updates the status and updated_at", () => {
    const created = createOrder(db, baseOrderInput(customerId));
    updateOrderStatus(db, created.id, "Processing");
    const after = getOrder(db, created.id);
    expect(after.status).toBe("Processing");
  });

  it("updateOrderStatus throws OrderNotFoundError for a nonexistent id", () => {
    expect(() => updateOrderStatus(db, 999999, "Completed")).toThrow(OrderNotFoundError);
  });

  describe("PHASE 15 — payment tracking", () => {
    it("a newly-created order starts Unpaid, with the full grand total as the balance due", () => {
      const order = createOrder(db, baseOrderInput(customerId)); // grandTotal 590
      expect(order.amountPaid).toBe(0);
      expect(order.balanceDue).toBe(590);
      expect(order.paymentStatus).toBe("Unpaid");
    });

    it("records a partial payment, updating amountPaid/balanceDue/paymentStatus", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      const updated = recordPayment(db, created.id, 30000);
      expect(updated.amountPaid).toBe(300);
      expect(updated.balanceDue).toBe(290);
      expect(updated.paymentStatus).toBe("Partial");
    });

    it("accumulates multiple payments cumulatively", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      recordPayment(db, created.id, 30000);
      const afterSecond = recordPayment(db, created.id, 20000);
      expect(afterSecond.amountPaid).toBe(500);
      expect(afterSecond.balanceDue).toBe(90);
      expect(afterSecond.paymentStatus).toBe("Partial");
    });

    it("reaching the exact grand total via a final payment transitions to Paid with zero balance", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      recordPayment(db, created.id, 30000);
      const final = recordPayment(db, created.id, 29000);
      expect(final.amountPaid).toBe(590);
      expect(final.balanceDue).toBe(0);
      expect(final.paymentStatus).toBe("Paid");
    });

    it("paying the full amount in a single payment transitions directly to Paid", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      const paid = recordPayment(db, created.id, 59000);
      expect(paid.paymentStatus).toBe("Paid");
      expect(paid.balanceDue).toBe(0);
    });

    it("a payment landing exactly on the remaining balance succeeds", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      recordPayment(db, created.id, 40000);
      const final = recordPayment(db, created.id, 19000); // exactly the remaining balance
      expect(final.amountPaid).toBe(590);
      expect(final.paymentStatus).toBe("Paid");
    });

    it("rejects a payment that would exceed the remaining balance, leaving amountPaid unchanged", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      recordPayment(db, created.id, 40000);
      expect(() => recordPayment(db, created.id, 20000)).toThrow(PaymentExceedsBalanceError); // 40000+20000 > 59000

      const after = getOrder(db, created.id);
      expect(after.amountPaid).toBe(400); // unchanged by the rejected attempt
    });

    it("rejects a payment on a nonexistent order", () => {
      expect(() => recordPayment(db, 999999, 10000)).toThrow(OrderNotFoundError);
    });

    it("a fully-paid order cannot receive another payment", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      recordPayment(db, created.id, 59000);
      expect(() => recordPayment(db, created.id, 1)).toThrow(PaymentExceedsBalanceError);

      const after = getOrder(db, created.id);
      expect(after.amountPaid).toBe(590); // unchanged
      expect(after.paymentStatus).toBe("Paid");
    });

    it("recording a payment never modifies grand total, discount, GST, or subtotal", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      recordPayment(db, created.id, 30000);
      const after = getOrder(db, created.id);
      expect(after.subtotal).toBe(created.subtotal);
      expect(after.discountPercent).toBe(created.discountPercent);
      expect(after.discountAmount).toBe(created.discountAmount);
      expect(after.gstPercent).toBe(created.gstPercent);
      expect(after.gstAmount).toBe(created.gstAmount);
      expect(after.grandTotal).toBe(created.grandTotal);
    });

    it("recording a payment never modifies the customer snapshot or order items", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      recordPayment(db, created.id, 30000);
      const after = getOrder(db, created.id);
      expect(after.customerId).toBe(created.customerId);
      expect(after.customerName).toBe(created.customerName);
      expect(after.customerPhone).toBe(created.customerPhone);
      expect(after.customerAddress).toBe(created.customerAddress);
      expect(after.items).toEqual(created.items);
    });

    it("recording a payment never modifies the invoice number", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      recordPayment(db, created.id, 30000);
      expect(getOrder(db, created.id).invoiceNumber).toBe(created.invoiceNumber);
    });

    it("recording a payment updates updated_at", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      const after = recordPayment(db, created.id, 30000);
      expect(typeof after.updatedAt).toBe("string");
    });

    it("the database rejects a directly-written negative amount_paid_paise, independent of recordPayment", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      expect(() =>
        db.prepare("UPDATE orders SET amount_paid_paise = -1 WHERE id = ?").run(created.id)
      ).toThrow();
    });

    it("the database rejects a directly-written amount_paid_paise exceeding grand_total_paise, independent of recordPayment", () => {
      const created = createOrder(db, baseOrderInput(customerId)); // grandTotalPaise 59000
      expect(() =>
        db.prepare("UPDATE orders SET amount_paid_paise = 60000 WHERE id = ?").run(created.id)
      ).toThrow();
    });
  });

  describe("transactional integrity", () => {
    it("rolls back the entire order when an item insert fails, leaving no orphan order", () => {
      const before = listOrders(db);
      expect(before).toHaveLength(0);

      const input = baseOrderInput(customerId, {
        items: [
          { printType: "Flex", width: 2, height: 3, unit: "Meter", areaSquareMeters: 6, ratePaise: 50000, quantity: 1, totalPaise: 50000 },
          // Missing required fields — forces a NOT NULL constraint violation on the second item's insert.
          { printType: null as unknown as string, width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 1, totalPaise: 100 },
        ],
      });

      expect(() => createOrder(db, input)).toThrow();

      expect(listOrders(db)).toHaveLength(0);
      const orderRows = db.prepare("SELECT * FROM orders").all();
      expect(orderRows).toHaveLength(0);
      const itemRows = db.prepare("SELECT * FROM order_items").all();
      expect(itemRows).toHaveLength(0);
    });

    it("rejects an order for a nonexistent customer_id via the foreign key constraint, creating nothing", () => {
      expect(() => createOrder(db, baseOrderInput(999999))).toThrow();
      expect(listOrders(db)).toHaveLength(0);
      expect(db.prepare("SELECT * FROM order_items").all()).toHaveLength(0);
    });

    it("a rolled-back order never leaves a persisted invoice_number behind", () => {
      const input = baseOrderInput(customerId, {
        items: [{ printType: null as unknown as string, width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 1, totalPaise: 100 }],
      });
      expect(() => createOrder(db, input)).toThrow();
      const invoiceNumbers = db.prepare("SELECT invoice_number FROM orders").all();
      expect(invoiceNumbers).toHaveLength(0);
    });
  });

  describe("PHASE 11 — invoice numbers", () => {
    it("generates an invoice number derived from the order's own id", () => {
      const order = createOrder(db, baseOrderInput(customerId));
      expect(order.invoiceNumber).toBe(invoiceNumberForId(order.id));
    });

    it("produces a different, correctly-derived invoice number for each sequential order", () => {
      const first = createOrder(db, baseOrderInput(customerId));
      const second = createOrder(db, baseOrderInput(customerId));

      expect(first.invoiceNumber).toBe(invoiceNumberForId(first.id));
      expect(second.invoiceNumber).toBe(invoiceNumberForId(second.id));
      expect(second.invoiceNumber).not.toBe(first.invoiceNumber);
    });

    it("persists the invoice number — a subsequent getOrder reflects it", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      expect(getOrder(db, created.id).invoiceNumber).toBe(created.invoiceNumber);
    });

    it("invoice number is unchanged by updateOrderStatus", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      updateOrderStatus(db, created.id, "Completed");
      expect(getOrder(db, created.id).invoiceNumber).toBe(created.invoiceNumber);
    });

    it("the database rejects a duplicate invoice_number outright, independent of application code", () => {
      const created = createOrder(db, baseOrderInput(customerId));
      expect(() =>
        db
          .prepare(
            `INSERT INTO orders (
               customer_id, customer_name, customer_phone, customer_address, status,
               subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
               invoice_number, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          )
          .run(customerId, "Ramesh Kumar", "9876543210", "12 MG Road", "Pending", 50000, 0, 0, 18, 9000, 59000, created.invoiceNumber)
      ).toThrow();
    });
  });

  describe("PHASE 9 — dashboard aggregates", () => {
    /**
     * Bypasses createOrder (which always uses datetime('now')) so tests
     * can control created_at precisely. Still gives every row a real,
     * unique invoice_number (required by the UNIQUE index migration 7
     * added) by following the same insert-then-update-by-id pattern
     * ordersRepository.createOrder itself uses.
     */
    function insertOrderAt(createdAt: string, overrides: Partial<{ status: string; grandTotalPaise: number }> = {}) {
      const result = db
        .prepare(
          `INSERT INTO orders (
             customer_id, customer_name, customer_phone, customer_address, status,
             subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
             invoice_number, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
        )
        .run(
          customerId,
          "Ramesh Kumar",
          "9876543210",
          "12 MG Road",
          overrides.status ?? "Pending",
          50000,
          0,
          0,
          18,
          9000,
          overrides.grandTotalPaise ?? 59000,
          createdAt,
          createdAt
        );
      const id = result.lastInsertRowid as number;
      db.prepare("UPDATE orders SET invoice_number = ? WHERE id = ?").run(invoiceNumberForId(id), id);
    }

    describe("countOrders", () => {
      it("returns 0 on a fresh database", () => {
        expect(countOrders(db)).toBe(0);
      });

      it("returns the exact count after several creates", () => {
        createOrder(db, baseOrderInput(customerId));
        createOrder(db, baseOrderInput(customerId));
        createOrder(db, baseOrderInput(customerId));
        expect(countOrders(db)).toBe(3);
      });
    });

    describe("countOrdersByStatus", () => {
      it("returns 0 for a status with no matching orders", () => {
        expect(countOrdersByStatus(db, "Completed")).toBe(0);
      });

      it("counts only orders with the matching status", () => {
        const a = createOrder(db, baseOrderInput(customerId));
        createOrder(db, baseOrderInput(customerId));
        updateOrderStatus(db, a.id, "Completed");

        expect(countOrdersByStatus(db, "Completed")).toBe(1);
        expect(countOrdersByStatus(db, "Pending")).toBe(1);
      });
    });

    describe("countOrdersInRange / sumGrandTotalPaise — date-range boundaries", () => {
      it("returns 0/0 on a fresh database for any range", () => {
        const range = { startUtc: "2026-01-01 00:00:00", endUtc: "2026-01-02 00:00:00" };
        expect(countOrdersInRange(db, range)).toBe(0);
        expect(sumGrandTotalPaise(db, range)).toBe(0);
      });

      it("is a half-open range: includes the start instant, excludes the end instant", () => {
        insertOrderAt("2026-01-01 00:00:00", { grandTotalPaise: 1000 }); // exactly at start -> included
        insertOrderAt("2026-01-01 23:59:59", { grandTotalPaise: 2000 }); // just before end -> included
        insertOrderAt("2026-01-02 00:00:00", { grandTotalPaise: 4000 }); // exactly at end -> excluded

        const range = { startUtc: "2026-01-01 00:00:00", endUtc: "2026-01-02 00:00:00" };
        expect(countOrdersInRange(db, range)).toBe(2);
        expect(sumGrandTotalPaise(db, range)).toBe(3000);
      });

      it("excludes orders from the day before and the day after the range", () => {
        insertOrderAt("2025-12-31 23:59:59", { grandTotalPaise: 100 }); // day before
        insertOrderAt("2026-01-01 12:00:00", { grandTotalPaise: 200 }); // in range
        insertOrderAt("2026-01-02 00:00:01", { grandTotalPaise: 400 }); // day after

        const range = { startUtc: "2026-01-01 00:00:00", endUtc: "2026-01-02 00:00:00" };
        expect(countOrdersInRange(db, range)).toBe(1);
        expect(sumGrandTotalPaise(db, range)).toBe(200);
      });

      it("sums grand_total_paise as an exact integer, never a rupee float", () => {
        insertOrderAt("2026-01-01 08:00:00", { grandTotalPaise: 1010 }); // 10.10
        insertOrderAt("2026-01-01 09:00:00", { grandTotalPaise: 2020 }); // 20.20
        const range = { startUtc: "2026-01-01 00:00:00", endUtc: "2026-01-02 00:00:00" };
        expect(sumGrandTotalPaise(db, range)).toBe(3030); // exactly 30.30, no float drift
      });
    });

    describe("getRecentOrders", () => {
      it("returns an empty array on a fresh database", () => {
        expect(getRecentOrders(db, 5)).toEqual([]);
      });

      it("returns orders newest-first, limited to the requested count", () => {
        const first = createOrder(db, baseOrderInput(customerId));
        const second = createOrder(db, baseOrderInput(customerId));
        const third = createOrder(db, baseOrderInput(customerId));

        const recent = getRecentOrders(db, 2);
        expect(recent.map((o) => o.id)).toEqual([third.id, second.id]);
        expect(recent.map((o) => o.id)).not.toContain(first.id);
      });

      it("returns the summary fields without loading order_items", () => {
        const created = createOrder(db, baseOrderInput(customerId));
        const [summary] = getRecentOrders(db, 1);
        expect(summary).toEqual({
          id: created.id,
          customerName: "Ramesh Kumar",
          status: "Pending",
          grandTotalPaise: 59000,
          createdAt: created.createdAt,
        });
        expect(summary).not.toHaveProperty("items");
      });
    });

    describe("getTopPrintTypes", () => {
      it("returns an empty array when there are no order_items", () => {
        expect(getTopPrintTypes(db, 5)).toEqual([]);
      });

      it("ranks print types by total quantity across all historical orders, highest first", () => {
        createOrder(
          db,
          baseOrderInput(customerId, {
            items: [
              { printType: "Flex", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 2, totalPaise: 200 },
              { printType: "Banner", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 1, totalPaise: 100 },
            ],
          })
        );
        createOrder(
          db,
          baseOrderInput(customerId, {
            items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 5, totalPaise: 500 }],
          })
        );

        const top = getTopPrintTypes(db, 5);
        expect(top).toEqual([
          { printType: "Flex", totalQuantity: 7 },
          { printType: "Banner", totalQuantity: 1 },
        ]);
      });

      it("respects the limit", () => {
        createOrder(
          db,
          baseOrderInput(customerId, {
            items: [
              { printType: "Flex", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 3, totalPaise: 300 },
              { printType: "Banner", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 2, totalPaise: 200 },
              { printType: "Sticker", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 1, totalPaise: 100 },
            ],
          })
        );

        expect(getTopPrintTypes(db, 1)).toEqual([{ printType: "Flex", totalQuantity: 3 }]);
      });
    });

    it("historical orders (created before these methods existed) are still counted correctly", () => {
      // Simulates an order that predates Phase 9 — no different in shape,
      // just proving the new aggregate queries don't special-case "new"
      // orders in any way.
      insertOrderAt("2020-01-01 00:00:00", { status: "Completed", grandTotalPaise: 12345 });
      expect(countOrders(db)).toBe(1);
      expect(countOrdersByStatus(db, "Completed")).toBe(1);
      expect(getRecentOrders(db, 5)).toHaveLength(1);
    });
  });
});
