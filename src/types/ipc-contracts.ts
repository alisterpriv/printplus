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

export interface CustomersSummary {
  activeThisMonth: number;
  newThisMonth: number;
  avgOrderValue: number;
}

export interface CustomersApi {
  list(): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: number, input: CustomerInput): Promise<void>;
  getSummary(): Promise<CustomersSummary>;
}

export type OrderStatus = "Pending" | "Processing" | "Completed";

export type PaymentStatus = "Unpaid" | "Partial" | "Paid";

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
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
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

export interface OrdersSummary {
  totalRevenue: number;
  todaysOrders: number;
}

export interface OrdersApi {
  list(): Promise<Order[]>;
  get(id: number): Promise<Order>;
  create(input: OrderInput): Promise<Order>;
  updateStatus(id: number, status: OrderStatus): Promise<void>;
  recordPayment(orderId: number, amountPaidRupees: number): Promise<Order>;
  getSummary(): Promise<OrdersSummary>;
}

export interface DashboardRecentOrder {
  id: number;
  customerName: string;
  status: OrderStatus;
  grandTotal: number;
  createdAt: string;
}

export interface DashboardSummary {
  todaysRevenue: number;
  todaysOrders: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalCustomers: number;
  recentOrders: DashboardRecentOrder[];
  mostUsedPrintType: string | null;
  outstandingAmount: number;
}

export interface DashboardApi {
  getSummary(): Promise<DashboardSummary>;
}

export interface BusinessSettings {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettingsInput {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
}

export interface BusinessSettingsApi {
  get(): Promise<BusinessSettings>;
  update(input: BusinessSettingsInput): Promise<BusinessSettings>;
}

export type BackupCreateOutcome =
  | { status: "success"; filePath: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export type BackupRestoreOutcome =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

export interface BackupApi {
  create(): Promise<BackupCreateOutcome>;
  restore(): Promise<BackupRestoreOutcome>;
}

export interface PrintPlusApi {
  settings: SettingsApi;
  rates: RatesApi;
  customers: CustomersApi;
  orders: OrdersApi;
  dashboard: DashboardApi;
  businessSettings: BusinessSettingsApi;
  backup: BackupApi;
}

declare global {
  interface Window {
    api: PrintPlusApi;
  }
}
