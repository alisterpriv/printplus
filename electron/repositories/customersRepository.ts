import type { DatabaseSync } from "node:sqlite";

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

/** Thrown when an update targets an id that doesn't exist. */
export class CustomerNotFoundError extends Error {}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The only file allowed to contain SQL for the customers table. */
export function listCustomers(db: DatabaseSync): Customer[] {
  const rows = db.prepare("SELECT * FROM customers ORDER BY id ASC").all() as unknown as CustomerRow[];
  return rows.map(toCustomer);
}

/** Used by ordersService to resolve the real customer behind a customer_id before snapshotting it onto an order. */
export function getCustomerById(db: DatabaseSync, id: number): Customer {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as unknown as CustomerRow | undefined;
  if (!row) {
    throw new CustomerNotFoundError(`No customer found with id ${id}`);
  }
  return toCustomer(row);
}

export function createCustomer(db: DatabaseSync, input: CustomerInput): Customer {
  const result = db
    .prepare(
      `INSERT INTO customers (name, phone, email, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(input.name, input.phone, input.email, input.address);

  const row = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as CustomerRow;
  return toCustomer(row);
}

export function updateCustomer(db: DatabaseSync, id: number, input: CustomerInput): void {
  const result = db
    .prepare(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, address = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(input.name, input.phone, input.email, input.address, id);

  if (result.changes === 0) {
    throw new CustomerNotFoundError(`No customer found with id ${id}`);
  }
}
