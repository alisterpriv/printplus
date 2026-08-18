import type { DatabaseSync } from "node:sqlite";
import {
  calculateAreaInSquareMeters,
  calculateItemTotal,
  calculateBillSummaryPaise,
  rupeesToPaise,
  LENGTH_UNIT_TO_METERS,
  type LengthUnit,
} from "../../src/domain/pricing";
import {
  listOrders as repoListOrders,
  getOrder as repoGetOrder,
  createOrder as repoCreateOrder,
  updateOrderStatus as repoUpdateOrderStatus,
  type Order,
  type CreateOrderItemInput,
} from "../repositories/ordersRepository";
import { getCustomerById } from "../repositories/customersRepository";
import { MAX_RATE } from "./ratesService";

export type OrderStatus = "Pending" | "Processing" | "Completed";
export const ORDER_STATUSES: readonly OrderStatus[] = ["Pending", "Processing", "Completed"];
const DEFAULT_STATUS: OrderStatus = "Pending";

/**
 * PHASE 8 — a dimension above this (after converting to meters,
 * regardless of the unit it was entered in) is almost certainly a
 * data-entry mistake, not real large-format work. Deliberately generous:
 * no legitimate printing-shop job approaches 1000 meters in either
 * dimension.
 */
const MAX_DIMENSION_METERS = 1000;

/** PHASE 8 — a single line item above this quantity is almost certainly a data-entry mistake. */
const MAX_QUANTITY = 100_000;

/** Thrown for a structurally-valid but business-invalid order value. */
export class InvalidOrderValueError extends Error {}

/**
 * PHASE 8 business rules for a single order item — the authoritative
 * validation boundary (see ordersHandlers.ts, which deliberately only
 * checks structural shape/type, not these business rules). Mirrors, for
 * rate, the same ceiling ratesService.ts already enforces on the Rate
 * Settings table, so an order-item rate can never be "valid" in a way a
 * saved rate wouldn't be.
 */
function validateItemInput(item: NewOrderItemInput): void {
  if (!(item.width > 0)) {
    throw new InvalidOrderValueError("Width must be greater than zero.");
  }
  if (!(item.height > 0)) {
    throw new InvalidOrderValueError("Height must be greater than zero.");
  }
  const multiplier = LENGTH_UNIT_TO_METERS[item.unit];
  if (item.width * multiplier > MAX_DIMENSION_METERS) {
    throw new InvalidOrderValueError(`Width must not exceed ${MAX_DIMENSION_METERS} meters.`);
  }
  if (item.height * multiplier > MAX_DIMENSION_METERS) {
    throw new InvalidOrderValueError(`Height must not exceed ${MAX_DIMENSION_METERS} meters.`);
  }
  if (!(item.rate > 0)) {
    throw new InvalidOrderValueError("Rate must be greater than zero.");
  }
  if (item.rate > MAX_RATE) {
    throw new InvalidOrderValueError(`Rate must not exceed ${MAX_RATE}.`);
  }
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    throw new InvalidOrderValueError("Quantity must be a whole number of 1 or more.");
  }
  if (item.quantity > MAX_QUANTITY) {
    throw new InvalidOrderValueError(`Quantity must not exceed ${MAX_QUANTITY}.`);
  }
}

/** PHASE 8 — discount and GST percentages must be within 0-100 inclusive. */
function validatePercent(value: number, fieldName: string): void {
  if (!(value >= 0) || value > 100) {
    throw new InvalidOrderValueError(`${fieldName} must be between 0 and 100.`);
  }
}

export interface NewOrderItemInput {
  printType: string;
  width: number;
  height: number;
  unit: LengthUnit;
  rate: number;
  quantity: number;
}

export interface NewOrderInput {
  customerId: number;
  items: NewOrderItemInput[];
  discountPercent: number;
  gstPercent: number;
}

export function listOrders(db: DatabaseSync): Order[] {
  return repoListOrders(db);
}

export function getOrder(db: DatabaseSync, id: number): Order {
  return repoGetOrder(db, id);
}

/**
 * Recomputes area/item-total/summary itself using the exact same,
 * unmodified pricing.ts area/item-total functions Create Bill uses for
 * its live preview, rather than trusting client-supplied totals. This
 * guarantees the persisted amounts can never drift from what the
 * renderer showed.
 *
 * PHASE 8: every item and every percentage is now validated against the
 * business rules in validateItemInput/validatePercent *before* any
 * calculation happens — zero/negative dimensions, zero/negative/oversized
 * rate, non-integer or out-of-range quantity, and out-of-range
 * discount/GST are all rejected here rather than silently accepted.
 * pricing.ts's own functions remain deliberately permissive (unchanged) —
 * they're still used for CreateBill's keystroke-by-keystroke live
 * preview, where rejecting mid-typing input would be wrong; this
 * function is the actual authoritative boundary.
 *
 * PHASE 8: the summary (subtotal/discount/GST/grand total) is now
 * computed via calculateBillSummaryPaise on the already-rounded per-item
 * paise integers directly, instead of converting them back into rupee
 * floats and re-running the float-based calculateBillSummary — removing
 * the round→float→round-again path that made the previous result
 * float-drift-dependent rather than deterministic. See
 * calculateBillSummaryPaise's own doc comment for the exact rounding
 * policy.
 *
 * Historical accuracy for the customer snapshot: the caller supplies only
 * customerId, never customer_name/phone/address — this function resolves
 * the real, current customer record and uses *its* fields as the
 * snapshot, so the snapshot can never mismatch an actual saved customer.
 */
export function createOrder(db: DatabaseSync, input: NewOrderInput): Order {
  if (input.items.length === 0) {
    throw new InvalidOrderValueError("An order must have at least one item");
  }
  for (const item of input.items) {
    validateItemInput(item);
  }
  validatePercent(input.discountPercent, "Discount");
  validatePercent(input.gstPercent, "GST");

  // Throws CustomerNotFoundError (propagated as-is) if customerId doesn't
  // reference a real, saved customer — Create Bill's normal workflow can
  // never produce an order with an unlinked customer.
  const customer = getCustomerById(db, input.customerId);

  const items: CreateOrderItemInput[] = input.items.map((item) => {
    const area = calculateAreaInSquareMeters(item.width, item.height, item.unit);
    const total = calculateItemTotal(area, item.rate, item.quantity);
    return {
      printType: item.printType,
      width: item.width,
      height: item.height,
      unit: item.unit,
      areaSquareMeters: area,
      ratePaise: rupeesToPaise(item.rate),
      quantity: item.quantity,
      totalPaise: rupeesToPaise(total),
    };
  });

  const summary = calculateBillSummaryPaise(
    items.map((item) => item.totalPaise),
    input.discountPercent,
    input.gstPercent
  );

  return repoCreateOrder(db, {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    status: DEFAULT_STATUS,
    subtotalPaise: summary.subtotalPaise,
    discountPercent: input.discountPercent,
    discountPaise: summary.discountPaise,
    gstPercent: input.gstPercent,
    gstPaise: summary.gstPaise,
    grandTotalPaise: summary.grandTotalPaise,
    items,
  });
}

export function updateOrderStatus(db: DatabaseSync, id: number, status: string): void {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new InvalidOrderValueError(`Invalid status: ${status}`);
  }
  repoUpdateOrderStatus(db, id, status);
}
