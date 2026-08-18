import type { DatabaseSync } from "node:sqlite";
import {
  countOrders,
  countOrdersByStatus,
  countOrdersInRange,
  sumGrandTotalPaise,
  getRecentOrders,
  getTopPrintTypes,
  type DateRange,
} from "../repositories/ordersRepository";
import { countCustomers } from "../repositories/customersRepository";

const RECENT_ORDERS_LIMIT = 5;
const TOP_PRINT_TYPE_LIMIT = 1;

export interface DashboardRecentOrder {
  id: number;
  customerName: string;
  status: string;
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
}

function paiseToRupees(paise: number): number {
  return paise / 100;
}

function formatAsDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * "Today" means today in the machine's local timezone — not UTC.
 * orders.created_at is stored as a UTC-naive "YYYY-MM-DD HH:MM:SS" string
 * (see connection.ts/migrations.ts), so "local midnight" has to be
 * converted to its equivalent UTC instant before it can be compared
 * against created_at with a plain string range.
 *
 * Date's local getters (getFullYear/getMonth/getDate) already reflect
 * whatever timezone the OS is set to; the Date constructor interprets
 * those same numbers as local time when building a new Date. Round-
 * tripping through it like this — read today's local Y/M/D, then build a
 * new Date from exactly those numbers — gives the correct UTC instant for
 * local midnight regardless of DST or which timezone the machine is in,
 * with no manual UTC-offset arithmetic.
 *
 * Returns a half-open range: [start of today, start of tomorrow).
 */
export function getTodayRangeUtc(now: Date = new Date()): DateRange {
  const startOfTodayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfTomorrowLocal = new Date(startOfTodayLocal.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUtc: formatAsDbTimestamp(startOfTodayLocal),
    endUtc: formatAsDbTimestamp(startOfTomorrowLocal),
  };
}

/**
 * Composes the Dashboard's summary from the orders/customers repositories.
 * Contains no SQL of its own — every number comes from a repository
 * aggregate query (COUNT/SUM/GROUP BY in SQLite), never from fetching
 * full rows and summing them in TypeScript.
 *
 * Money crosses from paise (repository) to rupees (this function's
 * return value) exactly once, here, at the service boundary — the same
 * paiseToRupees conversion point every other service in this app uses.
 *
 * Deliberately does not catch/swallow repository errors: if any
 * underlying query fails, this function throws and the whole summary
 * request fails. A dashboard silently showing "Today's Revenue: ₹0" on a
 * database error would be indistinguishable from a real zero-sales day —
 * that ambiguity is unacceptable for a number a shop owner makes
 * decisions from.
 */
export function getDashboardSummary(db: DatabaseSync, now: Date = new Date()): DashboardSummary {
  const todayRange = getTodayRangeUtc(now);

  const recentOrders: DashboardRecentOrder[] = getRecentOrders(db, RECENT_ORDERS_LIMIT).map((order) => ({
    id: order.id,
    customerName: order.customerName,
    status: order.status,
    grandTotal: paiseToRupees(order.grandTotalPaise),
    createdAt: order.createdAt,
  }));

  const topPrintTypes = getTopPrintTypes(db, TOP_PRINT_TYPE_LIMIT);

  return {
    todaysRevenue: paiseToRupees(sumGrandTotalPaise(db, todayRange)),
    todaysOrders: countOrdersInRange(db, todayRange),
    totalOrders: countOrders(db),
    pendingOrders: countOrdersByStatus(db, "Pending"),
    completedOrders: countOrdersByStatus(db, "Completed"),
    totalCustomers: countCustomers(db),
    recentOrders,
    mostUsedPrintType: topPrintTypes[0]?.printType ?? null,
  };
}
