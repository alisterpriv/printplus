import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Trash2, Plus, Printer, Save, FileDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  calculateAreaInSquareMeters,
  calculateItemTotal,
  calculateBillSummary,
  type LengthUnit,
} from "../../domain/pricing";
import type { Rate, Customer } from "../../types/ipc-contracts";

interface BillItem {
  id: string;
  type: string;
  width: number;
  height: number;
  unit: LengthUnit;
  area: number;
  rate: number;
  quantity: number;
  total: number;
}

const EMPTY_NEW_CUSTOMER = { name: "", phone: "", email: "", address: "" };

// "Custom" is a renderer-only escape hatch for one-off pricing — it is
// never persisted as a rate and never sent through any IPC call. Real
// print types come from the database (window.api.rates.list()) so this
// component no longer maintains its own hardcoded copy of them.
const CUSTOM_PRINT_TYPE = { name: "Custom", rate: 0 };

const units: { name: LengthUnit }[] = [
  { name: "Meter" },
  { name: "Centimeter" },
  { name: "Inch" },
  { name: "Feet" },
];

export function CreateBill() {
  const navigate = useNavigate();
  
  // Customer selection (Phase 6) — Create Bill now links to a real, saved
  // customer instead of free-typing name/phone/address each time. The
  // phone/address fields become a read-only display of the selected
  // customer, since the order's historical snapshot is resolved
  // server-side from customerId, not from whatever text might be in
  // these boxes — editing them here would silently have no effect.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const selectedCustomer = customers.find((c) => String(c.id) === selectedCustomerId) ?? null;

  // Print Job Details
  const [printType, setPrintType] = useState("");
  const [unit, setUnit] = useState<LengthUnit>("Meter");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Bill Items
  const [items, setItems] = useState<BillItem[]>([]);

  // Summary
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("18");

  // Rates, loaded from the database (Phase 4)
  const [rates, setRates] = useState<Rate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);

  useEffect(() => {
    window.api.rates
      .list()
      .then(setRates)
      .catch(() => toast.error("Failed to load print rates"))
      .finally(() => setRatesLoading(false));
  }, []);

  const loadCustomers = () => {
    setCustomersLoading(true);
    return window.api.customers
      .list()
      .then(setCustomers)
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setCustomersLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Please enter a customer name");
      return;
    }
    setIsSavingCustomer(true);
    try {
      const created = await window.api.customers.create(newCustomer);
      await loadCustomers();
      setSelectedCustomerId(String(created.id));
      setIsAddCustomerOpen(false);
      setNewCustomer(EMPTY_NEW_CUSTOMER);
      toast.success("Customer added successfully");
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Real print types come from the database; "Custom" is always appended
  // as a client-only option, matching the original hardcoded list's order.
  const printTypes = [
    ...rates.map((r) => ({ name: r.printType, rate: r.rate })),
    CUSTOM_PRINT_TYPE,
  ];

  // Calculate area in square meters
  const calculateArea = () => {
    if (!width || !height || !unit) return 0;
    const w = parseFloat(width);
    const h = parseFloat(height);
    return calculateAreaInSquareMeters(w, h, unit);
  };

  const area = calculateArea();

  // Handle print type change
  const handlePrintTypeChange = (value: string) => {
    setPrintType(value);
    const selectedType = printTypes.find(t => t.name === value);
    if (selectedType && selectedType.rate > 0) {
      setRate(selectedType.rate.toString());
    }
  };

  // Add item to bill
  const addItem = () => {
    if (!printType || !width || !height || !rate || !quantity) {
      toast.error("Please fill all fields");
      return;
    }

    const newItem: BillItem = {
      id: Date.now().toString(),
      type: printType,
      width: parseFloat(width),
      height: parseFloat(height),
      unit,
      area: area,
      rate: parseFloat(rate),
      quantity: parseInt(quantity),
      total: calculateItemTotal(area, parseFloat(rate), parseInt(quantity)),
    };

    setItems([...items, newItem]);
    
    // Reset form
    setPrintType("");
    setWidth("");
    setHeight("");
    setRate("");
    setQuantity("1");
    
    toast.success("Item added to bill");
  };

  // Delete item
  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success("Item removed");
  };

  // Calculate totals
  const { subtotal, discountAmount, gstAmount, grandTotal } = calculateBillSummary(
    items.map((item) => item.total),
    parseFloat(discount || "0"),
    parseFloat(gst || "0")
  );

  // Print Invoice — creates the persistent Order (Phase 6). Replaces the
  // old localStorage bill hand-off: the order and its items are now
  // written to SQLite in one transaction, and the invoice page reads the
  // real, persisted order back by id.
  const handlePrintInvoice = async () => {
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const order = await window.api.orders.create({
        customerId: selectedCustomer.id,
        items: items.map((item) => ({
          printType: item.type,
          width: item.width,
          height: item.height,
          unit: item.unit,
          rate: item.rate,
          quantity: item.quantity,
        })),
        discountPercent: parseFloat(discount || "0"),
        gstPercent: parseFloat(gst || "0"),
      });
      navigate(`/invoice/${order.id}`);
    } catch {
      toast.error("Failed to create order");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Create New Bill</h1>
        <p className="text-gray-600 mt-2">Generate a new bill for your customer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card className="p-6 bg-white border border-gray-200 rounded-xl">
            <h2 className="text-xl font-bold text-[#1F2937] mb-4">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="customer">Customer *</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={customersLoading}>
                    <SelectTrigger id="customer" className="flex-1">
                      <SelectValue placeholder={customersLoading ? "Loading customers..." : "Select a customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}{c.phone ? ` — ${c.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 shrink-0"
                    onClick={() => setIsAddCustomerOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add New Customer
                  </Button>
                </div>
                {!customersLoading && customers.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    No customers yet — add one to get started.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={selectedCustomer?.phone ?? ""}
                  disabled
                  placeholder="Select a customer to see phone"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={selectedCustomer?.address ?? ""}
                  disabled
                  placeholder="Select a customer to see address"
                  className="mt-1"
                />
              </div>
            </div>
          </Card>

          {/* Print Job Details */}
          <Card className="p-6 bg-white border border-gray-200 rounded-xl">
            <h2 className="text-xl font-bold text-[#1F2937] mb-4">Print Job Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <Label htmlFor="printType">Print Type *</Label>
                <Select value={printType} onValueChange={handlePrintTypeChange} disabled={ratesLoading}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={ratesLoading ? "Loading print types..." : "Select print type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {printTypes.map((type) => (
                      <SelectItem key={type.name} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!ratesLoading && rates.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    No print types configured — add rates in Rate Settings first.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as LengthUnit)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.name} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="width">Width *</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="Enter width"
                  className="mt-1"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="height">Height *</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Enter height"
                  className="mt-1"
                  step="0.01"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Area (Square Meter)</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-[#1F2937]">
                    {area.toFixed(4)} m²
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="rate">Rate per sq meter (₹) *</Label>
                <Input
                  id="rate"
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Enter rate"
                  className="mt-1"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="mt-1"
                  min="1"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Total Price</Label>
                <div className="mt-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-2xl font-bold text-[#2563EB]">
                    ₹{calculateItemTotal(area, parseFloat(rate || "0"), parseInt(quantity || "1")).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={addItem} className="w-full bg-[#2563EB] hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </Card>

          {/* Bill Items Table */}
          {items.length > 0 && (
            <Card className="p-6 bg-white border border-gray-200 rounded-xl">
              <h2 className="text-xl font-bold text-[#1F2937] mb-4">Bill Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Width</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Height</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Area (m²)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rate</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Qty</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{item.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.width.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.height.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.area.toFixed(4)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{item.rate}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItem(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-white border border-gray-200 rounded-xl sticky top-8">
            <h2 className="text-xl font-bold text-[#1F2937] mb-4">Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
              </div>

              <div>
                <Label htmlFor="discount">Discount (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  max="100"
                />
                <p className="text-sm text-gray-500 mt-1">- ₹{discountAmount.toFixed(2)}</p>
              </div>

              <div>
                <Label htmlFor="gst">GST (%)</Label>
                <Input
                  id="gst"
                  type="number"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  placeholder="18"
                  className="mt-1"
                  min="0"
                />
                <p className="text-sm text-gray-500 mt-1">+ ₹{gstAmount.toFixed(2)}</p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                  <span className="text-2xl font-bold text-[#2563EB]">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handlePrintInvoice}
                disabled={isSubmittingOrder}
                className="w-full bg-[#2563EB] hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                {isSubmittingOrder ? "Creating Order..." : "Print Invoice"}
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-gray-300 hover:bg-gray-50"
                onClick={() => toast.success("Bill saved successfully")}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Bill
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-gray-300 hover:bg-gray-50"
                onClick={() => toast.success("PDF generated successfully")}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Add New Customer Dialog */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-customer-name">Name *</Label>
              <Input
                id="new-customer-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Enter customer name"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="new-customer-phone">Phone</Label>
              <Input
                id="new-customer-phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-customer-email">Email</Label>
              <Input
                id="new-customer-email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="Enter email address"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-customer-address">Address</Label>
              <Input
                id="new-customer-address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Enter address"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-300"
              onClick={() => setIsAddCustomerOpen(false)}
              disabled={isSavingCustomer}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-blue-700"
              onClick={handleAddCustomer}
              disabled={isSavingCustomer}
            >
              {isSavingCustomer ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
