import { useState } from "react";

import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Receipts from "./pages/Receipts";
import Accounts from "./pages/Accounts";
import Customers from "./pages/Customers";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Items from "./pages/Items";
import Tarsh from "./pages/Tarsh";

type Page =
  | "dashboard"
  | "invoices"
  | "receipts"
  | "accounts"
  | "customers"
  | "users"
  | "settings"
  | "items"
  | "Tarsh";

type Lang = "ar" | "en";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [lang, setLang] = useState<Lang>("ar");

  const isArabic = lang === "ar";

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard lang={lang} />;
      case "invoices":
        return <Invoices lang={lang} />;
      case "receipts":
        return <Receipts lang={lang} />;
      case "accounts":
        return <Accounts lang={lang} />;
      case "customers":
        return <Customers lang={lang} />;
      case "users":
        return <Users lang={lang} />;
      case "settings":
        return <Settings lang={lang} />;
      case "items":
        return <Items lang={lang} />;
      case "Tarsh":
        return <Tarsh lang={lang} />;
      default:
        return <Dashboard lang={lang} />;
    }
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexDirection: isArabic ? "row-reverse" : "row",
        minHeight: "100vh",
        fontFamily: "system-ui",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          width: "220px",
          background: "#081f5c",
          color: "white",
          padding: "20px",
          minHeight: "100vh",
          boxShadow: "4px 0 20px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            gap: "10px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {isArabic ? "حول العالم للتخليص الجمركي" : "Around The World Custom Clearance"}
          </h2>

          <button
            onClick={() => setLang(isArabic ? "en" : "ar")}
            style={{
              border: "none",
              background: "#2563eb",
              color: "white",
              borderRadius: "10px",
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isArabic ? "EN" : "عربي"}
          </button>
        </div>

        <MenuButton
          title={isArabic ? "لوحة التحكم" : "Dashboard"}
          onClick={() => setPage("dashboard")}
        />
        <MenuButton
          title={isArabic ? "الفواتير" : "Invoices"}
          onClick={() => setPage("invoices")}
        />
        <MenuButton
          title={isArabic ? "سندات القبض" : "Receipts"}
          onClick={() => setPage("receipts")}
        />
        <MenuButton
          title={isArabic ? "الحسابات" : "Accounts"}
          onClick={() => setPage("accounts")}
        />
        <MenuButton
          title={isArabic ? "العملاء" : "Customers"}
          onClick={() => setPage("customers")}
        />
        <MenuButton
          title={isArabic ? "المستخدمون" : "Users"}
          onClick={() => setPage("users")}
        />
        <MenuButton
          title={isArabic ? "الإعدادات" : "Settings"}
          onClick={() => setPage("settings")}
        />
        <MenuButton
          title={isArabic ? "نماذج البنود" : "Items Templates"}
          onClick={() => setPage("items")}
        />
        <MenuButton
          title={isArabic ? "سلة المحذوفات" : "Trash"}
          onClick={() => setPage("Tarsh")}
        />
      </div>

      <div style={{ flex: 1, padding: "20px" }}>{renderPage()}</div>
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
        marginBottom: "12px",
        padding: "14px",
        border: "none",
        borderRadius: "12px",
        background: "#1d4ed8",
        color: "white",
        cursor: "pointer",
        fontSize: "17px",
        fontWeight: "600",
      }}
    >
      {title}
    </button>
  );
}
