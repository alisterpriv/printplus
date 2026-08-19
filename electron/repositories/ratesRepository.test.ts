import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer } from "./customersRepository";
import { createOrder } from "./ordersRepository";
import {
  listRates,
  updateRate,
  createRate,
  deleteRate,
  RateNotFoundError,
  DuplicatePrintTypeError,
} from "./ratesRepository";

describe("ratesRepository", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("lists all 8 seeded rates", () => {
    expect(listRates(db)).toHaveLength(8);
  });

  it("preserves the seeded id order, not alphabetical order", () => {
    const printTypes = listRates(db).map((r) => r.printType);
    expect(printTypes).toEqual([
      "Flex",
      "Banner",
      "Vinyl",
      "Sunboard",
      "Canvas",
      "Sticker",
      "Backlit",
      "One Way Vision",
    ]);
  });

  it("converts stored paise back to rupees correctly", () => {
    const flex = listRates(db).find((r) => r.printType === "Flex")!;
    expect(flex.rate).toBe(10);
  });

  it("updates only the targeted rate, leaving others untouched", () => {
    const before = listRates(db);
    const flex = before.find((r) => r.printType === "Flex")!;
    const banner = before.find((r) => r.printType === "Banner")!;

    updateRate(db, flex.id, 550);

    const after = listRates(db);
    expect(after.find((r) => r.id === flex.id)!.rate).toBe(550);
    expect(after.find((r) => r.id === banner.id)!.rate).toBe(banner.rate);
  });

  it("updates the updated_at timestamp", () => {
    const target = listRates(db)[0];
    updateRate(db, target.id, 999);
    const after = listRates(db).find((r) => r.id === target.id)!;
    expect(typeof after.updatedAt).toBe("string");
    expect(after.updatedAt.length).toBeGreaterThan(0);
  });

  it("throws RateNotFoundError for a nonexistent id", () => {
    expect(() => updateRate(db, 999999, 100)).toThrow(RateNotFoundError);
  });

  it("round-trips a typical decimal rupee value through paise without drift", () => {
    const target = listRates(db)[0];
    updateRate(db, target.id, 12.5);
    const after = listRates(db).find((r) => r.id === target.id)!;
    expect(after.rate).toBe(12.5);
  });

  it("rounds sub-paisa input to the nearest paisa (documented, not hidden)", () => {
    const target = listRates(db)[0];
    updateRate(db, target.id, 10.999);
    const after = listRates(db).find((r) => r.id === target.id)!;
    expect(after.rate).toBe(11);
  });

  describe("PHASE 19 — createRate", () => {
    it("creates a new rate and returns the full persisted record", () => {
      const created = createRate(db, "Foam Board", 25);
      expect(created.id).toBeGreaterThan(0);
      expect(created.printType).toBe("Foam Board");
      expect(created.rate).toBe(25);
      expect(typeof created.createdAt).toBe("string");
      expect(typeof created.updatedAt).toBe("string");
    });

    it("persists the new rate — a subsequent listRates includes it", () => {
      createRate(db, "Foam Board", 25);
      expect(listRates(db)).toHaveLength(9);
      expect(listRates(db).map((r) => r.printType)).toContain("Foam Board");
    });

    it("round-trips a decimal rupee value through paise without drift", () => {
      const created = createRate(db, "Foam Board", 12.5);
      expect(created.rate).toBe(12.5);
    });

    it("rejects a duplicate print type with DuplicatePrintTypeError, creating nothing", () => {
      expect(() => createRate(db, "Flex", 999)).toThrow(DuplicatePrintTypeError);
      expect(listRates(db)).toHaveLength(8); // unchanged — no partial insert
    });

    it("leaves existing rates completely untouched", () => {
      const before = listRates(db);
      createRate(db, "Foam Board", 25);
      const after = listRates(db);
      for (const rate of before) {
        expect(after.find((r) => r.id === rate.id)).toEqual(rate);
      }
    });
  });

  describe("PHASE 19 — deleteRate", () => {
    it("deletes an existing rate", () => {
      const target = listRates(db)[0];
      deleteRate(db, target.id);
      expect(listRates(db)).toHaveLength(7);
      expect(listRates(db).find((r) => r.id === target.id)).toBeUndefined();
    });

    it("throws RateNotFoundError for a nonexistent id, deleting nothing", () => {
      expect(() => deleteRate(db, 999999)).toThrow(RateNotFoundError);
      expect(listRates(db)).toHaveLength(8);
    });

    it("leaves other rates completely untouched", () => {
      const target = listRates(db)[0];
      const other = listRates(db)[1];
      deleteRate(db, target.id);
      expect(listRates(db).find((r) => r.id === other.id)).toEqual(other);
    });

    describe("historical data invariant", () => {
      it("deleting a rate does not affect a historical order's item — printType, price, and totals are unchanged", () => {
        const customerId = createCustomer(db, { name: "Ramesh", phone: null, email: null, address: null }).id;
        const flex = listRates(db).find((r) => r.printType === "Flex")!;

        const order = createOrder(db, {
          customerId,
          customerName: "Ramesh",
          customerPhone: null,
          customerAddress: null,
          status: "Pending",
          subtotalPaise: 1000,
          discountPercent: 0,
          discountPaise: 0,
          gstPercent: 18,
          gstPaise: 180,
          grandTotalPaise: 1180,
          items: [
            {
              printType: flex.printType,
              width: 2,
              height: 3,
              unit: "Meter",
              areaSquareMeters: 6,
              ratePaise: 1000,
              quantity: 1,
              totalPaise: 1000,
            },
          ],
        });

        deleteRate(db, flex.id);

        // The rate is gone...
        expect(listRates(db).find((r) => r.printType === "Flex")).toBeUndefined();

        // ...but the historical order item is completely untouched.
        const itemRow = db.prepare("SELECT * FROM order_items WHERE order_id = ?").get(order.id) as {
          print_type: string;
          rate_paise: number;
          total_paise: number;
        };
        expect(itemRow.print_type).toBe("Flex");
        expect(itemRow.rate_paise).toBe(1000);
        expect(itemRow.total_paise).toBe(1000);
        expect(order.items[0].printType).toBe("Flex");
        expect(order.items[0].total).toBe(10);
        expect(order.grandTotal).toBe(11.8);
      });
    });
  });
});
