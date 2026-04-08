import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type Lang = "ar" | "en";

type InvoiceItem = {
  id?: number;
  invoiceId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  advancePayment: number;
  notes: string | null;
  shipmentRef: string | null;
  billOfLading: string | null;
  packageCount: number | null;
  shipmentWeight: number | null;
  portOfEntry: string | null;
  createdBy: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
};

type Client = {
  id: number;
  name: string;
};

type InvoiceForm = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  status: string;
  taxRate: string;
  advancePayment: string;
  notes: string;
  shipmentRef: string;
  billOfLading: string;
  packageCount: string;
  shipmentWeight: string;
  portOfEntry: string;
  items: InvoiceItem[];
};

const API_BASE =
  ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";

function getAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function createDefaultForm(): InvoiceForm {
  return {
    clientId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "draft",
    taxRate: "0",
    advancePayment: "0",
    notes: "",
    shipmentRef: "",
    billOfLading: "",
    packageCount: "",
    shipmentWeight: "",
    portOfEntry: "",
    items: [
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ],
  };
}

export default function Invoices({ lang }: { lang: Lang }) {
  const isArabic = lang === "ar";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [form, setForm] = useState<InvoiceForm>(createDefaultForm());
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    void loadData();
  }, []);

  async function apiFetch(path: string, options: RequestInit = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });
  }

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [invoiceResponse, clientsResponse] = await Promise.all([
        apiFetch("/invoices"),
        apiFetch("/clients"),
      ]);

      if (!invoiceResponse.ok) {
        throw new Error(`Invoices request failed: ${invoiceResponse.status}`);
      }

      const invoicesJson = await invoiceResponse.json();
      const clientsJson = clientsResponse.ok ? await clientsResponse.json() : [];

      setInvoices(Array.isArray(invoicesJson) ? invoicesJson : []);
      setClients(Array.isArray(clientsJson) ? clientsJson : []);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        isArabic ? "تعذر تحميل بيانات الفواتير" : "Failed to load invoices data"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesSearch =
        !q ||
        (invoice.invoiceNumber || "").toLowerCase().includes(q) ||
        (invoice.clientName || "").toLowerCase().includes(q) ||
        (invoice.shipmentRef || "").toLowerCase().includes(q) ||
        (invoice.portOfEntry || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const paidCount = invoices.filter((inv) => inv.status === "paid").length;
    const draftCount = invoices.filter((inv) => inv.status === "draft").length;

    return {
      totalInvoices,
      totalAmount,
      paidCount,
      draftCount,
    };
  }, [invoices]);

  const formSubtotal = useMemo(() => {
    return form.items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return sum + qty * unitPrice;
    }, 0);
  }, [form.items]);

  const formTaxAmount = useMemo(() => {
    const taxRate = Number(form.taxRate || 0);
    return formSubtotal * (taxRate / 100);
  }, [form.taxRate, formSubtotal]);

  const formGrandTotal = useMemo(() => {
    const advance = Number(form.advancePayment || 0);
    return formSubtotal + formTaxAmount - advance;
  }, [formSubtotal, formTaxAmount, form.advancePayment]);

  function resetForm() {
    setEditingInvoiceId(null);
    setForm(createDefaultForm());
  }

  function openCreateModal() {
    resetForm();
    setErrorMessage("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setErrorMessage("");
    resetForm();
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoiceId(invoice.id);
    setForm({
      clientId: String(invoice.clientId ?? ""),
      issueDate: invoice.issueDate ? String(invoice.issueDate).slice(0, 10) : "",
      dueDate: invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : "",
      status: invoice.status || "draft",
      taxRate: String(invoice.taxRate ?? 0),
      advancePayment: String(invoice.advancePayment ?? 0),
      notes: invoice.notes || "",
      shipmentRef: invoice.shipmentRef || "",
      billOfLading: invoice.billOfLading || "",
      packageCount: invoice.packageCount != null ? String(invoice.packageCount) : "",
      shipmentWeight: invoice.shipmentWeight != null ? String(invoice.shipmentWeight) : "",
      portOfEntry: invoice.portOfEntry || "",
      items:
        invoice.items && invoice.items.length > 0
          ? invoice.items.map((item) => ({
              id: item.id,
              invoiceId: item.invoiceId,
              description: item.description || "",
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unitPrice || 0),
              total: Number(item.total || 0),
            }))
          : [
              {
                description: "",
                quantity: 1,
                unitPrice: 0,
                total: 0,
              },
            ],
    });
    setErrorMessage("");
    setShowModal(true);
  }

  function updateForm<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateItem(index: number, key: keyof InvoiceItem, value: string | number) {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const item = { ...nextItems[index], [key]: value };

      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      item.total = quantity * unitPrice;

      nextItems[index] = item;
      return {
        ...prev,
        items: nextItems,
      };
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => {
      if (prev.items.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
    });
  }

  async function handleSubmit() {
    if (!form.clientId || !form.issueDate) {
      setErrorMessage(
        isArabic
          ? "العميل وتاريخ الإصدار مطلوبان"
          : "Client and issue date are required"
      );
      return;
    }

    const cleanedItems = form.items
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      }))
      .filter((item) => item.description !== "");

    if (cleanedItems.length === 0) {
      setErrorMessage(
        isArabic ? "أدخل بندًا واحدًا على الأقل" : "Please add at least one item"
      );
      return;
    }

    const payload = {
      clientId: Number(form.clientId),
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      status: form.status || "draft",
      taxRate: form.taxRate || "0",
      advancePayment: form.advancePayment || "0",
      notes: form.notes || null,
      shipmentRef: form.shipmentRef || null,
      billOfLading: form.billOfLading || null,
      packageCount: form.packageCount || null,
      shipmentWeight: form.shipmentWeight || null,
      portOfEntry: form.portOfEntry || null,
      items: cleanedItems,
    };

    setSaving(true);
    setErrorMessage("");

    try {
      const response = await apiFetch(
        editingInvoiceId ? `/invoices/${editingInvoiceId}` : "/invoices",
        {
          method: editingInvoiceId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Request failed");
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        isArabic ? "تعذر حفظ الفاتورة" : "Failed to save invoice"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(invoiceId: number) {
    const confirmed = window.confirm(
      isArabic
        ? "هل تريد نقل الفاتورة إلى سلة المحذوفات؟"
        : "Do you want to move this invoice to trash?"
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(`/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        isArabic ? "تعذر حذف الفاتورة" : "Failed to delete invoice"
      );
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat(isArabic ? "ar-QA" : "en", {
      style: "currency",
      currency: "QAR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatDate(value: string | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(isArabic ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, { ar: string; en: string }> = {
      draft: { ar: "مسودة", en: "Draft" },
      issued: { ar: "صادرة", en: "Issued" },
      paid: { ar: "مدفوعة", en: "Paid" },
      pending: { ar: "معلقة", en: "Pending" },
      overdue: { ar: "متأخرة", en: "Overdue" },
      cancelled: { ar: "ملغاة", en: "Cancelled" },
    };

    return isArabic ? labels[status]?.ar || status : labels[status]?.en || status;
  }

  function getStatusStyle(status: string): CSSProperties {
    const styles: Record<string, CSSProperties> = {
      draft: {
        background: "rgba(148, 163, 184, 0.12)",
        color: "#475569",
      },
      paid: {
        background: "rgba(34, 197, 94, 0.12)",
        color: "#15803d",
      },
      pending: {
        background: "rgba(245, 158, 11, 0.12)",
        color: "#b45309",
      },
      overdue: {
        background: "rgba(239, 68, 68, 0.12)",
        color: "#b91c1c",
      },
      cancelled: {
        background: "rgba(100, 116, 139, 0.12)",
        color: "#475569",
      },
      issued: {
        background: "rgba(59, 130, 246, 0.12)",
        color: "#1d4ed8",
      },
    };

    return styles[status] || styles.draft;
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "18px",
        }}
      >
        <StatCard
          title={isArabic ? "إجمالي الفواتير" : "Total Invoices"}
          value={String(stats.totalInvoices)}
        />
        <StatCard
          title={isArabic ? "إجمالي المبالغ" : "Total Amount"}
          value={formatCurrency(stats.totalAmount)}
        />
        <StatCard
          title={isArabic ? "الفواتير المدفوعة" : "Paid Invoices"}
          value={String(stats.paidCount)}
        />
        <StatCard
          title={isArabic ? "المسودات" : "Drafts"}
          value={String(stats.draftCount)}
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "18px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {isArabic ? "الفواتير" : "Invoices"}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              {isArabic
                ? "إدارة الفواتير وربطها بالعملاء وبيانات الشحن"
                : "Manage invoices with clients and shipment details"}
            </div>
          </div>

          <button onClick={openCreateModal} style={primaryButtonStyle}>
            {isArabic ? "إنشاء فاتورة" : "Create Invoice"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1.4fr) minmax(180px, 0.8fr)",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isArabic
                ? "بحث برقم الفاتورة أو العميل أو مرجع الشحنة"
                : "Search by invoice number, client, or shipment ref"
            }
            style={inputStyle}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option>
            <option value="draft">{getStatusLabel("draft")}</option>
            <option value="issued">{getStatusLabel("issued")}</option>
            <option value="paid">{getStatusLabel("paid")}</option>
            <option value="pending">{getStatusLabel("pending")}</option>
            <option value="overdue">{getStatusLabel("overdue")}</option>
            <option value="cancelled">{getStatusLabel("cancelled")}</option>
          </select>
        </div>

        {errorMessage ? (
          <div
            style={{
              marginBottom: "14px",
              padding: "12px 14px",
              borderRadius: "14px",
              background: "rgba(239, 68, 68, 0.08)",
              color: "#b91c1c",
              border: "1px solid rgba(239, 68, 68, 0.16)",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            {isArabic ? "جاري تحميل الفواتير..." : "Loading invoices..."}
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #eef2f7",
              borderRadius: "18px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1100px",
                background: "white",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <Th>{isArabic ? "رقم الفاتورة" : "Invoice No."}</Th>
                  <Th>{isArabic ? "العميل" : "Client"}</Th>
                  <Th>{isArabic ? "تاريخ الإصدار" : "Issue Date"}</Th>
                  <Th>{isArabic ? "الحالة" : "Status"}</Th>
                  <Th>{isArabic ? "مرجع الشحنة" : "Shipment Ref"}</Th>
                  <Th>{isArabic ? "منفذ الدخول" : "Port"}</Th>
                  <Th>{isArabic ? "الدفعة المقدمة" : "Advance"}</Th>
                  <Th>{isArabic ? "الإجمالي" : "Total"}</Th>
                  <Th>{isArabic ? "إجراءات" : "Actions"}</Th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "28px",
                        textAlign: "center",
                        color: "#64748b",
                        borderTop: "1px solid #eef2f7",
                      }}
                    >
                      {isArabic ? "لا توجد فواتير" : "No invoices found"}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <Td>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {invoice.invoiceNumber}
                        </div>
                      </Td>
                      <Td>{invoice.clientName}</Td>
                      <Td>{formatDate(invoice.issueDate)}</Td>
                      <Td>
                        <span
                          style={{
                            ...getStatusStyle(invoice.status),
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {getStatusLabel(invoice.status)}
                        </span>
                      </Td>
                      <Td>{invoice.shipmentRef || "-"}</Td>
                      <Td>{invoice.portOfEntry || "-"}</Td>
                      <Td>{formatCurrency(invoice.advancePayment)}</Td>
                      <Td>
                        <span style={{ fontWeight: 800 }}>
                          {formatCurrency(invoice.total)}
                        </span>
                      </Td>
                      <Td>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => openEditModal(invoice)}
                            style={secondaryButtonStyle}
                          >
                            {isArabic ? "تعديل" : "Edit"}
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            style={dangerButtonStyle}
                          >
                            {isArabic ? "حذف" : "Delete"}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "1100px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "24px",
              padding: "20px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {editingInvoiceId
                    ? isArabic
                      ? "تعديل الفاتورة"
                      : "Edit Invoice"
                    : isArabic
                    ? "إنشاء فاتورة"
                    : "Create Invoice"}
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                >
                  {isArabic
                    ? "أدخل بيانات الفاتورة وبنودها وبيانات الشحن"
                    : "Enter invoice, items, and shipment details"}
                </div>
              </div>

              <button onClick={closeModal} style={secondaryButtonStyle}>
                {isArabic ? "إغلاق" : "Close"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <Field label={isArabic ? "العميل" : "Client"}>
                <select
                  value={form.clientId}
                  onChange={(e) => updateForm("clientId", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">{isArabic ? "اختر العميل" : "Select client"}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={isArabic ? "تاريخ الإصدار" : "Issue Date"}>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => updateForm("issueDate", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "تاريخ الاستحقاق" : "Due Date"}>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateForm("dueDate", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "الحالة" : "Status"}>
                <select
                  value={form.status}
                  onChange={(e) => updateForm("status", e.target.value)}
                  style={inputStyle}
                >
                  <option value="draft">{getStatusLabel("draft")}</option>
                  <option value="issued">{getStatusLabel("issued")}</option>
                  <option value="paid">{getStatusLabel("paid")}</option>
                  <option value="pending">{getStatusLabel("pending")}</option>
                  <option value="overdue">{getStatusLabel("overdue")}</option>
                  <option value="cancelled">{getStatusLabel("cancelled")}</option>
                </select>
              </Field>

              <Field label={isArabic ? "الضريبة %" : "Tax %"}>
                <input
                  type="number"
                  step="0.01"
                  value={form.taxRate}
                  onChange={(e) => updateForm("taxRate", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "الدفعة المقدمة" : "Advance Payment"}>
                <input
                  type="number"
                  step="0.01"
                  value={form.advancePayment}
                  onChange={(e) => updateForm("advancePayment", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "مرجع الشحنة" : "Shipment Ref"}>
                <input
                  value={form.shipmentRef}
                  onChange={(e) => updateForm("shipmentRef", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "رقم بوليصة الشحن" : "Bill of Lading"}>
                <input
                  value={form.billOfLading}
                  onChange={(e) => updateForm("billOfLading", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "عدد الطرود" : "Package Count"}>
                <input
                  type="number"
                  value={form.packageCount}
                  onChange={(e) => updateForm("packageCount", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "وزن الشحنة" : "Shipment Weight"}>
                <input
                  type="number"
                  step="0.001"
                  value={form.shipmentWeight}
                  onChange={(e) => updateForm("shipmentWeight", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label={isArabic ? "منفذ الدخول" : "Port of Entry"}>
                <input
                  value={form.portOfEntry}
                  onChange={(e) => updateForm("portOfEntry", e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <Field label={isArabic ? "ملاحظات" : "Notes"}>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: "96px",
                    resize: "vertical",
                  }}
                />
              </Field>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: "18px",
                border: "1px solid #e5e7eb",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "16px",
                    color: "#0f172a",
                  }}
                >
                  {isArabic ? "بنود الفاتورة" : "Invoice Items"}
                </div>

                <button onClick={addItem} style={secondaryButtonStyle}>
                  {isArabic ? "إضافة بند" : "Add Item"}
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "720px",
                    background: "white",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <Th>{isArabic ? "الوصف" : "Description"}</Th>
                      <Th>{isArabic ? "الكمية" : "Qty"}</Th>
                      <Th>{isArabic ? "سعر الوحدة" : "Unit Price"}</Th>
                      <Th>{isArabic ? "الإجمالي" : "Total"}</Th>
                      <Th>{isArabic ? "إزالة" : "Remove"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <tr key={index}>
                        <Td>
                          <input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            style={inputStyle}
                          />
                        </Td>
                        <Td>
                          <input
                            type="number"
                            step="0.001"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                            style={inputStyle}
                          />
                        </Td>
                        <Td>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                            style={inputStyle}
                          />
                        </Td>
                        <Td>
                          <div style={{ fontWeight: 700 }}>
                            {formatCurrency(item.total)}
                          </div>
                        </Td>
                        <Td>
                          <button onClick={() => removeItem(index)} style={dangerButtonStyle}>
                            {isArabic ? "حذف" : "Remove"}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <SummaryCard
                title={isArabic ? "المجموع الفرعي" : "Subtotal"}
                value={formatCurrency(formSubtotal)}
              />
              <SummaryCard
                title={isArabic ? "قيمة الضريبة" : "Tax Amount"}
                value={formatCurrency(formTaxAmount)}
              />
              <SummaryCard
                title={isArabic ? "الدفعة المقدمة" : "Advance"}
                value={formatCurrency(Number(form.advancePayment || 0))}
              />
              <SummaryCard
                title={isArabic ? "الإجمالي النهائي" : "Grand Total"}
                value={formatCurrency(formGrandTotal)}
              />
            </div>

            {errorMessage ? (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#b91c1c",
                  border: "1px solid rgba(239, 68, 68, 0.16)",
                }}
              >
                {errorMessage}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button onClick={closeModal} style={secondaryButtonStyle}>
                {isArabic ? "إلغاء" : "Cancel"}
              </button>

              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                {saving
                  ? isArabic
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingInvoiceId
                  ? isArabic
                    ? "حفظ التعديلات"
                    : "Save Changes"
                  : isArabic
                  ? "إنشاء الفاتورة"
                  : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "18px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontSize: "22px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "14px",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontSize: "18px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#334155",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        padding: "14px 12px",
        borderBottom: "1px solid #e5e7eb",
        color: "#334155",
        fontSize: "13px",
        fontWeight: 800,
        textAlign: "start",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td
      style={{
        padding: "14px 12px",
        borderTop: "1px solid #f1f5f9",
        color: "#0f172a",
        fontSize: "13px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid #dbe2ea",
  background: "white",
  fontSize: "13px",
  boxSizing: "border-box",
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "white",
  borderRadius: "12px",
  padding: "11px 16px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #dbe2ea",
  background: "white",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  border: "1px solid rgba(239, 68, 68, 0.18)",
  background: "rgba(239, 68, 68, 0.08)",
  color: "#b91c1c",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};
