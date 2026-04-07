import { useState } from "react";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  function handleLogin() {
    if (username === "admin" && password === "admin123") {
      setLoggedIn(true);
      setError("");
    } else {
      setError("بيانات الدخول غير صحيحة");
    }
  }

  if (loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b1f4d",
          color: "white",
          padding: "40px",
          fontFamily: "system-ui",
        }}
      >
        <h1>لوحة التحكم</h1>
        <p>مرحباً بك في نظام حول العالم للتخليص الجمركي</p>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, #1e3a8a, #0b1f4d 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          color: "white",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: "10px",
            fontSize: "30px",
          }}
        >
          حول العالم
        </h1>

        <p
          style={{
            textAlign: "center",
            marginBottom: "24px",
            color: "#cbd5e1",
          }}
        >
          تسجيل الدخول
        </p>

        <input
          type="text"
          placeholder="أدخل اسم المستخدم"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="أدخل كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#fca5a5", fontSize: "14px" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          دخول
        </button>
      </div>
    </div>
  );
}
