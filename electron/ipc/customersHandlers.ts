import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";
import {
  listCustomers as listCustomersService,
  createCustomer as createCustomerService,
  updateCustomerValue,
  InvalidCustomerValueError,
} from "../services/customersService";
import { CustomerNotFoundError, type Customer, type CustomerInput } from "../repositories/customersRepository";

/** Thrown for a structurally malformed request (wrong type/shape). */
export class InvalidCustomerRequestError extends Error {}

export function validateCustomerId(id: unknown): number {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new InvalidCustomerRequestError("Invalid customer id");
  }
  return id;
}

function validateOptionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidCustomerRequestError(`Invalid ${fieldName}`);
  }
  return value;
}

export function validateCustomerInput(payload: unknown): CustomerInput {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidCustomerRequestError("Invalid payload");
  }
  const { name, phone, email, address } = payload as {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    address?: unknown;
  };
  if (typeof name !== "string") {
    throw new InvalidCustomerRequestError("Invalid customer name");
  }
  return {
    name,
    phone: validateOptionalString(phone, "phone"),
    email: validateOptionalString(email, "email"),
    address: validateOptionalString(address, "address"),
  };
}

/** Pure logic, independently testable without a live ipcMain/Electron window. */
export function handleCustomersList(db: DatabaseSync): Customer[] {
  return listCustomersService(db);
}

export function handleCustomersCreate(db: DatabaseSync, payload: unknown): Customer {
  const input = validateCustomerInput(payload);
  return createCustomerService(db, input);
}

export function handleCustomersUpdate(db: DatabaseSync, payload: unknown): void {
  if (typeof payload !== "object" || payload === null) {
    throw new InvalidCustomerRequestError("Invalid payload");
  }
  const { id, ...inputPayload } = payload as { id?: unknown; [key: string]: unknown };
  const validId = validateCustomerId(id);
  const input = validateCustomerInput(inputPayload);
  updateCustomerValue(db, validId, input);
}

/**
 * Never exposes database paths, raw SQL, stack traces, or filesystem
 * paths to the renderer. Recognized validation/not-found errors pass
 * their (already-safe) message through as-is; anything else is logged
 * in full here and replaced with a generic message before crossing IPC.
 */
function toSafeError(error: unknown): Error {
  console.error("[customers IPC]", error);
  if (
    error instanceof InvalidCustomerRequestError ||
    error instanceof InvalidCustomerValueError ||
    error instanceof CustomerNotFoundError
  ) {
    return new Error(error.message);
  }
  return new Error("Something went wrong while accessing customers. Please try again.");
}

export function registerCustomersHandlers(db: DatabaseSync): void {
  ipcMain.handle("customers:list", () => {
    try {
      return handleCustomersList(db);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("customers:create", (_event, payload: unknown) => {
    try {
      return handleCustomersCreate(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("customers:update", (_event, payload: unknown) => {
    try {
      handleCustomersUpdate(db, payload);
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
