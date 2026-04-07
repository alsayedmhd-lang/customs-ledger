type Props = {
  lang: "ar" | "en";
};

export default function Receipts({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "سندات القبض" : "Receipts"}</h1>
      <p>{isArabic ? "هذه صفحة سندات القبض" : "This is the receipts page"}</p>
    </div>
  );
}
