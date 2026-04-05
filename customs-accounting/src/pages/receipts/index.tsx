import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListReceipts, useDeleteReceipt, getListReceiptsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  Plus, Search, Printer, Pencil, Trash2, ReceiptText, Banknote, CreditCard, FileCheck, Eye, EyeOff
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
  const { can } = useAuth();
  const { t, lang } = useLanguage();
  const isAR = lang === "ar";
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const hidden = <span className="tracking-widest opacity-35 font-mono">••••••</span>;
  const { data: receipts, isLoading } = useListReceipts();
  const deleteReceiptMutation = useDeleteReceipt();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const paymentMethodLabel: Record<string, string> = {
    cash: t("cash"),
    transfer: t("transfer"),
    check: t("check"),
  };

  const filtered = (receipts ?? []).filter((r) => {
    const q = search.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      (r.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
      (r.notes?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalAmount = (receipts ?? []).reduce((sum, r) => sum + r.amount, 0);

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteReceiptMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      toast({ title: t("delete"), description: t("receipts") });
    } catch {
      toast({ title: "خطأ", description: "فشل حذف سند القبض", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("receipts")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("receiptsDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAmounts(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              showAmounts
                ? "bg-card border-border text-muted-foreground hover:bg-muted/40"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
            }`}
          >
            {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showAmounts ? (isAR ? "إخفاء الأرقام" : "Hide") : (isAR ? "إظهار الأرقام" : "Show")}
          </button>
          <Link href="/receipts/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("newReceiptBtn")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary card */}
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
          <p className="text-2xl font-bold text-foreground">{showAmounts ? formatCurrency(totalAmount) : hidden}</p>
        </div>
        <div className="ms-auto text-end">
          <p className="text-sm text-muted-foreground">{t("receiptCount")}</p>
          <p className="text-2xl font-bold">{(receipts ?? []).length}</p>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={t("searchReceiptPlaceholder")}
          className="pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
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
          <div className="overflow-x-auto overflow-y-auto max-h-[490px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/40">
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("receiptNumber")}</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("client")}</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("invoiceRef")}</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("amount")}</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("paymentMethod")}</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("date")}</th>
                <th className="text-end px-4 py-3 font-semibold text-muted-foreground">{t("actions")}</th>
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
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{receipt.receiptNumber}</td>
                  <td className="px-4 py-3 font-medium">{receipt.clientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {receipt.invoiceNumber ? (
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{receipt.invoiceNumber}</span>
                    ) : (
                      <span className="text-xs italic">{t("independentPayment")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-700">{showAmounts ? formatCurrency(receipt.amount) : hidden}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_METHOD_COLORS[receipt.paymentMethod]}`}>
                      {PAYMENT_METHOD_ICONS[receipt.paymentMethod]}
                      {paymentMethodLabel[receipt.paymentMethod] ?? receipt.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(receipt.receiptDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/receipts/${receipt.id}/print`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title={t("print")}>
                          <Printer className="w-4 h-4" />
                        </Button>
                      </Link>
                      {can("canEditReceipts") && (
                        <Link href={`/receipts/${receipt.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title={t("edit")}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                      {can("canDeleteReceipts") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteReceiptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteReceiptDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
