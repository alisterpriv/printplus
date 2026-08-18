import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { createCustomer } from "../repositories/customersRepository";
import {
  validateOrderId,
  validateOrderInput,
  validateOrderStatus,
  handleOrdersList,
  handleOrdersGet,
  handleOrdersCreate,
  handleOrdersUpdateStatus,
  InvalidOrderRequestError,
} from "./ordersHandlers";
import { InvalidOrderValueError } from "../services/ordersService";
import { OrderNotFoundError } from "../repositories/ordersRepository";
import { CustomerNotFoundError } from "../repositories/customersRepository";

describe("validateOrderId", () => {
  it("accepts a positive integer", () => {
    expect(validateOrderId(1)).toBe(1);
  });

  it("rejects a non-number, zero, negative, or non-integer", () => {
    expect(() => validateOrderId("1")).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderId(null)).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderId(0)).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderId(-1)).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderId(1.5)).toThrow(InvalidOrderRequestError);
  });
});

describe("validateOrderInput", () => {
  const validItem = { printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 1 };

  it("accepts a well-formed payload", () => {
    const input = validateOrderInput({ customerId: 1, items: [validItem], discountPercent: 0, gstPercent: 18 });
    expect(input.customerId).toBe(1);
    expect(input.items).toHaveLength(1);
  });

  it("rejects a non-object payload", () => {
    expect(() => validateOrderInput("nope")).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderInput(null)).toThrow(InvalidOrderRequestError);
  });

  it("rejects an invalid customer id", () => {
    expect(() =>
      validateOrderInput({ customerId: "1", items: [validItem], discountPercent: 0, gstPercent: 18 })
    ).toThrow(InvalidOrderRequestError);
    expect(() =>
      validateOrderInput({ customerId: 0, items: [validItem], discountPercent: 0, gstPercent: 18 })
    ).toThrow(InvalidOrderRequestError);
  });

  it("rejects a non-array items list", () => {
    expect(() =>
      validateOrderInput({ customerId: 1, items: "not-an-array", discountPercent: 0, gstPercent: 18 })
    ).toThrow(InvalidOrderRequestError);
  });

  it("rejects a malformed item (missing print type)", () => {
    expect(() =>
      validateOrderInput({
        customerId: 1,
        items: [{ width: 1, height: 1, unit: "Meter", rate: 500, quantity: 1 }],
        discountPercent: 0,
        gstPercent: 18,
      })
    ).toThrow(InvalidOrderRequestError);
  });

  it("rejects a non-finite item width", () => {
    expect(() =>
      validateOrderInput({
        customerId: 1,
        items: [{ ...validItem, width: "1" }],
        discountPercent: 0,
        gstPercent: 18,
      })
    ).toThrow(InvalidOrderRequestError);
  });

  it("accepts a zero or negative rate/width structurally — business rejection, if any, is the service's job", () => {
    expect(() =>
      validateOrderInput({
        customerId: 1,
        items: [{ ...validItem, width: -5, rate: 0 }],
        discountPercent: 0,
        gstPercent: 18,
      })
    ).not.toThrow();
  });

  it("rejects a non-finite discountPercent/gstPercent", () => {
    expect(() =>
      validateOrderInput({ customerId: 1, items: [validItem], discountPercent: "0", gstPercent: 18 })
    ).toThrow(InvalidOrderRequestError);
    expect(() =>
      validateOrderInput({ customerId: 1, items: [validItem], discountPercent: 0, gstPercent: NaN })
    ).toThrow(InvalidOrderRequestError);
  });
});

describe("validateOrderStatus", () => {
  it("accepts a non-empty string", () => {
    expect(validateOrderStatus("Pending")).toBe("Pending");
  });

  it("rejects a non-string or empty string", () => {
    expect(() => validateOrderStatus(1)).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderStatus("")).toThrow(InvalidOrderRequestError);
    expect(() => validateOrderStatus(null)).toThrow(InvalidOrderRequestError);
  });
});

describe("handleOrdersList / handleOrdersGet / handleOrdersCreate / handleOrdersUpdateStatus", () => {
  let db: DatabaseSync;
  let customerId: number;

  beforeEach(() => {
    db = createConnection(":memory:");
    runMigrations(db);
    customerId = createCustomer(db, { name: "Ramesh", phone: "123", email: null, address: "Road" }).id;
  });

  const validPayload = () => ({
    customerId,
    items: [{ printType: "Flex", width: 1, height: 1, unit: "Meter", rate: 500, quantity: 1 }],
    discountPercent: 0,
    gstPercent: 18,
  });

  it("lists orders (empty on a fresh database)", () => {
    expect(handleOrdersList(db)).toHaveLength(0);
  });

  it("creates an order through the full handler logic", () => {
    const created = handleOrdersCreate(db, validPayload());
    expect(handleOrdersList(db)).toHaveLength(1);
    expect(created.customerId).toBe(customerId);
  });

  it("gets an order through the full handler logic", () => {
    const created = handleOrdersCreate(db, validPayload());
    const found = handleOrdersGet(db, created.id);
    expect(found).toEqual(created);
  });

  it("rejects a malformed create payload before touching the database", () => {
    expect(() => handleOrdersCreate(db, "nope")).toThrow(InvalidOrderRequestError);
    expect(() => handleOrdersCreate(db, { customerId, items: [] })).toThrow(InvalidOrderRequestError);
  });

  it("propagates a business-rule rejection from the service (empty items)", () => {
    expect(() => handleOrdersCreate(db, { ...validPayload(), items: [] })).toThrow(InvalidOrderValueError);
  });

  it("propagates CustomerNotFoundError for a nonexistent customer id", () => {
    expect(() => handleOrdersCreate(db, { ...validPayload(), customerId: 999999 })).toThrow(CustomerNotFoundError);
  });

  it("propagates OrderNotFoundError for a nonexistent order id on get", () => {
    expect(() => handleOrdersGet(db, 999999)).toThrow(OrderNotFoundError);
  });

  it("updates status through the full handler logic", () => {
    const created = handleOrdersCreate(db, validPayload());
    handleOrdersUpdateStatus(db, { id: created.id, status: "Processing" });
    expect(handleOrdersGet(db, created.id).status).toBe("Processing");
  });

  it("rejects an invalid status value at the service layer", () => {
    const created = handleOrdersCreate(db, validPayload());
    expect(() => handleOrdersUpdateStatus(db, { id: created.id, status: "Cancelled" })).toThrow(
      InvalidOrderValueError
    );
  });

  it("rejects a malformed updateStatus payload before touching the database", () => {
    expect(() => handleOrdersUpdateStatus(db, "nope")).toThrow(InvalidOrderRequestError);
    expect(() => handleOrdersUpdateStatus(db, { id: 1 })).toThrow(InvalidOrderRequestError);
  });

  describe("PHASE 11 — invoice numbers", () => {
    it("handleOrdersCreate returns an order with a real, server-derived invoice number", () => {
      const created = handleOrdersCreate(db, validPayload());
      expect(created.invoiceNumber).toBe(`INV-${String(created.id).padStart(6, "0")}`);
    });

    it("handleOrdersGet returns the same persisted invoice number", () => {
      const created = handleOrdersCreate(db, validPayload());
      expect(handleOrdersGet(db, created.id).invoiceNumber).toBe(created.invoiceNumber);
    });

    it("a renderer-supplied invoiceNumber in the create payload is ignored, not honored", () => {
      const created = handleOrdersCreate(db, { ...validPayload(), invoiceNumber: "INV-999999" });
      expect(created.invoiceNumber).not.toBe("INV-999999");
      expect(created.invoiceNumber).toBe(`INV-${String(created.id).padStart(6, "0")}`);
    });

    it("validateOrderInput does not carry an injected invoiceNumber field through to the trusted NewOrderInput", () => {
      const input = validateOrderInput({ ...validPayload(), invoiceNumber: "INV-999999" });
      expect(input).not.toHaveProperty("invoiceNumber");
    });
  });
});
