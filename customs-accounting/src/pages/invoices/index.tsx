import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useListInvoices, useDeleteInvoice, getListInvoicesQueryKey, useGetInvoice } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "../dashboard";
import { Plus, Search, Edit2, Trash2, Printer, FileText, Send, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function InvoicesList() {
  const { user, can } = useAuth();
  const isClient = user?.role === "client";
  const { t, lang } = useLanguage();
  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const { data: invoices = [], isLoading } = useListInvoices();

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const now = new Date();
  const firstDayOfMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = formatLocalDate(now);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("");
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [showAmounts, setShowAmounts] = useState(false);
  const hiddenAmount = <span className="inline-block min-w-[96px] tracking-widest opacity-35 font-mono text-end">••••••</span>;

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [copyId, setCopyId] = useState<number | null>(null);

  const { data: invoiceToCopy } = useGetInvoice(copyId || 0, {
    query: { enabled: copyId !== null },
  });

  useEffect(() => {
    if (!invoiceToCopy) return;

    sessionStorage.setItem(
      "copy_invoice",
      JSON.stringify({
        clientId: invoiceToCopy.clientId,
        taxRate: invoiceToCopy.taxRate,
        advancePayment: invoiceToCopy.advancePayment ?? 0,
        importerExporterName: invoiceToCopy.importerExporterName ?? "",
        portOfEntry: invoiceToCopy.portOfEntry ?? "",
        shipmentRef: invoiceToCopy.shipmentRef ?? "",
        billOfLading: invoiceToCopy.billOfLading ?? "",
        packageCount: invoiceToCopy.packageCount ?? undefined,
        shipmentWeight: invoiceToCopy.shipmentWeight ?? undefined,
        notes: "",
        status: invoiceToCopy.status,
        issueDate: formatLocalDate(new Date()),
        dueDate: "",
        items: invoiceToCopy.items?.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })
    );

    setCopyId(null);
    setLocation("/invoices/new");
  }, [invoiceToCopy, setLocation]);

  const getInvoiceSalesman = (i: any) =>
    i.salesmanName ||
    i.representativeName ||
    i.delegateName ||
    i.createdByName ||
    i.createdByDisplayName ||
    i.userDisplayName ||
    i.username ||
    "";

  const salesmanOptions = isClient
    ? [user?.displayName || user?.displayNameAr || user?.displayNameEn || user?.username || user?.name].filter(Boolean)
    : [
        ...new Set(
          invoices
            .map((i: any) => getInvoiceSalesman(i))
            .filter(Boolean)
        ),
      ];

  const portOptions = [
    ...new Set(
      invoices
        .map((i: any) => i.portOfEntry)
        .filter(Boolean)
    ),
  ];

  function getDeclarationBaseNumber(value: string | null | undefined) {
    return String(value ?? "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim()
      .slice(0, 14);
  }

  const q = search.toLowerCase();

  const filtered = invoices?.filter((i: any) => {
    const issueDate = String(i.issueDate || "").slice(0, 10);

    const shipmentBase = getDeclarationBaseNumber(i.shipmentRef);
    const searchBase = getDeclarationBaseNumber(q);

    const matchesSearch =
      i.invoiceNumber?.toLowerCase().includes(q) ||
      i.clientName?.toLowerCase().includes(q) ||
      (i.shipmentRef && i.shipmentRef.toLowerCase().includes(q)) ||
      (searchBase && shipmentBase && shipmentBase.includes(searchBase)) ||
      (i.billOfLading && i.billOfLading.toLowerCase().includes(q));

    const matchesFrom = !fromDate || issueDate >= fromDate;
    const matchesTo = !toDate || issueDate <= toDate;
    const matchesStatus = !statusFilter || i.status === statusFilter;
    const matchesSalesman = !salesmanFilter || getInvoiceSalesman(i) === salesmanFilter;
    const matchesPort = !portFilter || i.portOfEntry === portFilter;

    return matchesSearch && matchesFrom && matchesTo && matchesStatus && matchesSalesman && matchesPort;
  }) || [];

  const invoiceStatusStats = [
    {
      status: "draft",
      label: t("draft"),
      icon: FileText,
      iconClassName: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
    {
      status: "issued",
      label: t("issued"),
      icon: Send,
      iconClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    {
      status: "paid",
      label: t("paid"),
      icon: CheckCircle2,
      iconClassName: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    },
    {
      status: "cancelled",
      label: t("cancelled"),
      icon: XCircle,
      iconClassName: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    },
  ].map((item) => {
    const statusInvoices = filtered.filter((invoice: any) => invoice.status === item.status);
    const total = statusInvoices.reduce((sum: number, invoice: any) => sum + (Number(invoice.total) || 0), 0);

    return {
      ...item,
      count: statusInvoices.length,
      total,
    };
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteInvoice = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoices") + " - " + t("delete") });
      },
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("invoices")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("invoicesDesc")}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAmounts((value) => !value)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
              showAmounts
                ? "bg-card border-border text-muted-foreground hover:bg-muted/40"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
            }`}
          >
            {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showAmounts ? tr("إخفاء الأرقام", "Hide numbers") : tr("إظهار الأرقام", "Show numbers")}
          </button>

          {!isClient && (
            <Link href="/invoices/new">
              <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" />
                {t("createInvoiceBtn")}
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {invoiceStatusStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <motion.div
              key={stat.status}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4"
            >
              <div className={`${stat.iconClassName} p-3 rounded-xl`}>
                <Icon className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.count}</p>
              </div>

              <div className="ms-auto text-end min-w-0">
                <p className="text-sm text-muted-foreground">{t("total")}</p>
                <p className="text-lg font-bold text-foreground truncate">
                  {showAmounts ? formatCurrency(stat.total) : hiddenAmount}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-card border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 space-y-4">
          {/* Search row */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {tr("البحث", "Search")}
            </span>

            <div className="relative w-full xl:w-[72%]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <input
                placeholder={t("searchInvoicePlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[150px_150px_220px_220px_160px_70px] gap-3 items-center">

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />

            <select
              value={salesmanFilter}
              onChange={(e) => setSalesmanFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            >
              <option value="">{tr("المندوب", "Salesman")}</option>

              {salesmanOptions.map((salesman: any) => (
                <option key={salesman} value={salesman}>
                  {salesman}
                </option>
              ))}
            </select>

            <select
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            >
              <option value="">{tr("منفذ الدخول", "Port of Entry")}</option>

              {portOptions.map((port: any) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            >
              <option value="">{t("status")}</option>
              <option value="draft">{t("draft")}</option>
              <option value="issued">{t("issued")}</option>
              <option value="paid">{t("paid")}</option>
              <option value="cancelled">{t("cancelled")}</option>
            </select>

            {!isLoading && (
              <div className="h-10 px-3 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-xs text-muted-foreground whitespace-nowrap">
                {tr(
                  `${filtered.length}/${invoices?.length ?? 0} فاتورة`,
                  `${filtered.length}/${invoices?.length ?? 0} invoices`
                )}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/60 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">{t("invoiceNumber")}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">{t("client")}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">{t("date")}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">{t("status")}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold tracking-wide uppercase">{t("total")}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold tracking-wide uppercase">{t("actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground animate-pulse">
                    {t("loadingInvoices")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    {t("noInvoices")}
                  </td>
                </tr>
              ) : (
                filtered.map((inv: any, idx: number) => (
                  <tr key={inv.id} className={`transition-colors group hover:bg-primary/5 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}>
                    <td className="px-4 py-3">
                      {isClient ? (
                        <span className="font-mono font-bold text-primary text-sm">{inv.invoiceNumber}</span>
                      ) : (
                        <Link href={`/invoices/${inv.id}/edit`} className="font-mono font-bold text-primary text-sm hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{inv.clientName}</span>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm">{formatDate(inv.issueDate)}</p>
                      {inv.dueDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("dueDate")}: {formatDate(inv.dueDate)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>

                    <td className="px-4 py-3 text-end">
                      <span className="font-mono font-bold text-sm">{formatCurrency(inv.total)}</span>
                    </td>

                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/invoices/${inv.id}/receipt`}>
                          <button
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 border border-border hover:bg-muted/50 hover:text-foreground rounded-lg transition-colors"
                            title={t("print")}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {t("print")}
                          </button>
                        </Link>

                        <button
                          onClick={() => setCopyId(inv.id)}
                          className={`${isClient ? "hidden" : ""} p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors`}
                          title={t("copy")}
                        >
                          📄
                        </button>

                        {!isClient && can("canEditInvoices") && (
                          <Link href={`/invoices/${inv.id}/edit`}>
                            <button
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title={t("edit")}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        )}

                        {!isClient && can("canDeleteInvoices") && (
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-center">
            <span className="text-xs text-muted-foreground">
              {search || fromDate || toDate || statusFilter || salesmanFilter || portFilter
                ? tr(`${filtered.length} من ${invoices?.length ?? 0} فاتورة`, `${filtered.length} of ${invoices?.length ?? 0} invoices`)
                : tr(`إجمالي ${filtered.length} فاتورة`, `Total ${filtered.length} invoices`)}
            </span>
          </div>
        )}

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirmDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("confirmDeleteDesc")}</AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId !== null) {
                    deleteInvoice.mutate({ id: deleteId });
                    setDeleteId(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}
