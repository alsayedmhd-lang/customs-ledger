import { useState } from "react";

import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Receipts from "./pages/Receipts";
import Accounts from "./pages/Accounts";
import Customers from "./pages/Customers";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Items from "./pages/Items";

type Page =
  | "dashboard"
  | "invoices"
  | "receipts"
  | "accounts"
  | "customers"
  | "users"
  | "settings"
  | "items";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "invoices":
        return <Invoices />;
      case "receipts":
        return <Receipts />;
      case "accounts":
        return <Accounts />;
      case "customers":
        return <Customers />;
      case "users":
        return <Users />;
      case "settings":
        return <Settings />;
      case "items":
        return <Items />;
      default:
        return <Dashboard />;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui" }}>
      <div
        style={{
          width: "240px",
          background: "#0b1f4d",
          color: "white",
          padding: "20px",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>حول العالم</h2>

        <MenuButton title="لوحة التحكم" onClick={() => setPage("dashboard")} />
        <MenuButton title="الفواتير" onClick={() => setPage("invoices")} />
        <MenuButton title="سندات القبض" onClick={() => setPage("receipts")} />
        <MenuButton title="الحسابات" onClick={() => setPage("accounts")} />
        <MenuButton title="العملاء" onClick={() => setPage("customers")} />
        <MenuButton title="المستخدمون" onClick={() => setPage("users")} />
        <MenuButton title="الإعدادات" onClick={() => setPage("settings")} />
        <MenuButton title="نماذج البنود" onClick={() => setPage("items")} />
      </div>

      <div style={{ flex: 1, background: "#f3f4f6" }}>
        {renderPage()}
      </div>
    </div>
  );
}

function MenuButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        marginBottom: "10px",
        padding: "12px",
        border: "none",
        borderRadius: "10px",
        background: "#1d4ed8",
        color: "white",
        cursor: "pointer",
      }}
    >
      {title}
    </button>
  );
}
