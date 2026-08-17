import { describe, it, expect } from "vitest";
import {
  calculateAreaInSquareMeters,
  calculateItemTotal,
  calculateBillSummary,
} from "./pricing";

describe("calculateAreaInSquareMeters", () => {
  it("computes area directly in meters (multiplier = 1)", () => {
    expect(calculateAreaInSquareMeters(2, 3, "Meter")).toBe(6);
  });

  it("converts centimeters to square meters", () => {
    // 150cm x 200cm = 1.5m x 2m = 3 sq m
    expect(calculateAreaInSquareMeters(150, 200, "Centimeter")).toBeCloseTo(3, 10);
  });

  it("converts inches to square meters", () => {
    const area = calculateAreaInSquareMeters(100, 50, "Inch");
    expect(area).toBeCloseTo(100 * 0.0254 * (50 * 0.0254), 10);
  });

  it("converts feet to square meters", () => {
    const area = calculateAreaInSquareMeters(10, 5, "Feet");
    expect(area).toBeCloseTo(10 * 0.3048 * (5 * 0.3048), 10);
  });

  it("returns 0 when width is 0", () => {
    expect(calculateAreaInSquareMeters(0, 5, "Meter")).toBe(0);
  });

  it("returns 0 when height is 0", () => {
    expect(calculateAreaInSquareMeters(5, 0, "Meter")).toBe(0);
  });

  it("handles decimal dimensions", () => {
    expect(calculateAreaInSquareMeters(1.5, 2.25, "Meter")).toBeCloseTo(3.375, 10);
  });

  it("DOCUMENTS current behavior: negative dimensions are not rejected", () => {
    // Not a validated business rule — see DISCOVERED BILLING ISSUE in pricing.ts.
    // This test only proves the current pass-through behavior is preserved.
    expect(calculateAreaInSquareMeters(-2, 3, "Meter")).toBe(-6);
  });
});

describe("calculateItemTotal", () => {
  it("computes area x rate x quantity", () => {
    expect(calculateItemTotal(6, 10, 1)).toBe(60);
  });

  it("returns 0 when quantity is 0", () => {
    expect(calculateItemTotal(5, 10, 0)).toBe(0);
  });

  it("returns 0 when rate is 0", () => {
    expect(calculateItemTotal(5, 0, 3)).toBe(0);
  });

  it("returns 0 when area is 0", () => {
    expect(calculateItemTotal(0, 10, 3)).toBe(0);
  });

  it("handles a decimal rate", () => {
    expect(calculateItemTotal(2, 12.5, 2)).toBe(50);
  });

  it("DOCUMENTS current behavior: fractional quantity is not truncated here", () => {
    // CreateBill.tsx truncates quantity via parseInt before calling this
    // function; this function itself is agnostic and just multiplies.
    expect(calculateItemTotal(2, 10, 2.5)).toBe(50);
  });

  it("DOCUMENTS current behavior: negative rate is not rejected", () => {
    expect(calculateItemTotal(2, -10, 1)).toBe(-20);
  });
});

describe("calculateBillSummary", () => {
  it("returns all zeros for an empty item list", () => {
    const summary = calculateBillSummary([], 0, 18);
    expect(summary).toEqual({
      subtotal: 0,
      discountAmount: 0,
      taxableAmount: 0,
      gstAmount: 0,
      grandTotal: 0,
    });
  });

  it("sums a single item with no discount and no GST", () => {
    const summary = calculateBillSummary([60], 0, 0);
    expect(summary.subtotal).toBe(60);
    expect(summary.discountAmount).toBe(0);
    expect(summary.taxableAmount).toBe(60);
    expect(summary.gstAmount).toBe(0);
    expect(summary.grandTotal).toBe(60);
  });

  it("sums multiple items", () => {
    const summary = calculateBillSummary([60, 72, 18.5], 0, 0);
    expect(summary.subtotal).toBeCloseTo(150.5, 10);
  });

  it("applies GST with no discount", () => {
    const summary = calculateBillSummary([60], 0, 18);
    expect(summary.gstAmount).toBeCloseTo(10.8, 10);
    expect(summary.grandTotal).toBeCloseTo(70.8, 10);
  });

  it("applies a 0% discount as a no-op", () => {
    const summary = calculateBillSummary([100], 0, 0);
    expect(summary.discountAmount).toBe(0);
    expect(summary.taxableAmount).toBe(100);
  });

  it("applies a 100% discount, zeroing out GST too (GST applies after discount)", () => {
    const summary = calculateBillSummary([100], 100, 18);
    expect(summary.discountAmount).toBe(100);
    expect(summary.taxableAmount).toBe(0);
    expect(summary.gstAmount).toBe(0);
    expect(summary.grandTotal).toBe(0);
  });

  it("handles a decimal discount percentage", () => {
    const summary = calculateBillSummary([200], 12.5, 0);
    expect(summary.discountAmount).toBeCloseTo(25, 10);
    expect(summary.taxableAmount).toBeCloseTo(175, 10);
  });

  it("applies a 0% GST as a no-op", () => {
    const summary = calculateBillSummary([100], 0, 0);
    expect(summary.gstAmount).toBe(0);
    expect(summary.grandTotal).toBe(100);
  });

  it("handles a decimal GST percentage", () => {
    const summary = calculateBillSummary([100], 0, 18.5);
    expect(summary.gstAmount).toBeCloseTo(18.5, 10);
  });

  it("computes GST on the post-discount (taxable) amount, not the subtotal", () => {
    // subtotal 100, 10% discount -> taxable 90, 18% GST on 90 = 16.2 (not 18)
    const summary = calculateBillSummary([100], 10, 18);
    expect(summary.taxableAmount).toBeCloseTo(90, 10);
    expect(summary.gstAmount).toBeCloseTo(16.2, 10);
    expect(summary.grandTotal).toBeCloseTo(106.2, 10);
  });

  it("matches Baseline 3: multiple items + 10% discount + 18% GST", () => {
    // Baseline computed from the original inline CreateBill.tsx formula
    // before the refactor (see Phase 2 report).
    const summary = calculateBillSummary([60, 72], 10, 18);
    expect(summary.subtotal).toBe(132);
    expect(summary.discountAmount).toBeCloseTo(13.2, 10);
    expect(summary.taxableAmount).toBeCloseTo(118.8, 10);
    expect(summary.gstAmount).toBeCloseTo(21.384, 10);
    expect(summary.grandTotal).toBeCloseTo(140.184, 10);
  });

  it("DOCUMENTS current behavior: floating-point drift is not hidden or rounded away", () => {
    // 10.10 + 20.20 does not equal a clean 30.30 in IEEE-754 arithmetic.
    // This module intentionally does not round intermediate or final
    // values — see the DISCOVERED BILLING ISSUE note in pricing.ts.
    const summary = calculateBillSummary([10.1, 20.2], 0, 0);
    expect(summary.subtotal).not.toBe(30.3);
    expect(summary.subtotal).toBeCloseTo(30.3, 10);
  });

  it("DOCUMENTS current behavior: negative discount/GST percentages are not rejected", () => {
    const summary = calculateBillSummary([100], -10, -5);
    expect(summary.discountAmount).toBe(-10);
    expect(summary.taxableAmount).toBe(110);
    expect(summary.gstAmount).toBeCloseTo(-5.5, 10);
  });
});
