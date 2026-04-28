import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "") + "/api";
const LS_KEY = "company_settings";

export interface CompanySettings {
  id?: number;
  nameAr: string;
  nameEn: string;
  subtitleAr: string;
  subtitleEn: string;
  taglineAr: string;
  taglineEn: string;
  email: string;
  phone: string;
  address: string;
  poBox: string;
  website: string;
  crNumber: string;
  taxNumber: string;
  logoBase64: string | null;
  logoSize?: number;
  stampBase64: string | null;
  watermarkBase64: string | null;
  showWatermark: boolean;
  showStampOnInvoices: boolean;
  showStampOnReceipts: boolean;
  showStampOnStatements: boolean;
  footerText: string;
  invoiceCashTitleAr: string;
  invoiceCashTitleEn: string;
  invoiceCreditTitleAr: string;
  invoiceCreditTitleEn: string;
  invoiceTitleFontSize: number;
  accountantSignatureBase64: string | null;
  receiverSignatureBase64: string | null;
  showAccountantSignature: boolean;
  showReceiverSignature: boolean;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  nameAr: "اسم الشركة",
  nameEn: "Company Name",
  subtitleAr: "للتخليص الجمركي",
  subtitleEn: "Customs Clearance",
  taglineAr: "خدمات التخليص الجمركي والشحن",
  taglineEn: "Customs Clearance & Shipping Services",
  email: "*********@gmail.com",
  phone: "*********",
  address: "****, ****",
  poBox: "P.O BOX *****",
  website: "",
  crNumber: "",
  taxNumber: "",
  logoBase64: null,
  logoSize: 80,
  stampBase64: null,
  watermarkBase64: null,
  showWatermark: true,
  showStampOnInvoices: true,
  showStampOnReceipts: true,
  showStampOnStatements: true,
  footerText: "",
  invoiceCashTitleAr: "فاتورة نقدًا",
  invoiceCashTitleEn: "Cash Invoice",
  invoiceCreditTitleAr: "فاتورة نقدا / على الحساب",
  invoiceCreditTitleEn: "Cash / Credit Invoice",
  invoiceTitleFontSize: 25,
  accountantSignatureBase64: null,
  receiverSignatureBase64: null,
  showAccountantSignature: true,
  showReceiverSignature: true,
  };

interface CompanySettingsCtx {
  settings: CompanySettings;
  refresh: () => Promise<void>;
  setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
  logoSrc: string;
  stampSrc: string;
  watermarkSrc: string;
}

const defaultLogoSrc = `${import.meta.env.BASE_URL}logo_nobg.png`;
const defaultStampSrc = `${import.meta.env.BASE_URL}stamp_nobg.png`;

const Ctx = createContext<CompanySettingsCtx>({
  settings: DEFAULT_SETTINGS,
  refresh: async () => {},
  setSettings: () => {},
  logoSrc: defaultLogoSrc,
  stampSrc: defaultStampSrc,
  watermarkSrc: defaultLogoSrc,
});

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      return cached ? { ...DEFAULT_SETTINGS, ...JSON.parse(cached) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const { token } = useAuth();

const refresh = useCallback(async () => {
  try {
    const res = await fetch(`${API_BASE}/company-settings?ts=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${token || sessionStorage.getItem("auth_token") || ""}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();

    const merged = {
      ...DEFAULT_SETTINGS,
      ...data,
    };

      setSettings(merged);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error("Company settings refresh failed:", error);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logoSrc = settings.logoBase64 || defaultLogoSrc;
  const stampSrc = settings.stampBase64 || defaultStampSrc;
  // watermark: use dedicated watermark image if set, else fall back to logo
  const watermarkSrc = settings.watermarkBase64 || logoSrc;

  return (
    <Ctx.Provider value={{ settings, refresh, setSettings, logoSrc, stampSrc, watermarkSrc }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompanySettings() {
  return useContext(Ctx);
}
