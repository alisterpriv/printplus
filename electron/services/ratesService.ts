import type { DatabaseSync } from "node:sqlite";
import { listRates as repoListRates, updateRate, type Rate } from "../repositories/ratesRepository";

/** A rate above this is almost certainly a data-entry mistake, not a real price. */
const MAX_RATE = 1_000_000;

/** Thrown for a structurally-valid but business-invalid rate value. */
export class InvalidRateValueError extends Error {}

export function listRates(db: DatabaseSync): Rate[] {
  return repoListRates(db);
}

/**
 * Owns the business rule for what a valid rate is: greater than zero
 * (matching RateSettings.tsx's own existing validation) and below a
 * sanity ceiling. Structural checks (is `id`/`rate` even the right type)
 * happen one layer up, at the IPC boundary — this function assumes it
 * has already received a real number.
 */
export function updateRateValue(db: DatabaseSync, id: number, rate: number): void {
  if (rate <= 0) {
    throw new InvalidRateValueError("Rate must be greater than zero");
  }
  if (rate > MAX_RATE) {
    throw new InvalidRateValueError(`Rate must not exceed ${MAX_RATE}`);
  }
  updateRate(db, id, rate);
}
