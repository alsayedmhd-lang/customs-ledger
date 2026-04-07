import { useState } from "react";

type Step = "login" | "verify" | "dashboard";

export default function App() {
  const [step, setStep] = useState<Step>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");

  const correctCode = ["4", "7", "5", "7", "3", "6"];

  function handleLogin() {
    if (username === "admin" && password === "admin123") {
      setError("");
      setStep("verify");
    } else {
      setError("بيانات الدخول غير صحيحة");
    }
  }

  function handleCodeChange(value: string, index: number) {
    const onlyDigit = value.replace(/\D/g, "").slice(0, 1);
    const updated = [...code];
    updated[index] = onlyDigit;
    setCode(updated);
  }

  function handleVerify() {
    if (JSON.stringify(code) === JSON.stringify(correctCode)) {
      setError("");
      setStep("dashboard");
    } else {
      setError("رمز التحقق غير صحيح");
    }
  }

  if (step === "dashboard") {
    return (
      <div
        dir="rtl"
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        padding: "20px",
        color: "white",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "18px" }}>
        <div style={{ fontSize: "18px", marginBottom: "10px" }}>✈️</div>
        <h1 style={{ margin: 0, fontSize: "42px", fontWeight: 800 }}>
          حول العالم
        </h1>
        <div style={{ color: "#93c5fd", marginTop: "4px" }}>
          للتخليص الجمركي
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
          borderRadius: "22px",
          padding: "30px",
          boxShadow: "0 14px 40px rgba(0,0,0,0.28)",
        }}
      >
        {step === "login" && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: "8px", textAlign: "center" }}>
              تسجيل الدخول
            </h2>
            <p style={{ textAlign: "center", color: "#cbd5e1", marginBottom: "24px" }}>
              أدخل بياناتك للمتابعة
            </p>

            <input
              type="text"
              placeholder="أدخل اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, marginTop: "14px" }}
            />

            {error && (
              <p style={{ color: "#fecaca", fontSize: "14px", marginTop: "12px" }}>
                {error}
              </p>
            )}

            <button onClick={handleLogin} style={buttonStyle}>
              دخول
            </button>
          </>
        )}

        {step === "verify" && (
          <>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "rgba(59,130,246,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
                fontSize: "26px",
              }}
            >
              🛡️
            </div>

            <h2 style={{ marginTop: 0, marginBottom: "8px", textAlign: "center" }}>
              التحقق بخطوتين
            </h2>
            <p style={{ textAlign: "center", color: "#cbd5e1", marginBottom: "22px" }}>
              أدخل الرمز الظاهر أدناه لإتمام تسجيل الدخول
            </p>

            <div
              style={{
                border: "1px solid rgba(250,204,21,0.5)",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "18px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#fde68a", fontSize: "14px", marginBottom: "10px" }}>
                رمز التحقق
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                {correctCode.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      border: "1px solid rgba(250,204,21,0.7)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fde68a",
                      fontWeight: 700,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "18px" }}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  value={digit}
                  onChange={(e) => handleCodeChange(e.target.value, index)}
                  maxLength={1}
                  style={{
                    width: "42px",
                    height: "42px",
                    textAlign: "center",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    fontSize: "20px",
                    fontWeight: 700,
                  }}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: "#fecaca", fontSize: "14px", marginTop: "12px" }}>
                {error}
              </p>
            )}

            <button onClick={handleVerify} style={buttonStyle}>
              تأكيد الرمز
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "18px",
                color: "#93c5fd",
                fontSize: "14px",
              }}
            >
              <button
                onClick={() => setStep("login")}
                style={linkButtonStyle}
              >
                العودة
              </button>
              <button
                onClick={() => {
                  setCode(["", "", "", "", "", ""]);
                  setError("");
                }}
                style={linkButtonStyle}
              >
                إعادة إدخال الرمز
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: "22px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>
        حول العالم للتخليص الجمركي - نظام المحاسبة الداخلي
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontSize: "16px",
  cursor: "pointer",
  marginTop: "12px",
};

const linkButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: "14px",
};
