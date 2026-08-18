import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Edit, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { Rate } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

export function RateSettings() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    window.api.rates
      .list()
      .then(setRates)
      .catch((error) => toast.error(getErrorMessage(error, "Failed to load rates")))
      .finally(() => setIsLoading(false));
  }, []);

  const startEdit = (rate: Rate) => {
    setEditingId(rate.id);
    setEditValue(rate.rate.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (id: number) => {
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    try {
      await window.api.rates.update(id, newRate);
      setRates(rates.map(rate =>
        rate.id === id ? { ...rate, rate: newRate } : rate
      ));
      setEditingId(null);
      setEditValue("");
      toast.success("Rate updated successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update rate"));
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Rate Settings</h1>
        <p className="text-gray-600 mt-2">Manage pricing for different print types</p>
      </div>

      <div className="max-w-4xl">
        {isLoading ? (
          <Card className="p-12 bg-white border border-gray-200 rounded-xl text-center">
            <p className="text-gray-500">Loading rates...</p>
          </Card>
        ) : (
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Print Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Price per Sq Meter (₹)</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{rate.printType}</span>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === rate.id ? (
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="max-w-[150px]"
                          step="0.01"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-semibold">₹{rate.rate}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingId === rate.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(rate.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            className="border-gray-300"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(rate)}
                          className="border-gray-300 hover:bg-gray-50"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-900 mb-2">Pricing Information</h3>
          <p className="text-sm text-blue-800">
            These rates are automatically applied when creating new bills. Update them as needed to reflect current market prices. 
            All prices are per square meter.
          </p>
        </Card>
      </div>
    </div>
  );
}
