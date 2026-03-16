import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { CreateBill } from "./components/CreateBill";
import { Orders } from "./components/Orders";
import { RateSettings } from "./components/RateSettings";
import { Reports } from "./components/Reports";
import { Customers } from "./components/Customers";
import { Settings } from "./components/Settings";
import { PrintInvoice } from "./components/PrintInvoice";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "create-bill", Component: CreateBill },
      { path: "orders", Component: Orders },
      { path: "rate-settings", Component: RateSettings },
      { path: "reports", Component: Reports },
      { path: "customers", Component: Customers },
      { path: "settings", Component: Settings },
      { path: "invoice/:id", Component: PrintInvoice },
    ],
  },
]);
