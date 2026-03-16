import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Search, Eye, Printer } from "lucide-react";

const orders = [
  {
    id: "#001",
    customer: "Raj Kumar",
    phone: "+91 98765 43210",
    items: 3,
    amount: "₹1,250",
    date: "Mar 9, 2026",
    time: "10:30 AM",
    status: "Completed",
  },
  {
    id: "#002",
    customer: "Priya Sharma",
    phone: "+91 98765 43211",
    items: 2,
    amount: "₹850",
    date: "Mar 9, 2026",
    time: "09:15 AM",
    status: "Completed",
  },
  {
    id: "#003",
    customer: "Amit Patel",
    phone: "+91 98765 43212",
    items: 5,
    amount: "₹2,100",
    date: "Mar 8, 2026",
    time: "04:20 PM",
    status: "Completed",
  },
  {
    id: "#004",
    customer: "Sunita Singh",
    phone: "+91 98765 43213",
    items: 1,
    amount: "₹650",
    date: "Mar 8, 2026",
    time: "02:45 PM",
    status: "Completed",
  },
  {
    id: "#005",
    customer: "Vikram Reddy",
    phone: "+91 98765 43214",
    items: 4,
    amount: "₹1,800",
    date: "Mar 7, 2026",
    time: "11:10 AM",
    status: "Completed",
  },
  {
    id: "#006",
    customer: "Anjali Verma",
    phone: "+91 98765 43215",
    items: 2,
    amount: "₹920",
    date: "Mar 7, 2026",
    time: "03:30 PM",
    status: "Completed",
  },
  {
    id: "#007",
    customer: "Rahul Kapoor",
    phone: "+91 98765 43216",
    items: 3,
    amount: "₹1,450",
    date: "Mar 6, 2026",
    time: "01:15 PM",
    status: "Completed",
  },
  {
    id: "#008",
    customer: "Deepa Nair",
    phone: "+91 98765 43217",
    items: 1,
    amount: "₹550",
    date: "Mar 6, 2026",
    time: "10:00 AM",
    status: "Completed",
  },
];

export function Orders() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.phone.includes(searchQuery)
  );

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Orders</h1>
        <p className="text-gray-600 mt-2">View and manage all your orders</p>
      </div>

      {/* Search and Filter */}
      <Card className="p-6 bg-white border border-gray-200 rounded-xl mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by order ID, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
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
          <p className="text-2xl font-bold text-[#2563EB]">₹10,570</p>
        </Card>
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Today's Orders</p>
          <p className="text-2xl font-bold text-purple-600">2</p>
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Items</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-[#2563EB]">{order.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{order.items}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.amount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{order.date}</div>
                    <div className="text-xs text-gray-500">{order.time}</div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No orders found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
