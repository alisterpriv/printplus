import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Building2, Save, DatabaseBackup, Upload } from "lucide-react";
import { toast } from "sonner";
import type { BusinessSettingsInput } from "../../types/ipc-contracts";
import { getErrorMessage } from "../lib/getErrorMessage";

const EMPTY_BUSINESS_FORM = { businessName: "", address: "", phone: "", email: "", gstin: "" };

export function Settings() {
  const [businessForm, setBusinessForm] = useState(EMPTY_BUSINESS_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    window.api.businessSettings
      .get()
      .then((result) => {
        setBusinessForm({
          businessName: result.businessName,
          address: result.address ?? "",
          phone: result.phone ?? "",
          email: result.email ?? "",
          gstin: result.gstin ?? "",
        });
        setLoadError(null);
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to load business information");
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveBusinessInfo = async () => {
    if (!businessForm.businessName.trim()) {
      setNameError("Business name is required");
      return;
    }
    setNameError(null);

    const input: BusinessSettingsInput = {
      businessName: businessForm.businessName,
      address: businessForm.address,
      phone: businessForm.phone,
      email: businessForm.email,
      gstin: businessForm.gstin,
    };

    setIsSaving(true);
    try {
      const updated = await window.api.businessSettings.update(input);
      setBusinessForm({
        businessName: updated.businessName,
        address: updated.address ?? "",
        phone: updated.phone ?? "",
        email: updated.email ?? "",
        gstin: updated.gstin ?? "",
      });
      toast.success("Business information saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save business information"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const result = await window.api.backup.create();
      if (result.status === "success") {
        toast.success(`Backup saved to ${result.filePath}`);
      } else if (result.status === "error") {
        toast.error(result.message);
      }
      // "cancelled" is not an error — the user simply closed the dialog.
    } catch (error) {
      toast.error(getErrorMessage(error, "Backup failed"));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFromBackup = async () => {
    setIsRestoring(true);
    try {
      const result = await window.api.backup.restore();
      if (result.status === "invalid" || result.status === "error") {
        toast.error(result.message);
      }
      // "cancelled" is not an error. "success" restarts the app before
      // this can ever resolve in practice.
    } catch (error) {
      toast.error(getErrorMessage(error, "Restore failed"));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1F2937]">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your application preferences</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Business Information */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#2563EB] text-white p-3 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1F2937]">Business Information</h2>
              <p className="text-sm text-gray-600">Update your shop details</p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-gray-500">Loading business information...</p>
          ) : loadError ? (
            <p className="text-red-600">{loadError}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shopName">Business Name *</Label>
                <Input
                  id="shopName"
                  value={businessForm.businessName}
                  onChange={(e) => {
                    setBusinessForm({ ...businessForm, businessName: e.target.value });
                    if (nameError) setNameError(null);
                  }}
                  className="mt-1"
                />
                {nameError && <p className="text-sm text-red-600 mt-1">{nameError}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={businessForm.email}
                  onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={businessForm.phone}
                  onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={businessForm.gstin}
                  onChange={(e) => setBusinessForm({ ...businessForm, gstin: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Business Address</Label>
                <Textarea
                  id="address"
                  value={businessForm.address}
                  onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Backup & Restore */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#2563EB] text-white p-3 rounded-lg">
              <DatabaseBackup className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1F2937]">Backup & Restore</h2>
              <p className="text-sm text-gray-600">
                Back up your PrintPlus data to a file you can restore later.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleBackupNow}
              disabled={isBackingUp || isRestoring}
              className="bg-[#2563EB] hover:bg-blue-700"
            >
              <DatabaseBackup className="w-4 h-4 mr-2" />
              {isBackingUp ? "Backing Up..." : "Backup Now"}
            </Button>
            <Button
              onClick={handleRestoreFromBackup}
              disabled={isBackingUp || isRestoring}
              variant="outline"
              className="border-gray-300"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isRestoring ? "Restoring..." : "Restore from Backup"}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Restoring replaces the current data with the selected backup.
          </p>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveBusinessInfo}
            disabled={isSaving || isLoading}
            className="bg-[#2563EB] hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
