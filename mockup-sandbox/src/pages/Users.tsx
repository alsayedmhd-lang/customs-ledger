import React, { useEffect, useMemo, useState } from "react";

type Lang = "ar" | "en";

type UserPermissions = {
  canEditInvoices?: boolean;
  canDeleteInvoices?: boolean;
  canEditReceipts?: boolean;
};

type ClientForm = {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  isActive: boolean;
};

const API_BASE = "https://customs-ledger-api.onrender.com";

const emptyForm: ClientForm = {
  name: "",
  companyName: "",
  phone: "",
  email: "",
  taxNumber: "",
  city: "",
  isActive: true,
};

export default function Clients({ lang = "ar" }: { lang?: Lang }) {
  const isArabic = lang === "ar";

  const text = {
    title: isArabic ? "العملاء" : "Clients",
    subtitle: isArabic ? "إدارة قاعدة بيانات العملاء" : "Manage clients database",
    add: isArabic ? "إضافة عميل" : "Add Client",
    edit: isArabic ? "تعديل" : "Edit",
    delete: isArabic ? "حذف" : "Delete",
    save: isArabic ? "حفظ" : "Save",
    cancel: isArabic ? "إلغاء" : "Cancel",
    close: isArabic ? "إغلاق" : "Close",
    refresh: isArabic ? "تحديث" : "Refresh",
    loading: isArabic ? "جاري التحميل..." : "Loading...",
    search: isArabic ? "بحث عن عميل..." : "Search client...",
    noData: isArabic ? "لا يوجد عملاء" : "No clients found",
    unauthorized: isArabic ? "انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا" : "Session expired, please login again",
    failedLoad: isArabic ? "فشل تحميل العملاء" : "Failed to load clients",
    failedSave: isArabic ? "فشل حفظ العميل" : "Failed to save client",
    failedDelete: isArabic ? "فشل حذف العميل" : "Failed to delete client",
    savedOffline: isArabic ? "تم الحفظ محليًا (وضع المدير المؤقت)" : "Saved locally (offline admin mode)",
    confirmDelete: isArabic ? "هل تريد حذف هذا العميل؟" : "Do you want to delete this client?",
    requiredName: isArabic ? "اسم العميل مطلوب" : "Client name is required",
    name: isArabic ? "اسم العميل" : "Client Name",
    company: isArabic ? "الشركة" : "Company",
    phone: isArabic ? "الهاتف" : "Phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
    city: isArabic ? "المدينة" : "City",
    status: isArabic ? "الحالة" : "Status",
    actions: isArabic ? "الإجراءات" : "Actions",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  function normalizeClient(raw: any): Client {
    return {
      id: Number(raw.id),
      name: raw.name ?? "",
      companyName: raw.companyName ?? raw.company_name ?? "",
      phone: raw.phone ?? "",
      email: raw.email ?? "",
      taxNumber: raw.taxNumber ?? raw.tax_number ?? "",
      city: raw.city ?? "",
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
      const offlineMode = localStorage.getItem("offline_mode") === "true";

      if (offlineMode) {
        setClients([]);
        setError("");
        return;
      }

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
    } catch {
      const offlineMode = localStorage.getItem("offline_mode") === "true";
      if (offlineMode) {
        setClients([]);
        setError("");
      } else {
        setClients([]);
        setError(text.failedLoad);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, [lang]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((c) =>
      [c.name, c.companyName, c.phone, c.email, c.taxNumber, c.city]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [clients, search]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id);
    setForm({
      name: client.name || "",
      companyName: client.companyName || "",
      phone: client.phone || "",
      email: client.email || "",
      taxNumber: client.taxNumber || "",
      city: client.city || "",
      isActive: client.isActive ?? true,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
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

    const offlineMode = localStorage.getItem("offline_mode") === "true";

    if (offlineMode) {
      const localClient: Client = {
        id: editingId ?? Date.now(),
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        taxNumber: form.taxNumber.trim(),
        city: form.city.trim(),
        isActive: form.isActive,
        createdAt: new Date().toISOString(),
      };

      if (editingId !== null) {
        setClients((prev) => prev.map((c) => (c.id === editingId ? localClient : c)));
      } else {
        setClients((prev) => [localClient, ...prev]);
      }

      setSaving(false);
      alert(text.savedOffline);
      closeModal();
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("token");
      const isEdit = editingId !== null;

      const payload = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        taxNumber: form.taxNumber.trim(),
        city: form.city.trim(),
        isActive: form.isActive,
      };

      const res = await fetch(
        isEdit ? `${API_BASE}/api/clients/${editingId}` : `${API_BASE}/api/clients`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

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
    } catch {
      alert(text.failedSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(text.confirmDelete)) return;

    const offlineMode = localStorage.getItem("offline_mode") === "true";

    if (offlineMode) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/clients/${id}`, {
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

      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert(text.failedDelete);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            ...cardStyle,
            padding: 24,
            marginBottom: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#111827" }}>{text.title}</div>
            <div style={{ marginTop: 6, color: "#6b7280" }}>{text.subtitle}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={loadClients} style={secondaryButtonStyle}>
              {text.refresh}
            </button>
            <button onClick={openAdd} style={primaryButtonStyle}>
              + {text.add}
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18, marginBottom: 18 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={text.search}
            style={{
              width: "100%",
              maxWidth: 420,
              height: 46,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              outline: "none",
              padding: "0 14px",
              fontSize: 14,
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
        </div>

        <div style={{ ...cardStyle, overflow: "hidden" }}>
          {loading ? (
            <div style={stateStyle}>{text.loading}</div>
          ) : error ? (
            <div style={{ ...stateStyle, color: "#dc2626" }}>{error}</div>
          ) : filteredClients.length === 0 ? (
            <div style={stateStyle}>{text.noData}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 900,
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>{text.name}</th>
                    <th style={thStyle}>{text.company}</th>
                    <th style={thStyle}>{text.phone}</th>
                    <th style={thStyle}>{text.email}</th>
                    <th style={thStyle}>{text.taxNumber}</th>
                    <th style={thStyle}>{text.city}</th>
                    <th style={thStyle}>{text.status}</th>
                    <th style={thStyle}>{text.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>{client.name || "—"}</td>
                      <td style={tdStyle}>{client.companyName || "—"}</td>
                      <td style={tdStyle}>{client.phone || "—"}</td>
                      <td style={tdStyle}>{client.email || "—"}</td>
                      <td style={tdStyle}>{client.taxNumber || "—"}</td>
                      <td style={tdStyle}>{client.city || "—"}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: client.isActive ? "#dcfce7" : "#fee2e2",
                            color: client.isActive ? "#15803d" : "#dc2626",
                          }}
                        >
                          {client.isActive ? text.active : text.inactive}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => openEdit(client)} style={miniButtonStyle}>
                            {text.edit}
                          </button>
                          <button onClick={() => handleDelete(client.id)} style={deleteButtonStyle}>
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

      {modalOpen && (
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
              maxWidth: 820,
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              boxSizing: "border-box",
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
              <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
                {editingId ? text.edit : text.add}
              </div>

              <button onClick={closeModal} style={secondaryButtonStyle}>
                {text.close}
              </button>
            </div>

            <div style={gridStyle}>
              <Field label={text.name}>
                <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.company}>
                <input value={form.companyName} onChange={(e) => updateForm("companyName", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.phone}>
                <input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.email}>
                <input value={form.email} onChange={(e) => updateForm("email", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.taxNumber}>
                <input value={form.taxNumber} onChange={(e) => updateForm("taxNumber", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.city}>
                <input value={form.city} onChange={(e) => updateForm("city", e.target.value)} style={inputStyle} />
              </Field>

              <Field label={text.status}>
                <select
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(e) => updateForm("isActive", e.target.value === "active")}
                  style={inputStyle}
                >
                  <option value="active">{text.active}</option>
                  <option value="inactive">{text.inactive}</option>
                </select>
              </Field>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: 8,
          color: "#374151",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const stateStyle: React.CSSProperties = {
  padding: "34px 20px",
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 600,
};

const thStyle: React.CSSProperties = {
  textAlign: "start",
  padding: "14px 12px",
  color: "#6b7280",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "16px 12px",
  textAlign: "start",
  color: "#111827",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  outline: "none",
  padding: "0 14px",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "0 18px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  padding: "0 16px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const miniButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};ean;
  canDeleteReceipts?: boolean;
  canEditClients?: boolean;
  canDeleteClients?: boolean;
  canManageTemplates?: boolean;
  canViewStatements?: boolean;
  canViewAccounting?: boolean;
  canCustomizePrintContact?: boolean;
};

type UserRow = {
  id: number;
  username: string;
  displayName: string;
  displayNameAr?: string | null;
  displayNameEn?: string | null;
  role: string;
  isActive: boolean;
  pendingApproval: boolean;
  permissions?: UserPermissions | null;
  email?: string | null;
  phone?: string | null;
  createdAt?: string | null;
};

type UserForm = {
  username: string;
  displayName: string;
  displayNameAr: string;
  displayNameEn: string;
  role: string;
  email: string;
  phone: string;
  isActive: boolean;
  pendingApproval: boolean;
};

const API_BASE = "https://customs-ledger-api.onrender.com";

const emptyForm: UserForm = {
  username: "",
  displayName: "",
  displayNameAr: "",
  displayNameEn: "",
  role: "user",
  email: "",
  phone: "",
  isActive: true,
  pendingApproval: false,
};

export default function Users({ lang }: { lang: Lang }) {
  const isArabic = lang === "ar";

  const t = {
    pageTitle: isArabic ? "إدارة المستخدمين" : "Users Management",
    pageSubtitle: isArabic
      ? "إضافة وتعديل وحذف بيانات المستخدمين"
      : "Create, edit and manage system users",
    addUser: isArabic ? "إضافة مستخدم" : "Add User",
    editUser: isArabic ? "تعديل المستخدم" : "Edit User",
    loading: isArabic ? "جاري تحميل المستخدمين..." : "Loading users...",
    refresh: isArabic ? "تحديث" : "Refresh",
    search: isArabic
      ? "بحث باسم المستخدم أو الاسم أو البريد..."
      : "Search by username, name, or email...",
    totalUsers: isArabic ? "إجمالي المستخدمين" : "Total Users",
    activeUsers: isArabic ? "المستخدمون النشطون" : "Active Users",
    pendingUsers: isArabic ? "بانتظار الموافقة" : "Pending Approval",
    admins: isArabic ? "المديرون" : "Admins",
    displayName: isArabic ? "المستخدم" : "User",
    username: isArabic ? "اسم المستخدم" : "Username",
    role: isArabic ? "الدور" : "Role",
    status: isArabic ? "الحالة" : "Status",
    permissions: isArabic ? "الصلاحيات" : "Permissions",
    actions: isArabic ? "الإجراءات" : "Actions",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    phone: isArabic ? "الهاتف" : "Phone",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    pending: isArabic ? "بانتظار الموافقة" : "Pending",
    approved: isArabic ? "معتمد" : "Approved",
    admin: isArabic ? "مدير" : "Admin",
    user: isArabic ? "مستخدم" : "User",
    supervisor: isArabic ? "مشرف" : "Supervisor",
    edit: isArabic ? "تعديل" : "Edit",
    delete: isArabic ? "حذف" : "Delete",
    cancel: isArabic ? "إلغاء" : "Cancel",
    save: isArabic ? "حفظ" : "Save",
    close: isArabic ? "إغلاق" : "Close",
    noUsers: isArabic ? "لا يوجد مستخدمون" : "No users found",
    requiredUsername: isArabic ? "اسم المستخدم مطلوب" : "Username is required",
    requiredDisplayName: isArabic ? "اسم المستخدم الظاهر مطلوب" : "Display name is required",
    failedLoad: isArabic ? "فشل تحميل المستخدمين" : "Failed to load users",
    failedSave: isArabic ? "فشل حفظ المستخدم" : "Failed to save user",
    failedDelete: isArabic ? "فشل حذف المستخدم" : "Failed to delete user",
    confirmDelete: isArabic ? "هل تريد حذف هذا المستخدم؟" : "Do you want to delete this user?",
    sessionExpired: isArabic
      ? "انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا"
      : "Session expired, please login again",
    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    accountInfo: isArabic ? "بيانات الحساب" : "Account Information",
    roleOptions: {
      admin: isArabic ? "مدير" : "Admin",
      user: isArabic ? "مستخدم" : "User",
      supervisor: isArabic ? "مشرف" : "Supervisor",
      accountant: isArabic ? "محاسب" : "Accountant",
      staff: isArabic ? "موظف" : "Staff",
    },
  };

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  function normalizeUser(raw: any): UserRow {
    return {
      id: Number(raw.id),
      username: raw.username ?? "",
      displayName:
        raw.displayName ??
        raw.display_name ??
        raw.displayNameAr ??
        raw.display_name_ar ??
        raw.displayNameEn ??
        raw.display_name_en ??
        raw.username ??
        "",
      displayNameAr: raw.displayNameAr ?? raw.display_name_ar ?? "",
      displayNameEn: raw.displayNameEn ?? raw.display_name_en ?? "",
      role: raw.role ?? "user",
      isActive:
        typeof raw.isActive === "boolean"
          ? raw.isActive
          : typeof raw.is_active === "boolean"
          ? raw.is_active
          : true,
      pendingApproval:
        typeof raw.pendingApproval === "boolean"
          ? raw.pendingApproval
          : typeof raw.pending_approval === "boolean"
          ? raw.pending_approval
          : false,
      permissions: raw.permissions ?? null,
      email: raw.email ?? "",
      phone: raw.phone ?? "",
      createdAt: raw.createdAt ?? raw.created_at ?? "",
    };
  }

  function getRoleLabel(role: string) {
    const value = String(role || "").toLowerCase();
    if (value === "admin") return t.roleOptions.admin;
    if (value === "supervisor") return t.roleOptions.supervisor;
    if (value === "accountant") return t.roleOptions.accountant;
    if (value === "staff") return t.roleOptions.staff;
    return t.roleOptions.user;
  }

  function getDisplayName(user: UserRow) {
    if (isArabic) return user.displayNameAr || user.displayName || user.username;
    return user.displayNameEn || user.displayName || user.username;
  }

  function countPermissions(permissions?: UserPermissions | null) {
    if (!permissions) return 0;
    return Object.values(permissions).filter(Boolean).length;
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

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        setError(t.sessionExpired);
        setUsers([]);
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || t.failedLoad);
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.users)
        ? data.users
        : [];

      setUsers(list.map(normalizeUser));
    } catch (err) {
      setError(t.failedLoad);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [lang]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !q ||
        user.username.toLowerCase().includes(q) ||
        user.displayName.toLowerCase().includes(q) ||
        (user.displayNameAr || "").toLowerCase().includes(q) ||
        (user.displayNameEn || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        (user.phone || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.isActive && !user.pendingApproval) ||
        (statusFilter === "inactive" && !user.isActive) ||
        (statusFilter === "pending" && user.pendingApproval);

      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const pending = users.filter((u) => u.pendingApproval).length;
    const admins = users.filter((u) => String(u.role).toLowerCase() === "admin").length;
    return { total, active, pending, admins };
  }, [users]);

  function openAddModal() {
    setEditingUserId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEditModal(user: UserRow) {
    setEditingUserId(user.id);
    setForm({
      username: user.username || "",
      displayName: user.displayName || "",
      displayNameAr: user.displayNameAr || "",
      displayNameEn: user.displayNameEn || "",
      role: user.role || "user",
      email: user.email || "",
      phone: user.phone || "",
      isActive: user.isActive ?? true,
      pendingApproval: user.pendingApproval ?? false,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(emptyForm);
  }

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.username.trim()) {
      alert(t.requiredUsername);
      return;
    }
  if (!form.displayName.trim()) {
    alert(t.requiredDisplayName);
    return;
  }
  
  const offlineMode = localStorage.getItem("offline_mode") === "true";
  
  if (offlineMode) {
    setSaving(false);
    alert(isArabic ? "تم الحفظ محليًا (وضع المدير المؤقت)" : "Saved locally (offline admin mode)");
    closeModal();
    return;
  }
  
  setSaving(true);
  
  try {
    const token = localStorage.getItem("token");
    const isEdit = editingUserId !== null;

      const payload = {
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        displayNameAr: form.displayNameAr.trim(),
        displayNameEn: form.displayNameEn.trim(),
        role: form.role,
        email: form.email.trim(),
        phone: form.phone.trim(),
        isActive: form.isActive,
        pendingApproval: form.pendingApproval,
      };

      const res = await fetch(
        isEdit ? `${API_BASE}/api/users/${editingUserId}` : `${API_BASE}/api/users`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        alert(t.sessionExpired);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || t.failedSave);
      }

      await loadUsers();
      closeModal();
    } catch (err) {
      alert(t.failedSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        alert(t.sessionExpired);
        return;
      }

      if (!res.ok) {
        throw new Error(t.failedDelete);
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert(t.failedDelete);
    }
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
        background: "#f3f4f6",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "42px",
                lineHeight: 1.15,
                color: "#111827",
                fontWeight: 900,
              }}
            >
              {t.pageTitle}
            </h1>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                color: "#6b7280",
                fontSize: 15,
              }}
            >
              {t.pageSubtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={loadUsers} style={secondaryButtonStyle}>
              {t.refresh}
            </button>
            <button onClick={openAddModal} style={primaryButtonStyle}>
              + {t.addUser}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <StatCard title={t.totalUsers} value={stats.total} color="#dbeafe" />
          <StatCard title={t.activeUsers} value={stats.active} color="#dcfce7" />
          <StatCard title={t.pendingUsers} value={stats.pending} color="#fef3c7" />
          <StatCard title={t.admins} value={stats.admins} color="#ede9fe" />
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 22,
            padding: 20,
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 1fr) 170px",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: 14,
                background: "#f9fafb",
                boxSizing: "border-box",
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive" | "pending")
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: 14,
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              <option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
              <option value="pending">{t.pending}</option>
            </select>
          </div>

          {loading ? (
            <div style={emptyStateStyle}>{t.loading}</div>
          ) : error ? (
            <div style={{ ...emptyStateStyle, color: "#dc2626", fontWeight: 700 }}>{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div style={emptyStateStyle}>{t.noUsers}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1120px",
                }}
              >
                <thead>
                  <tr style={{ color: "#6b7280", fontSize: 14 }}>
                    <th style={thStyle}>{t.displayName}</th>
                    <th style={thStyle}>{t.username}</th>
                    <th style={thStyle}>{t.role}</th>
                    <th style={thStyle}>{t.status}</th>
                    <th style={thStyle}>{t.permissions}</th>
                    <th style={thStyle}>{t.actions}</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const roleValue = String(user.role || "").toLowerCase();
                    const roleBg =
                      roleValue === "admin"
                        ? "#ede9fe"
                        : roleValue === "supervisor"
                        ? "#cffafe"
                        : "#dbeafe";
                    const roleColor =
                      roleValue === "admin"
                        ? "#7c3aed"
                        : roleValue === "supervisor"
                        ? "#0f766e"
                        : "#2563eb";

                    const statusText = user.pendingApproval
                      ? t.pending
                      : user.isActive
                      ? t.active
                      : t.inactive;

                    const statusBg = user.pendingApproval
                      ? "#fef3c7"
                      : user.isActive
                      ? "#dcfce7"
                      : "#fee2e2";

                    const statusColor = user.pendingApproval
                      ? "#b45309"
                      : user.isActive
                      ? "#15803d"
                      : "#dc2626";

                    return (
                      <tr key={user.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800, color: "#111827" }}>
                            {getDisplayName(user)}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                            {user.email || "—"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ color: "#2563eb", fontWeight: 700 }}>{user.username}</div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                            {user.phone || formatDate(user.createdAt)}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: 13,
                              fontWeight: 700,
                              background: roleBg,
                              color: roleColor,
                            }}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: 13,
                              fontWeight: 700,
                              background: statusBg,
                              color: statusColor,
                            }}
                          >
                            {statusText}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: 13,
                              fontWeight: 700,
                              background: "#fff7ed",
                              color: "#c2410c",
                              border: "1px solid #fdba74",
                            }}
                          >
                            {countPermissions(user.permissions)}/10 {isArabic ? "صلاحية" : "Permissions"}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => openEditModal(user)} style={iconButtonStyle}>
                              {t.edit}
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              style={deleteButtonStyle}
                            >
                              {t.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              maxWidth: 900,
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
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                  {editingUserId ? t.editUser : t.addUser}
                </div>
                <div style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
                  {t.pageSubtitle}
                </div>
              </div>

              <button onClick={closeModal} style={secondaryButtonStyle}>
                {t.close}
              </button>
            </div>

            <SectionTitle title={t.basicInfo} />
            <div style={formGridStyle}>
              <InputField
                label={t.username}
                value={form.username}
                onChange={(v) => updateForm("username", v)}
              />
              <InputField
                label={isArabic ? "الاسم الظاهر" : "Display Name"}
                value={form.displayName}
                onChange={(v) => updateForm("displayName", v)}
              />
              <InputField
                label={isArabic ? "الاسم بالعربية" : "Arabic Name"}
                value={form.displayNameAr}
                onChange={(v) => updateForm("displayNameAr", v)}
              />
              <InputField
                label={isArabic ? "الاسم بالإنجليزية" : "English Name"}
                value={form.displayNameEn}
                onChange={(v) => updateForm("displayNameEn", v)}
              />
            </div>

            <SectionTitle title={t.accountInfo} />
            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>{t.role}</label>
                <select
                  value={form.role}
                  onChange={(e) => updateForm("role", e.target.value)}
                  style={inputStyle}
                >
                  <option value="admin">{t.roleOptions.admin}</option>
                  <option value="user">{t.roleOptions.user}</option>
                  <option value="supervisor">{t.roleOptions.supervisor}</option>
                  <option value="accountant">{t.roleOptions.accountant}</option>
                  <option value="staff">{t.roleOptions.staff}</option>
                </select>
              </div>

              <InputField
                label={t.email}
                value={form.email}
                onChange={(v) => updateForm("email", v)}
              />
              <InputField
                label={t.phone}
                value={form.phone}
                onChange={(v) => updateForm("phone", v)}
              />

              <div>
                <label style={labelStyle}>{t.status}</label>
                <select
                  value={
                    form.pendingApproval
                      ? "pending"
                      : form.isActive
                      ? "active"
                      : "inactive"
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "pending") {
                      updateForm("pendingApproval", true);
                      updateForm("isActive", true);
                    } else if (value === "active") {
                      updateForm("pendingApproval", false);
                      updateForm("isActive", true);
                    } else {
                      updateForm("pendingApproval", false);
                      updateForm("isActive", false);
                    }
                  }}
                  style={inputStyle}
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                  <option value="pending">{t.pending}</option>
                </select>
              </div>
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
                {t.cancel}
              </button>
              <button onClick={handleSave} style={primaryButtonStyle} disabled={saving}>
                {saving ? t.loading : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        border: `1px solid ${color}`,
      }}
    >
      <div style={{ color: "#6b7280", marginBottom: "10px", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color: "#111827" }}>{value}</div>
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
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  padding: "34px 20px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 600,
};

const thStyle: React.CSSProperties = {
  textAlign: "start",
  padding: "14px 12px",
  background: "#f8fafc",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "16px 12px",
  textAlign: "start",
  color: "#111827",
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

const primaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  padding: "0 18px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#334155",
  padding: "0 16px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const iconButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};
