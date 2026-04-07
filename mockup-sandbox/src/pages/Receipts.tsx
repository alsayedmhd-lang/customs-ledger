type Props = {
  lang: "ar" | "en";
};

export default function Receipts({ lang }: Props) {
  const isArabic = lang === "ar";

  const receipts = [
    {
      receiptNo: "RCP-2026-0001",
      customer: "Buzwair Industrial Gases Factory",
      invoice: "INV-2026-0001",
      amount: "QR 1,029.00",
      methodAr: "نقد",
      methodEn: "Cash",
      dateAr: "20 مارس 2026",
      dateEn: "Mar 20, 2026",
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
            {isArabic ? "سندات القبض" : "Receipts"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة سندات القبض والمدفوعات"
              : "Manage receipts and payments"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            style={{
              border: "1px solid #f59e0b",
              background: "#fff7ed",
              color: "#b45309",
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
            {isArabic ? "+ سند قبض جديد" : "+ New Receipt"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "20px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            border: "1px solid #dcfce7",
          }}
        >
          <div style={{ color: "#6b7280", marginBottom: "10px" }}>
            {isArabic ? "عدد السندات" : "Receipts Count"}
          </div>
          <div style={{ fontSize: "34px", fontWeight: 700 }}>1</div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "20px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            border: "1px solid #dcfce7",
          }}
        >
          <div style={{ color: "#6b7280", marginBottom: "10px" }}>
            {isArabic ? "إجمالي المبالغ المقبوضة" : "Total Collected"}
          </div>
          <div style={{ fontSize: "34px", fontWeight: 700 }}>QR 1,029.00</div>
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
                ? "بحث برقم السند أو العميل أو رقم الفاتورة..."
                : "Search by receipt, customer, or invoice..."
            }
            style={{
              width: "100%",
              maxWidth: "420px",
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
              minWidth: "950px",
            }}
          >
            <thead>
              <tr style={{ color: "#6b7280", fontSize: "14px" }}>
                <th style={thStyle}>{isArabic ? "رقم السند" : "Receipt No."}</th>
                <th style={thStyle}>{isArabic ? "العميل" : "Customer"}</th>
                <th style={thStyle}>{isArabic ? "الفاتورة" : "Invoice"}</th>
                <th style={thStyle}>{isArabic ? "المبلغ" : "Amount"}</th>
                <th style={thStyle}>{isArabic ? "طريقة الدفع" : "Payment Method"}</th>
                <th style={thStyle}>{isArabic ? "التاريخ" : "Date"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.receiptNo} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#2563eb", fontWeight: 600 }}>
                      {receipt.receiptNo}
                    </span>
                  </td>

                  <td style={tdStyle}>{receipt.customer}</td>

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
                      {receipt.invoice}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <strong>{receipt.amount}</strong>
                  </td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        background: "#dcfce7",
                        color: "#15803d",
                      }}
                    >
                      {isArabic ? receipt.methodAr : receipt.methodEn}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {isArabic ? receipt.dateAr : receipt.dateEn}
                  </td>

                  <td style={tdStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
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
