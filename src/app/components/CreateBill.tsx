import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Trash2, Plus, Printer, Save, FileDown } from "lucide-react";
import { toast } from "sonner";

interface BillItem {
  id: string;
  type: string;
  width: number;
  height: number;
  area: number;
  rate: number;
  quantity: number;
  total: number;
}

const printTypes = [
  { name: "Flex", rate: 10 },
  { name: "Banner", rate: 12 },
  { name: "Vinyl", rate: 15 },
  { name: "Sunboard", rate: 18 },
  { name: "Canvas", rate: 20 },
  { name: "Custom", rate: 0 },
];

const units = [
  { name: "Meter", toMeter: 1 },
  { name: "Centimeter", toMeter: 0.01 },
  { name: "Inch", toMeter: 0.0254 },
  { name: "Feet", toMeter: 0.3048 },
];

export function CreateBill() {
  const navigate = useNavigate();
  
  // Customer Info
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Print Job Details
  const [printType, setPrintType] = useState("");
  const [unit, setUnit] = useState("Meter");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Bill Items
  const [items, setItems] = useState<BillItem[]>([]);

  // Summary
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("18");

  // Calculate area in square meters
  const calculateArea = () => {
    if (!width || !height || !unit) return 0;
    const w = parseFloat(width);
    const h = parseFloat(height);
    const unitMultiplier = units.find(u => u.name === unit)?.toMeter || 1;
    return w * h * unitMultiplier * unitMultiplier;
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
      area: area,
      rate: parseFloat(rate),
      quantity: parseInt(quantity),
      total: area * parseFloat(rate) * parseInt(quantity),
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
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * parseFloat(discount || "0")) / 100;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = (taxableAmount * parseFloat(gst || "0")) / 100;
  const grandTotal = taxableAmount + gstAmount;

  // Print Invoice
  const handlePrintInvoice = () => {
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (!customerName) {
      toast.error("Please enter customer name");
      return;
    }
    
    // Save bill data to localStorage for the invoice page
    const billData = {
      id: Date.now().toString(),
      customerName,
      phone,
      address,
      items,
      subtotal,
      discount: discountAmount,
      gst: gstAmount,
      grandTotal,
      date: new Date().toLocaleDateString(),
    };
    
    localStorage.setItem(`bill-${billData.id}`, JSON.stringify(billData));
    navigate(`/invoice/${billData.id}`);
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
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter customer address"
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
                <Select value={printType} onValueChange={handlePrintTypeChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select print type" />
                  </SelectTrigger>
                  <SelectContent>
                    {printTypes.map((type) => (
                      <SelectItem key={type.name} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
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
                    ₹{(area * parseFloat(rate || "0") * parseInt(quantity || "1")).toFixed(2)}
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
                className="w-full bg-[#2563EB] hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Invoice
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
    </div>
  );
}
