import type { DatabaseSync } from "node:sqlite";
import {
  calculateAreaInSquareMeters,
  calculateItemTotal,
  calculateBillSummary,
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

export type OrderStatus = "Pending" | "Processing" | "Completed";
export const ORDER_STATUSES: readonly OrderStatus[] = ["Pending", "Processing", "Completed"];
const DEFAULT_STATUS: OrderStatus = "Pending";

/** Thrown for a structurally-valid but business-invalid order value. */
export class InvalidOrderValueError extends Error {}

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

function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function listOrders(db: DatabaseSync): Order[] {
  return repoListOrders(db);
}

export function getOrder(db: DatabaseSync, id: number): Order {
  return repoGetOrder(db, id);
}

/**
 * Recomputes area/item-total/summary itself using the exact same,
 * unmodified pricing.ts functions Create Bill uses for its live preview,
 * rather than trusting client-supplied totals. This guarantees the
 * persisted amounts can never drift from what the renderer showed, and
 * deliberately preserves every Phase 2 "discovered billing issue"
 * (zero/negative inputs are not rejected here, quantity is not
 * re-validated as a whole number, and the floating-point result is only
 * rounded at this persistence boundary — pricing.ts itself is untouched).
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

  const summary = calculateBillSummary(
    items.map((item) => item.totalPaise / 100),
    input.discountPercent,
    input.gstPercent
  );

  return repoCreateOrder(db, {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    status: DEFAULT_STATUS,
    subtotalPaise: rupeesToPaise(summary.subtotal),
    discountPercent: input.discountPercent,
    discountPaise: rupeesToPaise(summary.discountAmount),
    gstPercent: input.gstPercent,
    gstPaise: rupeesToPaise(summary.gstAmount),
    grandTotalPaise: rupeesToPaise(summary.grandTotal),
    items,
  });
}

export function updateOrderStatus(db: DatabaseSync, id: number, status: string): void {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new InvalidOrderValueError(`Invalid status: ${status}`);
  }
  repoUpdateOrderStatus(db, id, status);
}
