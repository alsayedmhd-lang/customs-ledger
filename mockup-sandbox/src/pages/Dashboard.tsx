type Props = {
  lang: "ar" | "en";
};

export default function Dashboard({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px", fontFamily: "system-ui" }}>
      <h1>{isArabic ? "لوحة التحكم" : "Dashboard"}</h1>
      <p>{isArabic ? "هذه صفحة لوحة التحكم" : "This is the dashboard page"}</p>
    </div>
  );
}
