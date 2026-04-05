import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { useGetClient, useListInvoices, useUpdateClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "../dashboard";
import { Building2, Mail, Phone, MapPin, FileText, Printer, ArrowRight, ArrowLeft, Edit2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
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

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0");
  const { lang } = useLanguage();
  const isAR = lang === "ar";
  
  const { data: client, isLoading: loadingClient } = useGetClient(clientId);
  const { data: invoices, isLoading: loadingInvoices } = useListInvoices({ clientId });
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (loadingClient) return <div className="p-8 text-center animate-pulse">جارٍ تحميل بيانات العميل...</div>;
  if (!client) return <div className="p-8 text-center text-destructive">العميل غير موجود</div>;

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;
  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.total, 0) || 0;
  const balance = totalInvoiced - totalPaid;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clients"><a className="hover:text-foreground transition-colors flex items-center gap-1">{isAR ? <ArrowRight className="w-4 h-4"/> : <ArrowLeft className="w-4 h-4"/>} {isAR ? "العودة للعملاء" : "Back to Clients"}</a></Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5"/> {client.email || "لا يوجد بريد"}</span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {client.phone || "لا يوجد هاتف"}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 md:flex-none px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" /> تعديل
          </button>
          <Link href={`/clients/${client.id}/statement`}>
            <button className="flex-1 md:flex-none px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> كشف الحساب
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
            <h3 className="font-semibold mb-4 pb-2 border-b border-border/50">البيانات</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">الرقم الضريبي</p>
                <p className="font-medium">{client.taxId || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> العنوان</p>
                <p className="font-medium whitespace-pre-wrap">{client.address || "—"}</p>
              </div>
              {client.notes && (
                <div>
                  <p className="text-muted-foreground mb-1">ملاحظات</p>
                  <p className="font-medium whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border border-border/50">{client.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
            <h3 className="font-semibold mb-4 pb-2 border-b border-border/50">ملخص مالي</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">إجمالي الفواتير</span>
                <span className="font-mono font-medium">{formatCurrency(totalInvoiced)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">إجمالي المدفوع</span>
                <span className="font-mono font-medium text-success">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                <span className="font-semibold">الرصيد الحالي</span>
                <span className={`font-mono font-bold ${balance > 0 ? 'text-destructive' : ''}`}>{formatCurrency(balance)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/> الفواتير</h3>
            <Link href={`/invoices/new?clientId=${client.id}`}>
              <button className="text-sm font-medium text-primary hover:underline">إنشاء فاتورة</button>
            </Link>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground font-medium border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 text-start">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-start">التاريخ</th>
                  <th className="px-6 py-4 text-start">الحالة</th>
                  <th className="px-6 py-4 text-end">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvoices ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</td></tr>
                ) : invoices?.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد فواتير بعد.</td></tr>
                ) : (
                  invoices?.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary hover:underline">
                        <Link href={`/invoices/${inv.id}/edit`}>{inv.invoiceNumber}</Link>
                      </td>
                      <td className="px-6 py-4">{formatDate(inv.issueDate)}</td>
                      <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                      <td className="px-6 py-4 text-end font-mono font-medium">{formatCurrency(inv.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EditClientModal client={client} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </motion.div>
  );
}

function EditClientModal({ client, isOpen, onClose }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateClient = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(client.id) });
        toast({ title: "تم تحديث بيانات العميل بنجاح" });
        onClose();
      },
      onError: (err: any) => toast({ title: "خطأ في التحديث", description: err.message, variant: "destructive" })
    }
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
  });

  const onSubmit = (data: z.infer<typeof clientSchema>) => {
    updateClient.mutate({ id: client.id, data });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تعديل بيانات العميل">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">الشركة / الاسم</label>
          <input {...register("name")} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message as string}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
            <input {...register("email")} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
            <input {...register("phone")} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الرقم الضريبي</label>
            <input {...register("taxId")} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">العنوان</label>
          <textarea {...register("address")} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ملاحظات</label>
          <textarea {...register("notes")} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl">إلغاء</button>
          <button type="submit" disabled={isSubmitting || updateClient.isPending} className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl shadow-lg">
            {isSubmitting || updateClient.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
