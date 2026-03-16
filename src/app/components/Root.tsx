import { Outlet, Link, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  FileText, 
  ShoppingCart, 
  Settings as SettingsIcon, 
  BarChart3, 
  Users, 
  Cog,
  LogOut,
  User
} from "lucide-react";
import { Button } from "./ui/button";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/create-bill", label: "Create Bill", icon: FileText },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/rate-settings", label: "Rate Settings", icon: SettingsIcon },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/settings", label: "Settings", icon: Cog },
];

export function Root() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-[#2563EB]">PrintPlus</h1>
          <p className="text-xs text-gray-500 mt-1">Printing Management</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 bg-[#2563EB] rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Shop Owner</p>
              <p className="text-xs text-gray-500 truncate">admin@printplus.com</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
