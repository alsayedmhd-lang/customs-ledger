type Props = {
  lang: "ar" | "en";
};

export default function Dashboard({ lang }: Props) {
  const isArabic = lang === "ar";

  const cards = [
    {
      titleAr: "إجمالي الفواتير",
      titleEn: "Total Invoices",
      value: "3",
      color: "#dbeafe",
      accent: "#3b82f6",
    },
    {
      titleAr: "المستحقات",
      titleEn: "Pending",
      value: "1",
      color: "#fef3c7",
      accent: "#f59e0b",
    },
    {
      titleAr: "عدد الفواتير",
      titleEn: "Invoices Count",
      value: "3",
      color: "#dcfce7",
      accent: "#10b981",
    },
    {
      titleAr: "إجمالي العملاء",
      titleEn: "Total Customers",
      value: "2",
      color: "#ede9fe",
      accent: "#8b5cf6",
    },
  ];

  const bars = [
    { labelAr: "يناير", labelEn: "Jan", height: 90 },
    { labelAr: "فبراير", labelEn: "Feb", height: 150 },
    { labelAr: "مارس", labelEn: "Mar", height: 230 },
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
          background: "linear-gradient(135deg, #081f5c, #1d4ed8)",
          color: "white",
          borderRadius: "24px",
          padding: "28px",
          marginBottom: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "8px" }}>
          {isArabic ? "صباح الخير" : "Good Morning"}
        </div>

        <h1 style={{ margin: 0, fontSize: "36px", fontWeight: 800 }}>
          {isArabic ? "المدير" : "Manager"}
        </h1>

        <p style={{ marginTop: "10px", opacity: 0.9 }}>
          {isArabic
            ? "نظرة عامة على أنشطة التخليص الجمركي"
            : "Overview of customs clearance activities"}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.titleAr}
            style={{
              background: "white",
              borderRadius: "18px",
              padding: "18px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
              border: `1px solid ${card.color}`,
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: card.color,
                marginBottom: "14px",
              }}
            />

            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              {isArabic ? card.titleAr : card.titleEn}
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {card.value}
            </div>

            <div
              style={{
                marginTop: "14px",
                height: "4px",
                borderRadius: "999px",
                background: card.accent,
                opacity: 0.5,
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "24px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "28px", color: "#111827" }}>
              {isArabic ? "الإيرادات الشهرية" : "Monthly Revenue"}
            </h2>

            <div style={{ color: "#6b7280", marginTop: "6px" }}>
              {isArabic ? "آخر 3 أشهر" : "Last 3 months"}
            </div>
          </div>
        </div>

        <div
          style={{
            height: "320px",
            display: "flex",
            alignItems: "end",
            justifyContent: "space-around",
            gap: "20px",
            padding: "20px 10px 10px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          {bars.map((bar) => (
            <div
              key={bar.labelAr}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: `${bar.height}px`,
                  background: "#3b82f6",
                  borderRadius: "14px 14px 0 0",
                }}
              />

              <div style={{ color: "#6b7280", fontSize: "14px" }}>
                {isArabic ? bar.labelAr : bar.labelEn}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
