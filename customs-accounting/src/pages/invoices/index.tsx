import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListInvoices, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "../dashboard";
import { Plus, Search, Edit2, Trash2, Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function InvoicesList() {
  const { can } = useAuth();
  const { t } = useLanguage();
  const { data: invoices, isLoading } = useListInvoices();
  const [search, setSearch] = useState("");
  
  const q = search.toLowerCase();
  const filtered = invoices?.filter(i =>
    i.invoiceNumber.toLowerCase().includes(q) ||
    i.clientName.toLowerCase().includes(q) ||
    (i.shipmentRef && i.shipmentRef.toLowerCase().includes(q)) ||
    (i.billOfLading && i.billOfLading.toLowerCase().includes(q))
  ) || [];

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteInvoice = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoices") + " — " + t("delete") });
      }
    }
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("invoices")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("invoicesDesc")}</p>
        </div>
        <Link href="/invoices/new">
          <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            {t("createInvoiceBtn")}
          </button>
        </Link>
      </div>

      <div className="bg-card border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        {/* Search + count bar */}
        <div className="px-4 py-3 border-b border-border/50 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              placeholder={t("searchInvoicePlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
          {!isLoading && (
            <span className="text-xs text-muted-foreground shrink-0">
              {search
                ? <>{filtered.length} <span className="opacity-60">/ {invoices?.length ?? 0}</span></>
                : <>{invoices?.length ?? 0} فاتورة</>
              }
            </span>
          )}
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
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground animate-pulse">{t("loadingInvoices")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">{t("noInvoices")}</td></tr>
              ) : (
                filtered.map((inv, idx) => (
                  <tr key={inv.id} className={`transition-colors group hover:bg-primary/5 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-primary text-sm">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{inv.clientName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{formatDate(inv.issueDate)}</p>
                      {inv.dueDate && <p className="text-xs text-muted-foreground mt-0.5">{t("dueDate")}: {formatDate(inv.dueDate)}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-end">
                      <span className="font-mono font-bold text-sm">{formatCurrency(inv.total)}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/invoices/${inv.id}/receipt`}>
                          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-800 hover:text-white rounded-lg transition-colors dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600" title={t("print")}>
                            <Printer className="w-3.5 h-3.5" />
                            {t("print")}
                          </button>
                        </Link>
                        {can("canEditInvoices") && (
                          <Link href={`/invoices/${inv.id}/edit`}>
                            <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title={t("edit")}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        )}
                        {can("canDeleteInvoices") && (
                          <button
                            onClick={() => { if(confirm(t("confirmDeleteDesc"))) deleteInvoice.mutate({ id: inv.id }); }}
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

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-center">
            <span className="text-xs text-muted-foreground">
              {search ? `${filtered.length} من ${invoices?.length ?? 0} فاتورة` : `إجمالي ${filtered.length} فاتورة`}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
