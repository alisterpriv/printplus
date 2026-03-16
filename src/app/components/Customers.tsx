import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Search, UserPlus, Mail, Phone } from "lucide-react";

const customers: any[] = [];

export function Customers() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
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
          <p className="text-2xl font-bold text-[#1F2937]">0</p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Active This Month</p>
          <p className="text-2xl font-bold text-green-600">0</p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">New This Month</p>
          <p className="text-2xl font-bold text-blue-600">0</p>
        </Card>

        <Card className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
          <p className="text-2xl font-bold text-purple-600">₹0</p>
        </Card>

      </div>

      {/* Customers Grid */}
      {filteredCustomers.length > 0 ? (

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {filteredCustomers.map((customer) => (

            <Card
              key={customer.id}
              className="p-6 bg-white border border-gray-200 rounded-xl"
            >

              <div className="flex items-start justify-between mb-4">

                <div className="flex items-center gap-4">

                  <div className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {customer.name?.[0] || "C"}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-[#1F2937] text-lg">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Customer ID: #{customer.id}
                    </p>
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

              <div className="flex gap-2 mt-4">

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-300"
                >
                  View Details
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-300"
                >
                  New Bill
                </Button>

              </div>

            </Card>

          ))}

        </div>

      ) : (

        <Card className="p-12 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-gray-500">No customers found</p>
        </Card>

      )}

    </div>
  );
}
