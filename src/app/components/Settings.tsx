import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Building2, Save } from "lucide-react";
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

  const [autoBackup, setAutoBackup] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [printAutoSave, setPrintAutoSave] = useState(false);

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

        {/* Invoice Settings */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <h2 className="text-xl font-bold text-[#1F2937] mb-4">Invoice Settings</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
              <Input
                id="invoicePrefix"
                defaultValue="INV"
                className="mt-1 max-w-xs"
              />
              <p className="text-sm text-gray-500 mt-1">Example: INV-001, INV-002</p>
            </div>

            <div>
              <Label htmlFor="defaultGst">Default GST (%)</Label>
              <Input
                id="defaultGst"
                type="number"
                defaultValue="18"
                className="mt-1 max-w-xs"
                min="0"
                max="100"
              />
            </div>

            <div>
              <Label htmlFor="termsConditions">Terms & Conditions</Label>
              <Textarea
                id="termsConditions"
                defaultValue="Thank you for choosing PrintPlus. All prices are inclusive of GST. Payment is due upon receipt."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <h2 className="text-xl font-bold text-[#1F2937] mb-4">Preferences</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Auto Backup</p>
                <p className="text-sm text-gray-600">Automatically backup data daily</p>
              </div>
              <Switch
                checked={autoBackup}
                onCheckedChange={setAutoBackup}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive email alerts for new orders</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Auto-save on Print</p>
                <p className="text-sm text-gray-600">Automatically save bills when printing</p>
              </div>
              <Switch
                checked={printAutoSave}
                onCheckedChange={setPrintAutoSave}
              />
            </div>
          </div>
        </Card>

        {/* Currency Settings */}
        <Card className="p-6 bg-white border border-gray-200 rounded-xl">
          <h2 className="text-xl font-bold text-[#1F2937] mb-4">Currency Settings</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                defaultValue="INR (₹)"
                className="mt-1 max-w-xs"
                disabled
              />
            </div>

            <div>
              <Label htmlFor="decimalPlaces">Decimal Places</Label>
              <Input
                id="decimalPlaces"
                type="number"
                defaultValue="2"
                className="mt-1 max-w-xs"
                min="0"
                max="4"
              />
            </div>
          </div>
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
