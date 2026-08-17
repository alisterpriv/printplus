/**
 * Contracts shared between the renderer and the Electron main process.
 * Only the SHAPE of requests/responses crossing the process boundary
 * belongs here — never storage details (e.g. DatabaseSync, SQL, raw
 * table row shapes). See Phase 3 report for the full rule.
 */

export interface SettingsApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Rate {
  id: number;
  printType: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
}

export interface RatesApi {
  list(): Promise<Rate[]>;
  update(id: number, rate: number): Promise<void>;
}

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
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface CustomersApi {
  list(): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: number, input: CustomerInput): Promise<void>;
}

export type OrderStatus = "Pending" | "Processing" | "Completed";

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
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  status: OrderStatus;
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

export interface OrderItemInput {
  printType: string;
  width: number;
  height: number;
  unit: string;
  rate: number;
  quantity: number;
}

export interface OrderInput {
  customerId: number;
  items: OrderItemInput[];
  discountPercent: number;
  gstPercent: number;
}

export interface OrdersApi {
  list(): Promise<Order[]>;
  get(id: number): Promise<Order>;
  create(input: OrderInput): Promise<Order>;
  updateStatus(id: number, status: OrderStatus): Promise<void>;
}

export interface PrintPlusApi {
  settings: SettingsApi;
  rates: RatesApi;
  customers: CustomersApi;
  orders: OrdersApi;
}

declare global {
  interface Window {
    api: PrintPlusApi;
  }
}
