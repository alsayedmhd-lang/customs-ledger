import { useState } from "react";

type Lang = "ar" | "en";

export default function Login({
  lang,
  onLogin,
}: {
  lang: Lang;
  onLogin: () => void;
}) {
  const isArabic = lang === "ar";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

async function handleLogin() {
  if (!username.trim() || !password.trim()) {
    alert(isArabic ? "أدخل اسم المستخدم وكلمة المرور" : "Enter username and password");
    return;
  }

  try {
    const res = await fetch("https://customs-ledger-api.onrender.com/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      onLogin();
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    alert(isArabic ? "فشل الاتصال بالسيرفر" : "Server connection failed");
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          boxSizing: "border-box",
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
              fontSize: "42px",
              marginBottom: "10px",
            }}
          >
            ✈️
          </div>

          <div
            style={{
              fontSize: "24px",
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
              fontSize: "13px",
            }}
          >
            {isArabic ? "نظام التخليص الجمركي" : "Customs Clearance System"}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
              color: "#334155",
              fontSize: "13px",
              textAlign: isArabic ? "right" : "left",
            }}
          >
            {isArabic ? "اسم المستخدم" : "Username"}
          </label>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={isArabic ? "أدخل اسم المستخدم" : "Enter username"}
            style={{
              width: "100%",
              padding: "13px 14px",
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
              fontSize: "13px",
              textAlign: isArabic ? "right" : "left",
            }}
          >
            {isArabic ? "كلمة المرور" : "Password"}
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isArabic ? "أدخل كلمة المرور" : "Enter password"}
            style={{
              width: "100%",
              padding: "13px 14px",
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
            padding: "13px",
            border: "none",
            borderRadius: "14px",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {isArabic ? "تسجيل الدخول" : "Login"}
        </button>
      </div>
    </div>
  );
}
