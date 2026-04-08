type Props = {
  lang: "ar" | "en";
};

export default function Tarsh({ lang }: Props) {
  const isArabic = lang === "ar";

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
      <h1 style={{ margin: 0, fontSize: "42px", color: "#111827" }}>
        {isArabic ? "سلة المحذوفات" : "Tarsh"}
      </h1>

      <p style={{ marginTop: "8px", color: "#6b7280" }}>
        {isArabic
          ? "العناصر المحذوفة مؤقتًا تظهر هنا"
          : "Temporarily deleted items appear here"}
      </p>
    </div>
  );
}
