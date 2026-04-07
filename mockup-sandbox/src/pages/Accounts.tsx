type Props = {
  lang: "ar" | "en";
};

export default function Accounts({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "الحسابات" : "Accounts"}</h1>
      <p>{isArabic ? "هذه صفحة الحسابات" : "This is the accounts page"}</p>
    </div>
  );
}
