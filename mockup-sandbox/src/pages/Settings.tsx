type Props = {
  lang: "ar" | "en";
};

type Section = "identity" | "contact" | "legal" | "notifications" | "printing";

export default function Settings({ lang }: Props) {
  const isArabic = lang === "ar";
  const activeSection: Section = "identity";

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
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div style={{ textAlign: isArabic ? "right" : "left" }}>
          <h1 style={{ margin: 0, fontSize: "42px", color: "#111827" }}>
            {isArabic ? "إعدادات البرنامج" : "App Settings"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "تحكم كامل في هوية الشركة وإعدادات الطباعة"
              : "Full control over company identity and printing settings"}
          </p>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "16px 20px",
            minWidth: "180px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            textAlign: isArabic ? "right" : "left",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>
            {isArabic ? "المدير" : "Admin"}
          </div>
          <div style={{ color: "#6b7280", fontSize: "14px" }}>
            {isArabic ? "مدير" : "Administrator"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isArabic ? "row-reverse" : "row",
          gap: "20px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "320px" }}>
          <MainPanel isArabic={isArabic} />
        </div>

        <div style={{ width: "280px", minWidth: "260px" }}>
          <SidePanel isArabic={isArabic} activeSection={activeSection} />
        </div>
      </div>
    </div>
  );
}

function MainPanel({ isArabic }: { isArabic: boolean }) {
  return (
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
          fontSize: "22px",
          fontWeight: 800,
          color: "#111827",
          marginBottom: "18px",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {isArabic ? "هوية الشركة" : "Company Identity"}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <Field
          isArabic={isArabic}
          label={isArabic ? "اسم الشركة (عربي)" : "Company Name (Arabic)"}
          value="حول العالم للتخليص الجمركي"
        />
        <Field
          isArabic={isArabic}
          label={isArabic ? "اسم الشركة (إنجليزي)" : "Company Name (English)"}
          value="Around The World Customs Clearance"
        />
        <Field
          isArabic={isArabic}
          label={isArabic ? "الترجمة الثانوية (عربي)" : "Secondary Text (Arabic)"}
          value="التخليص الجمركي"
        />
        <Field
          isArabic={isArabic}
          label={isArabic ? "الترجمة الثانوية (إنجليزي)" : "Secondary Text (English)"}
          value="Customs Clearance"
        />
        <Field
          isArabic={isArabic}
          label={isArabic ? "الوصف (عربي)" : "Description (Arabic)"}
          value="خدمات التخليص الجمركي والشحن"
        />
        <Field
          isArabic={isArabic}
          label={isArabic ? "الوصف (إنجليزي)" : "Description (English)"}
          value="Customs Clearance & Shipping Services"
        />
      </div>

      <div
        style={{
          marginTop: "18px",
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          color: "#2563eb",
          borderRadius: "14px",
          padding: "14px 16px",
          fontSize: "14px",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {isArabic
          ? "جميع التغييرات تطبق فورًا في كامل البرنامج وصفحات الطباعة عند الحفظ دون الحاجة لإعادة تشغيل."
          : "All changes are applied instantly across the app and print pages after saving, without restart."}
      </div>
    </div>
  );
}

function SidePanel({
  isArabic,
  activeSection,
}: {
  isArabic: boolean;
  activeSection: Section;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "16px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <SectionButton
          isArabic={isArabic}
          active={activeSection === "identity"}
          title={isArabic ? "هوية الشركة" : "Company Identity"}
        />
        <SectionButton
          isArabic={isArabic}
          active={activeSection === "contact"}
          title={isArabic ? "التواصل" : "Contact"}
        />
        <SectionButton
          isArabic={isArabic}
          active={activeSection === "legal"}
          title={isArabic ? "القانونية" : "Legal"}
        />
        <SectionButton
          isArabic={isArabic}
          active={activeSection === "notifications"}
          title={isArabic ? "الإشعارات" : "Notifications"}
        />
        <SectionButton
          isArabic={isArabic}
          active={activeSection === "printing"}
          title={isArabic ? "الطباعة" : "Printing"}
        />
      </div>

      <button
        style={{
          border: "none",
          background: "#2563eb",
          color: "white",
          borderRadius: "14px",
          padding: "14px 16px",
          cursor: "pointer",
          fontWeight: 700,
          boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
        }}
      >
        {isArabic ? "حفظ التغييرات" : "Save Changes"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  isArabic,
}: {
  label: string;
  value: string;
  isArabic: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "14px",
          color: "#6b7280",
          marginBottom: "8px",
          textAlign: isArabic ? "right" : "left",
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
          textAlign: isArabic ? "right" : "left",
          direction: isArabic ? "rtl" : "ltr",
        }}
      />
    </div>
  );
}

function SectionButton({
  title,
  active,
  isArabic,
}: {
  title: string;
  active: boolean;
  isArabic: boolean;
}) {
  return (
    <button
      style={{
        width: "100%",
        textAlign: isArabic ? "right" : "left",
        border: "none",
        borderRadius: "12px",
        padding: "12px 14px",
        marginBottom: "10px",
        background: active ? "#eff6ff" : "transparent",
        color: active ? "#2563eb" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {title}
    </button>
  );
}
