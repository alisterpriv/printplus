import type { DatabaseSync } from "node:sqlite";
import {
  listCustomers as repoListCustomers,
  createCustomer as repoCreateCustomer,
  updateCustomer as repoUpdateCustomer,
  countCustomersInRange,
  type Customer,
  type CustomerInput,
} from "../repositories/customersRepository";
import {
  countDistinctCustomersInRange,
  averageGrandTotalPaise,
  type DateRange,
} from "../repositories/ordersRepository";

/** A phone number longer than this is almost certainly a paste error, not a real number. */
const MAX_PHONE_LENGTH = 20;

/** Thrown for a structurally-valid but business-invalid customer value. */
export class InvalidCustomerValueError extends Error {}

function normalizeOptional(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Deliberately permissive: no digit-count or country-code format is
 * enforced (Create Bill's own phone field has never validated format
 * either), just a sanity length ceiling to catch obvious garbage.
 */
function validatePhone(phone: string | null): void {
  if (phone !== null && phone.length > MAX_PHONE_LENGTH) {
    throw new InvalidCustomerValueError(`Phone must not exceed ${MAX_PHONE_LENGTH} characters`);
  }
}

/** Light shape check only — must contain "@" with something on both sides. Not full RFC validation. */
function validateEmail(email: string | null): void {
  if (email === null) return;
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) {
    throw new InvalidCustomerValueError('Email must contain "@" with text on both sides');
  }
}

function validateInput(input: CustomerInput): CustomerInput {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new InvalidCustomerValueError("Customer name is required");
  }

  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  const address = normalizeOptional(input.address);

  validatePhone(phone);
  validateEmail(email);

  return { name, phone, email, address };
}

export function listCustomers(db: DatabaseSync): Customer[] {
  return repoListCustomers(db);
}

export function createCustomer(db: DatabaseSync, input: CustomerInput): Customer {
  return repoCreateCustomer(db, validateInput(input));
}

export function updateCustomerValue(db: DatabaseSync, id: number, input: CustomerInput): void {
  repoUpdateCustomer(db, id, validateInput(input));
}

function paiseToRupees(paise: number): number {
  return paise / 100;
}

function formatAsDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * PHASE 17 — duplicated from dashboardService.ts/ordersService.ts's local
 * range technique rather than cross-imported, matching this codebase's
 * paiseToRupees precedent (each service independently owns this small
 * pure helper). See dashboardService.ts's getTodayRangeUtc for the full
 * DST-safety reasoning; this is the same technique for a month boundary
 * instead of a day boundary.
 */
export function getThisMonthRangeUtc(now: Date = new Date()): DateRange {
  const startOfMonthLocal = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfNextMonthLocal = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return {
    startUtc: formatAsDbTimestamp(startOfMonthLocal),
    endUtc: formatAsDbTimestamp(startOfNextMonthLocal),
  };
}

export interface CustomersSummary {
  activeThisMonth: number;
  newThisMonth: number;
  avgOrderValue: number;
}

/**
 * PHASE 17 — activeThisMonth/newThisMonth are scoped to the current local
 * calendar month; avgOrderValue is deliberately all-time (booked value,
 * unaffected by recordPayment or by the Customers UI's search box),
 * mirroring Phase 16's "Total Revenue" all-time precedent rather than
 * introducing a fourth different date scope on one stat grid.
 */
export function getCustomersSummary(db: DatabaseSync, now: Date = new Date()): CustomersSummary {
  const range = getThisMonthRangeUtc(now);
  return {
    activeThisMonth: countDistinctCustomersInRange(db, range),
    newThisMonth: countCustomersInRange(db, range),
    avgOrderValue: paiseToRupees(averageGrandTotalPaise(db)),
  };
}
