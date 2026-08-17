/**
 * Pure billing/pricing math, extracted from CreateBill.tsx.
 *
 * No React, no browser APIs, no Electron, no localStorage — these functions
 * only take numbers in and return numbers out, so they can be tested and
 * reused without a UI.
 *
 * IMPORTANT: these functions intentionally do NOT validate or reject
 * zero/negative/invalid inputs. They mirror the existing CreateBill.tsx
 * math exactly. Input validation (e.g. rejecting negative dimensions) is a
 * separate, not-yet-decided concern — see the DISCOVERED BILLING ISSUE
 * notes below. Do not treat the current lack of guarding as a business
 * rule; it is simply undecided.
 */

export type LengthUnit = "Meter" | "Centimeter" | "Inch" | "Feet";

/** Multiplier to convert one dimension in this unit to meters. */
export const LENGTH_UNIT_TO_METERS: Readonly<Record<LengthUnit, number>> = {
  Meter: 1,
  Centimeter: 0.01,
  Inch: 0.0254,
  Feet: 0.3048,
};

/**
 * Converts a width x height in the given unit to an area in square meters.
 * The unit multiplier is applied to both dimensions (squared), since area
 * scales with the square of a length conversion.
 *
 * DISCOVERED BILLING ISSUE: negative or zero width/height are computed
 * as-is (e.g. a negative dimension produces a negative area). The current
 * UI does not reliably block these (see CreateBill.tsx's required-field
 * check, which treats any non-empty string, including "0" or "-5", as
 * valid). Whether to reject such inputs is a future validation-boundary
 * decision, not made here.
 */
export function calculateAreaInSquareMeters(
  width: number,
  height: number,
  unit: LengthUnit
): number {
  const multiplier = LENGTH_UNIT_TO_METERS[unit];
  return width * height * multiplier * multiplier;
}

/**
 * total = area x rate x quantity, mirroring CreateBill.tsx's existing
 * per-item formula exactly.
 *
 * DISCOVERED BILLING ISSUE: quantity is expected to already be a whole
 * number by the time it reaches this function — CreateBill.tsx truncates
 * the quantity field with parseInt before calling this. This function
 * itself does not truncate; it just multiplies whatever numbers it is
 * given.
 */
export function calculateItemTotal(
  area: number,
  rate: number,
  quantity: number
): number {
  return area * rate * quantity;
}

export interface BillSummary {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
}

/**
 * Sums item totals, applies a percentage discount, then applies GST to the
 * post-discount (taxable) amount — mirroring CreateBill.tsx's existing
 * subtotal/discount/GST/grandTotal formula exactly, including the
 * discount-before-GST ordering.
 *
 * DISCOVERED BILLING ISSUE: none of the resulting amounts are rounded.
 * They are raw IEEE-754 floating-point numbers, exactly as CreateBill.tsx
 * computes today (rounding only happens at display time via toFixed()).
 * This is a known, documented limitation — see pricing.test.ts — and is
 * intentionally left unchanged pending a deliberate future decision on
 * monetary precision (e.g. integer-cents storage) when the database layer
 * is designed.
 */
export function calculateBillSummary(
  itemTotals: number[],
  discountPercent: number,
  gstPercent: number
): BillSummary {
  const subtotal = itemTotals.reduce((sum, total) => sum + total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = (taxableAmount * gstPercent) / 100;
  const grandTotal = taxableAmount + gstAmount;

  return { subtotal, discountAmount, taxableAmount, gstAmount, grandTotal };
}
