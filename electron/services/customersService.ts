import type { DatabaseSync } from "node:sqlite";
import {
  listCustomers as repoListCustomers,
  createCustomer as repoCreateCustomer,
  updateCustomer as repoUpdateCustomer,
  type Customer,
  type CustomerInput,
} from "../repositories/customersRepository";

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
