import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

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

const NO_PERMISSIONS: UserPermissions = {
  canEditInvoices: false,
  canDeleteInvoices: false,
  canEditReceipts: false,
  canDeleteReceipts: false,
  canEditClients: false,
  canDeleteClients: false,
  canManageTemplates: false,
  canViewStatements: false,
  canViewAccounting: false,
  canCustomizePrintContact: false,
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
  receiverSignatureBase64?: string | null;
  clientId?: number | null;
  clientViewPermissions?: {
    canViewInvoices: boolean;
    canViewReceipts: boolean;
    canViewStatement: boolean;
    canViewSummary: boolean;
  } | null;
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
  isDeveloperSupportMode: boolean;
  login: (username: string, password: string) => Promise<OtpPending | undefined>;
  verifyOtp: (otpToken: string, code: string) => Promise<void>;
  resendOtp: (otpToken: string) => Promise<OtpPending>;
  logout: () => void;
  can: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:10000").replace(/\/$/, "") + "/api";
const DEVELOPER_UNLOCK_KEY = "developer_unlocked";
const DEVELOPER_UNLOCKED_AT_KEY = "developer_unlocked_at";
const DEVELOPER_ENTRY_FROM_LOGIN_KEY = "developer_entry_from_login";
const DEVELOPER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEVELOPER_FRONTEND_ALLOWED_ROUTES = [
  "/settings/developer",
  "/settings",
  "/users-management",
];

function isDeveloperFrontendAllowedRoute(location: string) {
  return DEVELOPER_FRONTEND_ALLOWED_ROUTES.some(
    (route) => location === route || location.startsWith(`${route}/`)
  );
}

function isDeveloperSupportSessionActive() {
  const developerEntry = sessionStorage.getItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY) === "true";
  const developerUnlocked = sessionStorage.getItem(DEVELOPER_UNLOCK_KEY) === "true";
  const developerUnlockedAt = Number(sessionStorage.getItem(DEVELOPER_UNLOCKED_AT_KEY) || 0);
  const developerUnlockValid =
    developerUnlockedAt > 0 && Date.now() - developerUnlockedAt < DEVELOPER_IDLE_TIMEOUT_MS;

  return (
    !sessionStorage.getItem("auth_token") &&
    developerEntry &&
    developerUnlocked &&
    developerUnlockValid
  );
}
const ONLINE_DATABASE_CONNECTED_KEY = "developer_online_database_connected";

async function checkSyncConnection(token: string) {
  try {
    const res = await fetch(`${API_BASE}/developer/sync/check-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.onlineConnected) {
      sessionStorage.setItem(ONLINE_DATABASE_CONNECTED_KEY, "true");
      console.log("[SYNC][LOGIN_CHECK] Online: Connected");
      return;
    }

    sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
    console.log("[SYNC][LOGIN_CHECK] Online: Disconnected", data?.message || data?.lastError || res.status);
  } catch (err) {
    sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
    console.warn("[SYNC][LOGIN_CHECK] Online connection check failed", err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const enterDeveloperFrontendAccess = useCallback(() => {
    const stored = sessionStorage.getItem("auth_token");
    const isDeveloperRoute = isDeveloperFrontendAllowedRoute(location);

    if (stored || !isDeveloperSupportSessionActive() || !isDeveloperRoute) {
      return false;
    }

    setToken(null);
    setUser({
      id: 0,
      username: "developer",
      displayName: "Developer",
      role: "developer_support",
      permissions: NO_PERMISSIONS,
    });
    return true;
  }, [location]);

  const logout = useCallback(() => {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem(DEVELOPER_UNLOCK_KEY);
    sessionStorage.removeItem(DEVELOPER_UNLOCKED_AT_KEY);
    sessionStorage.removeItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY);
    sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
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
      if (enterDeveloperFrontendAccess()) {
        setIsLoading(false);
        return;
      }

      if (!stored) {
        setIsLoading(false);
        return;
      }

      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((u: AuthUser) => {
          setUser({ ...u, permissions: u.permissions ?? ALL_PERMISSIONS });
          setToken(stored);
          void checkSyncConnection(stored);
        })
        .catch(() => {
          sessionStorage.removeItem("auth_token");
          sessionStorage.removeItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY);
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    }, [enterDeveloperFrontendAccess]);

  useEffect(() => {
    const handleDeveloperTempLogin = () => {
      enterDeveloperFrontendAccess();
    };

    window.addEventListener("developer-temp-login", handleDeveloperTempLogin);
    return () => window.removeEventListener("developer-temp-login", handleDeveloperTempLogin);
  }, [enterDeveloperFrontendAccess]);

  useEffect(() => {
    if (sessionStorage.getItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY) !== "true") return;
    if (isDeveloperFrontendAllowedRoute(location)) {
      enterDeveloperFrontendAccess();
      return;
    }

    setToken(null);
    setUser(null);
  }, [location, enterDeveloperFrontendAccess]);

  const login = useCallback(async (username: string, password: string): Promise<OtpPending | undefined> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
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
    sessionStorage.removeItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY);
    console.log("verifyOtp saved token:", newToken);
    console.log("verifyOtp readback token:", sessionStorage.getItem("auth_token"));

    setToken(newToken);
    setUser({ ...newUser, permissions: newUser.permissions ?? ALL_PERMISSIONS });
    void checkSyncConnection(newToken);
    return undefined;
  }, []);

  const verifyOtp = useCallback(async (otpToken: string, code: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
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
    sessionStorage.removeItem(DEVELOPER_ENTRY_FROM_LOGIN_KEY);
    setToken(newToken);
    setUser({ ...newUser, permissions: newUser.permissions ?? ALL_PERMISSIONS });
    void checkSyncConnection(newToken);
  }, [setToken, setUser]);

  const resendOtp = useCallback(async (otpToken: string): Promise<OtpPending> => {
    const res = await fetch(`${API_BASE}/auth/resend-otp`, {
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
    if (isDeveloperSupportSessionActive()) return false;
    if (user.role === "admin") return true;
    return user.permissions?.[permission] ?? false;
  }, [user]);

  const isDeveloperSupportMode = isDeveloperSupportSessionActive();

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isDeveloperSupportMode, login, verifyOtp, resendOtp, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
