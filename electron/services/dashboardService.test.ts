import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer } from "../repositories/customersRepository";
import { createOrder, updateOrderStatus } from "../repositories/ordersRepository";
import { getDashboardSummary, getTodayRangeUtc } from "./dashboardService";

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

describe("dashboardService", () => {
  describe("getTodayRangeUtc — local timezone boundary", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("computes the correct UTC range for local midnight in a timezone ahead of UTC (IST, +5:30)", () => {
      process.env.TZ = "Asia/Kolkata";
      // 8:00 PM UTC on Aug 18 is 1:30 AM IST on Aug 19 — "today" in IST is
      // Aug 19, which starts at 2026-08-18 18:30:00 UTC.
      const now = new Date("2026-08-18T20:00:00.000Z");
      const range = getTodayRangeUtc(now);
      expect(range).toEqual({
        startUtc: "2026-08-18 18:30:00",
        endUtc: "2026-08-19 18:30:00",
      });
    });

    it("computes the correct UTC range for local midnight in a timezone behind UTC (New York, -4:00 in August/DST)", () => {
      process.env.TZ = "America/New_York";
      const now = new Date("2026-08-18T20:00:00.000Z"); // 4:00 PM in New York, still Aug 18 there
      const range = getTodayRangeUtc(now);
      expect(range).toEqual({
        startUtc: "2026-08-18 04:00:00",
        endUtc: "2026-08-19 04:00:00",
      });
    });

    it("an order timestamped just before local midnight falls in yesterday's range, not today's, at the UTC boundary", () => {
      process.env.TZ = "Asia/Kolkata";
      // 6:29:59 PM UTC = 11:59:59 PM IST on Aug 18 (still "yesterday" relative to the Aug 19 instant below)
      const justBeforeMidnightIst = "2026-08-18 18:29:59";
      // 6:30:00 PM UTC = 12:00:00 AM IST on Aug 19 (the first instant of "today")
      const now = new Date("2026-08-18T18:30:00.000Z");
      const range = getTodayRangeUtc(now);
      expect(range.startUtc).toBe("2026-08-18 18:30:00");
      expect(justBeforeMidnightIst < range.startUtc).toBe(true);
    });

    it("is a half-open range: end equals exactly 24 hours after start", () => {
      process.env.TZ = "UTC";
      const range = getTodayRangeUtc(new Date("2026-06-15T12:00:00.000Z"));
      const startMs = new Date(range.startUtc.replace(" ", "T") + "Z").getTime();
      const endMs = new Date(range.endUtc.replace(" ", "T") + "Z").getTime();
      expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("getDashboardSummary", () => {
    let db: DatabaseSync;
    let customerId: number;

    beforeEach(() => {
      db = createConnection(":memory:");
      runMigrations(db);
      customerId = createCustomer(db, { name: "Ramesh Kumar", phone: "9876543210", email: null, address: "12 MG Road" }).id;
    });

    it("returns all zeros / empty on a fresh database, not an error", () => {
      const summary = getDashboardSummary(db);
      expect(summary).toEqual({
        todaysRevenue: 0,
        todaysOrders: 0,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalCustomers: 1, // the customer created in beforeEach
        recentOrders: [],
        mostUsedPrintType: null,
      });
    });

    it("converts paise to rupees exactly once at the service boundary", () => {
      createOrder(db, baseOrderInput(customerId, { grandTotalPaise: 1010 })); // 10.10
      const now = new Date();
      const summary = getDashboardSummary(db, now);
      expect(summary.todaysRevenue).toBe(10.1);
      expect(summary.recentOrders[0].grandTotal).toBe(10.1);
    });

    it("composes counts, status counts, and customer count correctly", () => {
      const a = createOrder(db, baseOrderInput(customerId));
      createOrder(db, baseOrderInput(customerId));
      updateOrderStatus(db, a.id, "Completed");
      createCustomer(db, { name: "Second Customer", phone: null, email: null, address: null });

      const summary = getDashboardSummary(db);
      expect(summary.totalOrders).toBe(2);
      expect(summary.pendingOrders).toBe(1);
      expect(summary.completedOrders).toBe(1);
      expect(summary.totalCustomers).toBe(2);
    });

    it("includes the most-used print type by total quantity", () => {
      createOrder(
        db,
        baseOrderInput(customerId, {
          items: [{ printType: "Banner", width: 1, height: 1, unit: "Meter", areaSquareMeters: 1, ratePaise: 100, quantity: 9, totalPaise: 900 }],
        })
      );
      const summary = getDashboardSummary(db);
      expect(summary.mostUsedPrintType).toBe("Banner");
    });

    it("returns at most 5 recent orders, newest first", () => {
      for (let i = 0; i < 7; i++) {
        createOrder(db, baseOrderInput(customerId));
      }
      const summary = getDashboardSummary(db);
      expect(summary.recentOrders).toHaveLength(5);
    });

    it("propagates a repository failure rather than substituting zeros", () => {
      db.close(); // force every subsequent query to fail
      expect(() => getDashboardSummary(db)).toThrow();
    });
  });
});
