import { useState } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar, TrendingUp, DollarSign } from "lucide-react";

const dailyRevenueData = [
  { date: "Mar 1", revenue: 8500 },
  { date: "Mar 2", revenue: 12000 },
  { date: "Mar 3", revenue: 9500 },
  { date: "Mar 4", revenue: 15000 },
  { date: "Mar 5", revenue: 11000 },
  { date: "Mar 6", revenue: 13500 },
  { date: "Mar 7", revenue: 14200 },
  { date: "Mar 8", revenue: 10800 },
  { date: "Mar 9", revenue: 12450 },
];

const monthlyRevenueData = [
  { month: "Sep", revenue: 285000 },
  { month: "Oct", revenue: 310000 },
  { month: "Nov", revenue: 295000 },
  { month: "Dec", revenue: 340000 },
  { month: "Jan", revenue: 325000 },
  { month: "Feb", revenue: 315000 },
  { month: "Mar", revenue: 265000 },
];

const printTypeData = [
  { name: "Flex", value: 45, color: "#2563EB" },
  { name: "Banner", value: 25, color: "#7C3AED" },
  { name: "Vinyl", value: 15, color: "#F59E0B" },
  { name: "Sunboard", value: 8, color: "#10B981" },
  { name: "Canvas", value: 7, color: "#EF4444" },
];

export function Reports() {
  const [dateFilter, setDateFilter] = useState("last-7-days");
  const [printTypeFilter, setPrintTypeFilter] = useState("all");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Reports & Analytics</h1>
        <p className="text-gray-600 mt-2">Analyze your business performance</p>
      </div>

      {/* Filters */}
      <Card className="p-6 bg-white border border-gray-200 rounded-xl mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateFilter">Date Range</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="printTypeFilter">Print Type</Label>
            <Select value={printTypeFilter} onValueChange={setPrintTypeFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="flex">Flex</SelectItem>
                <SelectItem value="banner">Banner</SelectItem>
                <SelectItem value="vinyl">Vinyl</SelectItem>
                <SelectItem value="sunboard">Sunboard</SelectItem>
                <SelectItem value="canvas">Canvas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-[#1F2937] mb-1">₹107,450</p>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +15.3% from last period
              </p>
            </div>
            <div className="bg-green-50 text-green-600 p-3 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">Total Orders</p>
              <p className="text-3xl font-bold text-[#1F2937] mb-1">156</p>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +8.2% from last period
              </p>
            </div>
            <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">Average Order Value</p>
              <p className="text-3xl font-bold text-[#1F2937] mb-1">₹689</p>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +5.1% from last period
              </p>
            </div>
            <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Revenue Chart */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <h3 className="text-lg font-bold text-[#1F2937] mb-4">Daily Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="revenue" fill="#2563EB" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Print Type Distribution */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <h3 className="text-lg font-bold text-[#1F2937] mb-4">Print Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={printTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {printTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-bold text-[#1F2937] mb-4">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyRevenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#6B7280" />
            <YAxis stroke="#6B7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#2563EB" 
              strokeWidth={3}
              dot={{ fill: '#2563EB', r: 5 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Top Customers */}
      <Card className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-[#1F2937]">Top Customers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Total Orders</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Total Spent</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                { name: "Raj Kumar", orders: 15, spent: "₹18,500", lastOrder: "Mar 9, 2026" },
                { name: "Priya Sharma", orders: 12, spent: "₹14,200", lastOrder: "Mar 8, 2026" },
                { name: "Amit Patel", orders: 10, spent: "₹12,800", lastOrder: "Mar 7, 2026" },
                { name: "Sunita Singh", orders: 9, spent: "₹11,500", lastOrder: "Mar 6, 2026" },
                { name: "Vikram Reddy", orders: 8, spent: "₹10,200", lastOrder: "Mar 5, 2026" },
              ].map((customer, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.orders}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{customer.spent}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
