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

/** Thrown when an update targets an id that doesn't exist. */
export class RateNotFoundError extends Error {}

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
