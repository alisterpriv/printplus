import type { DatabaseSync } from "node:sqlite";
import {
  listRates as repoListRates,
  updateRate,
  createRate as repoCreateRate,
  deleteRate as repoDeleteRate,
  DuplicatePrintTypeError,
  type Rate,
} from "../repositories/ratesRepository";

/**
 * A rate above this is almost certainly a data-entry mistake, not a real
 * price. Exported so ordersService.ts can apply the same ceiling to
 * order-item rates instead of defining a competing limit.
 */
export const MAX_RATE = 1_000_000;

/** Thrown for a structurally-valid but business-invalid rate value. */
export class InvalidRateValueError extends Error {}

export function listRates(db: DatabaseSync): Rate[] {
  return repoListRates(db);
}

/**
 * The single source of truth for what a valid rate is: greater than zero
 * and below a sanity ceiling. Shared by both create and update so there is
 * never a second, competing set of price rules.
 */
function validateRatePrice(rate: number): void {
  if (rate <= 0) {
    throw new InvalidRateValueError("Rate must be greater than zero");
  }
  if (rate > MAX_RATE) {
    throw new InvalidRateValueError(`Rate must not exceed ${MAX_RATE}`);
  }
}

/**
 * Owns the business rule for what a valid rate is: greater than zero
 * (matching RateSettings.tsx's own existing validation) and below a
 * sanity ceiling. Structural checks (is `id`/`rate` even the right type)
 * happen one layer up, at the IPC boundary — this function assumes it
 * has already received a real number.
 */
export function updateRateValue(db: DatabaseSync, id: number, rate: number): void {
  validateRatePrice(rate);
  updateRate(db, id, rate);
}

/**
 * PHASE 19 — creates a new print type. Trims the name (matching
 * customersService's normalizeOptional precedent), rejects an empty/
 * whitespace-only name, and reuses validateRatePrice for the price —
 * there is no separate pricing rule for a newly-created rate. A
 * duplicate-name insert is caught at the repository layer (via the
 * table's own UNIQUE constraint) and re-thrown here as the same
 * InvalidRateValueError the rest of this service already uses, so the
 * IPC layer needs no new error type to recognize.
 */
export function createRateValue(db: DatabaseSync, printType: string, rate: number): Rate {
  const trimmed = printType.trim();
  if (trimmed.length === 0) {
    throw new InvalidRateValueError("Print type name is required");
  }
  validateRatePrice(rate);

  try {
    return repoCreateRate(db, trimmed, rate);
  } catch (error) {
    if (error instanceof DuplicatePrintTypeError) {
      throw new InvalidRateValueError(`A print type named "${trimmed}" already exists`);
    }
    throw error;
  }
}

/**
 * PHASE 19 — deletes a print type. No business validation beyond the
 * repository's own not-found check: deleting is always safe with respect
 * to historical orders (see deleteRate's doc comment).
 */
export function deleteRateValue(db: DatabaseSync, id: number): void {
  repoDeleteRate(db, id);
}
