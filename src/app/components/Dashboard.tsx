import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  DollarSign,
  FileText,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Users,
  TrendingUp,
  Plus,
  Eye,
  Settings,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardSummary } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

function getStatusBadge(status: string) {
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
}

function formatOrderDate(createdAt: string): string {
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — reformat it so Date can parse it as UTC correctly
  // instead of ambiguously as local time (same approach as PrintInvoice.tsx).
  const parsed = new Date(createdAt.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? createdAt : parsed.toLocaleDateString();
}

export function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    window.api.dashboard
      .getSummary()
      .then((result) => {
        setSummary(result);
        setLoadError(null);
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to load dashboard");
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">{loadError ?? "Failed to load dashboard"}</p>
      </div>
    );
  }

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back! Here's your business overview.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Revenue</p>
              <p className="text-2xl font-bold">₹{summary.todaysRevenue.toFixed(2)}</p>
            </div>
            <DollarSign className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Orders</p>
              <p className="text-2xl font-bold">{summary.todaysOrders}</p>
            </div>
            <FileText className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold">{summary.totalOrders}</p>
            </div>
            <ShoppingCart className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Orders</p>
              <p className="text-2xl font-bold">{summary.pendingOrders}</p>
            </div>
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed Orders</p>
              <p className="text-2xl font-bold">{summary.completedOrders}</p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold">{summary.totalCustomers}</p>
            </div>
            <Users className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Amount</p>
              <p className="text-2xl font-bold">₹{summary.outstandingAmount.toFixed(2)}</p>
            </div>
            <Wallet className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

      </div>

      {/* Quick Actions */}
      <div>

        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <Link to="/create-bill">
            <Card className="p-6 border rounded-xl hover:shadow-lg">
              <div className="flex items-center gap-4">
                <Plus className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold">Create New Bill</h3>
                  <p className="text-sm text-gray-600">
                    Start a new billing process
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/orders">
            <Card className="p-6 border rounded-xl hover:shadow-lg">
              <div className="flex items-center gap-4">
                <Eye className="w-6 h-6 text-gray-700" />
                <div>
                  <h3 className="font-semibold">View Orders</h3>
                  <p className="text-sm text-gray-600">
                    Check all orders
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/rate-settings">
            <Card className="p-6 border rounded-xl hover:shadow-lg">
              <div className="flex items-center gap-4">
                <Settings className="w-6 h-6 text-gray-700" />
                <div>
                  <h3 className="font-semibold">Edit Rates</h3>
                  <p className="text-sm text-gray-600">
                    Update pricing settings
                  </p>
                </div>
              </div>
            </Card>
          </Link>

        </div>

      </div>

      {/* Recent Orders + Most Used Print Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">

        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4">Recent Orders</h2>

          {summary.recentOrders.length === 0 ? (
            <Card className="p-10 text-center border rounded-xl">
              <p className="text-gray-500">No orders yet</p>
            </Card>
          ) : (
            <Card className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-200">
                    {summary.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/invoice/${order.id}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[#2563EB]">#{order.id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatOrderDate(order.createdAt)}</td>
                        <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          ₹{order.grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Most Used Print Type</h2>
          <Card className="p-6 border rounded-xl">
            <div className="flex justify-between items-center">
              <p className="text-2xl font-bold">{summary.mostUsedPrintType ?? "No data yet"}</p>
              <TrendingUp className="w-6 h-6 text-gray-500" />
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
