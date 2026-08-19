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
import { Edit, Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Rate } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

const EMPTY_NEW_RATE = { printType: "", rate: "" };

export function RateSettings() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRate, setNewRate] = useState(EMPTY_NEW_RATE);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRates = () => {
    return window.api.rates
      .list()
      .then(setRates)
      .catch((error) => toast.error(getErrorMessage(error, "Failed to load rates")));
  };

  useEffect(() => {
    loadRates().finally(() => setIsLoading(false));
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
    const newRateValue = parseFloat(editValue);
    if (isNaN(newRateValue) || newRateValue <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    try {
      await window.api.rates.update(id, newRateValue);
      setRates(rates.map(rate =>
        rate.id === id ? { ...rate, rate: newRateValue } : rate
      ));
      setEditingId(null);
      setEditValue("");
      toast.success("Rate updated successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update rate"));
    }
  };

  const openAddDialog = () => {
    setNewRate(EMPTY_NEW_RATE);
    setIsAddDialogOpen(true);
  };

  const handleAddPrintType = async () => {
    if (!newRate.printType.trim()) {
      toast.error("Please enter a print type name");
      return;
    }
    const parsedRate = parseFloat(newRate.rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    setIsCreating(true);
    try {
      await window.api.rates.create(newRate.printType, parsedRate);
      await loadRates();
      setIsAddDialogOpen(false);
      setNewRate(EMPTY_NEW_RATE);
      toast.success("Print type added successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to add print type"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (rate: Rate) => {
    if (!window.confirm(`Delete "${rate.printType}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(rate.id);
    try {
      await window.api.rates.delete(rate.id);
      setRates(rates.filter((r) => r.id !== rate.id));
      toast.success("Print type deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete print type"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937]">Rate Settings</h1>
          <p className="text-gray-600 mt-2">Manage pricing for different print types</p>
        </div>

        <Button className="bg-[#2563EB] hover:bg-blue-700" onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Print Type
        </Button>
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
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(rate)}
                            className="border-gray-300 hover:bg-gray-50"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(rate)}
                            disabled={deletingId === rate.id}
                            className="border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {deletingId === rate.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
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

      {/* Add Print Type Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Print Type</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-print-type">Print Type Name *</Label>
              <Input
                id="new-print-type"
                value={newRate.printType}
                onChange={(e) => setNewRate({ ...newRate, printType: e.target.value })}
                placeholder="Enter print type name"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="new-print-rate">Price per Sq Meter (₹) *</Label>
              <Input
                id="new-print-rate"
                type="number"
                value={newRate.rate}
                onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                placeholder="Enter price"
                className="mt-1"
                step="0.01"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-300"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button className="bg-[#2563EB] hover:bg-blue-700" onClick={handleAddPrintType} disabled={isCreating}>
              {isCreating ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
