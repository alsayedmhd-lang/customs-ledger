type Props = {
  lang: "ar" | "en";
};

export default function Settings({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "الإعدادات" : "Settings"}</h1>
      <p>{isArabic ? "هذه صفحة الإعدادات" : "This is the settings page"}</p>
    </div>
  );
}
