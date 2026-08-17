import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import {
  validateRateId,
  validateRateNumber,
  handleRatesList,
  handleRatesUpdate,
  InvalidRateRequestError,
} from "./ratesHandlers";
import { InvalidRateValueError } from "../services/ratesService";
import { RateNotFoundError } from "../repositories/ratesRepository";

describe("validateRateId", () => {
  it("accepts a positive integer", () => {
    expect(validateRateId(1)).toBe(1);
  });

  it("rejects a non-number", () => {
    expect(() => validateRateId("1")).toThrow(InvalidRateRequestError);
    expect(() => validateRateId(null)).toThrow(InvalidRateRequestError);
    expect(() => validateRateId(undefined)).toThrow(InvalidRateRequestError);
  });

  it("rejects a non-integer", () => {
    expect(() => validateRateId(1.5)).toThrow(InvalidRateRequestError);
  });

  it("rejects zero and negative values", () => {
    expect(() => validateRateId(0)).toThrow(InvalidRateRequestError);
    expect(() => validateRateId(-1)).toThrow(InvalidRateRequestError);
  });
});

describe("validateRateNumber", () => {
  it("accepts a finite number", () => {
    expect(validateRateNumber(10.5)).toBe(10.5);
  });

  it("rejects a non-number", () => {
    expect(() => validateRateNumber("10")).toThrow(InvalidRateRequestError);
    expect(() => validateRateNumber(null)).toThrow(InvalidRateRequestError);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => validateRateNumber(NaN)).toThrow(InvalidRateRequestError);
    expect(() => validateRateNumber(Infinity)).toThrow(InvalidRateRequestError);
    expect(() => validateRateNumber(-Infinity)).toThrow(InvalidRateRequestError);
  });
});

describe("handleRatesList / handleRatesUpdate", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
  });

  it("lists all seeded rates", () => {
    expect(handleRatesList(db)).toHaveLength(8);
  });

  it("updates a rate through the full handler logic", () => {
    const target = handleRatesList(db)[0];
    handleRatesUpdate(db, { id: target.id, rate: 77 });
    expect(handleRatesList(db).find((r) => r.id === target.id)!.rate).toBe(77);
  });

  it("rejects a malformed payload before touching the database", () => {
    expect(() => handleRatesUpdate(db, "not an object")).toThrow(InvalidRateRequestError);
    expect(() => handleRatesUpdate(db, null)).toThrow(InvalidRateRequestError);
    expect(() => handleRatesUpdate(db, { id: 1 })).toThrow(InvalidRateRequestError);
    expect(() => handleRatesUpdate(db, { rate: 10 })).toThrow(InvalidRateRequestError);
  });

  it("propagates a business-rule rejection from the service", () => {
    const target = handleRatesList(db)[0];
    expect(() => handleRatesUpdate(db, { id: target.id, rate: 0 })).toThrow(InvalidRateValueError);
    expect(() => handleRatesUpdate(db, { id: target.id, rate: -5 })).toThrow(InvalidRateValueError);
  });

  it("propagates RateNotFoundError for a nonexistent id", () => {
    expect(() => handleRatesUpdate(db, { id: 999999, rate: 10 })).toThrow(RateNotFoundError);
  });
});
