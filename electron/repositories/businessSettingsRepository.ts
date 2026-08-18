import type { DatabaseSync } from "node:sqlite";

export interface BusinessSettings {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettingsInput {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
}

interface BusinessSettingsRow {
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

function toBusinessSettings(row: BusinessSettingsRow): BusinessSettings {
  return {
    businessName: row.business_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    gstin: row.gstin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The only file allowed to contain SQL for the business_settings table.
 * There is exactly one row (id = 1, pinned by a CHECK constraint and
 * seeded by migration 6) — no insert/delete is exposed, only get/update
 * against that single row.
 */
export function getBusinessSettings(db: DatabaseSync): BusinessSettings {
  const row = db.prepare("SELECT * FROM business_settings WHERE id = 1").get() as
    | BusinessSettingsRow
    | undefined;
  if (!row) {
    throw new Error("business_settings row is missing — migration 6 should have seeded it");
  }
  return toBusinessSettings(row);
}

export function updateBusinessSettings(db: DatabaseSync, input: BusinessSettingsInput): BusinessSettings {
  db.prepare(
    `UPDATE business_settings
     SET business_name = ?, address = ?, phone = ?, email = ?, gstin = ?, updated_at = datetime('now')
     WHERE id = 1`
  ).run(input.businessName, input.address, input.phone, input.email, input.gstin);

  return getBusinessSettings(db);
}
