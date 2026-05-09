import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useListClients,
  useListInvoices,
  useListInvoiceItemTemplates,
  useCreateInvoice,
  useGetInvoice,
  useUpdateInvoice,
  getListInvoicesQueryKey,
  CreateInvoiceRequestStatus,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  Upload,
  Save,
  FileText,
  Ship,
  Calculator,
  StickyNote,
  Printer,
  GripVertical,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const itemSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
});

const formSchema = z.object({
  createdBy: z.string().optional(),
  clientId: z.coerce.number().min(1, "العميل مطلوب"),
  issueDate: z.string().min(1, "التاريخ مطلوب"),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["draft", "issued", "paid", "cancelled"]),
  importerExporterName: z.string().optional().nullable(),
  taxRate: z.coerce.number().min(0),
  advancePayment: z.coerce.number().min(0),
  shipmentRef: z.string().optional().nullable(),
  billOfLading: z.string().optional().nullable(),
  packageCount: z.coerce.number().int().optional().nullable(),
  shipmentWeight: z.coerce.number().optional().nullable(),
  portOfEntry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "يجب إضافة بند واحد على الأقل"),
});

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  issued: { ar: "صادرة", en: "Issued" },
  paid: { ar: "مدفوعة", en: "Paid" },
  cancelled: { ar: "ملغاة", en: "Cancelled" },
};

type InvoiceFormValues = {
  clientId?: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  importerExporterName?: string;
  taxRate?: number;
  advancePayment?: number;
  shipmentRef?: string;
  billOfLading?: string;
  packageCount?: number;
  shipmentWeight?: number;
  portOfEntry?: string;
  notes?: string;
  createdBy?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
};

const inputCls =
  "w-full px-3 h-10 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const labelCls =
  "block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide";

const IMPORTER_EXPORTER_SUGGESTIONS_KEY = "invoice_importer_exporter_suggestions";
const ENTRY_PORT_SUGGESTIONS_KEY = "invoice_entry_port_suggestions";
const ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"]);
const PRESET_ATTACHMENT_CATEGORIES = [
  { key: "customs_declaration", ar: "البيان الجمركي", en: "Customs Declaration" },
  { key: "bill_of_lading", ar: "بوليصة الشحن", en: "Bill of Lading" },
  { key: "commercial_invoice", ar: "الفاتورة التجارية", en: "Commercial Invoice" },
  { key: "packing_list", ar: "قائمة التعبئة", en: "Packing List" },
  { key: "certificate_of_origin", ar: "شهادة المنشأ", en: "Certificate of Origin" },
  { key: "payment_receipt", ar: "إيصال الدفع", en: "Payment Receipt" },
  { key: "delivery_order", ar: "إذن التسليم", en: "Delivery Order" },
  { key: "arrival_notice", ar: "إشعار الوصول", en: "Arrival Notice" },
] as const;
const PRESET_ATTACHMENT_CATEGORY_KEYS = new Set(PRESET_ATTACHMENT_CATEGORIES.map((category) => category.key));

type InvoiceAttachment = {
  id: number;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  category?: string | null;
  storageProvider?: string | null;
  createdAt?: string | null;
  declarationNumber?: string | null;
  declarationBaseNumber?: string | null;
  relativePath?: string | null;
};

type AttachmentSaveResult = {
  ok: boolean;
  relativePath?: string;
  fullPath?: string;
  error?: string;
};

type AttachmentSelectResult = {
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  size?: number;
  ext?: string;
  error?: string;
};

function getDeclarationBaseNumber(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
}

function sanitizeStoredFileName(fileName: string) {
  const cleaned = String(fileName || "attachment")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .trim();

  return cleaned || "attachment";
}

function getFileExtension(fileName: string) {
  const parts = String(fileName || "").split(".");
  return parts.length > 1 ? String(parts.pop() || "").toLowerCase() : "";
}

function getAttachmentApiBase() {
  return `${import.meta.env.VITE_API_BASE_URL}/api/invoice-attachments`;
}

function readSuggestions(storageKey: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim()).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function writeSuggestions(storageKey: string, suggestions: string[]) {
  localStorage.setItem(storageKey, JSON.stringify(suggestions.slice(0, 10)));
}

function rememberSuggestion(storageKey: string, value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;

  writeSuggestions(storageKey, [
    normalized,
    ...readSuggestions(storageKey).filter((item) => item !== normalized),
  ]);
}

function removeSuggestion(storageKey: string, value: string) {
  writeSuggestions(
    storageKey,
    readSuggestions(storageKey).filter((item) => item !== value)
  );
}

function SuggestionInput({
  storageKey,
  value,
  onChange,
  placeholder,
  className,
  dir,
}: {
  storageKey: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const refreshSuggestions = () => setSuggestions(readSuggestions(storageKey));
  const visibleSuggestions = suggestions.slice(0, 5);

  return (
    <div className="relative">
      <input
        value={value ?? ""}
        onFocus={() => {
          refreshSuggestions();
          setOpen(true);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          refreshSuggestions();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder={placeholder}
        className={className}
        dir={dir}
      />

      {open && visibleSuggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
          dir={dir}
        >
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="flex items-center gap-2 border-b border-border/50 last:border-b-0"
            >
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(suggestion);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 truncate px-3 py-2 text-start text-sm hover:bg-muted"
              >
                {suggestion}
              </button>
              <button
                type="button"
                aria-label="Remove suggestion"
                onMouseDown={(event) => {
                  event.preventDefault();
                  removeSuggestion(storageKey, suggestion);
                  refreshSuggestions();
                  setOpen(true);
                }}
                className="shrink-0 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SortableRowProps {
  id: string;
  index: number;
  register: any;
  watch: any;
  remove: (index: number) => void;
  applyTemplate: (index: number, templateIdStr: string) => void;
  templates: any[] | undefined;
  canRemove: boolean;
  isAR: boolean;
}

function SortableRow({
  id,
  index,
  register,
  watch,
  remove,
  applyTemplate,
  templates,
  canRemove,
  isAR,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const qty = Number(watch(`items.${index}.quantity`) || 0);
  const price = Number(watch(`items.${index}.unitPrice`) || 0);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-muted/20 transition-colors bg-background"
    >
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing rounded transition-colors touch-none"
          title={isAR ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>

      <td className="px-3 py-2">
        <select
          onChange={(e) => applyTemplate(index, e.target.value)}
          className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded-md outline-none focus:border-primary"
        >
          <option value="">{isAR ? "اختر..." : "Pick..."}</option>
          {templates?.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.description.substring(0, 22)}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-2">
        <input
          {...register(`items.${index}.description`)}
          className="w-full px-2 py-1 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={isAR ? "وصف الخدمة..." : "Service description..."}
        />
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          {...register(`items.${index}.quantity`)}
          className="w-full px-2 py-1 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20 text-end"
        />
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          {...register(`items.${index}.unitPrice`)}
          className="w-full px-2 py-1 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20 text-end"
        />
      </td>

      <td className="px-4 py-2 text-end font-mono text-sm font-semibold text-foreground">
        {formatCurrency(qty * price)}
      </td>

      <td className="px-2 py-2 text-center">
        {canRemove && (
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function InvoiceForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const isCopyMode = window.location.href.includes("edit-copy");
  const invoiceId = parseInt(id || "0");
  const { lang, isRTL } = useLanguage();
  const isAR = lang === "ar";
  const [users, setUsers] = useState<any[]>([]);
  const [receiptLookupPending, setReceiptLookupPending] = useState(false);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Record<string, number>>({});
  const { data: clients } = useListClients();
  const { data: invoices } = useListInvoices();
  const { data: templates } = useListInvoiceItemTemplates();
  const { data: existingInvoice } = useGetInvoice(invoiceId, {
    query: { enabled: isEdit },
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const pendingSuggestionsRef = useRef({
    importerExporterName: "",
    portOfEntry: "",
  });

  const fetchAuditLogs = async () => {
    if (!isEdit) return;

    const token = sessionStorage.getItem("auth_token");

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/invoices/${invoiceId}/audit-logs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    setAuditLogs(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
  const token = sessionStorage.getItem("auth_token");

  fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((r) => r.json())
    .then((data) => setUsers(Array.isArray(data) ? data : data.data || []));
}, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateInvoice({
    mutation: {
      onSuccess: (data) => {
        rememberSuggestion(
          IMPORTER_EXPORTER_SUGGESTIONS_KEY,
          pendingSuggestionsRef.current.importerExporterName
        );
        rememberSuggestion(
          ENTRY_PORT_SUGGESTIONS_KEY,
          pendingSuggestionsRef.current.portOfEntry
        );
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: isAR ? "تم إنشاء الفاتورة بنجاح" : "Invoice created" });
        setLocation("/invoices");
      },
      onError: (err: any) => {
        const msg =
          err?.data?.error ||
          err?.message ||
          (isAR ? "حدث خطأ" : "An error occurred");
        toast({
          title: isAR ? "خطأ" : "Error",
          description: msg,
          variant: "destructive",
        });
      },
    },
  });

  const updateMut = useUpdateInvoice({
    mutation: {
      onSuccess: async () => {
        rememberSuggestion(
          IMPORTER_EXPORTER_SUGGESTIONS_KEY,
          pendingSuggestionsRef.current.importerExporterName
        );
        rememberSuggestion(
          ENTRY_PORT_SUGGESTIONS_KEY,
          pendingSuggestionsRef.current.portOfEntry
        );
        await queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
        await fetchAuditLogs();

        toast({ title: isAR ? "تم تحديث الفاتورة" : "Invoice updated" });
      },
      onError: (err: any) => {
        const msg =
          err?.data?.error ||
          err?.message ||
          (isAR ? "حدث خطأ" : "An error occurred");
        toast({
          title: isAR ? "خطأ" : "Error",
          description: msg,
          variant: "destructive",
        });
      },
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      createdBy: user?.id ? String(user.id) : "",
      clientId: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      status: "draft",
      importerExporterName: "",
      taxRate: 0,
      advancePayment: 0,
      shipmentRef: "",
      billOfLading: "",
      packageCount: undefined,
      shipmentWeight: undefined,
      portOfEntry: "",
      notes: "",
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    register("importerExporterName");
    register("portOfEntry");
  }, [register]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const snapshot = getValues("items");
        const reordered = arrayMove([...snapshot], oldIndex, newIndex);

        move(oldIndex, newIndex);

        reordered.forEach((item, i) => {
          setValue(`items.${i}.description`, item.description, {
            shouldDirty: true,
          });
          setValue(`items.${i}.quantity`, item.quantity, {
            shouldDirty: true,
          });
          setValue(`items.${i}.unitPrice`, item.unitPrice, {
            shouldDirty: true,
          });
        });
      }
    }
  };

  useEffect(() => {
    if (isEdit && existingInvoice && !isCopyMode) {
      reset({
        createdBy: String((existingInvoice as any).createdBy ?? ""),
        clientId: String(existingInvoice.clientId ?? ""),
        issueDate: existingInvoice.issueDate.split("T")[0],
        dueDate: existingInvoice.dueDate
          ? existingInvoice.dueDate.split("T")[0]
          : "",
        status: existingInvoice.status as any,
        importerExporterName:
          (existingInvoice as any).importerExporterName ?? "",
        taxRate: existingInvoice.taxRate,
        advancePayment: (existingInvoice as any).advancePayment ?? 0,
        shipmentRef: String(existingInvoice.shipmentRef ?? ""),
        billOfLading: String(existingInvoice.billOfLading ?? ""),
        packageCount: existingInvoice.packageCount?? undefined,
        shipmentWeight: existingInvoice.shipmentWeight ?? undefined,
        portOfEntry: String(existingInvoice.portOfEntry ?? ""),
        notes: String(existingInvoice.notes ?? ""),
        items: Array.isArray(existingInvoice.items)
        ? existingInvoice.items.map((i) => ({
            description: i.description ?? "",
            quantity: i.quantity ?? 1,
            unitPrice: i.unitPrice ?? 0,
          }))
        : [
            {
              description: "",
              quantity: 1,
              unitPrice: 0,
            },
          ],
      });
    }

    else if (isEdit && existingInvoice && isCopyMode) {
      sessionStorage.setItem(
        "copy_invoice",
        JSON.stringify({
          ...existingInvoice,
          id: undefined,
          invoiceNumber: undefined,
          shipmentRef: "",
          billOfLading: "",
          packageCount: null,
          shipmentWeight: null,
          notes: "",
          issueDate: new Date().toISOString().split("T")[0],
          dueDate: "",
        })
      );

      setLocation("/invoices/new");
    }

    else {
  const copied = sessionStorage.getItem("copy_invoice");
  if (copied) {
    const data = JSON.parse(copied);
    reset({
      createdBy: user?.id ? String(user.id) : "",
      clientId: String(data.clientId ?? ""),
      issueDate: data.issueDate?.split("T")[0] ?? "",
      dueDate: data.dueDate ? data.dueDate.split("T")[0] : "",
      status: data.status,
      importerExporterName: data.importerExporterName ?? "",
      taxRate: data.taxRate,
      advancePayment: data.advancePayment ?? 0,
      shipmentRef: String(data.shipmentRef ?? ""),
      billOfLading: String(data.billOfLading ?? ""),
      packageCount: undefined,
      shipmentWeight: undefined,
      portOfEntry: String(data.portOfEntry ?? ""),
      notes: String(data.notes ?? ""),
      items: data.items?.map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })) ?? [],
    });
    sessionStorage.removeItem("copy_invoice");
  }
  if (!isEdit && !sessionStorage.getItem("copy_invoice") && user?.id) {
    setValue("createdBy", String(user.id));
  }
}

  }, [isEdit, existingInvoice, isCopyMode, reset, setLocation, setValue, user?.id]);

  useEffect(() => {
  if (!isEdit && user?.id) {
    setValue("createdBy", String(user.id));
  }
}, [isEdit, user?.id, users.length, setValue]);

  useEffect(() => {
    fetchAuditLogs();
  }, [invoiceId, isEdit]);
  

  const itemsWatch = watch("items") || [];
  const taxRateWatch = watch("taxRate") || 0;
  const advancePaymentWatch = watch("advancePayment") || 0;
  const shipmentRefWatch = watch("shipmentRef");
  const declarationBaseNumber = getDeclarationBaseNumber(shipmentRefWatch);
  const attachmentsEnabled = Boolean(isEdit && invoiceId && declarationBaseNumber);
  const attachmentsByCategory = new Map<string, InvoiceAttachment[]>();
  for (const attachment of attachments) {
    const category = String(attachment.category || "other");
    const normalizedCategory = PRESET_ATTACHMENT_CATEGORY_KEYS.has(category as any) ? category : "other";
    attachmentsByCategory.set(normalizedCategory, [
      ...(attachmentsByCategory.get(normalizedCategory) || []),
      attachment,
    ]);
  }
  const otherAttachments = attachmentsByCategory.get("other") || [];
  const attachmentCountLabel = (count: number) =>
    isAR ? `${count} ${count === 1 ? "ملف" : "ملفات"}` : `${count} ${count === 1 ? "file" : "files"}`;
  const canViewInvoiceAuditLog =
    user?.role === "admin" || Boolean((user as any)?.permissions?.canViewInvoiceAuditLog);
  const showInvoiceAuditLog = Boolean(isEdit && canViewInvoiceAuditLog && auditLogs.length > 0);
  const getSelectedAttachment = (category: string) => {
    const categoryAttachments = attachmentsByCategory.get(category) || [];
    const selectedId = selectedAttachmentIds[category];
    return categoryAttachments.find((attachment) => attachment.id === selectedId) || null;
  };
  const attachmentButtonCls =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60";
  const attachmentDeleteButtonCls =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60";

  const subtotal = itemsWatch.reduce(
    (acc, item) =>
      acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );
  const taxAmount = subtotal * (Number(taxRateWatch) / 100);
  const total = subtotal + taxAmount - Number(advancePaymentWatch);

  const onSubmit = async (data: InvoiceFormValues) => {
    const cleanShipmentRef = String(data.shipmentRef ?? "")
      .replace(/[\/-]/g, "")
      .trim();

    if (cleanShipmentRef) {
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const cachedInvoices = await res.json();

      const matchedInvoice = cachedInvoices.find((inv: any) => {
        if (isEdit && String(inv.id) === String(invoiceId)) return false;

        const oldRef = String(inv.shipmentRef ?? "")
          .replace(/[\/-]/g, "")
          .trim();

        return oldRef && oldRef === cleanShipmentRef;
      });

      if (matchedInvoice) {
        setError("shipmentRef", {
          type: "manual",
          message: isAR
            ? `رقم البيان موجود سابقًا في الفاتورة ${matchedInvoice.invoiceNumber || ""}`
            : `Shipment ref already exists in invoice ${matchedInvoice.invoiceNumber || ""}`,
        });
        return;
      }
    }

    pendingSuggestionsRef.current = {
      importerExporterName: data.importerExporterName ?? "",
      portOfEntry: data.portOfEntry ?? "",
    };

    if (isEdit) {
        updateMut.mutate({
          id: invoiceId,
          data: {
            ...data,
            createdBy: Number(data.createdBy),
          } as any,
        });
      } else {
        createMut.mutate({
          data: {
            ...data,
            createdBy: Number(data.createdBy),
          } as any,
        });
      }
  };

  const applyTemplate = (index: number, templateIdStr: string) => {
    if (!templateIdStr) return;
    const template = templates?.find((t) => t.id === parseInt(templateIdStr));
    if (template) {
      setValue(`items.${index}.description`, template.description);
      setValue(`items.${index}.unitPrice`, template.defaultUnitPrice);
    }
  };

  const fetchAttachments = async (baseNumber = declarationBaseNumber) => {
    if (!isEdit || !invoiceId || !baseNumber) {
      setAttachments([]);
      return;
    }

    try {
      setAttachmentsLoading(true);
      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(`${getAttachmentApiBase()}/${encodeURIComponent(baseNumber)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Attachments request failed with status ${response.status}`);
      }

      const data = await response.json();
      setAttachments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load attachments:", error);
      toast({
        title: isAR ? "خطأ" : "Error",
        description: isAR ? "تعذر تحميل المرفقات" : "Failed to load attachments",
        variant: "destructive",
      });
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAttachments(declarationBaseNumber);
  }, [declarationBaseNumber, invoiceId, isEdit]);

  useEffect(() => {
    setSelectedAttachmentIds((current) => {
      const next: Record<string, number> = {};

      for (const [category, categoryAttachments] of attachmentsByCategory.entries()) {
        if (categoryAttachments.length === 0) continue;
        const currentSelectedId = current[category];
        next[category] = categoryAttachments.some((attachment) => attachment.id === currentSelectedId)
          ? currentSelectedId
          : categoryAttachments[0].id;
      }

      return next;
    });
  }, [attachments]);

  const handleAddAttachmentClick = async (category = "other") => {
    if (!attachmentsEnabled) {
      toast({
        title: isAR ? "احفظ الفاتورة أولًا لتفعيل المرفقات" : "Save invoice first to enable attachments",
        variant: "destructive",
      });
      return;
    }

    const api = (window as any).electronAPI;
    if (!api?.selectAttachmentFile || !api?.saveAttachmentFile) {
      toast({
        title: isAR ? "واجهة المرفقات غير متاحة" : "Attachment bridge is not available",
        variant: "destructive",
      });
      return;
    }

    try {
      setAttachmentBusy(true);
      const selected: AttachmentSelectResult = await api.selectAttachmentFile();

      if (selected.canceled) return;
      if (!selected.filePath || !selected.fileName) {
        throw new Error(selected.error || "No file was selected");
      }

      const extension = selected.ext || getFileExtension(selected.fileName);
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
        toast({
          title: isAR ? "نوع الملف غير مسموح" : "Unsupported file type",
          variant: "destructive",
        });
        return;
      }

      if (Number(selected.size || 0) > ATTACHMENT_MAX_SIZE_BYTES) {
        toast({
          title: isAR ? "الملف أكبر من الحد المسموح 5MB" : "File exceeds 5MB limit",
          variant: "destructive",
        });
        return;
      }

      const storedName = `${Date.now()}-${sanitizeStoredFileName(selected.fileName)}`;
      const saveResult: AttachmentSaveResult = await api.saveAttachmentFile({
        sourcePath: selected.filePath,
        declarationBaseNumber,
        storedName,
      });

      if (!saveResult.ok || !saveResult.relativePath) {
        throw new Error(saveResult.error || "Failed to save attachment file");
      }

      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(getAttachmentApiBase(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          invoiceId,
          declarationNumber: shipmentRefWatch || declarationBaseNumber,
          declarationBaseNumber,
          fileName: selected.fileName,
          storedName,
          relativePath: saveResult.relativePath,
          mimeType: extension || null,
          fileSize: selected.size ?? null,
          category,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Metadata request failed with status ${response.status}`);
      }

      await fetchAttachments(declarationBaseNumber);
      toast({ title: isAR ? "تمت إضافة المرفق" : "Attachment added" });
    } catch (error) {
      console.error("Failed to add attachment:", error);
      toast({
        title: isAR ? "خطأ" : "Error",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleOpenAttachment = async (attachment: InvoiceAttachment) => {
    if (!attachment.relativePath) return;

    const api = (window as any).electronAPI;
    if (!api?.openAttachmentFile) {
      toast({
        title: isAR ? "واجهة المرفقات غير متاحة" : "Attachment bridge is not available",
        variant: "destructive",
      });
      return;
    }

    const result: AttachmentSaveResult = await api.openAttachmentFile(attachment.relativePath);
    if (!result.ok) {
      toast({
        title: isAR ? "تعذر فتح الملف" : "Failed to open file",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      setAttachmentBusy(true);
      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(`${getAttachmentApiBase()}/${attachmentId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete request failed with status ${response.status}`);
      }

      await fetchAttachments(declarationBaseNumber);
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      toast({
        title: isAR ? "تعذر حذف المرفق" : "Failed to delete attachment",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleReceiptClick = async () => {
    if (!invoiceId) return;

    try {
      setReceiptLookupPending(true);

      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/receipts/by-invoice/${invoiceId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      if (!response.ok) {
        throw new Error(`Receipt lookup failed with status ${response.status}`);
      }

      const receipt = await response.json();

      if (receipt?.id) {
        setLocation(`/receipts/${receipt.id}/edit`);
        return;
      }

      setLocation(`/receipts/new?invoice=${invoiceId}`);
    } catch (error) {
      console.error("Receipt lookup failed:", error);
      toast({
        title: isAR ? "خطأ" : "Error",
        description: isAR
          ? "تعذر التحقق من سند القبض المرتبط بهذه الفاتورة"
          : "Failed to check the receipt linked to this invoice",
        variant: "destructive",
      });
    } finally {
      setReceiptLookupPending(false);
    }
  };

    const getAuditSummary = (log: any) => {
    try {
      const changes = log.changesJson ? JSON.parse(log.changesJson) : null;

      if (!changes) return [];

      if (log.action === "created") {
        return [isAR ? "تم إنشاء الفاتورة" : "Invoice was created"];
      }

      if (log.action === "recreated") {
        return isAR
          ? "تم إعادة إنشاء الفاتورة بعد حذف سابق"
          : "Invoice recreated after previous deletion";
      }

      if (log.action === "deleted") {
        return [
          isAR
            ? "تم نقل الفاتورة إلى سلة المحذوفات"
            : "Invoice moved to trash"
        ];
      }

      if (Array.isArray(changes.itemChanges) && changes.itemChanges.length > 0) {
        return changes.itemChanges;
      }

      if (log.action === "updated") {
        const before = changes.before?.invoice || {};
        const after = changes.after?.invoice || {};
        const result: string[] = [];

        const changeText = (labelAr: string, labelEn: string, from: any, to: any) =>
          isAR
            ? `تم تغيير ${labelAr} من ${from ?? "-"} إلى ${to ?? "-"}`
            : `${labelEn} changed from ${from ?? "-"} to ${to ?? "-"}`;

        if (before.notes !== after.notes) {
            result.push(changeText("الملاحظات", "Notes", before.notes, after.notes));
          }

          if (before.taxRate !== after.taxRate) {
            result.push(
              isAR
                ? `تم تغيير الضريبة من ${before.taxRate ?? "-"} إلى ${after.taxRate ?? "-"}`
                : `Tax changed from ${before.taxRate ?? "-"} to ${after.taxRate ?? "-"}`
            );
          }

          if (before.advancePayment !== after.advancePayment) {
            result.push(
              isAR
                ? `تم تغيير الدفعة المقدمة من ${before.advancePayment ?? "-"} إلى ${after.advancePayment ?? "-"}`
                : `Advance payment changed from ${before.advancePayment ?? "-"} to ${after.advancePayment ?? "-"}`
            );
          }

          if (before.importerExporterName !== after.importerExporterName) {
            result.push(changeText("المستورد / المصدر", "Importer / exporter", before.importerExporterName, after.importerExporterName));
          }

          if (before.billOfLading !== after.billOfLading) {
            result.push(changeText("بوليصة الشحن", "Bill of lading", before.billOfLading, after.billOfLading));
          }

          const addChange = (key: string, labelAr: string, labelEn: string) => {
            if (String(before[key] ?? "") !== String(after[key] ?? "")) {
              result.push(changeText(labelAr, labelEn, before[key], after[key]));
            }
          };

          addChange("portOfEntry", "ميناء الدخول", "Port of entry");
          addChange("issueDate", "تاريخ الإصدار", "Issue date");
          addChange("dueDate", "تاريخ الاستحقاق", "Due date");
          addChange("status", "الحالة", "Status");
          addChange("subtotal", "المجموع الفرعي", "Subtotal");
          addChange("taxAmount", "قيمة الضريبة", "Tax amount");
          addChange("shipmentWeight", "وزن الشحنة", "Shipment weight");

      if (before.packageCount !== after.packageCount) {
        result.push(changeText("عدد الطرود", "Package count", before.packageCount, after.packageCount));
      }

      if (before.clientId !== after.clientId) {
        result.push(changeText("العميل", "Client", before.clientId, after.clientId));
      }

      if (before.shipmentRef !== after.shipmentRef) {
        result.push(changeText("رقم البيان", "Shipment reference", before.shipmentRef, after.shipmentRef));
      }

      if (before.total !== after.total) {
        result.push(changeText("الإجمالي", "Total", before.total, after.total));
      }

      if (before.createdBy !== after.createdBy) {
        result.push(changeText("المندوب", "Agent", before.createdBy, after.createdBy));
      }

      return result.length > 0
        ? result
        : [isAR ? "تم تعديل بيانات الفاتورة" : "Invoice details updated"];
      }

      return [log.action];
      } catch {
        return [isAR ? "تعذر قراءة تفاصيل التغيير" : "Could not read change details"];
      }
  };

  const getAuditUsername = (log: any) => {
    const auditUser = users.find((u) => String(u.id) === String(log.userId));
    if (!auditUser) return log.username || "-";

    return (
      (isAR
        ? auditUser.displayNameAr || auditUser.displayName || auditUser.displayNameEn
        : auditUser.displayNameEn || auditUser.displayName || auditUser.displayNameAr) ||
      auditUser.username ||
      log.username ||
      "-"
    );
  };

 return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      dir={isRTL ? "rtl" : "ltr"}
      className="max-w-4xl mx-auto space-y-4 pb-24"
    >
      <div className="flex items-start gap-4 w-full">
        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => setLocation("/invoices")}
            className="p-2 bg-card border border-border/50 rounded-xl hover:bg-muted transition-colors"
          >
            {isAR ? (
              <ArrowRight className="w-4 h-4" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
          </button>

          <div className="text-right self-start">
            <h1 className="text-xl font-bold leading-tight">
              {isEdit
                ? `${isAR ? "تعديل" : "Edit"} ${
                    existingInvoice?.invoiceNumber || ""
                  }`
                : isAR
                ? "إنشاء فاتورة جديدة"
                : "New Invoice"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAR
                ? "أدخل بيانات الفاتورة ثم احفظ"
                : "Fill in the details and save"}
              
            </p>
            </div>
            </div>
          
        {isEdit && invoiceId ? (
          <div className={`flex items-center gap-5 -mt-2 min-w-[420px] ${isAR ? "order-1"  :  "order-3"}`}>

            <button
              type="button"
              onClick={() => {
                if (!existingInvoice) return;

                sessionStorage.setItem(
                  "copy_invoice",
                  JSON.stringify({
                    ...existingInvoice,
                    id: undefined,
                    invoiceNumber: undefined,
                    shipmentRef: "",
                    billOfLading: "",
                    shipmentWeight: null,
                    packageCount: null,
                    notes: "",
                    issueDate: new Date().toISOString().split("T")[0],
                    dueDate: "",
                  })
                );

                setLocation("/invoices/new");
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 shadow-sm"
            >
              {isAR ? "نسخ الفاتورة" : "Copy Invoice"}
            </button>

              {isEdit && invoiceId && (
                <Link
                  href={`/receipts/new?invoice=${invoiceId}`}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleReceiptClick();
                    }}
                    disabled={receiptLookupPending}
                    className="flex items-center gap-1.5 px-3 py-2 border border-emerald-400 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 shadow-sm disabled:opacity-60"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    {isAR ? "سند قبض" : "Receipt"}
                  </button>
                </Link>
              )}

            <Link href={`/accounting?invoice=${encodeURIComponent(existingInvoice?.invoiceNumber || "")}`}>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-emerald-400 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
                <Calculator className="w-3.5 h-3.5" />
                {isAR ? "الحسابات" : "Calculate"}
              </button>
            </Link>

            <Link href={`/invoices/${invoiceId}/receipt`}>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white text-sm font-medium rounded-xl hover:bg-slate-600">
                <Printer className="w-3.5 h-3.5" />
                {isAR ? "طباعة" : "Print"}
              </button>
            </Link>

          </div>
        ) : null}
        </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-visible">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-primary/5">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {isAR ? "البيانات الأساسية" : "Basic Details"}
            </h2>
          </div>
        
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-2">
              <label className={labelCls}>{isAR ? "العميل" : "Client"}</label>
              <select {...register("clientId")} className={inputCls}>
                <option value={0}>
                  {isAR ? "اختر العميل..." : "Select client..."}
                </option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-xs text-destructive mt-0.5">
                  {errors.clientId.message}
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "تاريخ الإصدار" : "Issue Date"}
              </label>
              <input
                type="date"
                {...register("issueDate")}
                className={inputCls}
              />
              {errors.issueDate && (
                <p className="text-xs text-destructive mt-0.5">
                  {errors.issueDate.message}
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "تاريخ الاستحقاق" : "Due Date"}
              </label>
              <input
                type="date"
                {...register("dueDate")}
                className={inputCls}
              />
            </div>

           <div className="col-span-2 md:col-span-2">
            <label className={labelCls}>
              {isAR ? "اسم المستورد / المصدر" : "Importer / Exporter Name"}
            </label>
            <SuggestionInput
              storageKey={IMPORTER_EXPORTER_SUGGESTIONS_KEY}
              value={watch("importerExporterName") ?? ""}
              onChange={(value) =>
                setValue("importerExporterName", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder={isAR ? "ادخل الاسم" : "Enter the name"}
              className={inputCls}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>

            <div>
              <label className={labelCls}>{isAR ? "الحالة" : "Status"}</label>
              <select {...register("status")} className={inputCls}>
                {Object.values(CreateInvoiceRequestStatus).map((s) => {
                  const status = String(s) as keyof typeof STATUS_LABELS;

                  return (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]?.[lang] || status}
                    </option>
                  );
                })}
            </select>
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "المندوب" : "Salesman"}
              </label>
              <select
                {...register("createdBy")}
                value={watch("createdBy") || (user?.id ? String(user.id) : "")}
                className={inputCls}
                disabled={
                  !isEdit ||
                  (user?.role !== "admin" && user?.role !== "supervisor")
                }
              >
                {user && !users.some((u) => String(u.id) === String(user.id)) && (
                  <option value={String(user.id)}>
                    {user.displayName || user.username}
                  </option>
                )}

                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-visible">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-blue-500/5">
            <Ship className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-foreground">
              {isAR ? "بيانات الشحنة" : "Shipment Info"}
            </h2>
          </div>

          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>
                {isAR ? "رقم البيان" : "Shipment Ref"}
              </label>
              <input
                {...register("shipmentRef", {
                  onBlur: (e) => {
                    const value = e.target.value.trim().slice(0, 14);

                    const found = invoices?.find(
                      (inv: any) =>
                        String(inv.shipmentRef ?? "").trim().slice(0, 14) === value
                    );

                    if (found) {
                      const sameUser = String(found.createdBy) === String(user?.id || "");

                      if (sameUser) {
                        setLocation(`/invoices/${found.id}/edit`);
                        return;
                      } else {
                        toast({
                          title: isAR ? "البيان موجود" : "Shipment exists",
                          description: isAR
                            ? `رقم الفاتورة: ${found.invoiceNumber || ""} | بواسطة مستخدم آخر`
                            : `Invoice: ${found.invoiceNumber || ""} | Registered by another user`,
                        });
                      }
                    }
                  },
                })}
                placeholder={isAR ? "مثال: 123456" : "e.g. 123456"}
                className={inputCls}
              />
          </div>
             <div>
              <label className={labelCls}>
                {isAR ? "رقم البوليصة B/L" : "Bill of Lading"}
              </label>
           
              <input
                {...register("billOfLading")}
                placeholder="MSKU1234567"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "ميناء الدخول" : "Port of Entry"}
              </label>
              <SuggestionInput
                storageKey={ENTRY_PORT_SUGGESTIONS_KEY}
                value={watch("portOfEntry") ?? ""}
                onChange={(value) =>
                  setValue("portOfEntry", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={isAR ? "مثال: ميناء حمد" : "e.g. Hamad Port"}
                className={inputCls}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "عدد الطرود" : "Packages"}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                {...register("packageCount")}
                placeholder="50"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                {isAR ? "الوزن (كجم)" : "Weight (kg)"}
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                {...register("shipmentWeight")}
                placeholder="1250.000"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-green-500/5">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-bold text-foreground">
                {isAR ? "بنود الفاتورة" : "Line Items"}
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                append({ description: "", quantity: 1, unitPrice: 0 })
              }
              className="text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAR ? "إضافة بند" : "Add Item"}
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-4 py-2 font-semibold text-start w-36">
                      {isAR ? "نموذج" : "Template"}
                    </th>
                    <th className="px-4 py-2 font-semibold text-start">
                      {isAR ? "الوصف" : "Description"}
                    </th>
                    <th className="px-4 py-2 font-semibold text-start w-20">
                      {isAR ? "الكمية" : "Qty"}
                    </th>
                    <th className="px-4 py-2 font-semibold text-start w-28">
                      {isAR ? "سعر الوحدة" : "Unit Price"}
                    </th>
                    <th className="px-4 py-2 font-semibold text-end w-28">
                      {isAR ? "الإجمالي" : "Total"}
                    </th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>

                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-border/40">
                    {fields.map((field, index) => (
                      <SortableRow
                        key={field.id}
                        id={field.id}
                        index={index}
                        register={register}
                        watch={watch}
                        remove={remove}
                        applyTemplate={applyTemplate}
                        templates={templates}
                        canRemove={fields.length > 1}
                        isAR={isAR}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          </DndContext>

          {errors.items && (
            <p className="text-xs text-destructive px-4 py-2 border-t border-border/40">
              {errors.items.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-amber-500/5">
              <StickyNote className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold">
                {isAR ? "ملاحظات" : "Notes"}
              </h3>
            </div>

            <div className="p-3">
              <textarea
                {...register("notes")}
                rows={5}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder={
                  isAR
                    ? "شروط الدفع، تعليمات التحويل، إلخ..."
                    : "Payment terms, notes..."
                }
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-primary/5">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">
                {isAR ? "الملخص المالي" : "Financial Summary"}
              </h3>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{isAR ? "المجموع الجزئي" : "Subtotal"}</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {isAR ? "الضريبة %" : "Tax %"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    {...register("taxRate")}
                    className="w-16 px-2 py-1 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary text-end"
                  />
                </div>
                <span className="font-mono text-muted-foreground">
                  {formatCurrency(taxAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {isAR ? "دفعة مقدمة" : "Advance"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("advancePayment")}
                    className="w-24 px-2 py-1 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary text-end"
                    placeholder="0.00"
                  />
                </div>
                <span className="font-mono text-green-600 font-medium">
                  − {formatCurrency(Number(advancePaymentWatch))}
                </span>
              </div>

              <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                <span className="text-base font-bold">
                  {isAR ? "الصافي المستحق" : "Net Due"}
                </span>
                <span className="text-lg font-bold font-mono text-primary">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={showInvoiceAuditLog ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start" : ""}>
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden min-w-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-slate-500/5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold">
                {isAR ? "المرفقات" : "Attachments"}
              </h3>
            </div>

            {attachmentsEnabled && (
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {attachments.length}
              </span>
            )}
          </div>

          <div className="p-4">
            {!attachmentsEnabled ? (
              <p className="text-sm text-muted-foreground">
                {isAR
                  ? "احفظ الفاتورة أولًا لتفعيل المرفقات"
                  : "Save invoice first to enable attachments"}
              </p>
            ) : (
              <div className="space-y-5">
                {attachmentsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {isAR ? "جاري تحميل المرفقات..." : "Loading attachments..."}
                  </p>
                ) : (
                  <>
                    <section className="space-y-2">
                      <div className="flex flex-nowrap items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-foreground">
                          {isAR ? "مرفقات أساسية" : "Preset Attachment Slots"}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {PRESET_ATTACHMENT_CATEGORIES.filter((category) => attachmentsByCategory.has(category.key)).length}
                          /{PRESET_ATTACHMENT_CATEGORIES.length}
                        </span>
                      </div>

                      <div className="divide-y divide-border/50 rounded-lg border border-border/60">
                        {PRESET_ATTACHMENT_CATEGORIES.map((category) => {
                          const categoryAttachments = attachmentsByCategory.get(category.key) || [];
                          const uploaded = categoryAttachments.length > 0;
                          const selectedAttachment = getSelectedAttachment(category.key);

                          return (
                            <div key={category.key} className="space-y-3 px-3 py-3">
                              <div className="flex flex-nowrap items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">
                                    {isAR ? category.ar : category.en}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                      uploaded
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-border bg-muted/40 text-muted-foreground"
                                    }`}
                                  >
                                    {uploaded
                                      ? attachmentCountLabel(categoryAttachments.length)
                                      : isAR ? "غير مرفوع" : "Missing"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleAddAttachmentClick(category.key)}
                                  disabled={attachmentBusy}
                                  title={isAR ? "رفع" : "Upload"}
                                  aria-label={isAR ? "رفع" : "Upload"}
                                  className={attachmentButtonCls}
                                >
                                  <Upload className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectedAttachment && void handleOpenAttachment(selectedAttachment)}
                                  disabled={!selectedAttachment}
                                  title={isAR ? "فتح" : "Open"}
                                  aria-label={isAR ? "فتح" : "Open"}
                                  className={attachmentButtonCls}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectedAttachment && void handleDeleteAttachment(selectedAttachment.id)}
                                  disabled={attachmentBusy || !selectedAttachment}
                                  title={isAR ? "حذف" : "Delete"}
                                  aria-label={isAR ? "حذف" : "Delete"}
                                  className={attachmentDeleteButtonCls}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              </div>

                              {categoryAttachments.length > 0 && (
                                <div className="space-y-2">
                                  {categoryAttachments.map((attachment) => (
                                    <div
                                      key={attachment.id}
                                      className="flex flex-nowrap items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2"
                                    >
                                      <input
                                        type="radio"
                                        name={`attachment-${category.key}`}
                                        checked={selectedAttachmentIds[category.key] === attachment.id}
                                        onChange={() =>
                                          setSelectedAttachmentIds((current) => ({
                                            ...current,
                                            [category.key]: attachment.id,
                                          }))
                                        }
                                        className="h-4 w-4 shrink-0 accent-primary"
                                      />
                                      <div className="min-w-0 flex-1 truncate text-sm text-foreground">
                                        {attachment.fileName}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="space-y-2">
                      {(() => {
                        const selectedOtherAttachment = getSelectedAttachment("other");
                        return (
                          <>
                      <div className="flex flex-nowrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">
                            {isAR ? "أخرى" : "Other"}
                          </h4>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              otherAttachments.length > 0
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-border bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {otherAttachments.length > 0
                              ? attachmentCountLabel(otherAttachments.length)
                              : isAR ? "غير مرفوع" : "Missing"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleAddAttachmentClick("other")}
                          disabled={attachmentBusy}
                          title={isAR ? "رفع" : "Upload"}
                          aria-label={isAR ? "رفع" : "Upload"}
                          className={attachmentButtonCls}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        {otherAttachments[0] && (
                          <>
                            <button
                              type="button"
                              onClick={() => selectedOtherAttachment && void handleOpenAttachment(selectedOtherAttachment)}
                              disabled={!selectedOtherAttachment}
                              title={isAR ? "فتح" : "Open"}
                              aria-label={isAR ? "فتح" : "Open"}
                              className={attachmentButtonCls}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => selectedOtherAttachment && void handleDeleteAttachment(selectedOtherAttachment.id)}
                              disabled={attachmentBusy || !selectedOtherAttachment}
                              title={isAR ? "حذف" : "Delete"}
                              aria-label={isAR ? "حذف" : "Delete"}
                              className={attachmentDeleteButtonCls}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {otherAttachments.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                          {isAR ? "لا توجد مرفقات أخرى حتى الآن" : "No other attachments yet"}
                        </p>
                      ) : (
                        <div className="divide-y divide-border/50 rounded-lg border border-border/60">
                          {otherAttachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex flex-nowrap items-center justify-between gap-3 px-3 py-3"
                            >
                              <input
                                type="radio"
                                name="attachment-other"
                                checked={selectedAttachmentIds.other === attachment.id}
                                onChange={() =>
                                  setSelectedAttachmentIds((current) => ({
                                    ...current,
                                    other: attachment.id,
                                  }))
                                }
                                className="h-4 w-4 shrink-0 accent-primary"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-foreground">
                                  {attachment.fileName}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{attachment.category || "other"}</span>
                                  <span>•</span>
                                  <span>
                                    {attachment.createdAt
                                      ? new Date(attachment.createdAt).toLocaleString(isAR ? "ar" : "en-US")
                                      : "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                          </>
                        );
                      })()}
                    </section>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {showInvoiceAuditLog && (
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden min-w-0">
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">
                {isAR ? "سجل تغييرات الفاتورة" : "Invoice Audit Log"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {auditLogs.length} {isAR ? "عملية" : "events"}
              </span>
            </div>

            <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
              {auditLogs.map((log, i) => {
                const rawDate =
                  log.createdAt ??
                  log.created_at ??
                  JSON.parse(log.changesJson || "{}")?.after?.invoice?.updatedAt ??
                  JSON.parse(log.changesJson || "{}")?.before?.invoice?.updatedAt;
                const dateText = rawDate ? new Date(rawDate).toLocaleString("en-US") : "-";
                const actionLabel =
                  log.action === "created"
                    ? isAR ? "إنشاء الفاتورة" : "Invoice Created"
                    : log.action === "updated"
                      ? isAR ? "تعديل الفاتورة" : "Invoice Updated"
                      : log.action === "deleted"
                        ? isAR ? "حذف الفاتورة" : "Invoice Deleted"
                        : log.action === "restored"
                          ? isAR ? "استعادة الفاتورة" : "Invoice Restored"
                          : log.action;
                const summary = getAuditSummary(log);

                return (
                  <div key={i} className="px-4 py-3 space-y-2">
                    <div className="flex flex-nowrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-bold">
                          {actionLabel}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {isAR ? "بواسطة" : "By"}: {getAuditUsername(log)}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {dateText}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground leading-6 break-words">
                      {(Array.isArray(summary) ? summary : [String(summary ?? "")]).map((s: string, idx: number) => (
                        <div key={idx}>• {s}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-card/90 backdrop-blur-md border border-border/60 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 z-40">
          <p className="text-xs text-muted-foreground hidden sm:block truncate">
            {isAR
              ? "تأكد من اكتمال الحقول المطلوبة"
              : "Fill all required fields"}
          </p>

          <div className="flex gap-2 ms-auto">
            <button
              type="button"
              onClick={() => setLocation("/invoices")}
              className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors"
            >
              {isAR ? "إلغاء" : "Cancel"}
            </button>

            <button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {isEdit
                ? isAR
                  ? "حفظ التغييرات"
                  : "Save Changes"
                : isAR
                ? "إنشاء الفاتورة"
                : "Create Invoice"}
            </button>
          </div>
        </div>
      </form>

     {false && isEdit && user?.role === "admin" && auditLogs.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-sm font-bold">
              {isAR ? "سجل تغييرات الفاتورة" : "Invoice Audit Log"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {auditLogs.length} {isAR ? "عملية" : "events"}
            </span>
          </div>

          <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
            {Array.isArray(auditLogs) &&
              auditLogs.map((log, i) => {
              const rawDate =
                log.createdAt ??
                log.created_at ??
                JSON.parse(log.changesJson || "{}")?.after?.invoice?.updatedAt ??
                JSON.parse(log.changesJson || "{}")?.before?.invoice?.updatedAt;

              const dateText = rawDate
                ? new Date(rawDate).toLocaleString("en-US")
                : "-";

              const actionLabel =
                log.action === "created"
                  ? isAR ? "إنشاء الفاتورة" : "Invoice Created"
                  : log.action === "updated"
                    ? isAR ? "تعديل الفاتورة" : "Invoice Updated"
                    : log.action === "deleted"
                      ? isAR ? "حذف الفاتورة" : "Invoice Deleted"
                      : log.action === "restored"
                        ? isAR ? "استعادة الفاتورة" : "Invoice Restored"
                        : log.action;
              const actionStyle =
                log.action === "created"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : log.action === "updated"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : log.action === "deleted"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-purple-50 text-purple-700 border-purple-200";

              const summary = getAuditSummary(log);

              return (
                <div
                    key={i}
                    className="px-5 py-3 grid grid-cols-1 md:grid-cols-[0.6fr_3fr_0.7fr] gap-4 items-start"
                  >
                  <div className="min-w-0">
                    <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${actionStyle}`}>
                      {actionLabel}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 leading-5">
                      {isAR ? "بواسطة" : "By"}: {getAuditUsername(log)}
                    </div>
                  </div>

                  <div className="min-w-0 text-xs text-muted-foreground space-y-2 leading-6 break-words whitespace-normal px-2">
                    {(Array.isArray(summary) ? summary : [String(summary ?? "")]).map((s: string, idx: number) => (
                      <div key={idx}>• {s}</div>
                    ))}
                  </div>

                  <div className="min-w-0 text-xs text-muted-foreground break-words whitespace-normal md:text-start pl-2">
                    {dateText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
