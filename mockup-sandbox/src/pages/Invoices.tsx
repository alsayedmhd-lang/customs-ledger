type Props = {
  lang: "ar" | "en";
};

export default function Invoices({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "الفواتير" : "Invoices"}</h1>
      <p>{isArabic ? "هذه صفحة الفواتير" : "This is the invoices page"}</p>
    </div>
  );
}
