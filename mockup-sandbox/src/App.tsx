import { useEffect, useMemo, useState } from "react";

import Login from "./pages/Login";
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
  | "login"
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

const SIDEBAR_WIDTH = 260;
const MOBILE_BREAKPOINT = 992;

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [lang, setLang] = useState<Lang>("ar");
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(window.innerWidth >= MOBILE_BREAKPOINT);

  const isArabic = lang === "ar";

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang");
    if (savedLang === "ar" || savedLang === "en") {
      setLang(savedLang);
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";
    } else {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("app_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [lang, isArabic]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);

      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pageTitle = useMemo(() => {
    const titles: Record<Page, { ar: string; en: string }> = {
      dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
      invoices: { ar: "الفواتير", en: "Invoices" },
      receipts: { ar: "سندات القبض", en: "Receipts" },
      accounts: { ar: "كشف الحسابات", en: "Account Statements" },
      customers: { ar: "العملاء", en: "Customers" },
      users: { ar: "المستخدمون", en: "Users" },
      settings: { ar: "الإعدادات", en: "Settings" },
      items: { ar: "نماذج البنود", en: "Item Templates" },
      Tarsh: { ar: "سلة المحذوفات", en: "Trash" },
    };

    return isArabic ? titles[page].ar : titles[page].en;
  }, [page, isArabic]);

  function goToPage(nextPage: Page) {
    setPage(nextPage);
    if (isMobile) setSidebarOpen(false);
  }

  function toggleLanguage() {
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
  }

  function handleSignOut() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("session");
      localStorage.removeItem("admin");
  
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("currentUser");
      sessionStorage.removeItem("session");
      sessionStorage.removeItem("admin");
  
      setSidebarOpen(false);
      setPage("login");
    } catch (error) {
      console.error("Sign out failed:", error);
      setPage("login");
    }
  }

  function renderPage() {
    switch (page) {
      case "login":
        return <Login lang={lang} />;
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

  const sidebarSideStyle = isArabic
    ? { right: 0 as const, left: "auto" as const }
    : { left: 0 as const, right: "auto" as const };

  return (
      <div
        dir={isArabic ? "rtl" : "ltr"}
        style={{
          minHeight: "100vh",
          background: "#f3f4f6",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: "14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 40,
          }}
        />
      )}

      <aside
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          ...sidebarSideStyle,
          width: `${SIDEBAR_WIDTH}px`,
          maxWidth: "86vw",
          background: "linear-gradient(180deg, #081a4b 0%, #0b1f4d 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          overflow: "hidden",
          zIndex: 50,
          transform:
            isMobile && !sidebarOpen
              ? isArabic
                ? "translateX(100%)"
                : "translateX(-100%)"
              : "translateX(0)",
          transition: "transform 0.28s ease",
        }}
      >
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
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
                flexDirection: isArabic ? "row-reverse" : "row",
                textAlign: isArabic ? "right" : "left",
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
                  flexShrink: 0,
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

          <div
            style={{
              padding: "16px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            <MenuButton
              title={isArabic ? "لوحة التحكم" : "Dashboard"}
              active={page === "dashboard"}
              onClick={() => goToPage("dashboard")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "الفواتير" : "Invoices"}
              active={page === "invoices"}
              onClick={() => goToPage("invoices")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "سندات القبض" : "Receipts"}
              active={page === "receipts"}
              onClick={() => goToPage("receipts")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "كشف الحسابات" : "Account Statements"}
              active={page === "accounts"}
              onClick={() => goToPage("accounts")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "العملاء" : "Customers"}
              active={page === "customers"}
              onClick={() => goToPage("customers")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "المستخدمون" : "Users"}
              active={page === "users"}
              onClick={() => goToPage("users")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "الإعدادات" : "Settings"}
              active={page === "settings"}
              onClick={() => goToPage("settings")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "نماذج البنود" : "Item Templates"}
              active={page === "items"}
              onClick={() => goToPage("items")}
              isArabic={isArabic}
            />

            <MenuButton
              title={isArabic ? "سلة المحذوفات" : "Trash"}
              active={page === "Tarsh"}
              onClick={() => goToPage("Tarsh")}
              isArabic={isArabic}
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
              flexDirection: isArabic ? "row-reverse" : "row",
              textAlign: isArabic ? "right" : "left",
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
                flexShrink: 0,
              }}
            >
              {isArabic ? "ا" : "A"}
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
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              color: "white",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            {isArabic ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main
        style={{
          minHeight: "100vh",
          marginLeft: !isMobile && !isArabic ? `${SIDEBAR_WIDTH}px` : 0,
          marginRight: !isMobile && isArabic ? `${SIDEBAR_WIDTH}px` : 0,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          transition: "margin 0.28s ease",
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
            minHeight: "72px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid #e5e7eb",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexDirection: isArabic ? "row-reverse" : "row",
              minWidth: 0,
            }}
          >
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  border: "1px solid #dbe2ea",
                  background: "white",
                  color: "#0f172a",
                  borderRadius: "12px",
                  padding: "9px 12px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: "18px",
                  lineHeight: 1,
                }}
                aria-label={isArabic ? "فتح القائمة" : "Open menu"}
                title={isArabic ? "فتح القائمة" : "Open menu"}
              >
                ☰
              </button>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: isArabic ? "right" : "left",
              }}
            >
              <div
                style={{
                  color: "#0f172a",
                  fontSize: "20px",
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {pageTitle}
              </div>

              <div
                style={{
                  color: "#6b7280",
                  fontSize: "14px",
                  marginTop: "4px",
                }}
              >
                {isArabic ? "الأربعاء، 8 أبريل 2026" : "Wednesday, April 8, 2026"}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexDirection: isArabic ? "row-reverse" : "row",
            }}
          >
            <button
              onClick={toggleLanguage}
              style={{
                border: "1px solid #cbd5e1",
                background: "white",
                color: "#0f172a",
                borderRadius: "12px",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "14px",
                minWidth: "96px",
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
              }}
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            padding: "20px",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function MenuButton({
  title,
  onClick,
  active,
  isArabic,
}: {
  title: string;
  onClick: () => void;
  active: boolean;
  isArabic: boolean;
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
        textAlign: isArabic ? "right" : "left",
        boxShadow: active ? "0 8px 20px rgba(255,255,255,0.1)" : "none",
        transition: "all 0.18s ease",
      }}
    >
      {title}
    </button>
  );
}
