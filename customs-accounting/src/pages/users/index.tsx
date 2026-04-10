import { useState } from "react";
import { useAuth, type UserPermissions } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  Users, Plus, Trash2, Pencil, Key, ShieldCheck, User, X, Check,
  FileText, ReceiptText, UserCog, PackageSearch, Shield, Mail, Phone, UserCheck, Clock, KeyRound
} from "lucide-react";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "https://workspaceapi-server-production-0e1f.up.railway.app").replace(/\/$/, "");
interface AppUser {
  id: number;
  username: string;
  displayName: string;
  displayNameAr: string | null;
  displayNameEn: string | null;
  role: string;
  isActive: boolean;
  pendingApproval: boolean;
  permissions: UserPermissions;
  email: string | null;
  phone: string | null;
  whatsappApiKey: string | null;
  createdAt: string;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = sessionStorage.getItem("auth_token");
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers as Record<string, string>),
    },
  });
}

type PermKey = keyof UserPermissions;

const PERM_GROUPS: { label_ar: string; label_en: string; icon: React.ElementType; items: { key: PermKey; label_ar: string; label_en: string }[] }[] = [
  {
    label_ar: "الفواتير", label_en: "Invoices", icon: FileText,
    items: [
      { key: "canEditInvoices", label_ar: "تعديل الفواتير", label_en: "Edit Invoices" },
      { key: "canDeleteInvoices", label_ar: "حذف الفواتير", label_en: "Delete Invoices" },
    ],
  },
  {
    label_ar: "سندات القبض", label_en: "Receipts", icon: ReceiptText,
    items: [
      { key: "canEditReceipts", label_ar: "تعديل السندات", label_en: "Edit Receipts" },
      { key: "canDeleteReceipts", label_ar: "حذف السندات", label_en: "Delete Receipts" },
    ],
  },
  {
    label_ar: "العملاء", label_en: "Clients", icon: Users,
    items: [
      { key: "canEditClients", label_ar: "تعديل العملاء", label_en: "Edit Clients" },
      { key: "canDeleteClients", label_ar: "حذف العملاء", label_en: "Delete Clients" },
    ],
  },
  {
    label_ar: "أخرى", label_en: "Other", icon: PackageSearch,
    items: [
      { key: "canManageTemplates", label_ar: "إدارة النماذج", label_en: "Manage Templates" },
      { key: "canViewStatements", label_ar: "كشوفات الحساب", label_en: "Account Statements" },
      { key: "canViewAccounting", label_ar: "صفحة الحسابات", label_en: "Accounting Page" },
      { key: "canCustomizePrintContact", label_ar: "تخصيص بيانات الاتصال في الطباعة", label_en: "Customize Print Contact Info" },
    ],
  },
];

const DEFAULT_PERMS: UserPermissions = {
  canEditInvoices: true, canDeleteInvoices: true,
  canEditReceipts: true, canDeleteReceipts: true,
  canEditClients: true, canDeleteClients: true,
  canManageTemplates: true, canViewStatements: true,
  canViewAccounting: true, canCustomizePrintContact: false,
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const { lang } = useLanguage();
  const isAR = lang === "ar";

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [pwdId, setPwdId] = useState<number | null>(null);
  const [permId, setPermId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({ username: "", password: "", displayName: "", displayNameAr: "", displayNameEn: "", role: "user" });
  const [editForm, setEditForm] = useState({ displayName: "", displayNameAr: "", displayNameEn: "", role: "user", isActive: true, email: "", phone: "", whatsappApiKey: "" });
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [permForm, setPermForm] = useState<UserPermissions>(DEFAULT_PERMS);
  const [resetResult, setResetResult] = useState<{ userId: number; sent: boolean; visibleCode?: string; maskedEmail: string | null; message: string } | null>(null);

  async function loadUsers() {
    const res = await authFetch(`${API_BASE}/api/users`);
    if (res.ok) { setUsers(await res.json()); setLoaded(true); }
  }

  if (!loaded) { loadUsers(); }

  async function handleActivate(id: number) {
    const res = await authFetch(`${API_BASE}/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: true, pendingApproval: false }),
    });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x));
      flash(isAR ? "تم تفعيل الحساب بنجاح" : "Account activated");
    } else {
      flash(isAR ? "فشل التفعيل" : "Activation failed", true);
    }
  }

  function flash(msg: string, isError = false) {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch(`${API_BASE}/api/users`, { method: "POST", body: JSON.stringify(form) });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => [...prev, u]);
      setShowAdd(false);
      setForm({ username: "", password: "", displayName: "", displayNameAr: "", displayNameEn: "", role: "user" });
      flash(isAR ? "تم إضافة المستخدم" : "User added successfully");
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.message || (isAR ? "فشل الإضافة" : "Failed to add user"), true);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch(`${API_BASE}/api/users/${editId}`, { method: "PATCH", body: JSON.stringify(editForm) });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x));
      setEditId(null);
      flash(isAR ? "تم التعديل" : "User updated");
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.message || (isAR ? "فشل التعديل" : "Update failed"), true);
    }
  }

  async function handleDelete(id: number) {
    const msg = isAR ? "هل أنت متأكد من حذف هذا المستخدم؟" : "Delete this user?";
    if (!confirm(msg)) return;
    const res = await authFetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(x => x.id !== id));
      flash(isAR ? "تم الحذف" : "Deleted");
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.message || (isAR ? "فشل الحذف" : "Delete failed"), true);
    }
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      flash(isAR ? "كلمتا السر غير متطابقتين" : "Passwords do not match", true);
      return;
    }
    const body: Record<string, string> = { newPassword: pwdForm.newPassword };
    if (pwdId === me?.id) body.currentPassword = pwdForm.currentPassword;
    const res = await authFetch(`${API_BASE}/api/users/${pwdId}/change-password`, { method: "PATCH", body: JSON.stringify(body) });
    if (res.ok) {
      setPwdId(null);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      flash(isAR ? "تم تغيير كلمة السر" : "Password changed");
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.message || (isAR ? "فشل تغيير كلمة السر" : "Failed"), true);
    }
  }

  async function handleSavePerms(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch(`${API_BASE}/api/users/${permId}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: permForm }),
    });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x));
      setPermId(null);
      flash(isAR ? "تم حفظ الصلاحيات" : "Permissions saved");
    } else {
      flash(isAR ? "فشل حفظ الصلاحيات" : "Failed to save permissions", true);
    }
  }

  async function handleAdminSendReset(userId: number) {
    const res = await authFetch(`${API_BASE}/api/auth/admin-send-reset/${userId}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setResetResult({ userId, sent: data.sent, visibleCode: data.visibleCode, maskedEmail: data.maskedEmail, message: data.message });
    } else {
      flash(data.message || (isAR ? "فشل إرسال الرمز" : "Failed to send reset code"), true);
    }
  }

  if (me?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-lg">{isAR ? "هذه الصفحة للمديرين فقط" : "Admins only"}</p>
      </div>
    );
  }

  const permUser = users.find(u => u.id === permId);

  return (
    <div className="space-y-6" dir={isAR ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isAR ? "إدارة المستخدمين" : "User Management"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{isAR ? "إضافة وتعديل وحذف حسابات المستخدمين" : "Add, edit, and remove user accounts"}</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium shadow-lg">
          <Plus className="w-4 h-4" />
          {isAR ? "إضافة مستخدم" : "Add User"}
        </button>
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl px-4 py-3 text-sm">{success}</div>}

      {/* Pending Approval Section */}
      {users.some(u => u.pendingApproval) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-amber-800 dark:text-amber-300 text-sm">
              {isAR ? "حسابات في انتظار التفعيل" : "Accounts Pending Activation"}
            </h3>
            <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
              {users.filter(u => u.pendingApproval).length}
            </span>
          </div>
          <div className="space-y-2">
            {users.filter(u => u.pendingApproval).map(u => (
              <div key={u.id} className="flex items-center justify-between bg-white dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{(isAR ? u.displayNameAr : u.displayNameEn) || u.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">@{u.username}</p>
                  {(u.email || u.phone) && (
                    <div className="flex gap-3 mt-1">
                      {u.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>}
                      {u.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleActivate(u.id)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {isAR ? "تفعيل" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/30 text-muted-foreground hover:text-destructive transition-colors"
                    title={isAR ? "رفض الطلب" : "Reject"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[660px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/50 sticky top-0 z-10">
            <tr>
              <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{isAR ? "المستخدم" : "User"}</th>
              <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{isAR ? "اسم المستخدم" : "Username"}</th>
              <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{isAR ? "الدور" : "Role"}</th>
              <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{isAR ? "الحالة" : "Status"}</th>
              <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{isAR ? "الصلاحيات" : "Permissions"}</th>
              <th className="text-end px-5 py-3 font-semibold text-muted-foreground">{isAR ? "الإجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {users.map(u => {
              const perms = u.permissions ?? DEFAULT_PERMS;
              const permCount = u.role === "admin" ? 8 : Object.values(perms).filter(Boolean).length;
              return (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4 font-semibold">{(isAR ? u.displayNameAr : u.displayNameEn) || u.displayName}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-muted-foreground">{u.username}</span>
                    {(u.email || u.phone) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">{isAR ? "تحقق بخطوتين" : "2FA"}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        <ShieldCheck className="w-3 h-3" />
                        {isAR ? "مدير" : "Admin"}
                      </span>
                    ) : u.role === "supervisor" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                        <Shield className="w-3 h-3" />
                        {isAR ? "مشرف" : "Supervisor"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <User className="w-3 h-3" />
                        {isAR ? "مستخدم" : "User"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u.pendingApproval ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Clock className="w-3 h-3" />
                        {isAR ? "في انتظار التفعيل" : "Pending"}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {u.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {u.isActive ? (isAR ? "نشط" : "Active") : (isAR ? "موقوف" : "Suspended")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u.role === "admin" ? (
                      <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        {isAR ? "صلاحيات كاملة" : "Full Access"}
                      </span>
                    ) : (
                      <button
                        onClick={() => { setPermId(u.id); setPermForm(u.permissions ?? DEFAULT_PERMS); }}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors font-medium"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {permCount}/8 {isAR ? "صلاحية" : "perms"}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditId(u.id); setEditForm({ displayName: u.displayName, displayNameAr: u.displayNameAr ?? "", displayNameEn: u.displayNameEn ?? "", role: u.role, isActive: u.isActive, email: u.email ?? "", phone: u.phone ?? "", whatsappApiKey: u.whatsappApiKey ?? "" }); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={isAR ? "تعديل" : "Edit"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPwdId(u.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={isAR ? "تغيير كلمة السر" : "Change Password"}
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      {u.id !== me?.id && (
                        <button
                          onClick={() => handleAdminSendReset(u.id)}
                          className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/30 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          title={isAR ? "إرسال رمز إعادة تعيين كلمة السر" : "Send Password Reset Code"}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title={isAR ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">{isAR ? "لا يوجد مستخدمون" : "No users found"}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title={isAR ? "إضافة مستخدم جديد" : "Add New User"} onClose={() => setShowAdd(false)} isAR={isAR}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={isAR ? "الاسم بالعربية" : "Name in Arabic"}>
                <input value={form.displayNameAr} onChange={e => setForm(p => ({ ...p, displayNameAr: e.target.value, displayName: e.target.value || p.displayNameEn || p.displayName }))} className={inputCls} dir="rtl" placeholder="محمد أحمد" />
              </Field>
              <Field label={isAR ? "الاسم بالإنجليزية" : "Name in English"}>
                <input value={form.displayNameEn} onChange={e => setForm(p => ({ ...p, displayNameEn: e.target.value, displayName: p.displayNameAr || e.target.value || p.displayName }))} className={inputCls} dir="ltr" placeholder="Mohamed Ahmed" />
              </Field>
            </div>
            <Field label={isAR ? "الاسم الكامل (احتياطي)" : "Full Name (fallback)"}>
              <input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} className={inputCls} required placeholder={isAR ? "يُستخدم إن لم يُحدد اسم بالعربية أو الإنجليزية" : "Used if no Arabic/English name is set"} />
            </Field>
            <Field label={isAR ? "اسم المستخدم (للدخول)" : "Username (for login)"}><input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className={inputCls} required /></Field>
            <Field label={isAR ? "كلمة السر" : "Password"}><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputCls} required /></Field>
            <Field label={isAR ? "الدور" : "Role"}>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputCls}>
                <option value="user">{isAR ? "مستخدم" : "User"}</option>
                <option value="supervisor">{isAR ? "مشرف" : "Supervisor"}</option>
                <option value="admin">{isAR ? "مدير" : "Admin"}</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium">{isAR ? "إضافة" : "Add"}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-medium">{isAR ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editId && (
        <Modal title={isAR ? "تعديل المستخدم" : "Edit User"} onClose={() => setEditId(null)} isAR={isAR}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={isAR ? "الاسم بالعربية" : "Name in Arabic"}>
                <input value={editForm.displayNameAr} onChange={e => setEditForm(p => ({ ...p, displayNameAr: e.target.value }))} className={inputCls} dir="rtl" placeholder="محمد أحمد" />
              </Field>
              <Field label={isAR ? "الاسم بالإنجليزية" : "Name in English"}>
                <input value={editForm.displayNameEn} onChange={e => setEditForm(p => ({ ...p, displayNameEn: e.target.value }))} className={inputCls} dir="ltr" placeholder="Mohamed Ahmed" />
              </Field>
            </div>
            <Field label={isAR ? "الاسم الكامل (احتياطي)" : "Full Name (fallback)"}><input value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} className={inputCls} required /></Field>
            <Field label={isAR ? "الدور" : "Role"}>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className={inputCls}>
                <option value="user">{isAR ? "مستخدم" : "User"}</option>
                <option value="supervisor">{isAR ? "مشرف" : "Supervisor"}</option>
                <option value="admin">{isAR ? "مدير" : "Admin"}</option>
              </select>
            </Field>
            <Field label={isAR ? "الحالة" : "Status"}>
              <select value={editForm.isActive ? "true" : "false"} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.value === "true" }))} className={inputCls}>
                <option value="true">{isAR ? "نشط" : "Active"}</option>
                <option value="false">{isAR ? "موقوف" : "Suspended"}</option>
              </select>
            </Field>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isAR ? "بيانات التحقق بخطوتين (اختياري)" : "Two-factor authentication (optional)"}
              </p>
              <div className="space-y-3">
                <Field label={isAR ? "البريد الإلكتروني" : "Email"}>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                      className={inputCls + " pr-9"}
                      placeholder={isAR ? "user@example.com (اختياري)" : "user@example.com (optional)"}
                    />
                  </div>
                </Field>
                <Field label={isAR ? "رقم الهاتف (واتساب)" : "Phone (WhatsApp)"}>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                      className={inputCls + " pr-9"}
                      placeholder={isAR ? "97455251595 (بدون +)" : "97455251595 (no +)"}
                    />
                  </div>
                </Field>
                <Field label={isAR ? "مفتاح واتساب CallMeBot" : "WhatsApp API Key"}>
                  <input
                    type="text"
                    value={editForm.whatsappApiKey}
                    onChange={e => setEditForm(p => ({ ...p, whatsappApiKey: e.target.value }))}
                    className={inputCls}
                    placeholder={isAR ? "المفتاح من CallMeBot (اختياري)" : "From CallMeBot (optional)"}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium">{isAR ? "حفظ" : "Save"}</button>
              <button type="button" onClick={() => setEditId(null)} className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-medium">{isAR ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {pwdId && (
        <Modal title={isAR ? "تغيير كلمة السر" : "Change Password"} onClose={() => setPwdId(null)} isAR={isAR}>
          <form onSubmit={handleChangePwd} className="space-y-4">
            {pwdId === me?.id && (
              <Field label={isAR ? "كلمة السر الحالية" : "Current Password"}><input type="password" value={pwdForm.currentPassword} onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))} className={inputCls} required /></Field>
            )}
            <Field label={isAR ? "كلمة السر الجديدة" : "New Password"}><input type="password" value={pwdForm.newPassword} onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))} className={inputCls} required /></Field>
            <Field label={isAR ? "تأكيد كلمة السر" : "Confirm Password"}><input type="password" value={pwdForm.confirmPassword} onChange={e => setPwdForm(p => ({ ...p, confirmPassword: e.target.value }))} className={inputCls} required /></Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium">{isAR ? "تغيير" : "Change"}</button>
              <button type="button" onClick={() => setPwdId(null)} className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-medium">{isAR ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Permissions Modal */}
      {permId && permUser && (
        <Modal title={isAR ? `صلاحيات: ${(isAR ? permUser.displayNameAr : permUser.displayNameEn) || permUser.displayName}` : `Permissions: ${(isAR ? permUser.displayNameAr : permUser.displayNameEn) || permUser.displayName}`} onClose={() => setPermId(null)} isAR={isAR} wide>
          <form onSubmit={handleSavePerms} className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {isAR ? "حدد ما يمكن لهذا المستخدم فعله في النظام:" : "Define what this user can do in the system:"}
            </p>
            {PERM_GROUPS.map(group => (
              <div key={group.label_ar} className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                  <group.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{isAR ? group.label_ar : group.label_en}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <span className="text-sm text-foreground">{isAR ? item.label_ar : item.label_en}</span>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={permForm[item.key]}
                          onChange={e => setPermForm(p => ({ ...p, [item.key]: e.target.checked }))}
                          className="w-4 h-4 accent-primary cursor-pointer"
                          aria-label={isAR ? item.label_ar : item.label_en}
                        />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${permForm[item.key] ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {permForm[item.key] ? (isAR ? "مفعّل" : "On") : (isAR ? "معطّل" : "Off")}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* Quick actions */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPermForm({ canEditInvoices: true, canDeleteInvoices: true, canEditReceipts: true, canDeleteReceipts: true, canEditClients: true, canDeleteClients: true, canManageTemplates: true, canViewStatements: true, canViewAccounting: true, canCustomizePrintContact: true })}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium"
              >
                {isAR ? "تفعيل الكل" : "Enable All"}
              </button>
              <button
                type="button"
                onClick={() => setPermForm({ canEditInvoices: false, canDeleteInvoices: false, canEditReceipts: false, canDeleteReceipts: false, canEditClients: false, canDeleteClients: false, canManageTemplates: false, canViewStatements: false, canViewAccounting: false, canCustomizePrintContact: false })}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium"
              >
                {isAR ? "تعطيل الكل" : "Disable All"}
              </button>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium">{isAR ? "حفظ الصلاحيات" : "Save Permissions"}</button>
              <button type="button" onClick={() => setPermId(null)} className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-medium">{isAR ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Admin Reset Result Modal */}
      {resetResult && (
        <Modal
          title={isAR ? "إعادة تعيين كلمة المرور" : "Password Reset"}
          onClose={() => setResetResult(null)}
          isAR={isAR}
        >
          <div className="space-y-4 text-center">
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${resetResult.sent ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"}`}>
              {resetResult.message}
              {resetResult.sent && resetResult.maskedEmail && (
                <p className="mt-1 font-bold">{resetResult.maskedEmail}</p>
              )}
            </div>

            {resetResult.visibleCode && (
              <div className="bg-muted rounded-xl px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {isAR ? "رمز إعادة التعيين (للمستخدم)" : "Reset Code (for the user)"}
                </p>
                <div className="flex justify-center gap-2" dir="ltr">
                  {resetResult.visibleCode.split("").map((d, i) => (
                    <span key={i} className="w-10 h-11 flex items-center justify-center bg-background border-2 border-amber-400/60 rounded-xl text-foreground text-xl font-black">{d}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {isAR ? "أعطِ هذا الرمز للمستخدم ليتمكن من إعادة تعيين كلمة المرور من صفحة الدخول." : "Give this code to the user so they can reset their password from the login page."}
                </p>
              </div>
            )}

            <button
              onClick={() => setResetResult(null)}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium"
            >
              {isAR ? "إغلاق" : "Close"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}

function Modal({ title, onClose, children, isAR, wide }: { title: string; onClose: () => void; children: React.ReactNode; isAR: boolean; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isAR ? "rtl" : "ltr"}>
      <div className={`bg-card border border-border rounded-2xl w-full shadow-2xl flex flex-col max-h-[90vh] ${wide ? "max-w-lg" : "max-w-md"}`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
