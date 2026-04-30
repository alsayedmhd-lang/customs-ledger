import { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useListInvoices,
  useCreateReceipt,
  useGetInvoice,
  useGetReceipt,
  useUpdateReceipt,
  getListReceiptsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import { ArrowRight, ArrowLeft, Save, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  clientId: z.number().nullable(),
  clientName: z.string().optional().nullable(),
  invoiceId: z.coerce.number().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "المبلغ مطلوب"),
  paymentMethod: z.enum(["cash", "transfer", "check"]),
  notes: z.string().optional(),
  receiptDate: z.string(),
});

type ReceiptFormValues = z.infer<typeof formSchema>;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "cash - نقداً",
  transfer: "transfer - تحويل بنكي",
  check: "check - شيك",
};

export default function ReceiptForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const receiptId = parseInt(id || "0");
  const search = new URLSearchParams(window.location.search);
  const invoiceIdFromUrl = search.get("invoice");
  const invoiceIdFromUrlNumber = invoiceIdFromUrl ? Number(invoiceIdFromUrl) : 0;
  const { data: clients } = useListClients();
  const { data: invoices } = useListInvoices();
  const { data: linkedInvoice } = useGetInvoice(invoiceIdFromUrlNumber, {
    query: { enabled: !isEdit && invoiceIdFromUrlNumber > 0 },
  });
  const { data: existing } = useGetReceipt(receiptId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const isAR = lang === "ar";

  const createMutation = useCreateReceipt();
  const updateMutation = useUpdateReceipt();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: null,
      clientName: "",
      invoiceId: undefined,
      invoiceNumber: "",
      amount: 0,
      paymentMethod: "cash",
      notes: "",
      receiptDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (isEdit || !invoiceIdFromUrlNumber || !linkedInvoice) return;

    const linkedClient = (clients ?? []).find(
      (c) => Number(c.id) === Number(linkedInvoice.clientId)
    );

    setValue("invoiceId", Number(linkedInvoice.id), { shouldValidate: true });
    setValue(
      "invoiceNumber",
      linkedInvoice.invoiceNumber || ""
    );
    setValue("clientId", Number(linkedInvoice.clientId), { shouldValidate: true });
    setValue(
      "clientName",
      linkedInvoice.clientName ||
      linkedClient?.name ||
      "",
      { shouldValidate: true }
    );
    setValue("amount", Number(linkedInvoice.total ?? 0), { shouldValidate: true });
  }, [invoiceIdFromUrlNumber, isEdit, linkedInvoice, clients?.length, setValue]);

  const selectedClientId = watch("clientId");

  // Filter invoices by selected client
    const effectiveClientId =
      selectedClientId || watch("clientId") || existing?.clientId;

    const clientInvoices = (invoices ?? []).filter(
      (inv) =>
        Number(inv.clientId) === Number(effectiveClientId) &&
        inv.status !== "cancelled"
    );
    useEffect(() => {
      if (!existing || !isEdit) return;
      if (!invoices || invoices.length === 0) return;

      const matchedInvoice = invoices.find(
        (inv) => Number(inv.id) === Number(existing.invoiceId)
      );

      reset({
        clientId: Number(existing.clientId),
        clientName:
          existing.clientName ||
          matchedInvoice?.clientName ||
          "",
        invoiceId: existing.invoiceId ? Number(existing.invoiceId) : undefined,
        invoiceNumber:
          existing.invoiceNumber ||
          matchedInvoice?.invoiceNumber ||
          "",
        amount: Number(existing.amount),
        paymentMethod: existing.paymentMethod as "cash" | "transfer" | "check",
        notes: existing.notes ?? "",
        receiptDate: existing.receiptDate,
      });
    }, [existing?.id, isEdit, invoices?.length, reset]);

    useEffect(() => {
      const currentInvoiceId = watch("invoiceId");

      if (!currentInvoiceId || !invoices || invoices.length === 0) return;

      const invoice = invoices.find(
        (i) => Number(i.id) === Number(currentInvoiceId)
      );

      if (!invoice) return;

      if (!watch("invoiceNumber") && invoice.invoiceNumber) {
        setValue("invoiceNumber", invoice.invoiceNumber ?? "", {
          shouldValidate: true,
        });
      }
    }, [watch("invoiceId"), invoices?.length, setValue]);

  // const onSubmit = async (data: ReceiptFormValues) => {
  const onSubmit = async (data: ReceiptFormValues) => {
  console.log("Receipt submit fired", data);
    try {
      const payload = {
        clientId: Number(data.clientId),
        clientName: data.clientName?.trim() || null,
        invoiceId: data.invoiceId ? Number(data.invoiceId) : null,
        amount: Number(data.amount),
        paymentMethod: data.paymentMethod,
        notes: data.notes?.trim() || null,
        receiptDate: data.receiptDate,
      };

      let saved;
      if (isEdit) {
        saved = await updateMutation.mutateAsync({ id: receiptId, data: payload });
      } else {
        saved = await createMutation.mutateAsync({ data: payload });
      }

      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      toast({ title: "تم الحفظ", description: `تم ${isEdit ? "تحديث" : "إنشاء"} سند القبض بنجاح` });
      setLocation(`/receipts/${saved.id}/print`);

    } catch (err) {
      console.error("Receipt save error:", err);
      const conflictReceiptId = Number((err as any)?.data?.receiptId);

      if ((err as any)?.status === 409 && conflictReceiptId > 0) {
        toast({
          title: "سند موجود",
          description: "يوجد سند قبض مرتبط مسبقاً بهذه الفاتورة",
        });
        setLocation(`/receipts/${conflictReceiptId}/edit`);
        return;
      }
      toast({
        title: "خطأ",
        description: "فشل حفظ سند القبض",
        variant: "destructive",
      });
    }

  };

  const selectedInvoiceNumber =
    watch("invoiceNumber") ||
    linkedInvoice?.invoiceNumber ||
    clientInvoices.find(
      (inv) => Number(inv.id) === Number(watch("invoiceId"))
    )?.invoiceNumber ||
    "";

  const selectedClientName =
    watch("clientName") ||
    linkedInvoice?.clientName ||
    (clients ?? []).find(
      (c) => Number(c.id) === Number(watch("clientId") || linkedInvoice?.clientId || 0)
    )?.name ||
    "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/receipts">
          <Button variant="ghost" size="icon">
            {isAR ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "تعديل سند القبض" : "سند قبض جديد"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? "تعديل بيانات السند" : "إنشاء سند قبض جديد"}
          </p>
        </div>
      </div>

      <form
          onSubmit={handleSubmit(
            onSubmit,
            (errors) => {
              console.log("receipt validation errors:", errors);
              toast({
                title: "بيانات ناقصة",
                description: "راجع الحقول المطلوبة قبل الحفظ",
                variant: "destructive",
              });
            }
          )}
          className="space-y-6"
        >
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Client */}
          <div className="space-y-2">
            <Label>العميل <span className="text-destructive">*</span></Label>
            <Select
              key={watch("clientId") || linkedInvoice?.clientId || "empty-client"}
              value={String(watch("clientId") || linkedInvoice?.clientId || "")}
              onValueChange={(v) => {
                const selectedClient = (clients ?? []).find((c) => String(c.id) === v);

                setValue("clientId", Number(v), { shouldValidate: true });

                if (!isEdit) {
                  setValue("clientName", selectedClient?.name || "", { shouldValidate: true });
                }

                if (!isEdit) {
                  setValue("invoiceId", null);
                  setValue("invoiceNumber", "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedClientName || "اختر العميل"} />
              </SelectTrigger>
              <SelectContent
                  position="popper"
                  className="z-[9999] bg-white dark:bg-slate-900 opacity-100 backdrop-blur-none border border-slate-300 shadow-2xl"
                >
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && <p className="text-destructive text-xs">{errors.clientId.message}</p>}
          </div>

          {/* Invoice (optional) */}
          <div className="space-y-2">
            <Label>الفاتورة <span className="text-muted-foreground text-xs">(اختياري — اتركه فارغاً للدفعة المستقلة)</span></Label>
            <Select
              key={watch("invoiceId") || linkedInvoice?.id || "none"}
              value={String(watch("invoiceId") || linkedInvoice?.id || "none")}
              onValueChange={(v) => {
                const inv = v === "none" ? null : Number(v);

                setValue("invoiceId", inv, { shouldValidate: true });

                if (!inv) {
                  setValue("invoiceNumber", "");
                  return;
                }

                const invoice = (invoices ?? []).find((i) => Number(i.id) === Number(inv));

                if (invoice) {
                  setValue("invoiceNumber", invoice.invoiceNumber ?? "");
                  setValue("clientId", Number(invoice.clientId), { shouldValidate: true });
                  setValue("clientName", invoice.clientName || watch("clientName") || "", {
                    shouldValidate: true,
                  });
                  setValue("amount", Number(invoice.total), { shouldValidate: true });
                }
              }}
              disabled={!effectiveClientId && !watch("invoiceId")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedInvoiceNumber ||
                    (effectiveClientId ? "اختر فاتورة (اختياري)" : "اختر العميل أولاً")
                  }
                />
              </SelectTrigger>
              <SelectContent
                  position="popper"
                  className="z-[9999] bg-white dark:bg-slate-900 opacity-100 backdrop-blur-none border border-slate-300 shadow-2xl"
                >
                <SelectItem value="none">بدون فاتورة (دفعة مستقلة)</SelectItem>
                {clientInvoices.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.invoiceNumber} — {formatCurrency(inv.total)} ({inv.status === "paid" ? "مدفوعة" : inv.status === "issued" ? "صادرة" : "مسودة"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>المبلغ (ر.ق) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("amount")}
              />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>تاريخ السند <span className="text-destructive">*</span></Label>
              <Input type="date" {...register("receiptDate")} />
              {errors.receiptDate && <p className="text-destructive text-xs">{errors.receiptDate.message}</p>}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>طريقة الدفع <span className="text-destructive">*</span></Label>
            <Select
              value={watch("paymentMethod")}
              onValueChange={(v) => setValue("paymentMethod", v as "cash" | "transfer" | "check", { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                  position="popper"
                  className="z-[9999] bg-white dark:bg-slate-900 opacity-100 backdrop-blur-none border border-slate-300 shadow-2xl"
                >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea placeholder="أي ملاحظات إضافية..." rows={3} {...register("notes")} />
          </div>
        </div>

        {/* Action bar */}
        <div className="fixed bottom-6 right-6 left-6 md:right-[18rem] flex gap-3 justify-end z-10">
          <Link href="/receipts">
            <Button type="button" variant="outline" className="bg-background shadow-lg">
              إلغاء
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "جارٍ الحفظ..." : isEdit ? "تحديث السند" : "حفظ وطباعة"}
          </Button>
        </div>
        {/* Spacer for fixed bar */}
        <div className="h-20" />
      </form>
    </div>
  );
}
