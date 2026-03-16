import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

interface PrintRate {
  id: string;
  type: string;
  rate: number;
}

const initialRates: PrintRate[] = [
  { id: "1", type: "Flex", rate: 10 },
  { id: "2", type: "Banner", rate: 12 },
  { id: "3", type: "Vinyl", rate: 15 },
  { id: "4", type: "Sunboard", rate: 18 },
  { id: "5", type: "Canvas", rate: 20 },
  { id: "6", type: "Sticker", rate: 8 },
  { id: "7", type: "Backlit", rate: 25 },
  { id: "8", type: "One Way Vision", rate: 22 },
];

export function RateSettings() {
  const [rates, setRates] = useState<PrintRate[]>(initialRates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (rate: PrintRate) => {
    setEditingId(rate.id);
    setEditValue(rate.rate.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = (id: string) => {
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    setRates(rates.map(rate => 
      rate.id === id ? { ...rate, rate: newRate } : rate
    ));
    
    setEditingId(null);
    setEditValue("");
    toast.success("Rate updated successfully");
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Rate Settings</h1>
        <p className="text-gray-600 mt-2">Manage pricing for different print types</p>
      </div>

      <div className="max-w-4xl">
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
                      <span className="text-sm font-medium text-gray-900">{rate.type}</span>
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
