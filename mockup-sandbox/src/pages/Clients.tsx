import { useEffect, useState, type CSSProperties } from "react";

type Lang = "ar" | "en";

type Client = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type NewClientForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
};

const API_BASE =
  ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";

function getApiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export default function Clients({ lang }: { lang: Lang }) {
  const isArabic = lang === "ar";

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [newClient, setNewClient] = useState<NewClientForm>({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
  });

  async function loadClients() {
    try {
      setLoading(true);
      setErrorMessage("");
  
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No auth token found");
      }
  
      const res = await fetch(getApiUrl("/api/clients"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok) {
        throw new Error(`Failed to load clients: ${res.status}`);
      }
  
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setClients([]);
      setErrorMessage(
        isArabic ? "تعذر تحميل العملاء من الخادم" : "Failed to load clients from server"
      );
    } finally {
      setLoading(false);
    }
  }

    useEffect(() => {
    void loadClients();
  }, []);
  async function createClient() {
    if (!newClient.name.trim()) {
      setErrorMessage(isArabic ? "اسم العميل مطلوب" : "Client name is required");
      return;
    }
  
    try {
      setSaving(true);
      setErrorMessage("");
  
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No auth token found");
      }
  
      const res = await fetch(getApiUrl("/api/clients"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newClient.name.trim(),
          email: newClient.email.trim() || null,
          phone: newClient.phone.trim() || null,
          address: newClient.address.trim() || null,
          taxId: newClient.taxId.trim() || null,
          notes: newClient.notes.trim() || null,
        }),
      });
  
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create client");
      }
  
      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        taxId: "",
        notes: "",
      });
  
      await loadClients();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        isArabic ? "تعذر حفظ العميل" : "Failed to save client"
      );
    } finally {
      setSaving(false);
    }
  }
  
  async function deleteClient(id: number) {
    const confirmed = window.confirm(
      isArabic ? "هل تريد حذف هذا العميل؟" : "Do you want to delete this client?"
    );
  
    if (!confirmed) return;
  
    try {
      setErrorMessage("");
  
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No auth token found");
      }
  
      const res = await fetch(getApiUrl(`/api/clients/${id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(text || "Failed to delete client");
      }
  
      await loadClients();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        isArabic ? "تعذر حذف العميل" : "Failed to delete client"
      );
    }
  }

  const filteredClients = clients.filter((client) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return (
      (client.name || "").toLowerCase().includes(q) ||
      (client.email || "").toLowerCase().includes(q) ||
      (client.phone || "").toLowerCase().includes(q) ||
      (client.taxId || "").toLowerCase().includes(q)
    );
  });

  function formatDate(value?: string) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(isArabic ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
      }}
    >
      <div
        style={{
          fontSize: "24px",
          fontWeight: 800,
          marginBottom: "20px",
          color: "#0f172a",
        }}
      >
        {isArabic ? "العملاء" : "Clients"}
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "18px",
          padding: "18px",
          marginBottom: "20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          border: "1px solid #e5e7eb",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isArabic ? "بحث عن عميل..." : "Search client..."}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "18px",
          padding: "18px",
          marginBottom: "24px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: "14px",
            color: "#0f172a",
            fontSize: "16px",
          }}
        >
          {isArabic ? "إضافة عميل" : "Add Client"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: "12px",
          }}
        >
          <input
            placeholder={isArabic ? "اسم العميل" : "Client name"}
            value={newClient.name}
            onChange={(e) =>
              setNewClient({ ...newClient, name: e.target.value })
            }
            style={inputStyle}
          />

          <input
            placeholder={isArabic ? "البريد الإلكتروني" : "Email"}
            value={newClient.email}
            onChange={(e) =>
              setNewClient({ ...newClient, email: e.target.value })
            }
            style={inputStyle}
          />

          <input
            placeholder={isArabic ? "الهاتف" : "Phone"}
            value={newClient.phone}
            onChange={(e) =>
              setNewClient({ ...newClient, phone: e.target.value })
            }
            style={inputStyle}
          />

          <input
            placeholder={isArabic ? "الرقم الضريبي" : "Tax ID"}
            value={newClient.taxId}
            onChange={(e) =>
              setNewClient({ ...newClient, taxId: e.target.value })
            }
            style={inputStyle}
          />

          <input
            placeholder={isArabic ? "العنوان" : "Address"}
            value={newClient.address}
            onChange={(e) =>
              setNewClient({ ...newClient, address: e.target.value })
            }
            style={inputStyle}
          />

          <input
            placeholder={isArabic ? "ملاحظات" : "Notes"}
            value={newClient.notes}
            onChange={(e) =>
              setNewClient({ ...newClient, notes: e.target.value })
            }
            style={inputStyle}
          />
        </div>

        <button
          onClick={createClient}
          disabled={saving}
          style={{
            marginTop: "14px",
            padding: "12px 18px",
            border: "none",
            borderRadius: "12px",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving
            ? isArabic
              ? "جاري الحفظ..."
              : "Saving..."
            : isArabic
            ? "حفظ العميل"
            : "Save Client"}
        </button>
      </div>

      {errorMessage ? (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 14px",
            borderRadius: "12px",
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
          background: "white",
          borderRadius: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        {loading ? (
          <div style={{ padding: "24px", color: "#64748b" }}>
            {isArabic ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                }}
              >
                <th style={thStyle}>{isArabic ? "الاسم" : "Name"}</th>
                <th style={thStyle}>{isArabic ? "البريد" : "Email"}</th>
                <th style={thStyle}>{isArabic ? "الهاتف" : "Phone"}</th>
                <th style={thStyle}>{isArabic ? "الرقم الضريبي" : "Tax ID"}</th>
                <th style={thStyle}>{isArabic ? "تاريخ الإضافة" : "Created"}</th>
                <th style={thStyle}>{isArabic ? "إجراء" : "Action"}</th>
              </tr>
            </thead>

            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={emptyStyle}>
                    {isArabic ? "لا يوجد عملاء" : "No clients found"}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td style={tdStyle}>{client.name}</td>
                    <td style={tdStyle}>{client.email || "-"}</td>
                    <td style={tdStyle}>{client.phone || "-"}</td>
                    <td style={tdStyle}>{client.taxId || "-"}</td>
                    <td style={tdStyle}>{formatDate(client.createdAt)}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deleteClient(client.id)}
                        style={{
                          border: "none",
                          background: "#ef4444",
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {isArabic ? "حذف" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const thStyle: CSSProperties = {
  padding: "14px",
  textAlign: "start",
  fontSize: "13px",
  color: "#334155",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: CSSProperties = {
  padding: "14px",
  borderTop: "1px solid #f1f5f9",
  fontSize: "14px",
  color: "#0f172a",
};

const emptyStyle: CSSProperties = {
  padding: "24px",
  textAlign: "center",
  color: "#64748b",
};
