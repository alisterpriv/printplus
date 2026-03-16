import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Search, UserPlus, Mail, Phone } from "lucide-react";

const customers = [
  {
    id: "1",
    name: "Raj Kumar",
    email: "raj.kumar@example.com",
    phone: "+91 98765 43210",
    totalOrders: 15,
    totalSpent: "₹18,500",
    lastOrder: "Mar 9, 2026",
  },
  {
    id: "2",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98765 43211",
    totalOrders: 12,
    totalSpent: "₹14,200",
    lastOrder: "Mar 8, 2026",
  },
  {
    id: "3",
    name: "Amit Patel",
    email: "amit.patel@example.com",
    phone: "+91 98765 43212",
    totalOrders: 10,
    totalSpent: "₹12,800",
    lastOrder: "Mar 7, 2026",
  },
  {
    id: "4",
    name: "Sunita Singh",
    email: "sunita.singh@example.com",
    phone: "+91 98765 43213",
    totalOrders: 9,
    totalSpent: "₹11,500",
    lastOrder: "Mar 6, 2026",
  },
  {
    id: "5",
    name: "Vikram Reddy",
    email: "vikram.reddy@example.com",
    phone: "+91 98765 43214",
    totalOrders: 8,
    totalSpent: "₹10,200",
    lastOrder: "Mar 5, 2026",
  },
  {
    id: "6",
    name: "Anjali Verma",
    email: "anjali.verma@example.com",
    phone: "+91 98765 43215",
    totalOrders: 7,
    totalSpent: "₹9,800",
    lastOrder: "Mar 4, 2026",
  },
  {
    id: "7",
    name: "Rahul Kapoor",
    email: "rahul.kapoor@example.com",
    phone: "+91 98765 43216",
    totalOrders: 6,
    totalSpent: "₹8,500",
    lastOrder: "Mar 3, 2026",
  },
  {
    id: "8",
    name: "Deepa Nair",
    email: "deepa.nair@example.com",
    phone: "+91 98765 43217",
    totalOrders: 5,
    totalSpent: "₹7,200",
    lastOrder: "Mar 2, 2026",
  },
];

export function Customers() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937]">Customers</h1>
          <p className="text-gray-600 mt-2">Manage your customer database</p>
        </div>
        <Button className="bg-[#2563EB] hover:bg-blue-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card className="p-6 bg-white border border-gray-200 rounded-xl mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-[#1F2937]">{customers.length}</p>
        </Card>
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Active This Month</p>
          <p className="text-2xl font-bold text-green-600">25</p>
        </Card>
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">New This Month</p>
          <p className="text-2xl font-bold text-blue-600">4</p>
        </Card>
        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
          <p className="text-2xl font-bold text-purple-600">₹1,250</p>
        </Card>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCustomers.map((customer) => (
          <Card key={customer.id} className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-[#1F2937] text-lg">{customer.name}</h3>
                  <p className="text-sm text-gray-500">Customer ID: #{customer.id}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{customer.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                <p className="font-semibold text-[#1F2937]">{customer.totalOrders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                <p className="font-semibold text-[#2563EB]">{customer.totalSpent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Order</p>
                <p className="font-semibold text-gray-600 text-xs">{customer.lastOrder}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 border-gray-300">
                View Details
              </Button>
              <Button variant="outline" size="sm" className="flex-1 border-gray-300">
                New Bill
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <Card className="p-12 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-gray-500">No customers found</p>
        </Card>
      )}
    </div>
  );
}
