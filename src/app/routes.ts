import { createHashRouter } from "react-router";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { CreateBill } from "./components/CreateBill";
import { Orders } from "./components/Orders";
import { RateSettings } from "./components/RateSettings";
import { Customers } from "./components/Customers";
import { Settings } from "./components/Settings";
import { PrintInvoice } from "./components/PrintInvoice";

// createBrowserRouter matches routes against location.pathname, which
// under Electron's file:// loading is the full filesystem path to
// index.html rather than "/" — no route would ever match. createHashRouter
// keeps the route in the URL hash instead, which is unaffected by where
// the file was loaded from.
export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "create-bill", Component: CreateBill },
      { path: "orders", Component: Orders },
      { path: "rate-settings", Component: RateSettings },
      { path: "customers", Component: Customers },
      { path: "settings", Component: Settings },
      { path: "invoice/:id", Component: PrintInvoice },
    ],
  },
]);
