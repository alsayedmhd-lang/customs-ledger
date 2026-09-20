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
  getListInvoicesQueryKey,
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
  amount: z.coerce.number().min(0.01, "Amount is required"),
  paymentMethod: z.enum(["cash", "transfer", "check"]),
  status: z.enum(["draft", "issued"]).default("draft"),
  notes: z.string().optional(),
  receiptDate: z.string(),
});

type ReceiptFormValues = z.infer<typeof formSchema>;

const PAYMENT_METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقداً", en: "Cash" },
  transfer: { ar: "تحويل بنكي", en: "Bank transfer" },
  check: { ar: "شيك", en: "Cheque" },
};

const RECEIPT_STATUS_LABELS: Record<"draft" | "issued", { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  issued: { ar: "صادر", en: "Issued" },
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
  const tr = (ar: string, en: string) => (isAR ? ar : en);

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
      status: "draft",
      notes: "",
      receiptDate: new Date().toISOString().split("T")[0],
    },
  });

  async function issueReceipt(receiptId: number) {
    const token = sessionStorage.getItem("auth_token");
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/receipts/${receiptId}/issue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || data.errorEn || "Failed to issue receipt"), {
        status: res.status,
        data,
      });
    }

    return res.json();
  }

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
        status: ((existing as any).status === "issued" ? "issued" : "draft") as "draft" | "issued",
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
        status: data.status,
        notes: data.notes?.trim() || null,
        receiptDate: data.receiptDate,
      };

      let saved;

      console.log("Receipt before save", payload);

      if (isEdit) {
        saved = await updateMutation.mutateAsync({ id: receiptId, data: payload });
      } else {
        saved = await createMutation.mutateAsync({ data: payload });
      }

      console.log("Receipt saved response", saved);

      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      toast({
        title: tr("تم الحفظ", "Saved"),
        description: isEdit ? tr("تم تحديث سند القبض بنجاح", "Receipt updated successfully") : tr("تم إنشاء سند القبض بنجاح", "Receipt created successfully"),
      });
      try {
        await (window as any).electronAPI?.openExternalPrintWindow?.(
          `#/receipts/${saved.id}/print`
        );
      } catch (printError) {
        console.error("Receipt print window error:", printError);
      }

    } catch (err) {
  console.error("Receipt save error:", err);

    const errorData = (err as any)?.data;
    const conflictReceiptId = Number(errorData?.receiptId);

    if ((err as any)?.status === 409 && conflictReceiptId > 0) {
      toast({
        title: tr("سند موجود", "Receipt already exists"),
        description: tr(
          "يوجد سند قبض مرتبط مسبقاً بهذه الفاتورة",
          "A receipt is already linked to this invoice"
        ),
      });

      setLocation(`/receipts/${conflictReceiptId}/edit`);
      return;
    }

    const backendError =
      errorData?.error ||
      errorData?.errorEn ||
      (err as any)?.message ||
      tr(
        "فشل حفظ سند القبض",
        "Failed to save receipt"
      );

    toast({
      title: tr("تعذر حفظ سند القبض", "Unable to save receipt"),
      description: backendError,
      variant: "destructive",
    });
  }

  };

  const handleIssue = async () => {
    if (!isEdit || !receiptId) return;

    try {
      const issued = await issueReceipt(receiptId);
      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      reset({
        clientId: Number(issued.clientId),
        clientName: issued.clientName || watch("clientName") || "",
        invoiceId: issued.invoiceId ? Number(issued.invoiceId) : undefined,
        invoiceNumber: issued.invoiceNumber || watch("invoiceNumber") || "",
        amount: Number(issued.amount),
        paymentMethod: issued.paymentMethod as "cash" | "transfer" | "check",
        status: "issued",
        notes: issued.notes ?? "",
        receiptDate: issued.receiptDate,
      });
      toast({
        title: tr("تم إصدار السند", "Receipt issued"),
        description: tr("تم تطبيق أثر سند القبض على الفاتورة", "The receipt now affects the invoice balance"),
      });
    } catch (err) {
      toast({
        title: tr("تعذر إصدار السند", "Failed to issue receipt"),
        description: (err as any)?.data?.error || (err as any)?.data?.errorEn || tr("راجع بيانات السند والمتبقي على الفاتورة", "Check the receipt details and remaining invoice balance"),
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
          <h1 className="text-2xl font-bold">{isEdit ? tr("تعديل سند القبض", "Edit Receipt") : tr("سند قبض جديد", "New Receipt")}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? tr("تعديل بيانات السند", "Edit receipt details") : tr("إنشاء سند قبض جديد", "Create a new receipt")}
          </p>
        </div>
      </div>

      <form
          onSubmit={handleSubmit(
            onSubmit,
            (errors) => {
              console.log("receipt validation errors:", errors);
              toast({
                title: tr("بيانات ناقصة", "Missing information"),
                description: tr("راجع الحقول المطلوبة قبل الحفظ", "Review required fields before saving"),
                variant: "destructive",
              });
            }
          )}
          className="space-y-6"
        >
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Client */}
          <div className="space-y-2">
            <Label>{tr("العميل", "Client")} <span className="text-destructive">*</span></Label>
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
                <SelectValue placeholder={selectedClientName || tr("اختر العميل", "Select client")} />
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
            <Label>{tr("الفاتورة", "Invoice")} <span className="text-muted-foreground text-xs">{tr("(اختياري - اتركه فارغاً للدفعة المستقلة)", "(optional - leave empty for an independent payment)")}</span></Label>
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
                    (effectiveClientId ? tr("اختر فاتورة (اختياري)", "Select invoice (optional)") : tr("اختر العميل أولاً", "Select client first"))
                  }
                />
              </SelectTrigger>
              <SelectContent
                  position="popper"
                  className="z-[9999] bg-white dark:bg-slate-900 opacity-100 backdrop-blur-none border border-slate-300 shadow-2xl"
                >
                <SelectItem value="none">{tr("بدون فاتورة (دفعة مستقلة)", "No invoice (independent payment)")}</SelectItem>
                {clientInvoices.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.invoiceNumber} - {formatCurrency(inv.total)} ({inv.status === "paid" ? tr("مدفوعة", "Paid") : inv.status === "issued" ? tr("صادرة", "Issued") : tr("مسودة", "Draft")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>{tr("المبلغ (ر.ق)", "Amount (QR)")} <span className="text-destructive">*</span></Label>
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
              <Label>{tr("تاريخ السند", "Receipt date")} <span className="text-destructive">*</span></Label>
              <Input type="date" {...register("receiptDate")} />
              {errors.receiptDate && <p className="text-destructive text-xs">{errors.receiptDate.message}</p>}
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>{tr("طريقة الدفع", "Payment method")} <span className="text-destructive">*</span></Label>
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
                    <SelectItem key={value} value={value}>{isAR ? label.ar : label.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tr("حالة السند", "Receipt status")} <span className="text-destructive">*</span></Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as "draft" | "issued", { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                    position="popper"
                    className="z-[9999] bg-white dark:bg-slate-900 opacity-100 backdrop-blur-none border border-slate-300 shadow-2xl"
                  >
                  {Object.entries(RECEIPT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{isAR ? label.ar : label.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{tr("ملاحظات", "Notes")}</Label>
            <Textarea placeholder={tr("أي ملاحظات إضافية...", "Any additional notes...")} rows={3} {...register("notes")} />
          </div>
        </div>

        {/* Action bar */}
        <div className="fixed bottom-6 right-6 left-6 md:right-[18rem] flex gap-3 justify-end z-10">
          <Link href="/receipts">
            <Button type="button" variant="outline" className="bg-background shadow-lg">
              {tr("إلغاء", "Cancel")}
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? tr("جارٍ الحفظ...", "Saving...") : isEdit ? tr("تحديث السند", "Update receipt") : tr("حفظ وطباعة", "Save and print")}
          </Button>
          {isEdit && watch("status") !== "issued" && (
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleIssue}
              className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-700/20"
            >
              <Printer className="w-4 h-4" />
              {tr("إصدار السند", "Issue receipt")}
            </Button>
          )}
        </div>
        {/* Spacer for fixed bar */}
        <div className="h-20" />
      </form>
    </div>
  );
}


