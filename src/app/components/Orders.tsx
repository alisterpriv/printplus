import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus, PaymentStatus, OrdersSummary } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Processing", "Completed"];

type StatusFilter = "All" | OrderStatus;
type DateFilter = "All" | "Today" | "This Week" | "This Month";

const STATUS_FILTER_OPTIONS: StatusFilter[] = ["All", ...ORDER_STATUSES];
const DATE_FILTER_OPTIONS: DateFilter[] = ["All", "Today", "This Week", "This Month"];

interface LocalDateRange {
  startUtc: string;
  endUtc: string;
}

/** Same "YYYY-MM-DD HH:MM:SS" UTC-naive shape orders.created_at is stored in. */
function formatAsDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * PHASE 16 — client-side mirror of the server's local-timezone,
 * DST-safe, half-open date range technique (see dashboardService.ts's
 * getTodayRangeUtc for the full reasoning). This filter stays entirely
 * client-side so it can compose with the free-text search, which is
 * also client-side and cannot be expressed as SQL.
 */
export function getTodayRangeLocal(now: Date): LocalDateRange {
  const startOfTodayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfTomorrowLocal = new Date(startOfTodayLocal.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUtc: formatAsDbTimestamp(startOfTodayLocal),
    endUtc: formatAsDbTimestamp(startOfTomorrowLocal),
  };
}

/** Monday-start local week — the first "week" concept in this codebase. */
export function getThisWeekRangeLocal(now: Date): LocalDateRange {
  const startOfTodayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const daysSinceMonday = (startOfTodayLocal.getDay() + 6) % 7;
  const startOfWeekLocal = new Date(startOfTodayLocal.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const startOfNextWeekLocal = new Date(startOfWeekLocal.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    startUtc: formatAsDbTimestamp(startOfWeekLocal),
    endUtc: formatAsDbTimestamp(startOfNextWeekLocal),
  };
}

export function getThisMonthRangeLocal(now: Date): LocalDateRange {
  const startOfMonthLocal = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfNextMonthLocal = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return {
    startUtc: formatAsDbTimestamp(startOfMonthLocal),
    endUtc: formatAsDbTimestamp(startOfNextMonthLocal),
  };
}

function matchesDateFilter(order: Order, filter: DateFilter, now: Date): boolean {
  if (filter === "All") return true;
  const range =
    filter === "Today" ? getTodayRangeLocal(now) : filter === "This Week" ? getThisWeekRangeLocal(now) : getThisMonthRangeLocal(now);
  return order.createdAt >= range.startUtc && order.createdAt < range.endUtc;
}

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>({ totalRevenue: 0, todaysOrders: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");

  useEffect(() => {
    Promise.all([window.api.orders.list(), window.api.orders.getSummary()])
      .then(([ordersResult, summaryResult]) => {
        setOrders(ordersResult);
        setSummary(summaryResult);
      })
      .catch((error) => toast.error(getErrorMessage(error, "Failed to load orders")))
      .finally(() => setIsLoading(false));
  }, []);

  const now = new Date();
  const filteredOrders = orders.filter(order =>
    (order.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone?.includes(searchQuery)) &&
    (statusFilter === "All" || order.status === statusFilter) &&
    matchesDateFilter(order, dateFilter, now)
  );

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "All" || dateFilter !== "All";
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setDateFilter("All");
  };

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    try {
      await window.api.orders.updateStatus(order.id, status);
      setOrders(orders.map(o => (o.id === order.id ? { ...o, status } : o)));
      toast.success("Order status updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update order status"));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>;
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{status}</Badge>;
      case "Processing":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{status}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>;
      case "Partial":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{status}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{status}</Badge>;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Orders</h1>
        <p className="text-gray-600 mt-2">View and manage all your orders</p>
      </div>

      {/* Search & Filters */}
      <Card className="p-6 bg-white border border-gray-200 rounded-xl mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by invoice number, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "All" ? "All Statuses" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by date">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTER_OPTIONS.map((date) => (
                <SelectItem key={date} value={date}>
                  {date === "All" ? "All Dates" : date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" className="border-gray-300 hover:bg-gray-50" onClick={resetFilters}>
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Orders Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-[#1F2937]">{orders.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === "Completed").length}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-[#2563EB]">₹{summary.totalRevenue.toFixed(2)}</p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Today's Orders</p>
          <p className="text-2xl font-bold text-purple-600">{summary.todaysOrders}</p>
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Items</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Payment</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const created = new Date((order.createdAt.replace(" ", "T")) + "Z");
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-[#2563EB]">{order.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.customerName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.customerPhone || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.items.length}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{order.grandTotal.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{Number.isNaN(created.getTime()) ? order.createdAt : created.toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">
                        {Number.isNaN(created.getTime()) ? "" : created.toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="cursor-pointer">
                            {getStatusBadge(order.status)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {ORDER_STATUSES.map((status) => (
                            <DropdownMenuItem key={status} onClick={() => handleStatusChange(order, status)}>
                              {status}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-6 py-4">
                      {getPaymentStatusBadge(order.paymentStatus)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-300 hover:bg-gray-50"
                          onClick={() => navigate(`/invoice/${order.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-300 hover:bg-gray-50"
                          onClick={() => navigate(`/invoice/${order.id}`)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!isLoading && filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No orders found</p>
            </div>
          )}
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading orders...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
