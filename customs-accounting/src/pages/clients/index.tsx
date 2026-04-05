import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListClients, 
  useCreateClient, 
  useDeleteClient,
  getListClientsQueryKey
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Plus, Search, Trash2, Eye, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";

const clientSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

export default function ClientsList() {
  const { t } = useLanguage();
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("clients")}</h1>
          <p className="text-muted-foreground mt-1">{t("clientsDesc")}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t("addClient")}
        </button>
      </div>

      <div className="bg-card border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              placeholder={t("searchClientPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[660px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground font-medium border-b border-border/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-start">{t("clientName")}</th>
                <th className="px-6 py-4 text-start">{t("contactInfo")}</th>
                <th className="px-6 py-4 text-start">{t("taxId")}</th>
                <th className="px-6 py-4 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">{t("loading")}</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">{t("noClients")}</td></tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{t("addedOn")} {formatDate(client.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p>{client.email || "—"}</p>
                      <p className="text-xs text-muted-foreground">{client.phone || ""}</p>
                    </td>
                    <td className="px-6 py-4">{client.taxId || "—"}</td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/clients/${client.id}/statement`}>
                          <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title={t("statements")}>
                            <FileText className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link href={`/clients/${client.id}`}>
                          <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title={t("client")}>
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button 
                          onClick={() => setDeletingId(client.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title={t("delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateClientModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      
      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title={t("confirmDeleteTitle")} maxWidth="sm">
        <DeleteClientConfirm id={deletingId!} onClose={() => setDeletingId(null)} />
      </Modal>
    </motion.div>
  );
}

function CreateClientModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: t("addClient") });
        reset();
        onClose();
      },
      onError: (err: any) => toast({ title: "خطأ في إضافة العميل", description: err.message, variant: "destructive" })
    }
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema)
  });

  const onSubmit = (data: ClientForm) => {
    createClient.mutate({ data });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("addClientTitle")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("clientCompanyName")} <span className="text-destructive">*</span></label>
          <input 
            {...register("name")} 
            className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" 
            placeholder={t("clientCompanyPlaceholder")}
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("email")}</label>
            <input 
              {...register("email")} 
              type="email"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("phone")}</label>
            <input 
              {...register("phone")} 
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("taxId")}</label>
            <input 
              {...register("taxId")} 
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">{t("address")}</label>
            <textarea 
              {...register("address")} 
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">{t("notes")}</label>
            <textarea 
              {...register("notes")} 
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
            />
          </div>
        </div>
        <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors">
            {t("cancel")}
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting || createClient.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50"
          >
            {isSubmitting || createClient.isPending ? t("saving") : t("saveClient")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteClientConfirm({ id, onClose }: { id: number, onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteClient = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: t("delete") + " " + t("client") });
        onClose();
      },
      onError: () => toast({ title: "فشل الحذف", variant: "destructive" })
    }
  });

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("deleteClientConfirm")}</p>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 font-medium rounded-xl hover:bg-muted transition-colors">{t("cancel")}</button>
        <button 
          onClick={() => deleteClient.mutate({ id })}
          disabled={deleteClient.isPending}
          className="px-4 py-2 font-medium rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          {deleteClient.isPending ? t("deleting") : t("delete")}
        </button>
      </div>
    </div>
  );
}
