import type { DatabaseSync } from "node:sqlite";

export interface Rate {
  id: number;
  printType: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
}

interface RateRow {
  id: number;
  print_type: string;
  rate_paise: number;
  created_at: string;
  updated_at: string;
}

/** Thrown when an update or delete targets an id that doesn't exist. */
export class RateNotFoundError extends Error {}

/** Thrown when a create would violate the rates.print_type UNIQUE constraint. */
export class DuplicatePrintTypeError extends Error {}

function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function paiseToRupees(paise: number): number {
  return paise / 100;
}

function toRate(row: RateRow): Rate {
  return {
    id: row.id,
    printType: row.print_type,
    rate: paiseToRupees(row.rate_paise),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The only file allowed to contain SQL for the rates table. Money is
 * stored as integer paise (rate_paise); every function here converts to
 * and from plain rupee numbers, so nothing above this file ever needs to
 * know paise exists — pricing.ts and the UI only ever see rupees.
 */
export function listRates(db: DatabaseSync): Rate[] {
  const rows = db.prepare("SELECT * FROM rates ORDER BY id ASC").all() as unknown as RateRow[];
  return rows.map(toRate);
}

export function updateRate(db: DatabaseSync, id: number, rate: number): void {
  const result = db
    .prepare("UPDATE rates SET rate_paise = ?, updated_at = datetime('now') WHERE id = ?")
    .run(rupeesToPaise(rate), id);

  if (result.changes === 0) {
    throw new RateNotFoundError(`No rate found with id ${id}`);
  }
}

/**
 * Relies on the table's own UNIQUE(print_type) constraint as the actual
 * duplicate-rejection mechanism (not a separate SELECT-then-INSERT check),
 * matching this codebase's existing preference for DB constraints as the
 * correctness-enforcing layer. Translates that specific failure into a
 * typed DuplicatePrintTypeError; any other insert failure propagates as-is.
 */
export function createRate(db: DatabaseSync, printType: string, rate: number): Rate {
  let result;
  try {
    result = db
      .prepare(
        `INSERT INTO rates (print_type, rate_paise, created_at, updated_at)
         VALUES (?, ?, datetime('now'), datetime('now'))`
      )
      .run(printType, rupeesToPaise(rate));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw new DuplicatePrintTypeError(`A print type named "${printType}" already exists`);
    }
    throw error;
  }

  const row = db.prepare("SELECT * FROM rates WHERE id = ?").get(result.lastInsertRowid) as unknown as RateRow;
  return toRate(row);
}

/**
 * Deleting a rate is always safe with respect to historical data:
 * order_items.print_type is a plain denormalized TEXT snapshot with no
 * foreign key to rates (see migration 4) — a deleted rate can never
 * orphan or alter any existing order or invoice.
 */
export function deleteRate(db: DatabaseSync, id: number): void {
  const result = db.prepare("DELETE FROM rates WHERE id = ?").run(id);

  if (result.changes === 0) {
    throw new RateNotFoundError(`No rate found with id ${id}`);
  }
}
