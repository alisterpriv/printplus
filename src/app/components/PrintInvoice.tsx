import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Printer, ArrowLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Order, BusinessSettings, PaymentStatus } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

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

function getPaymentStatusBadge(status: PaymentStatus) {
  switch (status) {
    case "Paid":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>;
    case "Partial":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{status}</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{status}</Badge>;
  }
}

/**
 * PHASE 15 — client-side mirror of ordersService.recordPayment's
 * validation, for immediate feedback only; the service remains
 * authoritative. balanceDue is the exact ceiling — the server enforces
 * the real invariant in integer paise regardless of what this allows
 * through.
 */
export function validatePaymentAmount(value: string, balanceDue: number): string | undefined {
  if (value.trim() === "") {
    return "Please enter a payment amount.";
  }
  const amount = parseFloat(value);
  if (!Number.isFinite(amount)) {
    return "Please enter a valid payment amount.";
  }
  if (amount <= 0) {
    return "Payment amount must be greater than zero.";
  }
  if (amount > balanceDue) {
    return `Payment amount cannot exceed the balance due of ₹${balanceDue.toFixed(2)}.`;
  }
  return undefined;
}

export function PrintInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

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

  const handleOpenPaymentDialog = () => {
    if (!order) return;
    setPaymentAmountInput(order.balanceDue.toFixed(2));
    setPaymentError(null);
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!order) return;
    const validationError = validatePaymentAmount(paymentAmountInput, order.balanceDue);
    if (validationError) {
      setPaymentError(validationError);
      return;
    }

    setIsRecordingPayment(true);
    try {
      const updated = await window.api.orders.recordPayment(order.id, parseFloat(paymentAmountInput));
      setOrder(updated);
      setIsPaymentDialogOpen(false);
      toast.success("Payment recorded");
    } catch (error) {
      // Preserve the entered amount and the currently-displayed order —
      // a failed payment must never corrupt what's shown as already paid.
      toast.error(getErrorMessage(error, "Failed to record payment"));
    } finally {
      setIsRecordingPayment(false);
    }
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
              onClick={handleOpenPaymentDialog}
              disabled={order.paymentStatus === "Paid"}
              variant="outline"
              className="border-gray-300"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Record Payment
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
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Paid:</span>
                <span className="text-sm font-semibold text-gray-900">₹{order.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Balance Due:</span>
                <span className="text-sm font-semibold text-gray-900">₹{order.balanceDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Payment Status:</span>
                {getPaymentStatusBadge(order.paymentStatus)}
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

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-semibold text-gray-900">₹{order.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Paid</span>
                <span className="font-semibold text-gray-900">₹{order.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance Due</span>
                <span className="font-semibold text-gray-900">₹{order.balanceDue.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="paymentAmount">Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentAmountInput}
                onChange={(e) => {
                  setPaymentAmountInput(e.target.value);
                  if (paymentError) setPaymentError(null);
                }}
                placeholder="Enter amount"
                className="mt-1"
                step="0.01"
                min="0"
                autoFocus
              />
              {paymentError && <p className="text-sm text-red-600 mt-1">{paymentError}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-300"
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isRecordingPayment}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-blue-700"
              onClick={handleRecordPayment}
              disabled={isRecordingPayment}
            >
              {isRecordingPayment ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
