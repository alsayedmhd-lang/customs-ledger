type Props = {
  lang: "ar" | "en";
};

export default function Accounts({ lang }: Props) {
  const isArabic = lang === "ar";

  const statements = [
    {
      accountCode: "1130",
      accountNameAr: "العملاء",
      accountNameEn: "Customers",
      opening: "QR 0.00",
      debit: "QR 1,379.00",
      credit: "QR 1,029.00",
      closing: "QR 350.00",
    },
    {
      accountCode: "1110",
      accountNameAr: "الصندوق",
      accountNameEn: "Cash صندوق",
      opening: "QR 0.00",
      debit: "QR 1,029.00",
      credit: "QR 0.00",
      closing: "QR 1,029.00",
    },
    {
      accountCode: "4110",
      accountNameAr: "إيرادات خدمات التخليص الجمركي",
      accountNameEn: "Customs Services Revenue",
      opening: "QR 0.00",
      debit: "QR 0.00",
      credit: "QR 1,379.00",
      closing: "QR 1,379.00",
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
            {isArabic ? "كشف الحسابات" : "Account Statements"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "عرض ملخص حركات الحسابات والأرصدة"
              : "View account movement summaries and balances"}
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
            {isArabic ? "تصدير Excel" : "Export Excel"}
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
            {isArabic ? "طباعة الكشف" : "Print Statement"}
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
          title={isArabic ? "عدد الحسابات" : "Accounts Count"}
          value="3"
          color="#dbeafe"
        />
        <StatCard
          title={isArabic ? "إجمالي المدين" : "Total Debit"}
          value="QR 2,408.00"
          color="#dcfce7"
        />
        <StatCard
          title={isArabic ? "إجمالي الدائن" : "Total Credit"}
          value="QR 2,408.00"
          color="#ede9fe"
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <FilterBox
            label={isArabic ? "من تاريخ" : "From Date"}
            value="2026-01-01"
          />
          <FilterBox
            label={isArabic ? "إلى تاريخ" : "To Date"}
            value="2026-12-31"
          />
          <FilterBox
            label={isArabic ? "الحساب" : "Account"}
            value={isArabic ? "كل الحسابات" : "All Accounts"}
          />
          <FilterBox
            label={isArabic ? "البحث" : "Search"}
            value={isArabic ? "بحث بالاسم أو الرمز" : "Search by name or code"}
          />
        </div>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1100px",
            }}
          >
            <thead>
              <tr style={{ color: "#6b7280", fontSize: "14px" }}>
                <th style={thStyle}>{isArabic ? "رمز الحساب" : "Code"}</th>
                <th style={thStyle}>{isArabic ? "اسم الحساب" : "Account Name"}</th>
                <th style={thStyle}>{isArabic ? "الرصيد الافتتاحي" : "Opening Balance"}</th>
                <th style={thStyle}>{isArabic ? "مدين" : "Debit"}</th>
                <th style={thStyle}>{isArabic ? "دائن" : "Credit"}</th>
                <th style={thStyle}>{isArabic ? "الرصيد الختامي" : "Closing Balance"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {statements.map((row) => (
                <tr key={row.accountCode} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#2563eb", fontWeight: 700 }}>
                      {row.accountCode}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {isArabic ? row.accountNameAr : row.accountNameEn}
                  </td>

                  <td style={tdStyle}>{row.opening}</td>
                  <td style={tdStyle}>{row.debit}</td>
                  <td style={tdStyle}>{row.credit}</td>

                  <td style={tdStyle}>
                    <strong>{row.closing}</strong>
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button style={iconButtonStyle}>
                        {isArabic ? "عرض" : "View"}
                      </button>
                      <button style={iconButtonStyle}>
                        {isArabic ? "طباعة" : "Print"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              <tr style={{ borderTop: "2px solid #cbd5e1", background: "#f8fafc" }}>
                <td style={tdStyle} colSpan={2}>
                  <strong>{isArabic ? "الإجمالي" : "Total"}</strong>
                </td>
                <td style={tdStyle}>
                  <strong>QR 0.00</strong>
                </td>
                <td style={tdStyle}>
                  <strong>QR 2,408.00</strong>
                </td>
                <td style={tdStyle}>
                  <strong>QR 2,408.00</strong>
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

function FilterBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "14px",
          color: "#6b7280",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>

      <input
        value={value}
        readOnly
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "12px",
          border: "1px solid #d1d5db",
          background: "#f8fafc",
          fontSize: "14px",
          boxSizing: "border-box",
        }}
      />
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
