import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { listRates, updateRateValue, createRateValue, deleteRateValue, InvalidRateValueError } from "./ratesService";
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

  describe("PHASE 19 — createRateValue", () => {
    it("creates a valid new print type", () => {
      const created = createRateValue(db, "Foam Board", 25);
      expect(created.printType).toBe("Foam Board");
      expect(created.rate).toBe(25);
      expect(listRates(db)).toHaveLength(9);
    });

    it("trims surrounding whitespace from the name before persisting", () => {
      const created = createRateValue(db, "  Foam Board  ", 25);
      expect(created.printType).toBe("Foam Board");
    });

    it("rejects an empty name", () => {
      expect(() => createRateValue(db, "", 25)).toThrow(InvalidRateValueError);
    });

    it("rejects a whitespace-only name", () => {
      expect(() => createRateValue(db, "   ", 25)).toThrow(InvalidRateValueError);
    });

    it("does not create anything when the name is rejected", () => {
      try {
        createRateValue(db, "   ", 25);
      } catch {
        // expected
      }
      expect(listRates(db)).toHaveLength(8);
    });

    it("rejects a zero rate, reusing the exact same price rule as update", () => {
      expect(() => createRateValue(db, "Foam Board", 0)).toThrow(InvalidRateValueError);
    });

    it("rejects a negative rate", () => {
      expect(() => createRateValue(db, "Foam Board", -5)).toThrow(InvalidRateValueError);
    });

    it("rejects a rate above the sanity ceiling", () => {
      expect(() => createRateValue(db, "Foam Board", 1_000_001)).toThrow(InvalidRateValueError);
    });

    it("accepts a rate exactly at the sanity ceiling", () => {
      expect(() => createRateValue(db, "Foam Board", 1_000_000)).not.toThrow();
    });

    it("translates a duplicate-name failure into a friendly InvalidRateValueError naming the print type", () => {
      expect(() => createRateValue(db, "Flex", 999)).toThrow(InvalidRateValueError);
      try {
        createRateValue(db, "Flex", 999);
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).toMatch(/Flex.*already exists/);
      }
    });

    it("a duplicate rejection does not modify the existing rate with that name", () => {
      const flexBefore = listRates(db).find((r) => r.printType === "Flex")!;
      try {
        createRateValue(db, "Flex", 999);
      } catch {
        // expected
      }
      const flexAfter = listRates(db).find((r) => r.printType === "Flex")!;
      expect(flexAfter).toEqual(flexBefore);
    });
  });

  describe("PHASE 19 — deleteRateValue", () => {
    it("deletes an existing rate", () => {
      const target = listRates(db)[0];
      deleteRateValue(db, target.id);
      expect(listRates(db)).toHaveLength(7);
    });

    it("propagates RateNotFoundError for a nonexistent id", () => {
      expect(() => deleteRateValue(db, 999999)).toThrow(RateNotFoundError);
    });
  });
});
