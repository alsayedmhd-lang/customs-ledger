type Props = {
  lang: "ar" | "en";
};

export default function Customers({ lang }: Props) {
  const isArabic = lang === "ar";

  const customers = [
    {
      name: "VERONA READY MADE",
      email: "verona@example.com",
      phone: "+974 5000 1111",
      balance: "QR 350.00",
      invoices: 2,
    },
    {
      name: "Buzwair Industrial Gases Factory",
      email: "buzwair@example.com",
      phone: "+974 5000 2222",
      balance: "QR 1,029.00",
      invoices: 1,
    },
  ];

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
        fontFamily: "system-ui",
        background: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "42px", color: "#111827" }}>
            {isArabic ? "العملاء" : "Customers"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة قاعدة بيانات العملاء"
              : "Manage customer database"}
          </p>
        </div>

        <button
          style={{
            border: "none",
            background: "#2563eb",
            color: "white",
            borderRadius: "14px",
            padding: "14px 18px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
          }}
        >
          {isArabic ? "+ عميل جديد" : "+ New Customer"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title={isArabic ? "إجمالي العملاء" : "Total Customers"}
          value="2"
          color="#dbeafe"
        />
        <StatCard
          title={isArabic ? "إجمالي الأرصدة" : "Total Balances"}
          value="QR 1,379.00"
          color="#dcfce7"
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: isArabic ? "flex-start" : "flex-end",
            marginBottom: "18px",
          }}
        >
          <input
            placeholder={
              isArabic
                ? "بحث بالاسم أو البريد الإلكتروني أو الهاتف..."
                : "Search by name, email, or phone..."
            }
            style={{
              width: "100%",
              maxWidth: "360px",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              outline: "none",
              fontSize: "14px",
              background: "#f9fafb",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "900px",
            }}
          >
            <thead>
              <tr style={{ color: "#6b7280", fontSize: "14px" }}>
                <th style={thStyle}>{isArabic ? "العميل" : "Customer"}</th>
                <th style={thStyle}>{isArabic ? "البريد الإلكتروني" : "Email"}</th>
                <th style={thStyle}>{isArabic ? "الهاتف" : "Phone"}</th>
                <th style={thStyle}>{isArabic ? "عدد الفواتير" : "Invoices"}</th>
                <th style={thStyle}>{isArabic ? "الرصيد" : "Balance"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((customer) => (
                <tr key={customer.name} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{customer.name}</div>
                  </td>

                  <td style={tdStyle}>{customer.email}</td>

                  <td style={tdStyle}>{customer.phone}</td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        borderRadius: "10px",
                        padding: "6px 10px",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      {customer.invoices}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <strong>{customer.balance}</strong>
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button style={iconButtonStyle}>
                        {isArabic ? "عرض" : "View"}
                      </button>
                      <button style={iconButtonStyle}>
                        {isArabic ? "تعديل" : "Edit"}
                      </button>
                      <button style={deleteButtonStyle}>
                        {isArabic ? "حذف" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={tdStyle} colSpan={4}>
                  <strong>{isArabic ? "إجمالي العملاء" : "Total Customers"}</strong>
                </td>
                <td style={tdStyle}>
                  <strong>QR 1,379.00</strong>
                </td>
                <td style={tdStyle}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
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
      <div style={{ color: "#6b7280", marginBottom: "10px" }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

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
};

const iconButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
};
