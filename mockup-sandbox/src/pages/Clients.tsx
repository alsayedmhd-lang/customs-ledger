import React, { useEffect, useMemo, useState } from "react";

type Lang = "ar" | "en";

type Client = {
  id: number;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  commercialRegistration?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type ClientForm = {
  name: string;
  companyName: string;
  phone: string;
  whatsapp: string;
  email: string;
  taxNumber: string;
  commercialRegistration: string;
  address: string;
  city: string;
  country: string;
  contactPerson: string;
  notes: string;
  isActive: boolean;
};

const API_BASE = "https://customs-ledger-api.onrender.com";

const emptyForm: ClientForm = {
  name: "",
  companyName: "",
  phone: "",
  whatsapp: "",
  email: "",
  taxNumber: "",
  commercialRegistration: "",
  address: "",
  city: "",
  country: "",
  contactPerson: "",
  notes: "",
  isActive: true,
};

export default function Clients({
  lang = "ar",
}: {
  lang?: Lang;
}) {
  const isArabic = lang === "ar";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const text = {
    pageTitle: isArabic ? "العملاء" : "Clients",
    pageSubtitle: isArabic ? "إدارة قاعدة بيانات العملاء" : "Manage clients database",
    addClient: isArabic ? "إضافة عميل" : "Add Client",
    editClient: isArabic ? "تعديل العميل" : "Edit Client",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير" : "Export",
    searchPlaceholder: isArabic ? "بحث عن عميل / شركة / هاتف / بريد..." : "Search client / company / phone / email...",
    all: isArabic ? "الكل" : "All",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    totalClients: isArabic ? "إجمالي العملاء" : "Total Clients",
    activeClients: isArabic ? "العملاء النشطون" : "Active Clients",
    inactiveClients: isArabic ? "العملاء غير النشطين" : "Inactive Clients",
    newThisMonth: isArabic ? "عملاء هذا الشهر" : "New This Month",
    clientName: isArabic ? "اسم العميل" : "Client Name",
    companyName: isArabic ? "الشركة" : "Company",
    contactInfo: isArabic ? "بيانات التواصل" : "Contact Info",
    taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
    city: isArabic ? "المدينة" : "City",
    status: isArabic ? "الحالة" : "Status",
    createdAt: isArabic ? "تاريخ الإضافة" : "Created At",
    actions: isArabic ? "الإجراءات" : "Actions",
    noClients: isArabic ? "لا يوجد عملاء" : "No clients found",
    loading: isArabic ? "جاري تحميل العملاء..." : "Loading clients...",
    save: isArabic ? "حفظ" : "Save",
    cancel: isArabic ? "إلغاء" : "Cancel",
    delete: isArabic ? "حذف" : "Delete",
    edit: isArabic ? "تعديل" : "Edit",
    close: isArabic ? "إغلاق" : "Close",
    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Info",
    officialInfo: isArabic ? "البيانات الرسمية" : "Official Info",
    extraInfo: isArabic ? "بيانات إضافية" : "Extra Info",
    phone: isArabic ? "الهاتف" : "Phone",
    whatsapp: isArabic ? "واتساب" : "WhatsApp",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    commercialRegistration: isArabic ? "السجل التجاري" : "Commercial Registration",
    address: isArabic ? "العنوان" : "Address",
    country: isArabic ? "الدولة" : "Country",
    contactPerson: isArabic ? "شخص التواصل" : "Contact Person",
    notes: isArabic ? "ملاحظات" : "Notes",
    activeLabel: isArabic ? "نشط" : "Active",
    inactiveLabel: isArabic ? "غير نشط" : "Inactive",
    addedOn: isArabic ? "أضيف" : "Added",
    failedLoad: isArabic ? "فشل تحميل العملاء" : "Failed to load clients",
    failedSave: isArabic ? "فشل حفظ العميل" : "Failed to save client",
    failedDelete: isArabic ? "فشل حذف العميل" : "Failed to delete client",
    requiredName: isArabic ? "اسم العميل مطلوب" : "Client name is required",
    confirmDelete: isArabic ? "هل تريد حذف هذا العميل؟" : "Do you want to delete this client?",
    unauthorized: isArabic ? "انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا" : "Session expired, please login again",
  };

  function normalizeClient(raw: any): Client {
    return {
      id: Number(raw.id),
      name: raw.name ?? raw.clientName ?? raw.fullName ?? "",
      companyName: raw.companyName ?? raw.company_name ?? "",
      phone: raw.phone ?? "",
      whatsapp: raw.whatsapp ?? raw.whatsApp ?? "",
      email: raw.email ?? "",
      taxNumber: raw.taxNumber ?? raw.tax_number ?? "",
      commercialRegistration: raw.commercialRegistration ?? raw.commercial_registration ?? "",
      address: raw.address ?? "",
      city: raw.city ?? "",
      country: raw.country ?? "",
      contactPerson: raw.contactPerson ?? raw.contact_person ?? "",
      notes: raw.notes ?? "",
      isActive:
        typeof raw.isActive === "boolean"
          ? raw.isActive
          : typeof raw.is_active === "boolean"
          ? raw.is_active
          : true,
      createdAt: raw.createdAt ?? raw.created_at ?? "",
    };
  }

  async function loadClients() {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/clients`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        setError(text.unauthorized);
        setClients([]);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || text.failedLoad);
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.clients)
        ? data.clients
        : [];

      setClients(list.map(normalizeClient));
    } catch (err) {
      setError(text.failedLoad);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, [lang]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !q ||
        client.name?.toLowerCase().includes(q) ||
        client.companyName?.toLowerCase().includes(q) ||
        client.phone?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q) ||
        client.taxNumber?.toLowerCase().includes(q);

      const activeValue = client.isActive ?? true;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && activeValue) ||
        (statusFilter === "inactive" && !activeValue);

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const total = clients.length;
    const active = clients.filter((c) => c.isActive ?? true).length;
    const inactive = total - active;
    const newThisMonth = clients.filter((c) => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    return { total, active, inactive, newThisMonth };
  }, [clients]);

  function openAddModal() {
    setEditingClientId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEditModal(client: Client) {
    setEditingClientId(client.id);
    setForm({
      name: client.name || "",
      companyName: client.companyName || "",
      phone: client.phone || "",
      whatsapp: client.whatsapp || "",
      email: client.email || "",
      taxNumber: client.taxNumber || "",
      commercialRegistration: client.commercialRegistration || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "",
      contactPerson: client.contactPerson || "",
      notes: client.notes || "",
      isActive: client.isActive ?? true,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingClientId(null);
    setForm(emptyForm);
  }

  function updateForm<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert(text.requiredName);
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      const payload = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        taxNumber: form.taxNumber.trim(),
        commercialRegistration: form.commercialRegistration.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        contactPerson: form.contactPerson.trim(),
        notes: form.notes.trim(),
        isActive: form.isActive,
      };

      const isEdit = editingClientId !== null;
      const url = isEdit
        ? `${API_BASE}/api/clients/${editingClientId}`
        : `${API_BASE}/api/clients`;

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        alert(text.unauthorized);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || text.failedSave);
      }

      await loadClients();
      closeModal();
    } catch (err) {
      alert(text.failedSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(clientId: number) {
    const ok = window.confirm(text.confirmDelete);
    if (!ok) return;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/clients/${clientId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        alert(text.unauthorized);
        return;
      }

      if (!res.ok) {
        throw new Error(text.failedDelete);
      }

      setClients((prev) => prev.filter((c) => c.id !== clientId));
    } catch (err) {
      alert(text.failedDelete);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(isArabic ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function exportCsv() {
    const headers = [
      text.clientName,
      text.companyName,
      text.phone,
      text.email,
      text.taxNumber,
      text.city,
      text.status,
      text.createdAt,
    ];

    const rows = filteredClients.map((client) => [
      client.name || "",
      client.companyName || "",
      client.phone || "",
      client.email || "",
      client.taxNumber || "",
      client.city || "",
      client.isActive ?? true ? text.activeLabel : text.inactiveLabel,
      formatDate(client.createdAt),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isArabic ? "clients.csv" : "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: "#0f172a",
                lineHeight: 1.2,
              }}
            >
              {text.pageTitle}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 15,
                color: "#64748b",
              }}
            >
              {text.pageSubtitle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button onClick={loadClients} style={secondaryButtonStyle}>
              {text.refresh}
            </button>
            <button onClick={exportCsv} style={secondaryButtonStyle}>
              {text.export}
            </button>
            <button onClick={openAddModal} style={primaryButtonStyle}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
              <span>{text.addClient}</span>
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <StatsCard title={text.totalClients} value={stats.total} />
          <StatsCard title={text.activeClients} value={stats.active} />
          <StatsCard title={text.inactiveClients} value={stats.inactive} />
          <StatsCard title={text.newThisMonth} value={stats.newThisMonth} />
        </div>

        <div
          style={{
            ...cardStyle,
            padding: "18px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(250px, 1fr) 180px",
              gap: 12,
            }}
          >
            <div
              style={{
                position: "relative",
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={text.searchPlaceholder}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  padding: isArabic ? "0 44px 0 14px" : "0 14px 0 44px",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#fff",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  [isArabic ? "right" : "left"]: 14,
                  color: "#64748b",
                  fontSize: 18,
                }}
              >
                ⌕
              </span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid #cbd5e1",
                outline: "none",
                padding: "0 12px",
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="all">{text.all}</option>
              <option value="active">{text.active}</option>
              <option value="inactive">{text.inactive}</option>
            </select>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "34px 20px",
                textAlign: "center",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              {text.loading}
            </div>
          ) : error ? (
            <div
              style={{
                padding: "34px 20px",
                textAlign: "center",
                color: "#dc2626",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : filteredClients.length === 0 ? (
            <div
              style={{
                padding: "34px 20px",
                textAlign: "center",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              {text.noClients}
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1100,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                    }}
                  >
                    {[
                      text.clientName,
                      text.companyName,
                      text.contactInfo,
                      text.taxNumber,
                      text.city,
                      text.status,
                      text.createdAt,
                      text.actions,
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: isArabic ? "right" : "left",
                          padding: "16px 18px",
                          color: "#475569",
                          fontSize: 14,
                          fontWeight: 800,
                          borderBottom: "1px solid #e2e8f0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: "1px solid #eef2f7",
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                          {client.name || "—"}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                          #{client.id}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ color: "#0f172a", fontWeight: 700 }}>
                          {client.companyName || "—"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={smallInfoStyle}>{client.phone || "—"}</span>
                          <span style={smallInfoStyle}>{client.email || "—"}</span>
                        </div>
                      </td>

                      <td style={tdStyle}>{client.taxNumber || "—"}</td>
                      <td style={tdStyle}>{client.city || "—"}</td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: (client.isActive ?? true) ? "#dcfce7" : "#fee2e2",
                            color: (client.isActive ?? true) ? "#166534" : "#991b1b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {(client.isActive ?? true) ? text.activeLabel : text.inactiveLabel}
                        </span>
                      </td>

                      <td style={tdStyle}>{formatDate(client.createdAt)}</td>

                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => openEditModal(client)}
                            style={miniButtonStyle}
                          >
                            {text.edit}
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            style={miniDeleteButtonStyle}
                          >
                            {text.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 920,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              boxSizing: "border-box",
              boxShadow: "0 25px 60px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  {editingClientId ? text.editClient : text.addClient}
                </div>
                <div
                  style={{
                    color: "#64748b",
                    marginTop: 4,
                    fontSize: 14,
                  }}
                >
                  {text.pageSubtitle}
                </div>
              </div>

              <button onClick={closeModal} style={secondaryButtonStyle}>
                {text.close}
              </button>
            </div>

            <SectionTitle title={text.basicInfo} />
            <div style={formGridStyle}>
              <InputField
                label={text.clientName}
                value={form.name}
                onChange={(v) => updateForm("name", v)}
              />
              <InputField
                label={text.companyName}
                value={form.companyName}
                onChange={(v) => updateForm("companyName", v)}
              />
              <InputField
                label={text.phone}
                value={form.phone}
                onChange={(v) => updateForm("phone", v)}
              />
              <InputField
                label={text.whatsapp}
                value={form.whatsapp}
                onChange={(v) => updateForm("whatsapp", v)}
              />
              <InputField
                label={text.email}
                value={form.email}
                onChange={(v) => updateForm("email", v)}
              />
              <InputField
                label={text.contactPerson}
                value={form.contactPerson}
                onChange={(v) => updateForm("contactPerson", v)}
              />
            </div>

            <SectionTitle title={text.officialInfo} />
            <div style={formGridStyle}>
              <InputField
                label={text.taxNumber}
                value={form.taxNumber}
                onChange={(v) => updateForm("taxNumber", v)}
              />
              <InputField
                label={text.commercialRegistration}
                value={form.commercialRegistration}
                onChange={(v) => updateForm("commercialRegistration", v)}
              />
              <InputField
                label={text.address}
                value={form.address}
                onChange={(v) => updateForm("address", v)}
              />
              <InputField
                label={text.city}
                value={form.city}
                onChange={(v) => updateForm("city", v)}
              />
              <InputField
                label={text.country}
                value={form.country}
                onChange={(v) => updateForm("country", v)}
              />
              <div>
                <label style={labelStyle}>{text.status}</label>
                <select
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(e) => updateForm("isActive", e.target.value === "active")}
                  style={inputStyle}
                >
                  <option value="active">{text.activeLabel}</option>
                  <option value="inactive">{text.inactiveLabel}</option>
                </select>
              </div>
            </div>

            <SectionTitle title={text.extraInfo} />
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{text.notes}</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                rows={4}
                style={{
                  ...inputStyle,
                  height: "auto",
                  resize: "vertical",
                  paddingTop: 12,
                  paddingBottom: 12,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: isArabic ? "flex-start" : "flex-end",
                flexWrap: "wrap",
                marginTop: 20,
              }}
            >
              <button onClick={closeModal} style={secondaryButtonStyle}>
                {text.cancel}
              </button>
              <button onClick={handleSave} style={primaryButtonStyle} disabled={saving}>
                {saving ? text.loading : text.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value }: { title: string; value: number }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        padding: 20,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 30,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 16,
        fontWeight: 900,
        color: "#0f172a",
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      {title}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "16px 18px",
  color: "#334155",
  fontSize: 14,
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  outline: "none",
  padding: "0 14px",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 14,
};

const smallInfoStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  padding: "0 18px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
  padding: "0 16px",
  cursor: "pointer",
};

const miniButtonStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 12,
  padding: "0 12px",
  cursor: "pointer",
};

const miniDeleteButtonStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 700,
  fontSize: 12,
  padding: "0 12px",
  cursor: "pointer",
};
