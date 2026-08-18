import type { DatabaseSync } from "node:sqlite";

export interface OrderItem {
  id: number;
  printType: string;
  width: number;
  height: number;
  unit: string;
  areaSquareMeters: number;
  rate: number;
  quantity: number;
  total: number;
}

export interface Order {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  status: string;
  items: OrderItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
}

/** Raw insert input for a single item — already paise-denominated, already historically resolved. */
export interface CreateOrderItemInput {
  printType: string;
  width: number;
  height: number;
  unit: string;
  areaSquareMeters: number;
  ratePaise: number;
  quantity: number;
  totalPaise: number;
}

/** Raw insert input for an order — already paise-denominated, already historically resolved by the service. */
export interface CreateOrderInput {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  status: string;
  subtotalPaise: number;
  discountPercent: number;
  discountPaise: number;
  gstPercent: number;
  gstPaise: number;
  grandTotalPaise: number;
  items: CreateOrderItemInput[];
}

interface OrderRow {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  status: string;
  subtotal_paise: number;
  discount_percent: number;
  discount_paise: number;
  gst_percent: number;
  gst_paise: number;
  grand_total_paise: number;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: number;
  order_id: number;
  print_type: string;
  width: number;
  height: number;
  unit: string;
  area_sq_meters: number;
  rate_paise: number;
  quantity: number;
  total_paise: number;
}

/** Thrown when a lookup targets an order id that doesn't exist. */
export class OrderNotFoundError extends Error {}

function paiseToRupees(paise: number): number {
  return paise / 100;
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    printType: row.print_type,
    width: row.width,
    height: row.height,
    unit: row.unit,
    areaSquareMeters: row.area_sq_meters,
    rate: paiseToRupees(row.rate_paise),
    quantity: row.quantity,
    total: paiseToRupees(row.total_paise),
  };
}

function toOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    status: row.status,
    items,
    subtotal: paiseToRupees(row.subtotal_paise),
    discountPercent: row.discount_percent,
    discountAmount: paiseToRupees(row.discount_paise),
    gstPercent: row.gst_percent,
    gstAmount: paiseToRupees(row.gst_paise),
    grandTotal: paiseToRupees(row.grand_total_paise),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getItemsForOrder(db: DatabaseSync, orderId: number): OrderItem[] {
  const rows = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
    .all(orderId) as unknown as OrderItemRow[];
  return rows.map(toOrderItem);
}

/**
 * The only file allowed to contain SQL for the orders/order_items tables.
 * Money is stored as integer paise; every function here converts to and
 * from plain rupee numbers, so nothing above this file ever needs to know
 * paise exists.
 */
export function listOrders(db: DatabaseSync): Order[] {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all() as unknown as OrderRow[];
  return rows.map((row) => toOrder(row, getItemsForOrder(db, row.id)));
}

export function getOrder(db: DatabaseSync, id: number): Order {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as unknown as OrderRow | undefined;
  if (!row) {
    throw new OrderNotFoundError(`No order found with id ${id}`);
  }
  return toOrder(row, getItemsForOrder(db, id));
}

/** Matches the same "INV-" + 6-digit-minimum-width formula migration 7 used to backfill existing orders. */
function invoiceNumberForId(id: number): string {
  return `INV-${String(id).padStart(6, "0")}`;
}

/**
 * Inserts the order and all of its items in a single transaction, deriving
 * invoice_number from the order's own generated id immediately after
 * insert and before anything else happens. If any item insert fails, the
 * whole transaction (including the order row and its invoice number) is
 * rolled back — there must never be a persisted order without all of its
 * items, and never an order whose invoice number didn't survive with it.
 */
export function createOrder(db: DatabaseSync, input: CreateOrderInput): Order {
  db.exec("BEGIN");
  try {
    const orderResult = db
      .prepare(
        `INSERT INTO orders (
           customer_id, customer_name, customer_phone, customer_address, status,
           subtotal_paise, discount_percent, discount_paise, gst_percent, gst_paise, grand_total_paise,
           invoice_number, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'), datetime('now'))`
      )
      .run(
        input.customerId,
        input.customerName,
        input.customerPhone,
        input.customerAddress,
        input.status,
        input.subtotalPaise,
        input.discountPercent,
        input.discountPaise,
        input.gstPercent,
        input.gstPaise,
        input.grandTotalPaise
      );

    const orderId = orderResult.lastInsertRowid as number;

    db.prepare("UPDATE orders SET invoice_number = ? WHERE id = ?").run(invoiceNumberForId(orderId), orderId);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, print_type, width, height, unit, area_sq_meters, rate_paise, quantity, total_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of input.items) {
      insertItem.run(
        orderId,
        item.printType,
        item.width,
        item.height,
        item.unit,
        item.areaSquareMeters,
        item.ratePaise,
        item.quantity,
        item.totalPaise
      );
    }

    db.exec("COMMIT");
    return getOrder(db, orderId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateOrderStatus(db: DatabaseSync, id: number, status: string): void {
  const result = db
    .prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, id);

  if (result.changes === 0) {
    throw new OrderNotFoundError(`No order found with id ${id}`);
  }
}

/**
 * PHASE 9 — a half-open UTC range: created_at >= startUtc AND created_at
 * < endUtc. Both bounds must already be in the same "YYYY-MM-DD HH:MM:SS"
 * UTC-naive string format orders.created_at is stored in — computing that
 * (e.g. converting the machine's local "today" into this format) is the
 * caller's job, not this repository's; see dashboardService.ts.
 */
export interface DateRange {
  startUtc: string;
  endUtc: string;
}

export function countOrders(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM orders").get() as { count: number };
  return row.count;
}

export function countOrdersByStatus(db: DatabaseSync, status: string): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = ?").get(status) as {
    count: number;
  };
  return row.count;
}

export function countOrdersInRange(db: DatabaseSync, range: DateRange): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE created_at >= ? AND created_at < ?")
    .get(range.startUtc, range.endUtc) as { count: number };
  return row.count;
}

/**
 * Sums grand_total_paise directly in SQL — an exact integer sum, never a
 * rupee-float sum in TypeScript. COALESCE guards the zero-orders case,
 * where SQLite's SUM() over no rows returns NULL rather than 0.
 */
export function sumGrandTotalPaise(db: DatabaseSync, range: DateRange): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(grand_total_paise), 0) as total FROM orders WHERE created_at >= ? AND created_at < ?")
    .get(range.startUtc, range.endUtc) as { total: number };
  return row.total;
}

/**
 * A lightweight summary row — deliberately NOT the full Order shape, and
 * deliberately does not load order_items, so a dashboard "recent orders"
 * list never pays the per-order item-fetch cost listOrders/getOrder do.
 * Money stays as paise here; converting to rupees is dashboardService's
 * job (paise -> rupees happens exactly once, at the service boundary).
 */
export interface RecentOrderSummary {
  id: number;
  customerName: string;
  status: string;
  grandTotalPaise: number;
  createdAt: string;
}

export function getRecentOrders(db: DatabaseSync, limit: number): RecentOrderSummary[] {
  const rows = db
    .prepare("SELECT id, customer_name, status, grand_total_paise, created_at FROM orders ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as {
    id: number;
    customer_name: string;
    status: string;
    grand_total_paise: number;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    status: row.status,
    grandTotalPaise: row.grand_total_paise,
    createdAt: row.created_at,
  }));
}

export interface PrintTypeUsage {
  printType: string;
  totalQuantity: number;
}

/**
 * "Most used" = highest total quantity across order_items, grouped by the
 * raw print_type text (order_items has no FK to rates — see migration 4 —
 * so this counts every historical item exactly as it was billed).
 */
export function getTopPrintTypes(db: DatabaseSync, limit: number): PrintTypeUsage[] {
  const rows = db
    .prepare(
      `SELECT print_type, SUM(quantity) as total_quantity
       FROM order_items
       GROUP BY print_type
       ORDER BY total_quantity DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { print_type: string; total_quantity: number }[];

  return rows.map((row) => ({ printType: row.print_type, totalQuantity: row.total_quantity }));
}
