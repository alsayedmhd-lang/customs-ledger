import { useState } from "react";

type Lang = "ar" | "en";

export default function Login({
  lang,
}: {
  lang: Lang;
}) {
  const isArabic = lang === "ar";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin() {
    if (username && password) {
      localStorage.setItem("token", "logged_in");
      window.location.reload();
    } else {
      alert(isArabic ? "أدخل البيانات" : "Enter credentials");
    }
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "white",
          borderRadius: "24px",
          padding: "36px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              marginBottom: "12px",
            }}
          >
            ✈️
          </div>

          <div
            style={{
              fontSize: "26px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            {isArabic ? "حول العالم" : "Around The World"}
          </div>

          <div
            style={{
              color: "#64748b",
              marginTop: "6px",
              fontSize: "14px",
            }}
          >
            {isArabic
              ? "نظام التخليص الجمركي"
              : "Customs Clearance System"}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
              color: "#334155",
            }}
          >
            {isArabic ? "اسم المستخدم" : "Username"}
          </label>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
              color: "#334155",
            }}
          >
            {isArabic ? "كلمة المرور" : "Password"}
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: "14px",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          {isArabic ? "تسجيل الدخول" : "Login"}
        </button>
      </div>
    </div>
  );
}
