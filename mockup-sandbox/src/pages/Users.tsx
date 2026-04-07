type Props = {
  lang: "ar" | "en";
};

export default function Users({ lang }: Props) {
  const isArabic = lang === "ar";

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isArabic ? "المستخدمون" : "Users"}</h1>
      <p>{isArabic ? "هذه صفحة المستخدمين" : "This is the users page"}</p>
    </div>
  );
}
