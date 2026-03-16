import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Printer, Download, ArrowLeft } from "lucide-react";

interface BillData {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  items: Array<{
    id: string;
    type: string;
    width: number;
    height: number;
    area: number;
    rate: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  date: string;
}

export function PrintInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [billData, setBillData] = useState<BillData | null>(null);

  useEffect(() => {
    if (id) {
      const data = localStorage.getItem(`bill-${id}`);
      if (data) {
        setBillData(JSON.parse(data));
      }
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (!billData) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Action Buttons - Hide on print */}
      <div className="p-6 bg-white border-b border-gray-200 print:hidden">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate("/create-bill")}
            className="border-gray-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-gray-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-[#2563EB] hover:bg-blue-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-gray-300 rounded-lg p-8 shadow-sm print:shadow-none print:border-0">
          {/* Header */}
          <div className="border-b-2 border-gray-300 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-[#2563EB] mb-2">PrintPlus</h1>
                <p className="text-sm text-gray-600">123 Main Street, City Center</p>
                <p className="text-sm text-gray-600">Mumbai, Maharashtra 400001</p>
                <p className="text-sm text-gray-600">Phone: +91 12345 67890</p>
                <p className="text-sm text-gray-600">Email: contact@printplus.com</p>
                <p className="text-sm text-gray-600 mt-1">GST: 27XXXXX1234X1Z5</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
                <p className="text-sm text-gray-600">Invoice #: {billData.id}</p>
                <p className="text-sm text-gray-600">Date: {billData.date}</p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bill To:</h3>
            <p className="font-bold text-gray-900 text-lg">{billData.customerName}</p>
            {billData.phone && <p className="text-sm text-gray-600">Phone: {billData.phone}</p>}
            {billData.address && <p className="text-sm text-gray-600">{billData.address}</p>}
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Item
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Size
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Area (m²)
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Rate
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Qty
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {billData.items.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      {item.type}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      {item.width.toFixed(2)} × {item.height.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right">
                      {item.area.toFixed(4)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right">
                      ₹{item.rate}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantity}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ₹{item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="text-sm font-semibold text-gray-900">₹{billData.subtotal.toFixed(2)}</span>
              </div>
              {billData.discount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Discount:</span>
                  <span className="text-sm font-semibold text-gray-900">- ₹{billData.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">GST:</span>
                <span className="text-sm font-semibold text-gray-900">+ ₹{billData.gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-300 mt-2">
                <span className="font-bold text-gray-900">Grand Total:</span>
                <span className="text-xl font-bold text-[#2563EB]">₹{billData.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">Thank you for choosing PrintPlus!</p>
            <p className="text-xs text-gray-500">
              This is a computer-generated invoice and does not require a signature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
