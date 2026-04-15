import { useCompanySettings } from "@/lib/company-settings-context";
import { useState, FormEvent, useRef, KeyboardEvent } from "react";
import { useAuth, type OtpPending } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language-context";
import { Eye, EyeOff, ShieldCheck, RefreshCw, ArrowRight, ArrowLeft, LogIn, UserPlus, CheckCircle, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LOGO = `${import.meta.env.BASE_URL}logo_nobg.png`;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/, "").slice(-1);
    const next = digits.map((d, idx) => (idx === i ? digit : d)).join("");
    onChange(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = digits.map((d, idx) => (idx === i - 1 ? "" : d)).join("");
      onChange(next);
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6).trimEnd());
    if (pasted.length > 0) inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex gap-2 justify-center" dir="ltr" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-11 h-12 text-center text-xl font-bold bg-white/10 border-2 border-white/25 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-300/60 focus:border-blue-300 transition-all placeholder-white/20"
        />
      ))}
    </div>
  );
}

type Mode = "login" | "register" | "otp" | "registered" | "forgot" | "reset-otp" | "new-password";

export default function LoginPage() {
  const { login, verifyOtp, resendOtp } = useAuth();
  const [, setLocation] = useLocation();
  const { lang, setLang } = useLanguage();
  const isAR = lang === "ar";
  const { settings } = useCompanySettings();
  
  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpPending, setOtpPending] = useState<OtpPending | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Register state
  const [reg, setReg] = useState({ displayName: "", username: "", email: "", phone: "", password: "", confirm: "" });
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotUsername, setForgotUsername] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState<string | null>(null);
  const [resetVisibleCode, setResetVisibleCode] = useState<string | undefined>(undefined);
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [passwordChangeToken, setPasswordChangeToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result?.requiresOtp) {
        setOtpPending(result);
        setOtpCode("");
        setMode("otp");
        startResendCooldown();
      } else {
        setLocation("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!otpPending || otpCode.length < 6) return;
    setError("");
    setLoading(true);
    try {
      await verifyOtp(otpPending.otpToken, otpCode);
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "رمز التحقق غير صحيح");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (reg.password !== reg.confirm) {
      setError(isAR ? "كلمتا السر غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (reg.password.length < 6) {
      setError(isAR ? "كلمة السر يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: reg.username.trim().toLowerCase(),
          displayName: reg.displayName.trim(),
          email: reg.email.trim() || undefined,
          phone: reg.phone.trim() || undefined,
          password: reg.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التسجيل");
      setMode("registered");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل التسجيل");
    } finally {
      setLoading(false);
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(interval); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (!otpPending || resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      const result = await resendOtp(otpPending.otpToken);
      setOtpPending(result);
      setOtpCode("");
      startResendCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل إعادة الإرسال");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل الطلب");
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setResetMaskedEmail(data.maskedEmail ?? null);
        setResetVisibleCode(data.visibleCode);
        setResetOtpCode("");
        setMode("reset-otp");
      } else {
        setError(isAR ? "لم يتم إرسال الرمز — تأكد من صحة اسم المستخدم" : "Code not sent — check your username");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل الطلب");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyResetOtp(e: FormEvent) {
    e.preventDefault();
    if (resetOtpCode.length < 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, code: resetOtpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "رمز غير صحيح");
      setPasswordChangeToken(data.passwordChangeToken);
      setNewPassword("");
      setConfirmPassword("");
      setMode("new-password");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "رمز غير صحيح");
      setResetOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(isAR ? "كلمتا السر غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError(isAR ? "كلمة السر يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/set-new-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordChangeToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل تغيير كلمة السر");
      setMode("login");
      setUsername(forgotUsername);
      setPassword("");
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل تغيير كلمة السر");
    } finally {
      setLoading(false);
    }
  }

  function buildContactHint() {
    const parts: string[] = [];
    if (otpPending?.maskedEmail) parts.push(`${isAR ? "البريد" : "email"} ${otpPending.maskedEmail}`);
    if (otpPending?.maskedPhone) parts.push(`${isAR ? "الهاتف" : "phone"} ${otpPending.maskedPhone}`);
    return parts.join(isAR ? " أو " : " or ");
  }

  const inputCls = "w-full px-4 py-3 bg-white/10 border border-white/25 rounded-xl text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all text-sm font-medium";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      dir={isAR ? "rtl" : "ltr"}
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f172a 100%)" }}
    >
      {/* Decorative circles */}
      <div className="absolute top-[-120px] right-[-120px] w-[420px] h-[420px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
      <div className="absolute bottom-[-80px] left-[-80px] w-[320px] h-[320px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
      <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[440px] relative z-10"
      >
        {/* Company Logo & Name */}
        <div className="text-center mb-6">
          <div className="inline-flex flex-col items-center gap-3">
            <img
              src={settings.logoBase64 || LOGO}
              alt="حول العالم للتخليص الجمركي"
              className="w-36 h-36 object-contain drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <div>
              <h1 className="text-3xl font-black text-white leading-tight tracking-wide">{isAR ? settings.nameAr || "حول العالم" : settings.nameEn || "Around The World"}</h1>
              <p className="text-blue-300 font-semibold mt-0.5 text-sm tracking-widest uppercase">{isAR ? "للتخليص الجمركي" : "Customs Clearance"}</p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── LOGIN ── */}
          {mode === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20"><LogIn className="w-5 h-5 text-blue-300" /></div>
                  <h2 className="text-lg font-bold text-white">{isAR ? "تسجيل الدخول" : "Sign In"}</h2>
                </div>
                <button type="button" onClick={() => setLang(isAR ? "en" : "ar")}
                  className="text-white/35 hover:text-white/80 text-xs font-semibold tracking-widest transition-colors uppercase"
                >
                  {isAR ? "EN" : "عربي"}
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "اسم المستخدم" : "Username"}</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} placeholder={isAR ? "أدخل اسم المستخدم" : "Enter username"} autoComplete="username" required dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "كلمة السر" : "Password"}</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pl-12`} placeholder="••••••••" autoComplete="current-password" required />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-l from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{isAR ? "جارٍ التحقق..." : "Signing in..."}</span> : <><LogIn className="w-4 h-4" />{isAR ? "دخول" : "Sign In"}</>}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-white/10 space-y-3 text-center">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setForgotUsername(username); setError(""); }}
                  className="flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200 text-sm font-medium transition-colors mx-auto"
                >
                  <KeyRound className="w-4 h-4" />
                  {isAR ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
                <p className="text-white/40 text-xs">{isAR ? "ليس لديك حساب؟" : "Don't have an account?"}</p>
                <button onClick={() => { setMode("register"); setError(""); }} className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm font-medium transition-colors mx-auto">
                  <UserPlus className="w-4 h-4" />
                  {isAR ? "إنشاء حساب جديد" : "Create new account"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── REGISTER ── */}
          {mode === "register" && (
            <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20"><UserPlus className="w-5 h-5 text-emerald-300" /></div>
                  <h2 className="text-lg font-bold text-white">{isAR ? "إنشاء حساب جديد" : "Create New Account"}</h2>
                </div>
                <button type="button" onClick={() => setLang(isAR ? "en" : "ar")}
                  className="text-white/35 hover:text-white/80 text-xs font-semibold tracking-widest transition-colors uppercase"
                >
                  {isAR ? "EN" : "عربي"}
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "الاسم الكامل" : "Full Name"} <span className="text-red-400">*</span></label>
                  <input type="text" value={reg.displayName} onChange={e => setReg(p => ({ ...p, displayName: e.target.value }))} className={inputCls} placeholder={isAR ? "محمد أحمد" : "John Smith"} required autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "اسم المستخدم (للدخول)" : "Username (for login)"} <span className="text-red-400">*</span></label>
                  <input type="text" value={reg.username} onChange={e => setReg(p => ({ ...p, username: e.target.value }))} className={inputCls} placeholder="mohammed123" required dir="ltr" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "البريد الإلكتروني" : "Email"}</label>
                  <input type="email" value={reg.email} onChange={e => setReg(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="user@example.com" dir="ltr" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "رقم الهاتف" : "Phone Number"}</label>
                  <input type="tel" value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="974XXXXXXXX" dir="ltr" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "كلمة السر" : "Password"} <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showRegPass ? "text" : "password"} value={reg.password} onChange={e => setReg(p => ({ ...p, password: e.target.value }))} className={`${inputCls} pl-10`} placeholder={isAR ? "6 أحرف على الأقل" : "At least 6 characters"} required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowRegPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "تأكيد كلمة السر" : "Confirm Password"} <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showRegConfirm ? "text" : "password"} value={reg.confirm} onChange={e => setReg(p => ({ ...p, confirm: e.target.value }))} className={`${inputCls} pl-10`} placeholder="••••••••" required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowRegConfirm(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (isAR ? "جارٍ التسجيل..." : "Registering...") : <><UserPlus className="w-4 h-4" />{isAR ? "إنشاء الحساب" : "Create Account"}</>}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button onClick={() => { setMode("login"); setError(""); }} className="text-blue-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 mx-auto">
                  {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {isAR ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── REGISTERED SUCCESS ── */}
          {mode === "registered" && (
            <motion.div key="registered" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="bg-emerald-500/20 p-4 rounded-2xl ring-1 ring-emerald-400/30">
                  <CheckCircle className="w-10 h-10 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">{isAR ? "تم إنشاء حسابك بنجاح!" : "Account Created!"}</h2>
                  <p className="text-blue-200 text-sm leading-relaxed">
                    {isAR ? <>حسابك الآن في انتظار <span className="font-bold text-white">تفعيل من قبل المدير</span>.<br />بعد التفعيل ستتمكن من تسجيل الدخول.</> : <>Your account is pending <span className="font-bold text-white">admin approval</span>.<br />You can sign in once it's activated.</>}
                  </p>
                </div>
              </div>
              <button onClick={() => { setMode("login"); setError(""); }}
                className="w-full bg-gradient-to-l from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {isAR ? "العودة لتسجيل الدخول" : "Back to Sign In"}
              </button>
            </motion.div>
          )}

          {/* ── OTP ── */}
          {mode === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="bg-blue-500/20 p-3 rounded-2xl mb-3 ring-1 ring-blue-400/30">
                  <ShieldCheck className="w-8 h-8 text-blue-300" />
                </div>
                <h2 className="text-xl font-bold text-white">{isAR ? "التحقق بخطوتين" : "Two-Step Verification"}</h2>
                {otpPending?.visibleCode ? (
                  <p className="text-blue-200 text-sm text-center mt-2 leading-relaxed">{isAR ? "أدخل الرمز الظاهر أدناه لإتمام تسجيل الدخول" : "Enter the code shown below to complete sign in"}</p>
                ) : (
                  <p className="text-blue-200 text-sm text-center mt-2 leading-relaxed">
                    {isAR ? "تم إرسال رمز التحقق إلى" : "Verification code sent to"} <span className="font-bold text-white">{buildContactHint()}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {otpPending?.visibleCode && (
                  <div className="bg-amber-500/15 border border-amber-400/40 rounded-2xl px-5 py-4 text-center">
                    <p className="text-amber-200 text-xs font-semibold mb-3 uppercase tracking-wider">{isAR ? "رمز التحقق" : "Verification Code"}</p>
                    <div className="flex justify-center gap-2" dir="ltr">
                      {otpPending.visibleCode.split("").map((d, i) => (
                        <span key={i} className="w-10 h-11 flex items-center justify-center bg-white/15 border border-amber-400/50 rounded-xl text-white text-xl font-black">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                <OtpInput value={otpCode} onChange={setOtpCode} />

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium text-center"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading || otpCode.length < 6}
                  className="w-full bg-gradient-to-l from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/40"
                >
                  {loading ? (isAR ? "جارٍ التحقق..." : "Verifying...") : (isAR ? "تأكيد الرمز" : "Confirm Code")}
                </button>

                <div className="flex items-center justify-between text-sm pt-1">
                  <button type="button" onClick={() => { setMode("login"); setError(""); setOtpCode(""); }}
                    className="text-blue-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
                  >
                    {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {isAR ? "العودة" : "Back"}
                  </button>
                  <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || loading}
                    className="text-blue-300 hover:text-white disabled:text-blue-300/40 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <RefreshCw className={`w-4 h-4 ${resendCooldown > 0 ? "" : "hover:rotate-180 transition-transform duration-500"}`} />
                    {resendCooldown > 0
                      ? (isAR ? `إعادة الإرسال (${resendCooldown}ث)` : `Resend (${resendCooldown}s)`)
                      : (isAR ? "إعادة إرسال الرمز" : "Resend Code")}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20"><KeyRound className="w-5 h-5 text-amber-300" /></div>
                  <h2 className="text-lg font-bold text-white">{isAR ? "نسيت كلمة المرور؟" : "Forgot Password?"}</h2>
                </div>
                <button type="button" onClick={() => setLang(isAR ? "en" : "ar")}
                  className="text-white/35 hover:text-white/80 text-xs font-semibold tracking-widest transition-colors uppercase"
                >{isAR ? "EN" : "عربي"}</button>
              </div>

              <p className="text-blue-200 text-sm mb-5 leading-relaxed">
                {isAR
                  ? "أدخل اسم المستخدم الخاص بك وسنرسل رمز التحقق إلى بريدك الإلكتروني المسجّل."
                  : "Enter your username and we'll send a verification code to your registered email."}
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "اسم المستخدم" : "Username"}</label>
                  <input type="text" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)}
                    className={inputCls} placeholder={isAR ? "أدخل اسم المستخدم" : "Enter username"} dir="ltr" required autoComplete="username" />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading || !forgotUsername.trim()}
                  className="w-full bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading
                    ? (isAR ? "جارٍ الإرسال..." : "Sending...")
                    : <><KeyRound className="w-4 h-4" />{isAR ? "إرسال رمز التحقق" : "Send Verification Code"}</>}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button onClick={() => { setMode("login"); setError(""); }} className="text-blue-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 mx-auto">
                  {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {isAR ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── RESET OTP ── */}
          {mode === "reset-otp" && (
            <motion.div key="reset-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="bg-amber-500/20 p-3 rounded-2xl mb-3 ring-1 ring-amber-400/30">
                  <ShieldCheck className="w-8 h-8 text-amber-300" />
                </div>
                <h2 className="text-xl font-bold text-white">{isAR ? "رمز إعادة التعيين" : "Reset Verification Code"}</h2>
                {resetVisibleCode ? (
                  <p className="text-blue-200 text-sm text-center mt-2 leading-relaxed">{isAR ? "أدخل الرمز الظاهر أدناه لإعادة تعيين كلمة السر" : "Enter the code shown below to reset your password"}</p>
                ) : (
                  <p className="text-blue-200 text-sm text-center mt-2 leading-relaxed">
                    {isAR ? "تم إرسال رمز التحقق إلى" : "Verification code sent to"}{" "}
                    <span className="font-bold text-white">{resetMaskedEmail || (isAR ? "بريدك الإلكتروني" : "your email")}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleVerifyResetOtp} className="space-y-5">
                {resetVisibleCode && (
                  <div className="bg-amber-500/15 border border-amber-400/40 rounded-2xl px-5 py-4 text-center">
                    <p className="text-amber-200 text-xs font-semibold mb-3 uppercase tracking-wider">{isAR ? "رمز التحقق" : "Verification Code"}</p>
                    <div className="flex justify-center gap-2" dir="ltr">
                      {resetVisibleCode.split("").map((d, i) => (
                        <span key={i} className="w-10 h-11 flex items-center justify-center bg-white/15 border border-amber-400/50 rounded-xl text-white text-xl font-black">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                <OtpInput value={resetOtpCode} onChange={setResetOtpCode} />

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium text-center"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading || resetOtpCode.length < 6}
                  className="w-full bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                >
                  {loading ? (isAR ? "جارٍ التحقق..." : "Verifying...") : (isAR ? "تأكيد الرمز" : "Confirm Code")}
                </button>

                <div className="flex items-center justify-between text-sm pt-1">
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); setResetOtpCode(""); }}
                    className="text-blue-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
                  >
                    {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {isAR ? "العودة" : "Back"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── NEW PASSWORD ── */}
          {mode === "new-password" && (
            <motion.div key="new-password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-xl bg-emerald-500/20"><KeyRound className="w-5 h-5 text-emerald-300" /></div>
                <h2 className="text-lg font-bold text-white">{isAR ? "تعيين كلمة مرور جديدة" : "Set New Password"}</h2>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "كلمة السر الجديدة" : "New Password"}</label>
                  <div className="relative">
                    <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className={`${inputCls} ${isAR ? "pr-4 pl-12" : "pl-4 pr-12"}`}
                      placeholder={isAR ? "6 أحرف على الأقل" : "At least 6 characters"} required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNewPass(v => !v)}
                      className={`absolute ${isAR ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}>
                      {showNewPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-blue-200 uppercase tracking-wider">{isAR ? "تأكيد كلمة السر" : "Confirm Password"}</label>
                  <div className="relative">
                    <input type={showConfirmPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className={`${inputCls} ${isAR ? "pr-4 pl-12" : "pl-4 pr-12"}`}
                      placeholder="••••••••" required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirmPass(v => !v)}
                      className={`absolute ${isAR ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}>
                      {showConfirmPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm font-medium"
                  >{error}</motion.div>
                )}

                <button type="submit" disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading ? (isAR ? "جارٍ الحفظ..." : "Saving...") : <><CheckCircle className="w-4 h-4" />{isAR ? "حفظ كلمة السر الجديدة" : "Save New Password"}</>}
                </button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="text-center text-white/25 text-xs mt-6 font-medium">
          {isAR ? "حول العالم للتخليص الجمركي · نظام المحاسبة الداخلي" : "Around The World Customs Clearance · Internal Accounting System"}
        </p>
      </motion.div>
    </div>
  );
}
