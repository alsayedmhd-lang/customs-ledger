import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Search, Filter, X, ShieldOff, Save, Check,
  Loader2, Users, Truck, MapPin, CalendarRange, ChevronDown, ChevronUp, Eye, EyeOff,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "https://workspaceapi-server-production-0e1f.up.railway.app").replace(/\/$/, "");
interface AccountingRow {
  id: number;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  total: number;
  payments: number;
  transportation: number;
  driverName: string;
  unloadLocation: string;
  labor: number;
  otherExpenses: number;
  transportationPaid: boolean;
  laborPaid: boolean;
  otherExpensesPaid: boolean;
}

interface RowEdit {
  payments: string;
  transportation: string;
  driverName: string;
  unloadLocation: string;
  labor: string;
  otherExpenses: string;
  transportationPaid: boolean;
  laborPaid: boolean;
  otherExpensesPaid: boolean;
}

function getToken() { return sessionStorage.getItem("auth_token"); }

async function fetchAccounting(): Promise<AccountingRow[]> {
  const res = await fetch(`${API_BASE}/api/accounting`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function patchAccounting(invoiceId: number, data: object) {
  const res = await fetch(`${API_BASE}/api/accounting/${invoiceId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save");
}

function rowToEdit(row: AccountingRow): RowEdit {
  return {
    payments: row.payments === 0 ? "" : String(row.payments),
    transportation: row.transportation === 0 ? "" : String(row.transportation),
    driverName: row.driverName ?? "",
    unloadLocation: row.unloadLocation ?? "",
    labor: row.labor === 0 ? "" : String(row.labor),
    otherExpenses: row.otherExpenses === 0 ? "" : String(row.otherExpenses),
    transportationPaid: row.transportationPaid ?? false,
    laborPaid: row.laborPaid ?? false,
    otherExpensesPaid: row.otherExpensesPaid ?? false,
  };
}

function p(v: string) { return parseFloat(v) || 0; }

function calcIncome(row: AccountingRow, e: RowEdit) {
  return row.total - p(e.payments)
    - (e.transportationPaid ? p(e.transportation) : 0)
    - (e.laborPaid ? p(e.labor) : 0)
    - (e.otherExpensesPaid ? p(e.otherExpenses) : 0);
}

function isDirty(row: AccountingRow, e: RowEdit) {
  return (
    p(e.payments) !== row.payments ||
    p(e.transportation) !== row.transportation ||
    (e.driverName ?? "") !== (row.driverName ?? "") ||
    (e.unloadLocation ?? "") !== (row.unloadLocation ?? "") ||
    p(e.labor) !== row.labor ||
    p(e.otherExpenses) !== row.otherExpenses ||
    e.transportationPaid !== (row.transportationPaid ?? false) ||
    e.laborPaid !== (row.laborPaid ?? false) ||
    e.otherExpensesPaid !== (row.otherExpensesPaid ?? false)
  );
}

/* ── tiny checkbox toggle ────────────────────── */
function PaidToggle({ checked, onChange, color }: { checked: boolean; onChange: () => void; color: string }) {
  return (
    <button
      onClick={onChange}
      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${
        checked ? `${color} text-white shadow-sm` : "border-border bg-background text-transparent hover:opacity-70"
      }`}
    >
      <Check className="w-3.5 h-3.5" />
    </button>
  );
}

/* ── compact number input ────────────────────── */
function NumInput({ value, onChange, paid }: { value: string; onChange: (v: string) => void; paid?: boolean }) {
  return (
    <input
      type="number" min="0" step="0.01" value={value}
      onChange={(e) => onChange(e.target.value)} placeholder="0"
      className={`w-20 px-1.5 py-1 rounded-md border border-border bg-background text-xs text-right
        focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-opacity
        ${paid === false ? "opacity-40" : ""}`}
    />
  );
}

/* ── compact text input ──────────────────────── */
function TxtInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-24 px-1.5 py-1 rounded-md border border-border bg-background text-xs text-right
        focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
    />
  );
}

export default function AccountingPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user, can } = useAuth();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounting"],
    queryFn: fetchAccounting,
    enabled: user?.role === "admin" || can("canViewAccounting"),
  });

  const searchString = useSearch();
  const initialInvoice = useMemo(() => new URLSearchParams(searchString).get("invoice") ?? "", [searchString]);

  const [search, setSearch] = useState(initialInvoice);
  const [clientFilter, setClientFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showAmounts, setShowAmounts] = useState(false);

  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const savedTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (rows.length > 0) {
      setEdits((prev) => {
        const next = { ...prev };
        rows.forEach((row) => { if (!next[row.id]) next[row.id] = rowToEdit(row); });
        return next;
      });
    }
  }, [rows]);

  useEffect(() => {
    if (initialInvoice) {
      setSearch(initialInvoice);
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }
  }, [initialInvoice]);

  const getEdit = useCallback((row: AccountingRow): RowEdit => edits[row.id] ?? rowToEdit(row), [edits]);

  const setField = (rowId: number, field: keyof RowEdit, value: string | boolean) => {
    setEdits((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] ?? {}), [field]: value } }));
    setSaved((prev) => ({ ...prev, [rowId]: false }));
  };

  const saveRow = useCallback(async (row: AccountingRow) => {
    const e = edits[row.id] ?? rowToEdit(row);
    setSaving((prev) => ({ ...prev, [row.id]: true }));
    try {
      await patchAccounting(row.id, {
        payments: p(e.payments), transportation: p(e.transportation),
        driverName: e.driverName, unloadLocation: e.unloadLocation,
        labor: p(e.labor), otherExpenses: p(e.otherExpenses),
        transportationPaid: e.transportationPaid, laborPaid: e.laborPaid, otherExpensesPaid: e.otherExpensesPaid,
      });
      await queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setSaved((prev) => ({ ...prev, [row.id]: true }));
      if (savedTimer.current[row.id]) clearTimeout(savedTimer.current[row.id]);
      savedTimer.current[row.id] = setTimeout(() => setSaved((prev) => ({ ...prev, [row.id]: false })), 2000);
    } catch {
      toast({ title: "فشل الحفظ", description: "حاول مرة أخرى", variant: "destructive" });
    } finally {
      setSaving((prev) => ({ ...prev, [row.id]: false }));
    }
  }, [edits, queryClient, toast]);

  const saveAll = useCallback(async () => {
    const dirtyRows = rows.filter((r) => isDirty(r, edits[r.id] ?? rowToEdit(r)));
    if (!dirtyRows.length) return;
    await Promise.all(dirtyRows.map(saveRow));
    toast({ title: `تم حفظ ${dirtyRows.length} صف بنجاح` });
  }, [rows, edits, saveRow, toast]);

  const clients  = useMemo(() => Array.from(new Set(rows.map((r) => r.clientName))).sort(), [rows]);
  const drivers  = useMemo(() => Array.from(new Set(rows.map((r) => r.driverName).filter(Boolean))).sort(), [rows]);
  const locations = useMemo(() => Array.from(new Set(rows.map((r) => r.unloadLocation).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const e = edits[r.id] ?? rowToEdit(r);
    if (search && !r.invoiceNumber.toLowerCase().includes(search.toLowerCase()) &&
        !r.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (clientFilter && r.clientName !== clientFilter) return false;
    if (driverFilter && e.driverName !== driverFilter) return false;
    if (locationFilter && e.unloadLocation !== locationFilter) return false;
    if (dateFrom && r.issueDate < dateFrom) return false;
    if (dateTo && r.issueDate > dateTo) return false;
    return true;
  }), [rows, search, clientFilter, driverFilter, locationFilter, dateFrom, dateTo, edits]);

  const totalInvoices = useMemo(() => filtered.reduce((s, r) => s + r.total, 0), [filtered]);
  const totalPayments = useMemo(() => filtered.reduce((s, r) => s + p(getEdit(r).payments), 0), [filtered, getEdit]);
  const totalTransportation = useMemo(() => filtered.reduce((s, r) => { const e = getEdit(r); return s + (!e.transportationPaid ? p(e.transportation) : 0); }, 0), [filtered, getEdit]);
  const totalLabor = useMemo(() => filtered.reduce((s, r) => { const e = getEdit(r); return s + (!e.laborPaid ? p(e.labor) : 0); }, 0), [filtered, getEdit]);
  const totalOther = useMemo(() => filtered.reduce((s, r) => { const e = getEdit(r); return s + (!e.otherExpensesPaid ? p(e.otherExpenses) : 0); }, 0), [filtered, getEdit]);
  const totalIncome = useMemo(() => filtered.reduce((s, r) => s + calcIncome(r, getEdit(r)), 0), [filtered, getEdit]);

  const anyDirty = useMemo(() => rows.some((r) => isDirty(r, edits[r.id] ?? rowToEdit(r))), [rows, edits]);
  const hasFilters = search || clientFilter || driverFilter || locationFilter || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setClientFilter(""); setDriverFilter(""); setLocationFilter(""); setDateFrom(""); setDateTo(""); };

  const summaryCards = [
    { label: "إجمالي الفواتير", value: totalInvoices, color: "text-foreground", bg: "bg-muted/40", icon: "📋" },
    { label: "المدفوعات", value: totalPayments, color: "text-blue-500", bg: "bg-blue-50/60 dark:bg-blue-900/15", icon: "💳" },
    { label: "نقليات غير مسددة", value: totalTransportation, color: "text-orange-500", bg: "bg-orange-50/60 dark:bg-orange-900/15", icon: "🚚" },
    { label: "عمال غير مسددة", value: totalLabor, color: "text-purple-500", bg: "bg-purple-50/60 dark:bg-purple-900/15", icon: "👷" },
    { label: "مصاريف غير مسددة", value: totalOther, color: "text-red-500", bg: "bg-red-50/60 dark:bg-red-900/15", icon: "📌" },
    { label: "صافي الدخل", value: totalIncome, color: totalIncome >= 0 ? "text-green-600" : "text-red-500", bg: totalIncome >= 0 ? "bg-green-50/60 dark:bg-green-900/15" : "bg-red-50/60 dark:bg-red-900/15", icon: "💰" },
  ];

  if (user?.role !== "admin" && !can("canViewAccounting")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShieldOff className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">ليس لديك صلاحية</h2>
        <p className="text-muted-foreground">لا تملك صلاحية الوصول إلى صفحة الحسابات. تواصل مع المدير.</p>
      </div>
    );
  }

  /* ── common select style ── */
  const selCls = "w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><Calculator className="w-6 h-6" /></span>
            {t("accounting")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 mr-10">
            جدول الحسابات التفصيلي • {rows.length} فاتورة
            {hasFilters && <span className="text-primary font-medium"> • يُعرض {filtered.length}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAmounts(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${
              showAmounts
                ? "bg-card border-border text-muted-foreground hover:bg-muted/40"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
            }`}
          >
            {showAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAmounts ? "إخفاء الأرقام" : "إظهار الأرقام"}
          </button>
          <AnimatePresence>
            {anyDirty && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                onClick={saveAll}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 transition-all text-sm"
              >
                <Save className="w-4 h-4" />
                حفظ جميع التغييرات
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-2xl border border-border/60 p-3 flex flex-col gap-1`}>
            <div className="flex items-center justify-between">
              <span className="text-lg">{card.icon}</span>
              <span className={`text-xs font-medium ${card.color}`}>QAR</span>
            </div>
            <p className={`text-lg font-bold ${card.color} tabular-nums transition-all`}>
              {showAmounts ? formatCurrency(card.value) : <span className="tracking-widest opacity-40 text-base">••••••</span>}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* filter header */}
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="w-4 h-4 text-primary" />
            <span>البحث والتصفية</span>
            {hasFilters && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {[search, clientFilter, driverFilter, locationFilter, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <X className="w-3 h-3" /> مسح الكل
              </button>
            )}
            {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {/* filter body */}
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/60"
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* بحث نصي */}
                <div className="lg:col-span-1 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Search className="w-3 h-3" /> بحث سريع
                  </label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="رقم الفاتورة أو اسم العميل..."
                      className="w-full pr-9 pl-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* العملاء */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> العميل
                  </label>
                  <div className="relative">
                    <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selCls}>
                      <option value="">جميع العملاء</option>
                      {clients.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>

                {/* التاريخ */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarRange className="w-3 h-3" /> نطاق التاريخ
                  </label>
                  <div className="flex gap-2">
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>

                {/* السائق */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3" /> السائق
                  </label>
                  <div className="relative">
                    <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className={selCls}>
                      <option value="">جميع السائقين</option>
                      {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>

                {/* الموقع */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> مكان التزيل
                  </label>
                  <div className="relative">
                    <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selCls}>
                      <option value="">جميع المواقع</option>
                      {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Table ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span>{t("loading")}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">{t("noData")}</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[440px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-border bg-muted/50 text-[11px]">
                  {/* ─ static cols ─ */}
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground whitespace-nowrap sticky right-0 top-0 bg-muted/50 z-30 shadow-[inset_-1px_0_0_0_hsl(var(--border))]">رقم الفاتورة</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground whitespace-nowrap">مبلغ الفاتورة</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground whitespace-nowrap">العميل</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground whitespace-nowrap">التاريخ</th>
                  {/* ─ payments ─ */}
                  <th className="px-2 py-2.5 text-right font-semibold text-blue-500 whitespace-nowrap border-r border-border/40">المدفوعات</th>
                  {/* ─ transport group ─ */}
                  <th className="px-2 py-2.5 text-right font-semibold text-orange-500 whitespace-nowrap border-r border-border/40">النقليات</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-orange-400 whitespace-nowrap" title="تسديد النقليات">✓</th>
                  <th className="px-2 py-2.5 text-right font-semibold text-sky-500 whitespace-nowrap">اسم السائق</th>
                  <th className="px-2 py-2.5 text-right font-semibold text-teal-500 whitespace-nowrap">مكان التزيل</th>
                  {/* ─ labor group ─ */}
                  <th className="px-2 py-2.5 text-right font-semibold text-purple-500 whitespace-nowrap border-r border-border/40">العمال</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-purple-400 whitespace-nowrap" title="تسديد العمال">✓</th>
                  {/* ─ other group ─ */}
                  <th className="px-2 py-2.5 text-right font-semibold text-red-500 whitespace-nowrap border-r border-border/40">مصاريف أخرى</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-red-400 whitespace-nowrap" title="تسديد المصاريف">✓</th>
                  {/* ─ income + save ─ */}
                  <th className="px-3 py-2.5 text-right font-semibold text-green-600 whitespace-nowrap bg-green-50/40 dark:bg-green-900/10 border-r border-border/40">الدخل</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap">💾</th>
                </tr>
                {/* ─ column group labels ─ */}
                <tr className="text-[10px] bg-muted/20 border-b border-border/40 sticky top-[33px] z-20">
                  <td colSpan={4} />
                  <td className="px-2 py-1 text-blue-400 text-center border-r border-border/40">مدفوعات العميل</td>
                  <td colSpan={4} className="px-2 py-1 text-orange-400 text-center border-r border-border/40">مجموعة النقليات</td>
                  <td colSpan={2} className="px-2 py-1 text-purple-400 text-center border-r border-border/40">مجموعة العمال</td>
                  <td colSpan={2} className="px-2 py-1 text-red-400 text-center border-r border-border/40">مجموعة أخرى</td>
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const e = getEdit(row);
                  const income = calcIncome(row, e);
                  const dirty = isDirty(row, e);
                  const isSaving = saving[row.id];
                  const isSaved = saved[row.id];
                  const isHighlighted = initialInvoice && row.invoiceNumber === initialInvoice;

                  return (
                    <tr
                      key={row.id}
                      ref={isHighlighted ? highlightRef : undefined}
                      className={`border-b border-border/40 transition-colors group ${
                        isHighlighted ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
                        : idx % 2 === 0 ? "hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/25"
                      } ${dirty ? "ring-1 ring-inset ring-amber-400/50" : ""}`}
                    >
                      {/* رقم الفاتورة – sticky */}
                      <td className="px-3 py-1.5 whitespace-nowrap sticky right-0 bg-inherit z-10 shadow-[inset_-1px_0_0_0_hsl(var(--border))]">
                        <Link href={`/invoices/${row.id}/receipt`}>
                          <span className="font-mono text-primary font-semibold hover:underline cursor-pointer text-xs">
                            {row.invoiceNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground">{formatCurrency(row.total)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap max-w-[120px] truncate" title={row.clientName}>{row.clientName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{new Date(row.issueDate).toLocaleDateString("ar-EG")}</td>

                      {/* المدفوعات */}
                      <td className="px-1.5 py-1.5 border-r border-border/40">
                        <NumInput value={e.payments} onChange={(v) => setField(row.id, "payments", v)} />
                      </td>

                      {/* النقليات */}
                      <td className="px-1.5 py-1.5 border-r border-border/40">
                        <NumInput value={e.transportation} onChange={(v) => setField(row.id, "transportation", v)} paid={e.transportationPaid} />
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <PaidToggle checked={e.transportationPaid} onChange={() => setField(row.id, "transportationPaid", !e.transportationPaid)}
                          color="bg-orange-500 border-orange-500" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <TxtInput value={e.driverName} onChange={(v) => setField(row.id, "driverName", v)} placeholder="السائق" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <TxtInput value={e.unloadLocation} onChange={(v) => setField(row.id, "unloadLocation", v)} placeholder="الموقع" />
                      </td>

                      {/* العمال */}
                      <td className="px-1.5 py-1.5 border-r border-border/40">
                        <NumInput value={e.labor} onChange={(v) => setField(row.id, "labor", v)} paid={e.laborPaid} />
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <PaidToggle checked={e.laborPaid} onChange={() => setField(row.id, "laborPaid", !e.laborPaid)}
                          color="bg-purple-500 border-purple-500" />
                      </td>

                      {/* مصاريف أخرى */}
                      <td className="px-1.5 py-1.5 border-r border-border/40">
                        <NumInput value={e.otherExpenses} onChange={(v) => setField(row.id, "otherExpenses", v)} paid={e.otherExpensesPaid} />
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <PaidToggle checked={e.otherExpensesPaid} onChange={() => setField(row.id, "otherExpensesPaid", !e.otherExpensesPaid)}
                          color="bg-red-500 border-red-500" />
                      </td>

                      {/* الدخل */}
                      <td className={`px-3 py-1.5 whitespace-nowrap font-bold bg-green-50/30 dark:bg-green-900/10 border-r border-border/40 ${income >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatCurrency(income)}
                      </td>

                      {/* حفظ */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => saveRow(row)}
                          disabled={isSaving || (!dirty && !isSaved)}
                          title="حفظ"
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                            isSaved ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                            : dirty ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                            : "bg-transparent text-muted-foreground/40 cursor-not-allowed"
                          }`}
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : isSaved ? <Check className="w-3.5 h-3.5" />
                            : <Save className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60 font-bold text-xs">
                  <td className="px-3 py-2.5 text-muted-foreground sticky right-0 bg-muted/60 z-10">المجموع ({filtered.length})</td>
                  <td className="px-3 py-2.5 text-foreground">{formatCurrency(totalInvoices)}</td>
                  <td colSpan={2} />
                  <td className="px-2 py-2.5 text-blue-500 border-r border-border/40">{formatCurrency(totalPayments)}</td>
                  <td className="px-2 py-2.5 text-orange-500 border-r border-border/40">{formatCurrency(totalTransportation)}</td>
                  <td colSpan={3} />
                  <td className="px-2 py-2.5 text-purple-500 border-r border-border/40">{formatCurrency(totalLabor)}</td>
                  <td />
                  <td className="px-2 py-2.5 text-red-500 border-r border-border/40">{formatCurrency(totalOther)}</td>
                  <td />
                  <td className={`px-3 py-2.5 bg-green-50/30 dark:bg-green-900/10 ${totalIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(totalIncome)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
