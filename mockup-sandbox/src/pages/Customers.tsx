type Props = {
  lang: "ar" | "en";
};

export default function Customers({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "العملاء" : "Customers"}</h1>
      <p>{isArabic ? "هذه صفحة العملاء" : "This is the customers page"}</p>
    </div>
  );
}
