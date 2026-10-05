import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  useListInvoices,
  useListClients,
  useListReceipts,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, arabicNums } from "@/lib/utils";
import {
  FileText, Users, DollarSign, AlertCircle, ArrowLeft, ArrowRight, TrendingUp, Eye, EyeOff,
  BookOpen, Database, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { useCompanySettings } from "@/lib/company-settings-context";

interface AccountingRow {
  id: number;
  subtotal: number;
  payments: number;
  transportation: number;
  labor: number;
  otherExpenses: number;
  transportationPaid: boolean;
  laborPaid: boolean;
  otherExpensesPaid: boolean;
}

type SystemStatus = {
  connections: { local: boolean; online: boolean; internal: boolean; onlineConfigured: boolean; internalConfigured: boolean; onlineEnabled: boolean; internalEnabled: boolean };
  sync: { autoSync: boolean; internalAutoSync: boolean; status: string; lastSync: string | null; pending: number; failed: number; serverTime: number; nextRunAt: number | null; manualAvailableAt: number | null; timing: string; intervalMinutes: number; scheduleEnabled: boolean };
};

type LiveSyncStatus = {
  online: SystemStatus["sync"];
  internal: Omit<SystemStatus["sync"], "failed" | "internalAutoSync"> & { lastError: string | null };
  connections: { onlineEnabled: boolean; internalEnabled: boolean };
  permissions: { online: boolean; internal: boolean };
};

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");

function getToken() {
  return sessionStorage.getItem("auth_token");
}

async function fetchAccounting(): Promise<AccountingRow[]> {
  const res = await fetch(`${API_BASE}/api/accounting`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) throw new Error("Failed to fetch accounting");

  return res.json();
}

async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/dashboard/system-status`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load system status");
  return res.json();
}

async function fetchSyncStatus(): Promise<LiveSyncStatus> {
  const res = await fetch(`${API_BASE}/api/dashboard/sync-status`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load sync status");
  return res.json();
}
async function requestOnlineSync(target: "online" | "internal"): Promise<void> {
  const res = await fetch(`${API_BASE}/api/dashboard/${target === "online" ? "sync" : "internal-sync"}/run-once`, {
    method: "POST", headers: { Authorization: `Bearer ${getToken()}` },
  });
  const result = await res.json();
  if (!res.ok || !result.ok) throw new Error(result.message || result.error || "Sync failed");
}

export default function Dashboard() {
  const { t, lang, currencySymbol } = useLanguage();
  const isAR = lang === "ar";
  const { user, can } = useAuth();
  const { settings, logoSrc } = useCompanySettings();
  const { data: invoices, isLoading: loadingInvoices } = useListInvoices();
  const { data: receipts = [] } = useListReceipts();
  const { data: clients } = useListClients();
  const { data: accountingRows = [] } = useQuery({
    queryKey: ["accounting"],
    queryFn: fetchAccounting,
    enabled:
      !!user &&
      user.role !== "client" &&
      (user.role === "admin" || can("canViewAccounting")),
  });
  const { data: systemStatus, isError: systemStatusError } = useQuery({
    queryKey: ["dashboard-system-status"],
    queryFn: fetchSystemStatus,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const queryClient = useQueryClient();
  const { data: liveSync, dataUpdatedAt: syncReceivedAt, isError: syncStatusError } = useQuery({
    queryKey: ["dashboard-sync-status"], queryFn: fetchSyncStatus,
    enabled: !!user, refetchInterval: 5000,
  });
  const [clock, setClock] = useState(Date.now());
  const [syncMessage, setSyncMessage] = useState("");
  const manualSync = useMutation({
    mutationFn: requestOnlineSync,
    onMutate: () => setSyncMessage(""),
    onSuccess: () => setSyncMessage(isAR ? "تمت المزامنة بنجاح" : "Sync completed"),
    onError: (error: Error) => setSyncMessage(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-sync-status"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-system-status"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      void queryClient.invalidateQueries({ predicate: query => {
        const key = JSON.stringify(query.queryKey).toLowerCase();
        return key.includes("invoice") || key.includes("receipt") || key.includes("client");
      } });
    },
  });
  const syncRunning = manualSync.isPending || liveSync?.online.status === "running" || liveSync?.internal.status === "running";
  useEffect(() => {
    if (!liveSync?.online.manualAvailableAt && !liveSync?.internal.manualAvailableAt) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveSync?.online.manualAvailableAt, liveSync?.internal.manualAvailableAt]);
  const formatCountdown = (status: LiveSyncStatus["online"] | LiveSyncStatus["internal"]) => {
    if (status.manualAvailableAt === null) return "—";
    const seconds = Math.max(0, Math.ceil((status.manualAvailableAt - status.serverTime - Math.max(0, clock - syncReceivedAt)) / 1000));
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  const enabledConnections = liveSync?.connections ?? systemStatus?.connections;
  const syncTargets = (["online", "internal"] as const).filter(target =>
    target === "online" ? enabledConnections?.onlineEnabled : enabledConnections?.internalEnabled
  );
  const [showAmounts, setShowAmounts] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains("dark"));
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const hidden = <span className="tracking-widest opacity-35 font-mono">••••••</span>;

  const receivedByInvoice = new Map<number, number>();
  for (const receipt of receipts) {
    if (receipt.status !== "issued" || receipt.invoiceId == null) continue;
    const invoiceId = Number(receipt.invoiceId);
    receivedByInvoice.set(
      invoiceId,
      (receivedByInvoice.get(invoiceId) ?? 0) + Number(receipt.amount || 0),
    );
  }

  const collectedForInvoice = (invoice: NonNullable<typeof invoices>[number]) =>
    Number((invoice as { advancePayment?: number }).advancePayment ?? 0) +
    (receivedByInvoice.get(invoice.id) ?? 0);

  const totalOutstanding = (invoices ?? []).reduce((sum, invoice) => {
    if (invoice.status !== "issued") return sum;
    return sum + Math.max(0, Number(invoice.total || 0) - collectedForInvoice(invoice));
  }, 0);
  const totalCollected = (invoices ?? []).reduce((sum, invoice) => {
    if (invoice.status !== "issued") return sum;
    return sum + collectedForInvoice(invoice);
  }, 0);
  const totalUnpaidTransportation =
  accountingRows.reduce(
    (sum, row) =>
      sum + (!row.transportationPaid ? Number(row.transportation || 0) : 0),
    0,
  );

  const totalUnpaidLabor =
  accountingRows.reduce(
    (sum, row) =>
      sum + (!row.laborPaid ? Number(row.labor || 0) : 0),
    0,
  );

  const totalUnpaidOtherExpenses =
  accountingRows.reduce(
    (sum, row) =>
      sum + (!row.otherExpensesPaid ? Number(row.otherExpenses || 0) : 0),
    0,
  );

  const totalPaymentsUncollected = accountingRows.reduce((sum, row) => {
    const invoice = invoices?.find((inv: typeof invoices[number]) => inv.id === row.id);
    if (invoice?.status !== "issued") return sum;
    return sum + Math.max(0, Number(row.payments || 0) - collectedForInvoice(invoice));
  }, 0);

  // The invoice list uses descending local IDs; createdAt can be empty after imports.
  const recentInvoices = [...(invoices ?? [])]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 5);

  const chartData = Array.from(
    (invoices ?? []).reduce((months, inv) => {
      if (inv.status === "cancelled") return months;
      const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?/.exec(inv.issueDate ?? "");
      if (!match) return months;
      const key = `${match[1]}-${match[2]}`;
      months.set(key, (months.get(key) ?? 0) + Number(inv.total ?? 0));
      return months;
    }, new Map<string, number>()),
    ([key, total]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        name: new Date(year, month - 1, 1).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }),
        total,
      };
    },
  ).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);

  const greeting = () => {
    const h = new Date().getHours();
    if (lang === "ar") {
      if (h < 12) return "صباح الخير";
      if (h < 17) return "مساء الخير";
      return "مساء النور";
    } else {
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    }
  };

  const stats = [
    {
      title: t("outstanding"),
      value: formatCurrency(totalOutstanding, currencySymbol, lang),
      icon: AlertCircle,
      color: "bg-primary/70",
      bg: "bg-primary/10 dark:bg-primary/20",
      iconColor: "text-primary",
      border: "border-border",
    },
    {
      title: t("payments"),
      value: formatCurrency(totalPaymentsUncollected, currencySymbol, lang),
      icon: DollarSign,
      color: "bg-primary/70",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      border: "border-border",
    },
    {
      title: isAR ? "المحصّل" : "Collected",
      value: formatCurrency(totalCollected, currencySymbol, lang),
      icon: DollarSign,
      color: "bg-primary/70",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      border: "border-border",
    },
    {
      title: t("unpaidTransportation"),
      value: formatCurrency(totalUnpaidTransportation, currencySymbol, lang),
      icon: TrendingUp,
      color: "bg-primary/70",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      border: "border-border",
    },
    {
      title: t("unpaidLabor"),
      value: formatCurrency(totalUnpaidLabor, currencySymbol, lang),
      icon: Users,
      color: "bg-primary/70",
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      border: "border-border",
    },
    {
      title: t("unpaidOtherExpenses"),
      value: formatCurrency(totalUnpaidOtherExpenses, currencySymbol, lang),
      icon: FileText,
      color: "bg-primary/70",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      iconColor: "text-rose-600 dark:text-rose-400",
      border: "border-border",
    },
    {
      title: t("invoiceCount"),
      value: arabicNums(invoices?.length ?? 0, lang),
      icon: FileText,
      color: "bg-primary/70",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      border: "border-border",
    },
    {
      title: t("totalClients"),
      value: arabicNums(clients?.length ?? 0, lang),
      icon: Users,
      color: "bg-primary/70",
      bg: "bg-teal-50 dark:bg-teal-950/30",
      iconColor: "text-teal-600 dark:text-teal-400",
      border: "border-border",
    },
  ];

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };
  const handleOpenProjectGuide = async () => {
    const api = (window as any).electronAPI;
    if (!api?.openExternalFile) return;

    const result = await api.openExternalFile("docs/project-guide.pdf");
    if (!result?.success) {
      console.error("Failed to open project guide:", result?.error || result);
    }
  };

  return (
    <motion.div
      variants={container} initial="hidden" animate="show"
      className="space-y-3 [container-type:inline-size]"
    >
      <style>{`
        .dashboard-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
        @container (min-width: 850px) {
          .dashboard-detail-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
        }
      `}</style>
      {/* Welcome Banner */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-card shadow-sm dark:border-border" style={{ background: isDarkMode ? "hsl(var(--card))" : "linear-gradient(135deg, var(--sb-from) 0%, var(--sb-to) 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-[-60px] right-[-60px] w-[220px] h-[220px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.7), transparent)" }} />
        <div className="absolute bottom-[-40px] left-[20%] w-[160px] h-[160px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.55), transparent)" }} />

        <div className="relative z-10 flex items-center gap-4 p-4 sm:p-5">
          {/* Logo */}
          <img
            src={logoSrc}
            alt="شعار الشركة"
            className="w-16 h-16 sm:w-24 sm:h-24 flex-shrink-0 object-contain drop-shadow-2xl"
            style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,0.24))" }}
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fallback = document.createElement("div");
              fallback.className = "w-20 h-20 rounded-2xl bg-white/15 dark:bg-muted/30 flex items-center justify-center";
              fallback.innerHTML = '<span class="text-4xl font-black text-white dark:text-foreground">ح</span>';
              el.parentElement!.prepend(fallback);
            }}
          />
          <div>
            <p className="text-white/80 dark:text-muted-foreground text-sm font-semibold mb-0.5">{greeting()}{lang === "ar" ? "،" : ","}</p>
            <h1 className="text-2xl sm:text-3xl font-black text-white dark:text-foreground leading-tight">
              {(lang === "ar" ? user?.displayNameAr : user?.displayNameEn) || user?.displayName || (lang === "ar" ? "المستخدم" : "User")}
            </h1>
            <p className="text-white/80 dark:text-muted-foreground text-sm mt-1 font-medium">
              {t("dashboardDesc")} · {lang === "ar" ? settings.nameAr : settings.nameEn}
            </p>
          </div>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {isAR ? "الإحصائيات" : "Statistics"}
          </p>
          <button
            onClick={() => setShowAmounts(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              showAmounts
                ? "bg-white/90 dark:bg-white/10 border-border text-slate-700 dark:text-white hover:bg-white dark:hover:bg-white/20"
                : "bg-amber-100 dark:bg-white/10 border-amber-200 dark:border-border text-amber-800 dark:text-white hover:bg-amber-200 dark:hover:bg-white/20"
            }`}
          >
            {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showAmounts
              ? (isAR ? "إخفاء الأرقام" : "Hide Numbers")
              : (isAR ? "إظهار الأرقام" : "Show Numbers")}
          </button>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 215px), 1fr))" }}>
          {stats.map((s) => (
            <motion.div
              key={s.title}
              variants={item}
              className={`stat-card bg-card border ${s.border} rounded-2xl p-2 shadow-sm`}
            >
              <div className={`flex items-start justify-between ${s.bg} rounded-xl p-1.5`}>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{s.title}</p>
                  <h3 className="text-xl font-semibold text-foreground tracking-tight">
                    {showAmounts ? s.value : hidden}
                  </h3>
                </div>
                <div className={`p-2 rounded-xl ${s.bg} flex-shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
              </div>
              <div className={`mt-2 h-1 rounded-full ${s.color}`} />
            </motion.div>
          ))}
          <motion.div variants={item} className="stat-card bg-card border border-border rounded-2xl p-2 shadow-sm">
            <div className="flex items-start justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-1.5 min-h-[58px]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{isAR ? "حالة الاتصال" : "Connections"}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold">
                  {(["local", "online", "internal"] as const).filter((key) => key === "local" || (key === "online" ? enabledConnections?.onlineEnabled : enabledConnections?.internalEnabled)).map((key) => {
                    const label = key === "local" ? (isAR ? "محلي" : "Local") : key === "online" ? "Online" : (isAR ? "داخلي" : "Internal");
                    const connected = systemStatus?.connections[key];
                    const enabled = key === "local" || (key === "online" ? enabledConnections?.onlineEnabled : enabledConnections?.internalEnabled);
                    return <span key={key} className={connected === undefined || systemStatusError ? "text-muted-foreground" : connected ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {label}: {connected === undefined || systemStatusError ? "—" : !enabled ? (isAR ? "مفصول" : "Disconnected") : connected ? (isAR ? "متصل" : "Connected") : (isAR ? "منقطع" : "Off")}
                    </span>;
                  })}
                </div>
              </div>
              <Database className="w-5 h-5 text-emerald-600 flex-shrink-0 m-2" />
            </div>
            <div className="mt-2 h-1 rounded-full bg-emerald-500/70" />
          </motion.div>
          <motion.div variants={item} className="stat-card bg-card border border-border rounded-2xl p-2 shadow-sm">
            <div className="bg-sky-50 dark:bg-sky-950/30 rounded-xl p-1.5 min-h-[58px]">
              <div className="flex gap-2">
                {syncTargets.map(target => {
                  const status = liveSync?.[target];
                  const running = status?.status === "running" || (manualSync.isPending && manualSync.variables === target);
                  const waiting = Boolean(status?.manualAvailableAt != null && status.manualAvailableAt - status.serverTime - Math.max(0, clock - syncReceivedAt) > 0);
                  const permitted = liveSync?.permissions[target] === true;
                  const label = target === "online" ? "Online" : (isAR ? "السيرفر الداخلي" : "Internal server");
                  const nextLabel = syncStatusError || !status ? "—" : running ? (isAR ? "جارٍ التنفيذ" : "Running")
                    : waiting ? (isAR ? "الزر متاح خلال" : "Button available in")
                    : (isAR ? "مزامنة يدوية" : "Manual sync");
                  return <div key={target} className="min-w-0 flex-1 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                    <button type="button" onClick={() => manualSync.mutate(target)} disabled={!permitted || syncRunning || waiting || syncStatusError}
                      aria-label={`${isAR ? "مزامنة الآن: " : "Sync now: "}${label}`}
                      title={!permitted ? (isAR ? "تحتاج صلاحية المزامنة من المدير" : "Sync permission from an administrator is required") : waiting ? (isAR ? "انتظر انتهاء العدّ التنازلي" : "Wait for the countdown to finish") : (isAR ? "مزامنة الآن" : "Sync now")}
                      className="rounded-lg p-2 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
                      <RefreshCw className={`w-5 h-5 ${running ? "animate-spin" : ""}`} />
                    </button>
                    <p className="text-[9px] text-muted-foreground">{nextLabel}</p>
                    {!syncStatusError && waiting && status && !running && <p dir="ltr" className="text-[11px] font-semibold tabular-nums text-sky-700 dark:text-sky-400">{formatCountdown(status)}</p>}
                    {!syncStatusError && status && <p className="text-[9px] text-muted-foreground">
                      {isAR ? "معلّق" : "Pending"} {arabicNums(status.pending, lang)}
                      {target === "online" && ` · ${isAR ? "فشل" : "Failed"} ${arabicNums(liveSync!.online.failed, lang)}`}
                    </p>}
                    {!syncStatusError && status?.status === "failed" && <p className="text-[9px] text-rose-600">{isAR ? "توجد أخطاء" : "Errors"}</p>}
                    {!syncStatusError && status?.lastSync && <p className="text-[9px] text-muted-foreground" title={new Date(status.lastSync).toLocaleString(isAR ? "ar-QA" : "en-US")}>
                      {isAR ? "آخر مزامنة " : "Last sync "}{new Date(status.lastSync).toLocaleTimeString(isAR ? "ar-QA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>}
                  </div>;
                })}
              </div>
              {syncTargets.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">{isAR ? "المزامنة غير مفعّلة" : "Sync is disabled"}</p>}
            </div>
            {syncMessage && <p role="status" className={`mt-1 text-[10px] break-words ${manualSync.isError ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"}`}>{syncMessage}</p>}
            <div className="mt-2 h-1 rounded-full bg-sky-500/70" />
          </motion.div>
        </div>
      </div>

      <motion.button
        type="button"
        variants={item}
        onClick={handleOpenProjectGuide}
        className="w-full bg-card border border-border rounded-2xl p-3 shadow-sm text-start transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">
              {isAR ? "دليل المشروع" : "Project Guide"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAR
                ? "افتح دليل استخدام النظام وميزات البرنامج"
                : "Open the system user guide and application features"}
            </p>
          </div>
        </div>
      </motion.button>

      <div className="dashboard-detail-grid">
        {/* Revenue Chart */}
        <motion.div
          variants={item}
          className="min-w-0 bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">{t("monthlyRevenue")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "آخر 6 أشهر" : "Last 6 months"}</p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="h-48">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "Cairo" }}
                    dy={8}
                  />
                  <YAxis
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)", rx: 8 }}
                    contentStyle={{
                      borderRadius: "14px", border: "1px solid hsl(var(--border))",
                      boxShadow: "0 10px 25px -5px hsl(var(--foreground) / 0.12)",
                      background: "hsl(var(--card))", color: "hsl(var(--foreground))",
                      fontSize: "13px", fontFamily: "Cairo", direction: lang === "ar" ? "rtl" : "ltr",
                    }}
                    formatter={(value: number) => [formatCurrency(value, currencySymbol, lang), lang === "ar" ? "الإيرادات" : "Revenue"]}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="hsl(var(--primary))" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="w-10 h-10 opacity-20" />
                <p className="text-sm">{lang === "ar" ? "لا توجد بيانات إيرادات بعد" : "No revenue data yet"}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Invoices */}
        <motion.div
          variants={item}
          className="min-w-0 bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-foreground">{t("recentInvoices")}</h2>
            <Link href="/invoices">
              <span className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-semibold">
                {t("viewAll")}
                {isAR ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </Link>
          </div>

          <div className="space-y-1 flex-1">
            {loadingInvoices ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-2.5">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3.5 w-24 bg-muted rounded-md" />
                    <div className="h-2.5 w-16 bg-muted rounded-md" />
                  </div>
                  <div className="h-5 w-16 bg-muted rounded-full" />
                </div>
              ))
            ) : recentInvoices.length > 0 ? (
              recentInvoices.map((invoice) => (
                <Link key={invoice.id} href={`/invoices/${invoice.id}/edit`}>
                  <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{invoice.clientName}</p>
                        <p className="text-xs text-muted-foreground">{invoice.invoiceNumber} · {formatDate(invoice.issueDate, lang)}</p>
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0 ms-2">
                      <p className="font-bold text-sm font-mono text-foreground">
                        {showAmounts ? formatCurrency(invoice.total, currencySymbol, lang) : hidden}
                      </p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="text-sm">{lang === "ar" ? "لا توجد فواتير حديثة" : "No recent invoices"}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const styles: Record<string, string> = {
    draft: "bg-muted/30 text-muted-foreground border-border",
    issued: "bg-muted/30 text-muted-foreground border-border",
    paid: "bg-muted/30 text-muted-foreground border-border",
    cancelled: "bg-muted/30 text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${styles[status] || styles.draft}`}>
      {t(status as "draft" | "issued" | "paid" | "cancelled")}
    </span>
  );
}
