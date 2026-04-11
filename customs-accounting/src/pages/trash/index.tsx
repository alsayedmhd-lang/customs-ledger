import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Trash, FileText, ReceiptText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function authFetch(url: string, options: RequestInit = {}) {
  const token = sessionStorage.getItem("auth_token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

type TrashInvoice = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  total: number;
  status: string;
  deletedAt: string;
};

type TrashReceipt = {
  id: number;
  receiptNumber: string;
  clientName: string;
  receivedAt: string;
  amount: number;
  paymentMethod: string;
  deletedAt: string;
};

type ActiveTab = "invoices" | "receipts";

export default function TrashPage() {
  const { t, lang, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoices");
  const [confirmDelete, setConfirmDelete] = useState<{ type: "invoice" | "receipt"; id: number } | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Status and method labels use translation keys
  const statusLabels: Record<string, string> = {
    draft: t("draft"),
    issued: t("issued"),
    paid: t("paid"),
    cancelled: t("cancelled"),
  };
  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
    issued: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  const methodLabels: Record<string, string> = {
    cash: t("cash"),
    transfer: t("transfer"),
    check: t("check"),
  };

  function timeSince(isoDate: string) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (lang === "ar") {
      if (days > 0) return `${t("timeAgo")} ${days} ${t("timeDays")}`;
      if (hours > 0) return `${t("timeAgo")} ${hours} ${t("timeHours")}`;
      return t("timeJustNow");
    } else {
      if (days > 0) return `${days} ${t("timeDays")} ${t("timeAgo")}`;
      if (hours > 0) return `${hours} ${t("timeHours")} ${t("timeAgo")}`;
      return t("timeJustNow");
    }
  }

  const { data: trashedInvoices = [], isLoading: loadingInvoices } = useQuery<TrashInvoice[]>({
    queryKey: ["trash-invoices"],
    queryFn: async () => {
      const res = await authFetch(`${API_BASE}/api/trash/invoices`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: trashedReceipts = [], isLoading: loadingReceipts } = useQuery<TrashReceipt[]>({
    queryKey: ["trash-receipts"],
    queryFn: async () => {
      const res = await authFetch(`${API_BASE}/api/trash/receipts`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const restoreInvoice = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${API_BASE}/api/trash/invoices/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("restoredTitle"), description: t("restoredInvoiceDesc") });
    },
    onError: () => toast({ title: t("errorTitle"), variant: "destructive" }),
  });

  const restoreReceipt = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${API_BASE}/api/trash/receipts/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash-receipts"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      toast({ title: t("restoredTitle"), description: t("restoredReceiptDesc") });
    },
    onError: () => toast({ title: t("errorTitle"), variant: "destructive" }),
  });

  const deleteInvoicePermanently = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${API_BASE}/api/trash/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash-invoices"] });
      toast({ title: t("permanentDeletedTitle"), description: t("permanentDeletedInvoiceDesc") });
    },
    onError: () => toast({ title: t("errorTitle"), variant: "destructive" }),
  });

  const deleteReceiptPermanently = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${API_BASE}/api/trash/receipts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash-receipts"] });
      toast({ title: t("permanentDeletedTitle"), description: t("permanentDeletedReceiptDesc") });
    },
    onError: () => toast({ title: t("errorTitle"), variant: "destructive" }),
  });

  const emptyTrash = useMutation({
    mutationFn: async () => {
      await Promise.all([
        ...trashedInvoices.map((inv) => authFetch(`${API_BASE}/api/trash/invoices/${inv.id}`, { method: "DELETE" })),
        ...trashedReceipts.map((rec) => authFetch(`${API_BASE}/api/trash/receipts/${rec.id}`, { method: "DELETE" })),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash-invoices"] });
      qc.invalidateQueries({ queryKey: ["trash-receipts"] });
      toast({ title: t("emptiedTrashTitle"), description: t("emptiedTrashDesc") });
    },
    onError: () => toast({ title: t("errorTitle"), variant: "destructive" }),
  });

  const totalItems = trashedInvoices.length + trashedReceipts.length;

  const thCls = "px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider";
  const tdCls = "px-4 py-3";

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-destructive/10 p-2.5 rounded-xl text-destructive">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("trashTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {totalItems > 0
                ? lang === "ar"
                  ? `${totalItems} عنصر محذوف`
                  : `${totalItems} deleted item${totalItems > 1 ? "s" : ""}`
                : t("trashEmpty")}
            </p>
          </div>
        </div>
        {totalItems > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmEmpty(true)} className="gap-2">
            <Trash className="w-4 h-4" />
            {t("emptyTrash")}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["invoices", "receipts"] as ActiveTab[]).map((tab) => {
          const count = tab === "invoices" ? trashedInvoices.length : trashedReceipts.length;
          const Icon = tab === "invoices" ? FileText : ReceiptText;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {t(tab)}
              {count > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div>
          {loadingInvoices ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("loading")}</div>
          ) : trashedInvoices.length === 0 ? (
            <EmptyState icon={<FileText className="w-10 h-10" />} label={t("noDeletedInvoices")} />
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto overflow-y-auto max-h-[660px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/40 text-start border-b border-border/60">
                    <th className={thCls}>{t("invoiceNumber")}</th>
                    <th className={thCls}>{t("client")}</th>
                    <th className={thCls}>{t("date")}</th>
                    <th className={thCls}>{t("total")}</th>
                    <th className={thCls}>{t("status")}</th>
                    <th className={thCls}>{t("deletedAt")}</th>
                    <th className={`${thCls} text-center`}>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {trashedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className={`${tdCls} font-mono font-bold text-primary`}>{inv.invoiceNumber}</td>
                      <td className={`${tdCls} font-medium`}>{inv.clientName}</td>
                      <td className={`${tdCls} text-muted-foreground`}>{formatDate(inv.issueDate)}</td>
                      <td className={`${tdCls} font-semibold`}>{formatCurrency(inv.total)}</td>
                      <td className={tdCls}>
                        <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold", statusColors[inv.status])}>
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className={`${tdCls} text-muted-foreground text-xs`}>{timeSince(inv.deletedAt)}</td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline"
                            className="gap-1.5 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                            onClick={() => restoreInvoice.mutate(inv.id)}
                            disabled={restoreInvoice.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t("restore")}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="gap-1.5 h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete({ type: "invoice", id: inv.id })}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            {t("permanentDelete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receipts Tab */}
      {activeTab === "receipts" && (
        <div>
          {loadingReceipts ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("loading")}</div>
          ) : trashedReceipts.length === 0 ? (
            <EmptyState icon={<ReceiptText className="w-10 h-10" />} label={t("noDeletedReceipts")} />
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto overflow-y-auto max-h-[660px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/40 text-start border-b border-border/60">
                    <th className={thCls}>{t("receiptNumber")}</th>
                    <th className={thCls}>{t("client")}</th>
                    <th className={thCls}>{t("date")}</th>
                    <th className={thCls}>{t("amount")}</th>
                    <th className={thCls}>{t("paymentMethod")}</th>
                    <th className={thCls}>{t("deletedAt")}</th>
                    <th className={`${thCls} text-center`}>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {trashedReceipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                      <td className={`${tdCls} font-mono font-bold text-primary`}>{rec.receiptNumber}</td>
                      <td className={`${tdCls} font-medium`}>{rec.clientName}</td>
                      <td className={`${tdCls} text-muted-foreground`}>{formatDate(rec.receivedAt)}</td>
                      <td className={`${tdCls} font-semibold`}>{formatCurrency(rec.amount)}</td>
                      <td className={`${tdCls} text-muted-foreground`}>{methodLabels[rec.paymentMethod] ?? rec.paymentMethod}</td>
                      <td className={`${tdCls} text-muted-foreground text-xs`}>{timeSince(rec.deletedAt)}</td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline"
                            className="gap-1.5 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                            onClick={() => restoreReceipt.mutate(rec.id)}
                            disabled={restoreReceipt.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t("restore")}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="gap-1.5 h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete({ type: "receipt", id: rec.id })}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            {t("permanentDelete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm permanent delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteDesc")}{" "}
              {lang === "ar"
                ? `سيتم حذف ${confirmDelete?.type === "invoice" ? t("invoiceWord") : t("receiptWord")} نهائياً من قاعدة البيانات.`
                : `The ${confirmDelete?.type === "invoice" ? t("invoiceWord") : t("receiptWord")} will be permanently deleted from the database.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.type === "invoice") deleteInvoicePermanently.mutate(confirmDelete.id);
                else deleteReceiptPermanently.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              {t("permanentDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm empty trash */}
      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("confirmEmptyTrash")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيتم حذف جميع العناصر في سلة المحذوفات (${totalItems} عنصر) نهائياً دون إمكانية الاسترداد.`
                : `All ${totalItems} item${totalItems > 1 ? "s" : ""} in trash will be permanently deleted and cannot be recovered.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { emptyTrash.mutate(); setConfirmEmpty(false); }}
            >
              {t("emptyTrash")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
      <div className="opacity-25">{icon}</div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
