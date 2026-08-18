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
 * SCOPE: this is the rupee-float function for CreateBill's live,
 * keystroke-by-keystroke on-screen preview only. It is NOT used to
 * compute the amounts actually persisted for an order — that path uses
 * calculateBillSummaryPaise below, which takes already-rounded paise
 * integers and never round-trips through a rupee float. If you're
 * looking for the function ordersService.createOrder calls, it's
 * calculateBillSummaryPaise, not this one.
 *
 * DISCOVERED BILLING ISSUE: none of the resulting amounts are rounded.
 * They are raw IEEE-754 floating-point numbers, exactly as CreateBill.tsx
 * computes today (rounding only happens at display time via toFixed()).
 * This is intentional and fine for a live preview, where occasional
 * sub-paisa float drift is invisible — see pricing.test.ts.
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

/**
 * PHASE 8 MONEY-PRECISION POLICY — the single, explicit rounding rule for
 * every rupee amount that crosses into persisted, integer-paise money.
 *
 * Converts a rupee amount to integer paise using JS's Math.round, which
 * rounds an exact .5 tie toward positive infinity ("round half up") —
 * e.g. Math.round(2.5) is 3, but Math.round(-2.5) is -2, not -3. This is
 * NOT the same rule as "round half away from zero" for negative inputs.
 * Every amount this function is ever called on in this codebase (rates,
 * subtotals, discount/GST amounts) is validated to be non-negative before
 * it gets here (see ordersService.ts's item/percent validation), and for
 * non-negative inputs "round half up" and "round half away from zero"
 * produce identical results — so this distinction has no practical effect
 * on any amount PrintPlus actually rounds, but the rule itself is stated
 * precisely here rather than under a name that only happens to match for
 * positive numbers.
 *
 * This is the only place this conversion should be implemented — callers
 * must import it rather than reimplementing `Math.round(rupees * 100)`
 * locally, so the rounding rule can never silently drift between call
 * sites.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** The inverse of rupeesToPaise. Exact (no rounding decision involved — dividing an integer by 100 loses no information a caller needs). */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export interface BillSummaryPaise {
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  gstPaise: number;
  grandTotalPaise: number;
}

/**
 * THIS is the function that computes the amounts actually persisted for
 * an order — ordersService.createOrder calls this, not the rupee-float
 * calculateBillSummary above. calculateBillSummary exists solely to
 * drive CreateBill's live on-screen preview; this function is the
 * integer-paise equivalent for the persistence boundary, where the final
 * numbers must be exact and deterministic. It never round-trips a paise
 * integer back through a rupee float, so there is no floating-point
 * drift to reason about.
 *
 * ROUNDING POLICY: exactly two rounding operations occur, both via
 * Math.round (see rupeesToPaise's doc comment for the precise tie-
 * breaking rule and why it's equivalent to "round half away from zero"
 * for the non-negative amounts this codebase ever rounds) — once for
 * discountPaise, once for gstPaise. subtotalPaise is an exact sum of
 * already-integer inputs. taxablePaise and grandTotalPaise are exact
 * integer (subtraction/addition) results and are never independently
 * re-rounded — this guarantees grandTotalPaise always exactly equals
 * subtotalPaise - discountPaise + gstPaise to the paisa, matching what a
 * customer would get re-adding the numbers on a printed invoice.
 *
 * Like calculateBillSummary, this function does not validate its inputs
 * (e.g. a discountPercent outside 0-100) — that is the caller's job, at
 * the service boundary, before calling this.
 */
export function calculateBillSummaryPaise(
  itemTotalsPaise: number[],
  discountPercent: number,
  gstPercent: number
): BillSummaryPaise {
  const subtotalPaise = itemTotalsPaise.reduce((sum, paise) => sum + paise, 0);
  const discountPaise = Math.round((subtotalPaise * discountPercent) / 100);
  const taxablePaise = subtotalPaise - discountPaise;
  const gstPaise = Math.round((taxablePaise * gstPercent) / 100);
  const grandTotalPaise = taxablePaise + gstPaise;

  return { subtotalPaise, discountPaise, taxablePaise, gstPaise, grandTotalPaise };
}
