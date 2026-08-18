import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import type { Order, BusinessSettings } from "../../types/ipc-contracts";

/**
 * Renders the historical Order exactly as persisted (customer snapshot,
 * item rates, discount/GST) — never re-reads current Customer or Rate
 * Settings values, since those may have changed since the order was
 * created. See ordersService.createOrder for where the snapshot is taken.
 */
function formatOrderDate(createdAt: string): string {
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — reformat it so Date can parse it as UTC correctly
  // instead of ambiguously as local time.
  const isoLike = createdAt.replace(" ", "T") + "Z";
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? createdAt : parsed.toLocaleDateString();
}

export function PrintInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // An invoice needs both the order and the current business identity to
  // render meaningfully — if either fetch fails, the existing not-found
  // state is used rather than rendering a half-populated invoice.
  useEffect(() => {
    const orderId = Number(id);
    if (!id || !Number.isInteger(orderId) || orderId <= 0) {
      setIsLoading(false);
      setNotFound(true);
      return;
    }
    Promise.all([window.api.orders.get(orderId), window.api.businessSettings.get()])
      .then(([fetchedOrder, fetchedBusinessSettings]) => {
        setOrder(fetchedOrder);
        setBusinessSettings(fetchedBusinessSettings);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (notFound || !order || !businessSettings) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Invoice not found.</p>
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
                {businessSettings.businessName && (
                  <h1 className="text-4xl font-bold text-[#2563EB] mb-2">{businessSettings.businessName}</h1>
                )}
                {businessSettings.address && <p className="text-sm text-gray-600">{businessSettings.address}</p>}
                {businessSettings.phone && <p className="text-sm text-gray-600">Phone: {businessSettings.phone}</p>}
                {businessSettings.email && <p className="text-sm text-gray-600">Email: {businessSettings.email}</p>}
                {businessSettings.gstin && (
                  <p className="text-sm text-gray-600 mt-1">GSTIN: {businessSettings.gstin}</p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
                <p className="text-sm text-gray-600">Invoice #: {order.invoiceNumber}</p>
                <p className="text-sm text-gray-600">Date: {formatOrderDate(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bill To:</h3>
            <p className="font-bold text-gray-900 text-lg">{order.customerName}</p>
            {order.customerPhone && <p className="text-sm text-gray-600">Phone: {order.customerPhone}</p>}
            {order.customerAddress && <p className="text-sm text-gray-600">{order.customerAddress}</p>}
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
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      {item.printType}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                      {item.width.toFixed(2)} × {item.height.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-right">
                      {item.areaSquareMeters.toFixed(4)}
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
                <span className="text-sm font-semibold text-gray-900">₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Discount:</span>
                  <span className="text-sm font-semibold text-gray-900">- ₹{order.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">GST:</span>
                <span className="text-sm font-semibold text-gray-900">+ ₹{order.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-300 mt-2">
                <span className="font-bold text-gray-900">Grand Total:</span>
                <span className="text-xl font-bold text-[#2563EB]">₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              {businessSettings.businessName
                ? `Thank you for choosing ${businessSettings.businessName}!`
                : "Thank you for your business!"}
            </p>
            <p className="text-xs text-gray-500">
              This is a computer-generated invoice and does not require a signature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
