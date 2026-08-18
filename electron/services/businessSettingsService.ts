import type { DatabaseSync } from "node:sqlite";
import {
  getBusinessSettings as repoGetBusinessSettings,
  updateBusinessSettings as repoUpdateBusinessSettings,
  type BusinessSettings,
  type BusinessSettingsInput,
} from "../repositories/businessSettingsRepository";

const MAX_BUSINESS_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 500;
const MAX_PHONE_LENGTH = 20;
const MAX_GSTIN_LENGTH = 20;

/** Thrown for a structurally-valid but business-invalid business-settings value. */
export class InvalidBusinessSettingsValueError extends Error {}

function normalizeOptional(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Deliberately permissive, matching customersService.validatePhone: no
 * digit-count or country-code format is enforced anywhere else in this
 * app either, just a sanity length ceiling to catch obvious garbage.
 */
function validatePhone(phone: string | null): void {
  if (phone !== null && phone.length > MAX_PHONE_LENGTH) {
    throw new InvalidBusinessSettingsValueError(`Phone must not exceed ${MAX_PHONE_LENGTH} characters`);
  }
}

/** Light shape check only, matching customersService.validateEmail — not full RFC validation. */
function validateEmail(email: string | null): void {
  if (email === null) return;
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) {
    throw new InvalidBusinessSettingsValueError('Email must contain "@" with text on both sides');
  }
}

/**
 * Basic sanity check only — a length ceiling, not a checksum or legal
 * compliance engine. A shop may not be GST-registered at all (gstin is
 * optional), and a stricter format regex risks rejecting a real, valid
 * GSTIN this app doesn't fully understand the rules for.
 */
function validateGstin(gstin: string | null): void {
  if (gstin !== null && gstin.length > MAX_GSTIN_LENGTH) {
    throw new InvalidBusinessSettingsValueError(`GSTIN must not exceed ${MAX_GSTIN_LENGTH} characters`);
  }
}

function validateAddress(address: string | null): void {
  if (address !== null && address.length > MAX_ADDRESS_LENGTH) {
    throw new InvalidBusinessSettingsValueError(`Address must not exceed ${MAX_ADDRESS_LENGTH} characters`);
  }
}

function validateInput(input: BusinessSettingsInput): BusinessSettingsInput {
  const businessName = input.businessName.trim();
  if (businessName.length === 0) {
    throw new InvalidBusinessSettingsValueError("Business name is required");
  }
  if (businessName.length > MAX_BUSINESS_NAME_LENGTH) {
    throw new InvalidBusinessSettingsValueError(`Business name must not exceed ${MAX_BUSINESS_NAME_LENGTH} characters`);
  }

  const address = normalizeOptional(input.address);
  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  const gstin = normalizeOptional(input.gstin);

  validateAddress(address);
  validatePhone(phone);
  validateEmail(email);
  validateGstin(gstin);

  return { businessName, address, phone, email, gstin };
}

export function getBusinessSettings(db: DatabaseSync): BusinessSettings {
  return repoGetBusinessSettings(db);
}

export function updateBusinessSettings(db: DatabaseSync, input: BusinessSettingsInput): BusinessSettings {
  return repoUpdateBusinessSettings(db, validateInput(input));
}
