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

  function formatDate() {
    return isArabic ? "الأربعاء، 8 أبريل 2026" : "Wednesday, April 8, 2026";
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
      <aside
        style={{
          width: "260px",
          background: "linear-gradient(180deg, #081a4b 0%, #0b1f4d 100%)",
          color: "white",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "4px 0 20px rgba(0,0,0,0.08)",
        }}
      >
        <div>
          <div
            style={{
              padding: "22px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                ✈️
              </div>

              <div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                >
                  {isArabic ? "حول العالم" : "Around The World"}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    opacity: 0.8,
                    marginTop: "4px",
                  }}
                >
                  {isArabic ? "للتخليص الجمركي" : "Customs Clearance"}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "16px" }}>
            <MenuButton
              title={isArabic ? "لوحة التحكم" : "Dashboard"}
              active={page === "dashboard"}
              onClick={() => setPage("dashboard")}
            />
            <MenuButton
              title={isArabic ? "الفواتير" : "Invoices"}
              active={page === "invoices"}
              onClick={() => setPage("invoices")}
            />
            <MenuButton
              title={isArabic ? "سندات القبض" : "Receipts"}
              active={page === "receipts"}
              onClick={() => setPage("receipts")}
            />
            <MenuButton
              title={isArabic ? "كشوفات الحساب" : "Account Statements"}
              active={page === "accounts"}
              onClick={() => setPage("accounts")}
            />
            <MenuButton
              title={isArabic ? "نماذج البنود" : "Item Templates"}
              active={page === "items"}
              onClick={() => setPage("items")}
            />
            <MenuButton
              title={isArabic ? "العملاء" : "Clients"}
              active={page === "customers"}
              onClick={() => setPage("customers")}
            />
            <MenuButton
              title={isArabic ? "المستخدمون" : "Users"}
              active={page === "users"}
              onClick={() => setPage("users")}
            />
            <MenuButton
              title={isArabic ? "إعدادات البرنامج" : "App Settings"}
              active={page === "settings"}
              onClick={() => setPage("settings")}
            />
            <MenuButton
              title={isArabic ? "سلة المحذوفات" : "Trash"}
              active={page === "Tarsh"}
              onClick={() => setPage("Tarsh")}
            />
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "14px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              ا
            </div>

            <div>
              <div style={{ fontWeight: 700 }}>
                {isArabic ? "المدير" : "Admin"}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.75 }}>
                {isArabic ? "مدير" : "Administrator"}
              </div>
            </div>
          </div>

          <button
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              color: "white",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            {isArabic ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            background: "white",
            height: "72px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ color: "#6b7280", fontSize: "14px" }}>{formatDate()}</div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                border: "1px solid #d1d5db",
                background: "white",
                borderRadius: "12px",
                padding: "4px",
                display: "flex",
                gap: "4px",
              }}
            >
              <button
                onClick={() => setLang("ar")}
                style={{
                  border: "none",
                  background: isArabic ? "#e5efff" : "transparent",
                  color: isArabic ? "#2563eb" : "#111827",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                عربي
              </button>

              <button
                onClick={() => setLang("en")}
                style={{
                  border: "none",
                  background: !isArabic ? "#e5efff" : "transparent",
                  color: !isArabic ? "#2563eb" : "#111827",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                EN
              </button>
            </div>

            <button
              style={{
                border: "none",
                background: "#f3f4f6",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ⚙️
            </button>

            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#3b82f6",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              ا
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: "20px" }}>{renderPage()}</div>
      </main>
    </div>
  );
}

function MenuButton({
  title,
  onClick,
  active,
}: {
  title: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        marginBottom: "10px",
        padding: "14px 16px",
        border: "none",
        borderRadius: "14px",
        background: active ? "white" : "transparent",
        color: active ? "#0b1f4d" : "white",
        cursor: "pointer",
        fontSize: "16px",
        fontWeight: 700,
        textAlign: "start",
        boxShadow: active ? "0 8px 20px rgba(255,255,255,0.1)" : "none",
      }}
    >
      {title}
    </button>
  );
}
