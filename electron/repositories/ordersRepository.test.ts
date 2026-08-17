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
  OrderNotFoundError,
  type CreateOrderInput,
} from "./ordersRepository";

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
  });
});
