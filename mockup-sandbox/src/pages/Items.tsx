type Props = {
  lang: "ar" | "en";
};

export default function Items({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "نماذج البنود" : "Items Templates"}</h1>
      <p>{isArabic ? "هذه صفحة نماذج البنود" : "This is the items page"}</p>
    </div>
  );
}
