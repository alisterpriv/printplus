import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer } from "../repositories/customersRepository";
import { createOrder } from "../repositories/ordersRepository";
import { handleDashboardGetSummary } from "./dashboardHandlers";

describe("handleDashboardGetSummary", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("returns a valid summary for a fresh, empty database", () => {
    const summary = handleDashboardGetSummary(db);
    expect(summary.totalOrders).toBe(0);
    expect(summary.totalCustomers).toBe(0);
    expect(summary.recentOrders).toEqual([]);
    expect(summary.mostUsedPrintType).toBeNull();
  });

  it("returns real, correctly-composed data for a populated database", () => {
    const customerId = createCustomer(db, { name: "Ramesh", phone: "123", email: null, address: "Road" }).id;
    createOrder(db, {
      customerId,
      customerName: "Ramesh",
      customerPhone: "123",
      customerAddress: "Road",
      status: "Pending",
      subtotalPaise: 10000,
      discountPercent: 0,
      discountPaise: 0,
      gstPercent: 18,
      gstPaise: 1800,
      grandTotalPaise: 11800,
      items: [
        {
          printType: "Flex",
          width: 1,
          height: 1,
          unit: "Meter",
          areaSquareMeters: 1,
          ratePaise: 10000,
          quantity: 1,
          totalPaise: 10000,
        },
      ],
    });

    const summary = handleDashboardGetSummary(db);
    expect(summary.totalOrders).toBe(1);
    expect(summary.totalCustomers).toBe(1);
    expect(summary.pendingOrders).toBe(1);
    expect(summary.recentOrders).toHaveLength(1);
    expect(summary.recentOrders[0].grandTotal).toBe(118);
    expect(summary.mostUsedPrintType).toBe("Flex");
  });

  it("propagates a failure rather than returning a partially-zeroed summary", () => {
    db.close();
    expect(() => handleDashboardGetSummary(db)).toThrow();
  });
});
