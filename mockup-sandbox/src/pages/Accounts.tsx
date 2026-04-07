type Props = {
  lang: "ar" | "en";
};

export default function Accounts({ lang }: Props) {
  const isArabic = lang === "ar";

  const accounts = [
    {
      code: "1110",
      nameAr: "الصندوق",
      nameEn: "Cash صندوق",
      typeAr: "أصل",
      typeEn: "Asset",
      balance: "QR 1,029.00",
    },
    {
      code: "1120",
      nameAr: "البنك",
      nameEn: "Bank البنك",
      typeAr: "أصل",
      typeEn: "Asset",
      balance: "QR 0.00",
    },
    {
      code: "1130",
      nameAr: "العملاء",
      nameEn: "Customers العملاء",
      typeAr: "أصل",
      typeEn: "Asset",
      balance: "QR 350.00",
    },
    {
      code: "4110",
      nameAr: "إيرادات خدمات التخليص الجمركي",
      nameEn: "Customs Services Revenue",
      typeAr: "إيراد",
      typeEn: "Revenue",
      balance: "QR 1,379.00",
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
            {isArabic ? "الحسابات" : "Accounts"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة شجرة الحسابات والمراكز المالية"
              : "Manage chart of accounts and balances"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              color: "#334155",
              borderRadius: "14px",
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            {isArabic ? "إظهار الأرقام" : "Show Numbers"}
          </button>

          <button
            style={{
              border: "none",
              background: "#2563eb",
              color: "white",
              borderRadius: "14px",
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
              boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
            }}
          >
            {isArabic ? "+ حساب جديد" : "+ New Account"}
          </button>
        </div>
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
          title={isArabic ? "إجمالي الحسابات" : "Total Accounts"}
          value="4"
          color="#dbeafe"
        />
        <StatCard
          title={isArabic ? "إجمالي الأصول" : "Total Assets"}
          value="QR 1,379.00"
          color="#dcfce7"
        />
        <StatCard
          title={isArabic ? "إجمالي الإيرادات" : "Total Revenue"}
          value="QR 1,379.00"
          color="#ede9fe"
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
                ? "بحث برقم الحساب أو الاسم أو النوع..."
                : "Search by account code, name, or type..."
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
                <th style={thStyle}>{isArabic ? "الرمز" : "Code"}</th>
                <th style={thStyle}>{isArabic ? "اسم الحساب" : "Account Name"}</th>
                <th style={thStyle}>{isArabic ? "النوع" : "Type"}</th>
                <th style={thStyle}>{isArabic ? "الرصيد" : "Balance"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((account) => (
                <tr key={account.code} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#2563eb", fontWeight: 600 }}>
                      {account.code}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {isArabic ? account.nameAr : account.nameEn}
                  </td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        background:
                          (isArabic ? account.typeAr : account.typeEn) ===
                          (isArabic ? "أصل" : "Asset")
                            ? "#dbeafe"
                            : "#ede9fe",
                        color:
                          (isArabic ? account.typeAr : account.typeEn) ===
                          (isArabic ? "أصل" : "Asset")
                            ? "#1d4ed8"
                            : "#7c3aed",
                      }}
                    >
                      {isArabic ? account.typeAr : account.typeEn}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <strong>{account.balance}</strong>
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
                <td style={tdStyle} colSpan={3}>
                  <strong>{isArabic ? "الإجمالي" : "Total"}</strong>
                </td>
                <td style={tdStyle}>
                  <strong>QR 2,758.00</strong>
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
