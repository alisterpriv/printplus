import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { listRates, updateRate, RateNotFoundError } from "./ratesRepository";

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
});
