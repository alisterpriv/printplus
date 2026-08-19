import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import type { LengthUnit } from "../../src/domain/pricing";
import {
  listOrders as listOrdersService,
  getOrder as getOrderService,
  createOrder as createOrderService,
  updateOrderStatus as updateOrderStatusService,
  recordPayment as recordPaymentService,
  getOrdersSummary as getOrdersSummaryService,
  InvalidOrderValueError,
  type NewOrderInput,
  type NewOrderItemInput,
  type OrdersSummary,
} from "../services/ordersService";
import { OrderNotFoundError, PaymentExceedsBalanceError, type Order } from "../repositories/ordersRepository";
import { CustomerNotFoundError } from "../repositories/customersRepository";

/** Thrown for a structurally malformed request (wrong type/shape). */
export class InvalidOrderRequestError extends Error {}

export function validateOrderId(id: unknown): number {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new InvalidOrderRequestError("Invalid order id");
  }
  return id;
}

function validateFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidOrderRequestError(`Invalid ${fieldName}`);
  }
  return value;
}

function validateOrderItemInput(item: unknown): NewOrderItemInput {
  if (typeof item !== "object" || item === null) {
    throw new InvalidOrderRequestError("Invalid order item");
  }
  const { printType, width, height, unit, rate, quantity } = item as Record<string, unknown>;
  if (typeof printType !== "string" || printType.length === 0) {
    throw new InvalidOrderRequestError("Invalid item print type");
  }
  if (typeof unit !== "string" || unit.length === 0) {
    throw new InvalidOrderRequestError("Invalid item unit");
  }
  return {
    printType,
    width: validateFiniteNumber(width, "item width"),
    height: validateFiniteNumber(height, "item height"),
    unit: unit as LengthUnit,
    rate: validateFiniteNumber(rate, "item rate"),
    quantity: validateFiniteNumber(quantity, "item quantity"),
  };
}

export function validateOrderInput(payload: unknown): NewOrderInput {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidOrderRequestError("Invalid payload");
  }
  const { customerId, items, discountPercent, gstPercent } = payload as Record<string, unknown>;

  if (typeof customerId !== "number" || !Number.isInteger(customerId) || customerId <= 0) {
    throw new InvalidOrderRequestError("Invalid customer id");
  }
  if (!Array.isArray(items)) {
    throw new InvalidOrderRequestError("Invalid items list");
  }

  return {
    customerId,
    items: items.map(validateOrderItemInput),
    discountPercent: validateFiniteNumber(discountPercent, "discount percent"),
    gstPercent: validateFiniteNumber(gstPercent, "gst percent"),
  };
}

export function validateOrderStatus(status: unknown): string {
  if (typeof status !== "string" || status.length === 0) {
    throw new InvalidOrderRequestError("Invalid status");
  }
  return status;
}

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleOrdersList(db: DatabaseSync): Order[] {
  return listOrdersService(db);
}

export function handleOrdersGet(db: DatabaseSync, payload: unknown): Order {
  const id = validateOrderId(payload);
  return getOrderService(db, id);
}

export function handleOrdersCreate(db: DatabaseSync, payload: unknown): Order {
  const input = validateOrderInput(payload);
  return createOrderService(db, input);
}

export function handleOrdersUpdateStatus(db: DatabaseSync, payload: unknown): void {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidOrderRequestError("Invalid payload");
  }
  const { id, status } = payload as { id?: unknown; status?: unknown };
  const validId = validateOrderId(id);
  const validStatus = validateOrderStatus(status);
  updateOrderStatusService(db, validId, validStatus);
}

function validateAmountPaidRupees(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidOrderRequestError("Invalid payment amount");
  }
  return value;
}

export function handleOrdersRecordPayment(db: DatabaseSync, payload: unknown): Order {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidOrderRequestError("Invalid payload");
  }
  const { orderId, amountPaidRupees } = payload as { orderId?: unknown; amountPaidRupees?: unknown };
  const validOrderId = validateOrderId(orderId);
  const validAmount = validateAmountPaidRupees(amountPaidRupees);
  return recordPaymentService(db, validOrderId, validAmount);
}

export function handleOrdersGetSummary(db: DatabaseSync): OrdersSummary {
  return getOrdersSummaryService(db);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. Recognized validation/not-found errors pass
 * their (already-safe) message through as-is; anything else is logged
 * in full here and replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[orders IPC]", error);
  if (
    error instanceof InvalidOrderRequestError ||
    error instanceof InvalidOrderValueError ||
    error instanceof OrderNotFoundError ||
    error instanceof CustomerNotFoundError ||
    error instanceof PaymentExceedsBalanceError
  ) {
    return new Error(error.message);
  }
  return new Error("Something went wrong while accessing orders. Please try again.");
}

export function registerOrdersHandlers(db: DatabaseSync): void {
  ipcMain.handle("orders:list", () => {
    try {
      return handleOrdersList(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("orders:get", (_event, payload: unknown) => {
    try {
      return handleOrdersGet(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("orders:create", (_event, payload: unknown) => {
    try {
      return handleOrdersCreate(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("orders:updateStatus", (_event, payload: unknown) => {
    try {
      handleOrdersUpdateStatus(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("orders:recordPayment", (_event, payload: unknown) => {
    try {
      return handleOrdersRecordPayment(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("orders:getSummary", () => {
    try {
      return handleOrdersGetSummary(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
