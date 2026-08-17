import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { listRates, updateRateValue, InvalidRateValueError } from "./ratesService";
import { RateNotFoundError } from "../repositories/ratesRepository";

describe("ratesService", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("lists rates via the repository", () => {
    expect(listRates(db)).toHaveLength(8);
  });

  it("accepts a valid rate update", () => {
    const target = listRates(db)[0];
    updateRateValue(db, target.id, 42.5);
    expect(listRates(db).find((r) => r.id === target.id)!.rate).toBe(42.5);
  });

  it("rejects a zero rate", () => {
    const target = listRates(db)[0];
    expect(() => updateRateValue(db, target.id, 0)).toThrow(InvalidRateValueError);
  });

  it("rejects a negative rate", () => {
    const target = listRates(db)[0];
    expect(() => updateRateValue(db, target.id, -5)).toThrow(InvalidRateValueError);
  });

  it("rejects a rate above the sanity ceiling", () => {
    const target = listRates(db)[0];
    expect(() => updateRateValue(db, target.id, 1_000_001)).toThrow(InvalidRateValueError);
  });

  it("accepts a rate exactly at the sanity ceiling", () => {
    const target = listRates(db)[0];
    expect(() => updateRateValue(db, target.id, 1_000_000)).not.toThrow();
  });

  it("propagates RateNotFoundError for a nonexistent id", () => {
    expect(() => updateRateValue(db, 999999, 100)).toThrow(RateNotFoundError);
  });

  it("does not modify the rate when validation rejects it", () => {
    const target = listRates(db)[0];
    const originalRate = target.rate;
    try {
      updateRateValue(db, target.id, -1);
    } catch {
      // expected
    }
    expect(listRates(db).find((r) => r.id === target.id)!.rate).toBe(originalRate);
  });
});
