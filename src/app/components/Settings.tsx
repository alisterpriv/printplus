import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";

export function Settings() {
  const [shopName, setShopName] = useState("PrintPlus");
  const [email, setEmail] = useState("contact@printplus.com");
  const [phone, setPhone] = useState("+91 98500 57887");
  const [address, setAddress] = useState("123 Main Street, City Center, Mumbai, Maharashtra 400001");
  const [gstNumber, setGstNumber] = useState("27XXXXX1234X1Z5");
  const [autoBackup, setAutoBackup] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [printAutoSave, setPrintAutoSave] = useState(false);

  const handleSave = () => {
    toast.success("Settings saved successfully");
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input
                id="gstNumber"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address">Business Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
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
          <Button onClick={handleSave} className="bg-[#2563EB] hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
