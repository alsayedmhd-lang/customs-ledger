import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  PackageSearch,
  LogOut,
  BookOpen,
  ReceiptText,
  UserCog,
  Trash2,
  Calculator,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useCompanySettings } from "@/lib/company-settings-context";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { getRoleLabel } from "@/lib/role-labels";
import SettingsPanel from "./SettingsPanel";
import { motion, AnimatePresence } from "framer-motion";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t, isRTL, lang, setLang } = useLanguage();
  const { settings, logoSrc } = useCompanySettings();
  const { display } = useDisplaySettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageZoom, setPageZoom] = useState(1);

    useEffect(() => {
      const handleWheel = (e: WheelEvent) => {
        if (!e.ctrlKey) return;

        e.preventDefault();

        setPageZoom((z) => {
          const next = e.deltaY < 0 ? z + 0.1 : z - 0.1;
          return Math.min(1.3, Math.max(0.8, Number(next.toFixed(1))));
        });
      };

      window.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        window.removeEventListener("wheel", handleWheel);
      };
    }, []);

  const bgLayerStyle: React.CSSProperties = (() => {
    const op = (display.bgOpacity ?? 15) / 100;
    if (display.bgType === "color") {
      return { position: "absolute", inset: 0, backgroundColor: display.bgColor, opacity: op, pointerEvents: "none", zIndex: 0 };
    }
    if (display.bgType === "image" && display.bgImage) {
      return { position: "absolute", inset: 0, backgroundImage: `url(${display.bgImage})`, backgroundSize: "cover", backgroundPosition: "center", opacity: op, pointerEvents: "none", zIndex: 0 };
    }
    return { display: "none" };
  })();

  const isAR = lang === "ar";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!localStorage.getItem("theme")) {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    applySystemTheme(mq);
    mq.addEventListener("change", applySystemTheme);
    return () => mq.removeEventListener("change", applySystemTheme);
  }, []);

  const isClient = user?.role === "client";
  const clientCanViewStatement = isClient && user?.clientViewPermissions?.canViewStatement !== false;
  const clientCanViewSummary = isClient && user?.clientViewPermissions?.canViewSummary !== false;
  const clientAllowedHrefs = new Set(["/", "/invoices", "/receipts", "/statements", "/customer-ledger"]);
  const navItems = [
    { name: t("dashboard"), href: "/", icon: LayoutDashboard, color: "text-blue-400" },
    { name: t("invoices"), href: "/invoices", icon: FileText, color: "text-sky-400" },
    { name: t("receipts"), href: "/receipts", icon: ReceiptText, color: "text-emerald-400" },
    ...(!isClient || clientCanViewSummary
      ? [{ name: isClient ? (isAR ? "ملخص العميل المالي" : "Customer Financial Summary") : "customerLedger", href: "/customer-ledger", icon: FileText, color: "text-indigo-400" }]
      : []),
    ...(!isClient || clientCanViewStatement
      ? [{ name: isClient ? (isAR ? "كشف الحساب" : "Account Statement") : t("statements"), href: "/statements", icon: BookOpen, color: "text-teal-400" }]
      : []),
    { name: t("templates"), href: "/templates", icon: PackageSearch, color: "text-amber-400" },
    { name: t("clients"), href: "/clients", icon: Users, color: "text-violet-400" },
    ...(user?.role === "admin" || user?.permissions?.canViewAccounting
      ? [{ name: t("accounting"), href: "/accounting", icon: Calculator, color: "text-orange-400" }]
      : []),
    ...(user?.role === "admin"
      ? [
          { name: t("users"), href: "/users", icon: UserCog, color: "text-pink-400" },
          { name: isAR ? "إعدادات البرنامج" : "App Settings", href: "/settings", icon: Settings, color: "text-cyan-400" },
        ]
      : []),
    { name: t("trash"), href: "/trash", icon: Trash2, color: "text-red-400" },
  ].filter((item) => !isClient || clientAllowedHrefs.has(item.href));

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const resolvedName = (isAR ? user?.displayNameAr : user?.displayNameEn) || user?.displayName || "";
  const roleLabel = getRoleLabel(user?.role, isAR);
  const initial = resolvedName?.charAt(0) ?? "م";
  const todayStr = new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b" style={{ borderColor: "var(--sb-border, rgba(255,255,255,0.1))" }}>
        <img
          src={logoSrc}
          alt="شعار الشركة"
          className="w-12 h-12 flex-shrink-0 object-contain"
          style={{ filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.5))" }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
          }}
        />
        <div className="min-w-0">
          <h1 className="font-black text-sm leading-tight truncate" style={{ color: "var(--sb-foreground, #ffffff)" }}>
            {isAR
              ? (settings.nameAr || "").split(" ").slice(0, 2).join(" ")
              : (settings.nameEn || "").split(" ").slice(0, 3).join(" ")}
          </h1>
          <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: "var(--sb-muted-foreground, rgba(255,255,255,0.5))" }}>
            {isAR ? settings.subtitleAr : settings.subtitleEn}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer group",
                  isActive && "shadow-lg nav-active-glow"
                )}
                style={{
                  background: isActive ? "var(--sb-active-bg, #ffffff)" : undefined,
                  color: isActive ? "var(--sb-active-fg, #0f172a)" : "var(--sb-muted-foreground, rgba(255,255,255,0.6))",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--sb-hover-bg, rgba(255,255,255,0.1))";
                    e.currentTarget.style.color = "var(--sb-foreground, #ffffff)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = "var(--sb-muted-foreground, rgba(255,255,255,0.6))";
                  }
                }}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                  isActive && "bg-primary/15"
                )}
                  style={{ background: isActive ? undefined : "var(--sb-hover-bg, rgba(255,255,255,0.05))" }}
                >
                  <item.icon className={cn(
                    "w-4 h-4",
                    isActive ? "text-primary" : item.color
                  )} />
                </div>
                <span className="text-sm font-semibold">{t(item.name as any) || item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className={`ms-auto w-1.5 h-1.5 rounded-full bg-primary`}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t" style={{ borderColor: "var(--sb-border, rgba(255,255,255,0.1))" }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: "var(--sb-hover-bg, rgba(255,255,255,0.05))" }}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-md">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate" style={{ color: "var(--sb-foreground, #ffffff)" }}>{isAR ? resolvedName : user?.displayNameEn || resolvedName}</p>
            <p className="text-xs font-medium" style={{ color: "var(--sb-muted-foreground, rgba(255,255,255,0.4))" }}>{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl font-medium hover:bg-red-500/15 hover:text-red-500 transition-all duration-200 group"
          style={{ color: "var(--sb-muted-foreground, rgba(255,255,255,0.5))" }}
        >
          <div className="w-8 h-8 rounded-lg group-hover:bg-red-500/15 flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: "var(--sb-hover-bg, rgba(255,255,255,0.05))" }}>
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold">{t("logout")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={cn("h-screen overflow-hidden bg-background flex flex-col md:flex-row")}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "app-sidebar hidden md:flex w-64 flex-shrink-0 flex-col print-hidden relative",
          isRTL ? "border-l" : "border-r"
        )}
        style={{
          background: "linear-gradient(180deg, var(--sb-from, #0f172a) 0%, var(--sb-to, #1e293b) 100%)",
          borderColor: "var(--sb-border, rgba(255,255,255,0.07))",
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: isRTL ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? "100%" : "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "fixed top-0 z-50 w-72 h-full flex flex-col md:hidden print-hidden",
                isRTL ? "right-0" : "left-0"
              )}
              style={{ background: "linear-gradient(180deg, var(--sb-from, #0f172a) 0%, var(--sb-to, #1e293b) 100%)" }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "absolute top-4 p-2 transition-colors z-50",
                  isRTL ? "left-4" : "right-4"
                )}
                style={{ color: "var(--sb-muted-foreground, rgba(255,255,255,0.5))" }}
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* App background layer */}
        <div className="pointer-events-none absolute inset-0" style={bgLayerStyle} />

        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border/60 print-hidden sticky top-0 z-30 shadow-sm relative">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Date */}
            <span className="text-xs text-muted-foreground font-medium hidden sm:block">{todayStr}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="flex items-center gap-1 px-2 py-1 rounded-xl border border-border bg-background/80 shadow-sm text-xs"
              title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            >
              <span className={cn("transition-all", lang === "en" && "text-primary font-extrabold")}>EN</span>
              <span className="text-muted-foreground/50 mx-0.5">|</span>
              <span className={cn("transition-all", lang === "ar" && "text-primary font-extrabold")}>عربي</span>
            </button>

              {/* Page Zoom Control */}
                <div className="flex items-center gap-1 rounded-xl border border-border bg-background/80 px-1 py-0.5 text-xs font-bold shadow-sm">
                <button
                  type="button"
                  onClick={() => setPageZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(1))))}
                  className="w-5 h-5 rounded-lg hover:bg-muted"
                >
                  -
                </button>

                <span className="min-w-[42px] text-center text-muted-foreground">
                  {Math.round(pageZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setPageZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(1))))}
                  className="w-5 h-5 rounded-lg hover:bg-muted"
                >
                  +
                </button>
              </div>

           {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  settingsOpen
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                )}
                title={t("settings")}
              >
                <Settings className={cn("w-5 h-5 transition-transform duration-300", settingsOpen && "rotate-90")} />
              </button>

              {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
            </div>

            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold"
              >
                {initial}
              </button>

              {userMenuOpen && (
                <div
                    className={cn(
                      "absolute top-10 bg-white rounded-xl shadow-xl border p-4 min-w-[220px] z-[9999]",
                      isRTL ? "left-2" : "right-0"
                    )}
                  >
                  <p className="text-sm font-semibold text-slate-900">
                    {isAR ? resolvedName : user?.displayNameEn || resolvedName}
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    {roleLabel}
                  </p>

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
          </header>

        {/* Page content */}
        <div
            className="flex-1 overflow-y-auto main-bg-pattern"
            style={{ zoom: pageZoom }}
          >
          <div className="min-h-full">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
