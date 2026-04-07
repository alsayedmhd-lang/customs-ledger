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
          width: "240px",
          background: "#0b1f4d",
          color: "white",
          padding: "20px",
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
          <h2 style={{ margin: 0 }}>
            {isArabic ? "حول العالم" : "Around The World"}
          </h2>

          <button
            onClick={() => setLang(isArabic ? "en" : "ar")}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#1d4ed8",
              color: "white",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
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
          title={isArabic ? "نماذج البنود" : "Items"}
          onClick={() => setPage("items")}
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
