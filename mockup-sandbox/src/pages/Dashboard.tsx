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
      icon: "📄",
    },
    {
      titleAr: "المستحقات",
      titleEn: "Pending",
      value: "1",
      color: "#fef3c7",
      accent: "#f59e0b",
      icon: "⏳",
    },
    {
      titleAr: "عدد الفواتير",
      titleEn: "Invoices Count",
      value: "3",
      color: "#dcfce7",
      accent: "#10b981",
      icon: "📊",
    },
    {
      titleAr: "إجمالي العملاء",
      titleEn: "Total Customers",
      value: "2",
      color: "#ede9fe",
      accent: "#8b5cf6",
      icon: "👥",
    },
  ];

  const bars = [
    { labelAr: "يناير", labelEn: "Jan", value: 90 },
    { labelAr: "فبراير", labelEn: "Feb", value: 150 },
    { labelAr: "مارس", labelEn: "Mar", value: 230 },
    { labelAr: "أبريل", labelEn: "Apr", value: 180 },
  ];

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
        fontFamily: "system-ui",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #081f5c, #2563eb)",
          color: "white",
          borderRadius: "28px",
          padding: "30px",
          marginBottom: "24px",
          boxShadow: "0 15px 35px rgba(37,99,235,0.25)",
          animation: "fadeIn 0.5s ease",
        }}
      >
        <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "10px" }}>
          {isArabic ? "صباح الخير" : "Good Morning"}
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "42px",
            fontWeight: 900,
            lineHeight: 1.1,
          }}
        >
          {isArabic ? "المدير" : "Manager"}
        </h1>

        <p
          style={{
            marginTop: "12px",
            opacity: 0.9,
            fontSize: "15px",
          }}
        >
          {isArabic
            ? "نظرة عامة على أنشطة التخليص الجمركي"
            : "Overview of customs clearance activities"}
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "18px",
          marginBottom: "24px",
        }}
      >
        {cards.map((card, i) => (
          <div
            key={card.titleAr}
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "20px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
              border: `1px solid ${card.color}`,
              transition: "0.25s",
              animation: `fadeUp ${0.2 + i * 0.1}s ease`,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: card.color,
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              {card.icon}
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                marginBottom: "10px",
              }}
            >
              {isArabic ? card.titleAr : card.titleEn}
            </div>

            <div
              style={{
                fontSize: "34px",
                fontWeight: 800,
                color: "#111827",
              }}
            >
              {card.value}
            </div>

            <div
              style={{
                marginTop: "16px",
                height: "4px",
                borderRadius: "999px",
                background: card.accent,
                opacity: 0.5,
              }}
            />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div
        style={{
          background: "white",
          borderRadius: "24px",
          padding: "26px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "30px",
              color: "#111827",
            }}
          >
            {isArabic ? "الإيرادات الشهرية" : "Monthly Revenue"}
          </h2>

          <div
            style={{
              color: "#64748b",
              marginTop: "6px",
            }}
          >
            {isArabic ? "آخر 4 أشهر" : "Last 4 months"}
          </div>
        </div>

        <div
          style={{
            height: "340px",
            display: "flex",
            alignItems: "end",
            justifyContent: "space-around",
            gap: "20px",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "20px",
          }}
        >
          {bars.map((bar, i) => (
            <div
              key={bar.labelAr}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: `${bar.value}px`,
                  background:
                    "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)",
                  borderRadius: "16px 16px 0 0",
                  transition: "0.5s",
                  animation: `growBar ${0.4 + i * 0.2}s ease`,
                  boxShadow: "0 8px 18px rgba(37,99,235,0.18)",
                }}
              />

              <div
                style={{
                  marginTop: "12px",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                {isArabic ? bar.labelAr : bar.labelEn}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {opacity:0; transform:translateY(12px);}
            to {opacity:1; transform:translateY(0);}
          }

          @keyframes fadeUp {
            from {opacity:0; transform:translateY(20px);}
            to {opacity:1; transform:translateY(0);}
          }

          @keyframes growBar {
            from {height:0;}
          }
        `}
      </style>
    </div>
  );
}
