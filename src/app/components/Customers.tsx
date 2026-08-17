import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Search, UserPlus, Mail, Phone, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "../../types/ipc-contracts";

const EMPTY_FORM = { name: "", phone: "", email: "", address: "" };

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = () => {
    setIsLoading(true);
    return window.api.customers
      .list()
      .then(setCustomers)
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  const openAddDialog = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a customer name");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCustomer) {
        await window.api.customers.update(editingCustomer.id, form);
        toast.success("Customer updated successfully");
      } else {
        await window.api.customers.create(form);
        toast.success("Customer added successfully");
      }
      setIsDialogOpen(false);
      await loadCustomers();
    } catch {
      toast.error(editingCustomer ? "Failed to update customer" : "Failed to add customer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937]">Customers</h1>
          <p className="text-gray-600 mt-2">Manage your customer database</p>
        </div>

        <Button className="bg-[#2563EB] hover:bg-blue-700" onClick={openAddDialog}>
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
      {isLoading ? (

        <Card className="p-12 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-gray-500">Loading customers...</p>
        </Card>

      ) : filteredCustomers.length > 0 ? (

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

                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                  onClick={() => openEditDialog(customer)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>

              </div>

              <div className="space-y-2 mb-4">

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{customer.email || "—"}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{customer.phone || "—"}</span>
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

      {/* Add / Edit Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="customer-name">Name *</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter customer name"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email address"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Enter address"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-gray-300" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="bg-[#2563EB] hover:bg-blue-700" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
