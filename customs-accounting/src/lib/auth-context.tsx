import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface UserPermissions {
  canEditInvoices: boolean;
  canDeleteInvoices: boolean;
  canEditReceipts: boolean;
  canDeleteReceipts: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canManageTemplates: boolean;
  canViewStatements: boolean;
  canViewAccounting: boolean;
  canCustomizePrintContact: boolean;
}

export const ALL_PERMISSIONS: UserPermissions = {
  canEditInvoices: true,
  canDeleteInvoices: true,
  canEditReceipts: true,
  canDeleteReceipts: true,
  canEditClients: true,
  canDeleteClients: true,
  canManageTemplates: true,
  canViewStatements: true,
  canViewAccounting: true,
  canCustomizePrintContact: true,
};

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  displayNameAr?: string | null;
  displayNameEn?: string | null;
  role: string;
  permissions: UserPermissions;
  phone?: string | null;
  email?: string | null;
}

export interface OtpPending {
  requiresOtp: true;
  otpToken: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  visibleCode?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<OtpPending | undefined>;
  verifyOtp: (otpToken: string, code: string) => Promise<void>;
  resendOtp: (otpToken: string) => Promise<OtpPending>;
  logout: () => void;
  can: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = "https://workspaceapi-server-production-0e1f.up.railway.app";
// const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("auth_token"));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  }, []);

  // Auto-logout after 5 minutes of inactivity
  useEffect(() => {
    if (!user) return;
    const IDLE_MS = 5 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, IDLE_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  useEffect(() => {
    const stored = sessionStorage.getItem("auth_token");
    if (!stored) { setIsLoading(false); return; }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: AuthUser) => { setUser({ ...u, permissions: u.permissions ?? ALL_PERMISSIONS }); setToken(stored); })
      .catch(() => { sessionStorage.removeItem("auth_token"); setToken(null); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<OtpPending | undefined> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "خطأ في تسجيل الدخول");
    }
    const data = await res.json();

    if (data.requiresOtp) {
      return data as OtpPending;
    }

    const { token: newToken, user: newUser } = data;
    sessionStorage.setItem("auth_token", newToken);
    setToken(newToken);
    setUser({ ...newUser, permissions: newUser.permissions ?? ALL_PERMISSIONS });
    return undefined;
  }, []);

  const verifyOtp = useCallback(async (otpToken: string, code: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpToken, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "رمز التحقق غير صحيح");
    }
    const { token: newToken, user: newUser } = await res.json();
    sessionStorage.setItem("auth_token", newToken);
    setToken(newToken);
    setUser({ ...newUser, permissions: newUser.permissions ?? ALL_PERMISSIONS });
  }, []);

  const resendOtp = useCallback(async (otpToken: string): Promise<OtpPending> => {
    const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "فشل إعادة إرسال الرمز");
    }
    return await res.json() as OtpPending;
  }, []);

  const can = useCallback((permission: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions?.[permission] ?? false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, verifyOtp, resendOtp, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
