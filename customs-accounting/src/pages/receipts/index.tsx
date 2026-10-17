import { describeDatePeriod } from "@/lib/date-period-description";
import ResizableScrollArea from "@/components/layout/ResizableScrollArea";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListReceipts, useDeleteReceipt, getListReceiptsQueryKey, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  Plus,
  Search,
  Printer,
  Pencil,
  Trash2,
  ReceiptText,
  Banknote,
  CreditCard,
  FileCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4" />,
  transfer: <CreditCard className="w-4 h-4" />,
  check: <FileCheck className="w-4 h-4" />,
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700",
  transfer: "bg-blue-100 text-blue-700",
  check: "bg-amber-100 text-amber-700",
};

export default function ReceiptsList() {
  const { user, can } = useAuth();
  const isClient = user?.role === "client";
  const { t, lang } = useLanguage();
  const defaultColumnWidths = [12, 18, 12, 10, 11, 8, 8, 9, 12];
  const columnStorageKey = "ledger-receipts-column-widths-v1";
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(columnStorageKey) || "null");
      if (Array.isArray(saved) && saved.length === 9 && saved.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 1) && Math.abs(saved.reduce((a, b) => a + b, 0) - 100) < 0.1) return saved;
    } catch { /* Use default widths when storage is unavailable. */ }
    return defaultColumnWidths;
  });
  const tableRef = useRef<HTMLTableElement>(null);
  const columnDrag = useRef<{ index: number; x: number; width: number; widths: number[]; rtl: boolean } | null>(null);
  useEffect(() => {
    try { localStorage.setItem(columnStorageKey, JSON.stringify(columnWidths)); } catch { /* Layout remains usable without storage. */ }
  }, [columnWidths]);
  const columnHandle = (index: number) => index < 8 ? (
    <span
      role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={lang === "ar" ? "تغيير عرض العمود" : "Resize column"}
      title={lang === "ar" ? "اسحب لتغيير العرض — انقر مرتين لاستعادة المقاسات" : "Drag to resize — double-click to reset widths"}
      className="absolute inset-y-0 end-0 w-2 cursor-col-resize touch-none select-none hover:bg-primary/10 focus:bg-primary/10 z-40"
      onDoubleClick={() => setColumnWidths(defaultColumnWidths)}
      onPointerDown={(event) => {
        if (event.button !== 0 || !tableRef.current) return;
        event.preventDefault(); event.stopPropagation();
        columnDrag.current = { index, x: event.clientX, width: tableRef.current.getBoundingClientRect().width, widths: [...columnWidths], rtl: getComputedStyle(tableRef.current).direction === "rtl" };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = columnDrag.current;
        if (!drag || drag.index !== index || drag.width <= 0) return;
        const delta = (event.clientX - drag.x) * (drag.rtl ? -1 : 1) / drag.width * 100;
        const pair = drag.widths[index] + drag.widths[index + 1];
        const minimum = Math.min(28 / drag.width * 100, pair / 2);
        const next = [...drag.widths];
        next[index] = Math.max(minimum, Math.min(pair - minimum, drag.widths[index] + delta));
        next[index + 1] = pair - next[index];
        setColumnWidths(next);
      }}
      onPointerUp={() => { columnDrag.current = null; }}
      onPointerCancel={() => { columnDrag.current = null; }}
      onLostPointerCapture={() => { columnDrag.current = null; }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const rtl = tableRef.current && getComputedStyle(tableRef.current).direction === "rtl";
        const delta = (event.key === "ArrowRight" ? 0.5 : -0.5) * (rtl ? -1 : 1);
        setColumnWidths((current) => {
          const next = [...current]; const pair = current[index] + current[index + 1];
          next[index] = Math.max(1, Math.min(pair - 1, current[index] + delta));
          next[index + 1] = pair - next[index]; return next;
        });
      }}
    />
  ) : null;


  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const [search, setSearch] = useState("");
  function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

  function getDefaultDateRange() {
    const today = new Date();

    return {
      from: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: formatDateInput(today),
    };
  }

  const [fromDate, setFromDate] = useState(() => getDefaultDateRange().from);
  const [toDate, setToDate] = useState(() => getDefaultDateRange().to);
  
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const hidden = <span className="tracking-widest opacity-35 font-mono">••••••</span>;
  const { data: receipts = [], isLoading } = useListReceipts();
  const { data: clients = [] } = useListClients();
  const deleteReceiptMutation = useDeleteReceipt();
  const queryClient = useQueryClient();
  const { toast } = useToast();

const paymentMethodLabel: Record<string, string> = {
  cash: t("cash"),
  transfer: t("transfer"),
  check: t("check"),
};

const receiptStatusLabel: Record<string, string> = {
  draft: tr("مسودة", "Draft"),
  issued: tr("صادر", "Issued"),
  cancelled: tr("ملغى", "Cancelled"),
};

const receiptStatusClass: Record<string, string> = {
  cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  draft: "bg-muted/30 text-muted-foreground border-border",
  issued: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const getClientName = (receipt: { clientName?: string | null; clientId?: number | null }) => {
  if (receipt.clientName && receipt.clientName.trim()) return receipt.clientName;

  const client = (clients ?? []).find((c) => c.id === receipt.clientId);
  return client?.name || tr("لا يوجد", "None");
};

  const filtered = (receipts ?? []).filter((r) => {
    const q = search.toLowerCase();
    const receiptDate = String((r as any).receiptDate || (r as any).receivedAt || "").slice(0, 10);
    return (
      ((r.receiptNumber ?? "").toLowerCase().includes(q) ||
        getClientName(r).toLowerCase().includes(q) ||
        (r.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
        (r.notes?.toLowerCase().includes(q) ?? false)) &&
      (!fromDate || receiptDate >= fromDate) &&
      (!toDate || receiptDate <= toDate) &&
      (!paymentMethodFilter || r.paymentMethod === paymentMethodFilter)
    );
  });

  const issuedReceipts = filtered.filter((r) => (r as any).status === "issued");
  const totalAmount = issuedReceipts.reduce((sum, r) => sum + r.amount, 0);

  const handleDelete = async () => {
    if (deleteId == null) return;

    try {
      await deleteReceiptMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      toast({ title: t("delete"), description: t("receipts") });
    } catch {
      toast({
        title: tr("خطأ", "Error"),
        description: tr("فشل حذف سند القبض", "Failed to delete receipt"),
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("receipts")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{lang === "ar" ? "عرض سندات القبض والتحصيلات" : "Receipt vouchers and collections"} {describeDatePeriod(fromDate, toDate, lang)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAmounts((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              showAmounts
                ? "bg-card border-border text-muted-foreground hover:bg-muted/40"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
            }`}
          >
            {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showAmounts ? tr("إخفاء الأرقام", "Hide") : tr("إظهار الأرقام", "Show")}
          </button>

          {!isClient && <Link href="/receipts/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("newReceiptBtn")}
            </Button>
          </Link>}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4"
      >
        <div className="bg-green-100 text-green-700 p-3 rounded-xl">
          <ReceiptText className="w-6 h-6" />
        </div>

        <div>
          <p className="text-sm text-muted-foreground">{t("totalCollected")}</p>
          <p className="text-2xl font-bold text-foreground">
            {showAmounts ? formatCurrency(totalAmount, undefined, lang) : hidden}
          </p>
        </div>

        <div className="ms-auto text-end">
          <p className="text-sm text-muted-foreground">{t("receiptCount")}</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[1.8fr_140px_140px_160px] gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("searchReceiptPlaceholder")}
            className="h-10 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input className="h-10" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input className="h-10" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">{t("paymentMethod")}</option>
          <option value="cash">{t("cash")}</option>
          <option value="transfer">{t("transfer")}</option>
          <option value="check">{t("check")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ReceiptText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{t("noReceipts")}</p>
          <p className="text-sm mt-1">{t("noReceiptsDesc")}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <ResizableScrollArea storageKey="receipts-index" maxHeight={490}>
            <table ref={tableRef} className="w-full table-fixed text-sm [&_th]:text-center [&_td]:text-center [&_th]:align-middle [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-3 [&_td]:px-3 [&_td]:overflow-hidden [&_td]:text-ellipsis [&_tr>td:nth-child(2)]:text-left">
              <colgroup>
                {columnWidths.map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/40">
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("رقم السند", "Receipt No")}
                  {columnHandle(0)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("العميل", "Client")}
                  {columnHandle(1)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("الفاتورة", "Invoice")}
                  {columnHandle(2)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("المبلغ", "Amount")}
                  {columnHandle(3)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("طريقة الدفع", "Payment Method")}
                  {columnHandle(4)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("الحالة", "Status")}
                  {columnHandle(5)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("المستلم", "Received By")}
                  {columnHandle(6)}</th>
                  <th className="relative text-start px-4 py-3 font-semibold text-muted-foreground">
                    {tr("التاريخ", "Date")}
                  {columnHandle(7)}</th>
                  <th className="relative text-end px-4 py-3 font-semibold text-muted-foreground">
                    {tr("الإجراءات", "Actions")}
                  {columnHandle(8)}</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((receipt, i) => (
                  <motion.tr
                    key={receipt.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/receipts/${receipt.id}/edit`}
                        className="font-mono font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {receipt.receiptNumber}
                      </Link>
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {getClientName(receipt)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {receipt.invoiceNumber ? (
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {receipt.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-xs italic">{t("independentPayment")}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-green-700">
                      {showAmounts ? formatCurrency(receipt.amount, undefined, lang) : hidden}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          PAYMENT_METHOD_COLORS[receipt.paymentMethod]
                        }`}
                      >
                        {PAYMENT_METHOD_ICONS[receipt.paymentMethod]}
                        {paymentMethodLabel[receipt.paymentMethod] ?? receipt.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          receiptStatusClass[(receipt as any).status] || receiptStatusClass.draft
                        }`}
                      >
                        {receiptStatusLabel[(receipt as any).status] || receiptStatusLabel.draft}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                        {(receipt as any).receivedByName || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate((receipt as any).receiptDate || (receipt as any).receivedAt, lang)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        <Button
                          type="button"
                          onClick={() => {
                            (window as any).electronAPI?.openExternalPrintWindow?.(
                              `#/receipts/${receipt.id}/print`
                            );
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300"
                          title={t("print")}
                          aria-label={t("print")}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>

                        {!isClient && can("canEditReceipts") && (
                          <Link href={`/receipts/${receipt.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300"
                              title={t("edit")}
                              aria-label={t("edit")}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}

                        {!isClient && can("canDeleteReceipts") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("delete")} className="h-8 w-8 shrink-0 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-700 dark:hover:text-rose-300"
                            onClick={() => setDeleteId(receipt.id)}
                            title={t("delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </ResizableScrollArea>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteReceiptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tr("سيتم تحويل سند القبض إلى ملغى ثم نقله إلى سلة المحذوفات وإلغاء أثره في التحصيل. هل تريد المتابعة؟", "This receipt will be cancelled and moved to trash, removing its collection effect. Continue?")}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
