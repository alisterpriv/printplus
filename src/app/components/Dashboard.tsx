import { Link } from "react-router";
import { Card } from "./ui/card";
import {
  DollarSign,
  FileText,
  ShoppingCart,
  TrendingUp,
  Plus,
  Eye,
  Settings
} from "lucide-react";

export function Dashboard() {

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
              <p className="text-2xl font-bold">₹0</p>
            </div>
            <DollarSign className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Bills Generated Today</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <FileText className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <ShoppingCart className="w-6 h-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-6 border rounded-xl">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Most Used Print Type</p>
              <p className="text-2xl font-bold">-</p>
            </div>
            <TrendingUp className="w-6 h-6 text-gray-500" />
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

      {/* Recent Bills */}
      <div className="mt-8">

        <h2 className="text-xl font-bold mb-4">Recent Bills</h2>

        <Card className="p-10 text-center border rounded-xl">
          <p className="text-gray-500">No recent bills</p>
        </Card>

      </div>

    </div>
  );
}
