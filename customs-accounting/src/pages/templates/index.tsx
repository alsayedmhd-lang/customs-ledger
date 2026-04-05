import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListInvoiceItemTemplates, 
  useCreateInvoiceItemTemplate, 
  useUpdateInvoiceItemTemplate, 
  useDeleteInvoiceItemTemplate,
  getListInvoiceItemTemplatesQueryKey,
  InvoiceItemTemplate
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Plus, Edit2, Trash2, PackageSearch, LayoutGrid, List, Grid2x2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "compact" | "list";

export default function TemplatesList() {
  const { t, lang } = useLanguage();
  const isAR = lang === "ar";
  const { data: templates, isLoading } = useListInvoiceItemTemplates();
  const [editingTemplate, setEditingTemplate] = useState<InvoiceItemTemplate | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("templates_view_mode");
    return (saved === "cards" || saved === "compact" || saved === "list") ? saved : "cards";
  });

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("templates_view_mode", mode);
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useDeleteInvoiceItemTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoiceItemTemplatesQueryKey() });
        toast({ title: t("templateDeleted") });
      }
    }
  });

  const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; labelAr: string; labelEn: string }[] = [
    { mode: "cards",   icon: <LayoutGrid className="w-4 h-4" />, labelAr: "بطاقات",  labelEn: "Cards"   },
    { mode: "compact", icon: <Grid2x2    className="w-4 h-4" />, labelAr: "مضغوط",   labelEn: "Compact" },
    { mode: "list",    icon: <List       className="w-4 h-4" />, labelAr: "سطور",    labelEn: "List"    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("templates")}</h1>
          <p className="text-muted-foreground mt-1">{t("templatesDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted/60 rounded-xl p-1 gap-0.5 border border-border/50">
            {VIEW_MODES.map(({ mode, icon, labelAr, labelEn }) => (
              <button
                key={mode}
                onClick={() => changeViewMode(mode)}
                title={isAR ? labelAr : labelEn}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  viewMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {icon}
                <span className="hidden sm:inline">{isAR ? labelAr : labelEn}</span>
              </button>
            ))}
          </div>
          {/* Add button */}
          <button 
            onClick={() => setIsAddOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t("addTemplate")}
          </button>
        </div>
      </div>

      {/* ── Cards view ── */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border/50" />
            ))
          ) : templates?.length === 0 ? (
            <EmptyState t={t} />
          ) : (
            templates?.map(tmpl => (
              <TemplateCard key={tmpl.id} tmpl={tmpl} onEdit={setEditingTemplate} onDelete={id => { if (confirm(t("confirmDeleteTemplate"))) deleteMut.mutate({ id }); }} t={t} />
            ))
          )}
        </div>
      )}

      {/* ── Compact view (4-col small cards) ── */}
      {viewMode === "compact" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border/50" />
            ))
          ) : templates?.length === 0 ? (
            <EmptyState t={t} />
          ) : (
            templates?.map(tmpl => (
              <div key={tmpl.id}
                className="bg-card border border-border/50 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group hover:-translate-y-0.5 flex flex-col gap-1"
              >
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{tmpl.description}</p>
                <p className="text-sm font-mono font-black text-primary mt-auto">{formatCurrency(tmpl.defaultUnitPrice)}</p>
                <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingTemplate(tmpl)}
                    className="flex-1 py-1 text-xs bg-muted hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-center"
                    title={t("edit")}>
                    <Edit2 className="w-3 h-3 mx-auto" />
                  </button>
                  <button onClick={() => { if (confirm(t("confirmDeleteTemplate"))) deleteMut.mutate({ id: tmpl.id }); }}
                    className="flex-1 py-1 text-xs bg-muted hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors text-center"
                    title={t("delete")}>
                    <Trash2 className="w-3 h-3 mx-auto" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── List view (table rows) ── */}
      {viewMode === "list" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="space-y-0 divide-y divide-border/50">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/30" />
              ))}
            </div>
          ) : templates?.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-muted-foreground">
              <PackageSearch className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">{t("noTemplates")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">#</th>
                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">
                      {isAR ? "وصف الخدمة" : "Description"}
                    </th>
                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">
                      {isAR ? "السعر الافتراضي" : "Default Price"}
                    </th>
                    <th className="text-end px-4 py-3 font-semibold text-muted-foreground">
                      {isAR ? "إجراءات" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates?.map((tmpl, i) => (
                    <tr
                      key={tmpl.id}
                      className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors",
                        i % 2 === 0 ? "" : "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground w-10">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{tmpl.description}</td>
                      <td className="px-4 py-3 font-mono font-bold text-primary">{formatCurrency(tmpl.defaultUnitPrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingTemplate(tmpl)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title={t("edit")}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm(t("confirmDeleteTemplate"))) deleteMut.mutate({ id: tmpl.id }); }}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title={t("delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={4} className="px-4 py-2 text-xs text-muted-foreground text-center">
                      {isAR ? `${templates?.length ?? 0} نموذج` : `${templates?.length ?? 0} templates`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      <TemplateModal 
        isOpen={isAddOpen || !!editingTemplate} 
        onClose={() => { setIsAddOpen(false); setEditingTemplate(null); }}
        template={editingTemplate}
      />
    </motion.div>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-card">
      <PackageSearch className="w-12 h-12 mb-4 opacity-40" />
      <p className="text-sm font-medium">{t("noTemplates")}</p>
    </div>
  );
}

function TemplateCard({
  tmpl,
  onEdit,
  onDelete,
  t,
}: {
  tmpl: InvoiceItemTemplate;
  onEdit: (tmpl: InvoiceItemTemplate) => void;
  onDelete: (id: number) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:-translate-y-0.5">
      <div>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <PackageSearch className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-foreground line-clamp-2 text-sm leading-relaxed">{tmpl.description}</h3>
        <p className="text-2xl font-mono font-black text-primary mt-3">{formatCurrency(tmpl.defaultUnitPrice)}</p>
      </div>
      <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(tmpl)}
          className="p-2 bg-muted hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
          title={t("edit")}
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(tmpl.id)}
          className="p-2 bg-muted hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
          title={t("delete")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TemplateModal({
  isOpen,
  onClose,
  template,
}: {
  isOpen: boolean;
  onClose: () => void;
  template: InvoiceItemTemplate | null;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const schema = z.object({
    description: z.string().min(1, t("descriptionRequired")),
    defaultUnitPrice: z.coerce.number().min(0, t("priceMustBePositive")),
  });

  const createMut = useCreateInvoiceItemTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoiceItemTemplatesQueryKey() });
        toast({ title: t("templateSaved") });
        onClose();
        reset();
      }
    }
  });

  const updateMut = useUpdateInvoiceItemTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoiceItemTemplatesQueryKey() });
        toast({ title: t("templateUpdated") });
        onClose();
        reset();
      }
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: template
      ? { description: template.description, defaultUnitPrice: template.defaultUnitPrice }
      : { description: "", defaultUnitPrice: 0 },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    if (template) {
      updateMut.mutate({ id: template.id, data });
    } else {
      createMut.mutate({ data });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? t("editTemplate") : t("newTemplate")}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("serviceDescription")}</label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none"
            placeholder={t("serviceDescPlaceholder")}
          />
          {errors.description && (
            <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("defaultUnitPriceLabel")}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("defaultUnitPrice")}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />
          {errors.defaultUnitPrice && (
            <p className="text-xs text-destructive mt-1">{errors.defaultUnitPrice.message}</p>
          )}
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {isPending ? t("saving") : t("saveTemplate")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
