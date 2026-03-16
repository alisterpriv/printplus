import { Link } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { 
  DollarSign, 
  FileText, 
  ShoppingCart, 
  TrendingUp,
  Plus,
  Eye,
  Settings
} from "lucide-react";

const statsCards = [
  {
    title: "Today's Revenue",
    value: "₹12,450",
    change: "+12.5%",
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Bills Generated Today",
    value: "24",
    change: "+8 from yesterday",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Total Orders",
    value: "156",
    change: "This month",
    icon: ShoppingCart,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Most Used Print Type",
    value: "Flex",
    change: "45% of orders",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

const quickActions = [
  {
    title: "Create New Bill",
    description: "Start a new billing process",
    icon: Plus,
    path: "/create-bill",
    color: "bg-[#2563EB] hover:bg-blue-700",
  },
  {
    title: "View Orders",
    description: "Check all pending orders",
    icon: Eye,
    path: "/orders",
    color: "bg-gray-700 hover:bg-gray-800",
  },
  {
    title: "Edit Rates",
    description: "Update pricing settings",
    icon: Settings,
    path: "/rate-settings",
    color: "bg-gray-700 hover:bg-gray-800",
  },
];

export function Dashboard() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your business overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">{stat.title}</p>
                  <p className="text-3xl font-bold text-[#1F2937] mb-1">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.change}</p>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-[#1F2937] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} to={action.path}>
                <Card className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`${action.color} p-3 rounded-lg text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1F2937] mb-1">{action.title}</h3>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-bold text-[#1F2937] mb-4">Recent Bills</h2>
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Bill ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { id: "#001", customer: "Raj Kumar", amount: "₹1,250", date: "Mar 9, 2026", status: "Paid" },
                  { id: "#002", customer: "Priya Sharma", amount: "₹850", date: "Mar 9, 2026", status: "Paid" },
                  { id: "#003", customer: "Amit Patel", amount: "₹2,100", date: "Mar 8, 2026", status: "Paid" },
                  { id: "#004", customer: "Sunita Singh", amount: "₹650", date: "Mar 8, 2026", status: "Paid" },
                  { id: "#005", customer: "Vikram Reddy", amount: "₹1,800", date: "Mar 7, 2026", status: "Paid" },
                ].map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-[#2563EB]">{bill.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{bill.customer}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{bill.amount}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{bill.date}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
