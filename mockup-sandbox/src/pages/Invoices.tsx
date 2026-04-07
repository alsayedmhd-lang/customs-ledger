type Props = {
  lang: "ar" | "en";
};

export default function Invoices({ lang }: Props) {
  const isArabic = lang === "ar";

  const invoices = [
    {
      number: "INV-2026-0006",
      customer: "VERONA READY MADE",
      dateAr: "3 أبريل 2026",
      dateEn: "Apr 3, 2026",
      statusAr: "مسودة",
      statusEn: "Draft",
      amount: "QR 100.00",
      paid: false,
    },
    {
      number: "INV-2026-0002",
      customer: "VERONA READY MADE",
      dateAr: "3 أبريل 2026",
      dateEn: "Apr 3, 2026",
      statusAr: "مدفوعة",
      statusEn: "Paid",
      amount: "QR 250.00",
      paid: true,
    },
    {
      number: "INV-2026-0001",
      customer: "Buzwair Industrial Gases Factory",
      dateAr: "19 مارس 2026",
      dateEn: "Mar 19, 2026",
      statusAr: "مدفوعة",
      statusEn: "Paid",
      amount: "QR 1,029.00",
      paid: true,
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
            {isArabic ? "الفواتير" : "Invoices"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة فواتير التخليص الجمركي"
              : "Manage customs clearance invoices"}
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
          {isArabic ? "إنشاء فاتورة +" : "+ Create Invoice"}
        </button>
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
                ? "بحث برقم الفاتورة أو العميل أو رقم البيان أو البوليصة..."
                : "Search by invoice, customer, declaration, or policy..."
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
              minWidth: "850px",
            }}
          >
            <thead>
              <tr style={{ color: "#6b7280", fontSize: "14px" }}>
                <th style={thStyle}>{isArabic ? "رقم الفاتورة" : "Invoice No."}</th>
                <th style={thStyle}>{isArabic ? "العميل" : "Customer"}</th>
                <th style={thStyle}>{isArabic ? "التاريخ" : "Date"}</th>
                <th style={thStyle}>{isArabic ? "الحالة" : "Status"}</th>
                <th style={thStyle}>{isArabic ? "الإجمالي" : "Total"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.number} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#2563eb", fontWeight: 600 }}>
                      {invoice.number}
                    </span>
                  </td>

                  <td style={tdStyle}>{invoice.customer}</td>

                  <td style={tdStyle}>
                    {isArabic ? invoice.dateAr : invoice.dateEn}
                  </td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        background: invoice.paid ? "#dcfce7" : "#e5e7eb",
                        color: invoice.paid ? "#15803d" : "#475569",
                      }}
                    >
                      {isArabic ? invoice.statusAr : invoice.statusEn}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <strong>{invoice.amount}</strong>
                  </td>

                  <td style={tdStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: isArabic ? "flex-start" : "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <button style={iconButtonStyle}>
                        {isArabic ? "طباعة" : "Print"}
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
                  <strong>{isArabic ? "إجمالي 3 فواتير" : "Total 3 invoices"}</strong>
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
