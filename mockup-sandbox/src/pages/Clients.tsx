import { useEffect, useState } from "react";

type Lang = "ar" | "en";

type Client = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
};

export default function Clients({ lang }: { lang: Lang }) {
  const isArabic = lang === "ar";

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
  });

  async function loadClients() {
    try {
      setLoading(true);

      const res = await fetch("/api/clients");
      const data = await res.json();

      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function createClient() {
    if (!newClient.name.trim()) return;

    await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newClient),
    });

    setNewClient({
      name: "",
      email: "",
      phone: "",
      address: "",
      taxId: "",
    });

    loadClients();
  }

  async function deleteClient(id: number) {
    await fetch(`/api/clients/${id}`, {
      method: "DELETE",
    });

    loadClients();
  }

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

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
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: "14px",
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
          />

          <input
            placeholder={isArabic ? "البريد الإلكتروني" : "Email"}
            value={newClient.email}
            onChange={(e) =>
              setNewClient({ ...newClient, email: e.target.value })
            }
          />

          <input
            placeholder={isArabic ? "الهاتف" : "Phone"}
            value={newClient.phone}
            onChange={(e) =>
              setNewClient({ ...newClient, phone: e.target.value })
            }
          />

          <input
            placeholder={isArabic ? "الرقم الضريبي" : "Tax ID"}
            value={newClient.taxId}
            onChange={(e) =>
              setNewClient({ ...newClient, taxId: e.target.value })
            }
          />
        </div>

        <button
          onClick={createClient}
          style={{
            marginTop: "14px",
            padding: "12px 18px",
            border: "none",
            borderRadius: "12px",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {isArabic ? "حفظ العميل" : "Save Client"}
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "24px" }}>
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
                <th style={{ padding: "14px" }}>
                  {isArabic ? "الاسم" : "Name"}
                </th>
                <th style={{ padding: "14px" }}>
                  {isArabic ? "البريد" : "Email"}
                </th>
                <th style={{ padding: "14px" }}>
                  {isArabic ? "الهاتف" : "Phone"}
                </th>
                <th style={{ padding: "14px" }}>
                  {isArabic ? "إجراء" : "Action"}
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td style={{ padding: "14px" }}>{client.name}</td>
                  <td style={{ padding: "14px" }}>{client.email || "-"}</td>
                  <td style={{ padding: "14px" }}>{client.phone || "-"}</td>
                  <td style={{ padding: "14px" }}>
                    <button
                      onClick={() => deleteClient(client.id)}
                      style={{
                        border: "none",
                        background: "#ef4444",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        cursor: "pointer",
                      }}
                    >
                      {isArabic ? "حذف" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
