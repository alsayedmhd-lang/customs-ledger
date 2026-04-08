type Props = {
  lang: "ar" | "en";
};

export default function Items({ lang }: Props) {
  const isArabic = lang === "ar";

  const items = [
    {
      code: "ITM-001",
      nameAr: "خدمة تخليص جمركي",
      nameEn: "Customs Clearance Service",
      categoryAr: "خدمات",
      categoryEn: "Services",
      price: "QR 500.00",
      statusAr: "نشط",
      statusEn: "Active",
    },
    {
      code: "ITM-002",
      nameAr: "رسوم شحن",
      nameEn: "Shipping Fees",
      categoryAr: "خدمات",
      categoryEn: "Services",
      price: "QR 250.00",
      statusAr: "نشط",
      statusEn: "Active",
    },
    {
      code: "ITM-003",
      nameAr: "رسوم تخزين",
      nameEn: "Storage Fees",
      categoryAr: "رسوم",
      categoryEn: "Fees",
      price: "QR 120.00",
      statusAr: "غير نشط",
      statusEn: "Inactive",
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
            {isArabic ? "نماذج البنود" : "Item Templates"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة بنود الفواتير والخدمات والرسوم"
              : "Manage invoice items, services, and fees"}
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
          {isArabic ? "+ بند جديد" : "+ New Item"}
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
          title={isArabic ? "إجمالي البنود" : "Total Items"}
          value="3"
          color="#dbeafe"
        />
        <StatCard
          title={isArabic ? "البنود النشطة" : "Active Items"}
          value="2"
          color="#dcfce7"
        />
        <StatCard
          title={isArabic ? "الخدمات" : "Services"}
          value="2"
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
                ? "بحث بالكود أو الاسم أو التصنيف..."
                : "Search by code, name, or category..."
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
                <th style={thStyle}>{isArabic ? "الكود" : "Code"}</th>
                <th style={thStyle}>{isArabic ? "اسم البند" : "Item Name"}</th>
                <th style={thStyle}>{isArabic ? "التصنيف" : "Category"}</th>
                <th style={thStyle}>{isArabic ? "السعر" : "Price"}</th>
                <th style={thStyle}>{isArabic ? "الحالة" : "Status"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const isActive =
                  (isArabic ? item.statusAr : item.statusEn) ===
                  (isArabic ? "نشط" : "Active");

                return (
                  <tr key={item.code} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#2563eb", fontWeight: 600 }}>
                        {item.code}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {isArabic ? item.nameAr : item.nameEn}
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                        }}
                      >
                        {isArabic ? item.categoryAr : item.categoryEn}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <strong>{item.price}</strong>
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background: isActive ? "#dcfce7" : "#fee2e2",
                          color: isActive ? "#15803d" : "#dc2626",
                        }}
                      >
                        {isArabic ? item.statusAr : item.statusEn}
                      </span>
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
                );
              })}
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
