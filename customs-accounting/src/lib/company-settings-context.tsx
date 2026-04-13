import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;
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
}

export const DEFAULT_SETTINGS: CompanySettings = {
  nameAr: "حول العالم للتخليص الجمركي",
  nameEn: "Around The World Customs Clearance",
  subtitleAr: "للتخليص الجمركي",
  subtitleEn: "Customs Clearance",
  taglineAr: "خدمات التخليص الجمركي والشحن",
  taglineEn: "Customs Clearance & Shipping Services",
  email: "atwcc1246@gmail.com",
  phone: "55251595",
  address: "Doha, Qatar",
  poBox: "P.O BOX 8180",
  website: "",
  crNumber: "",
  taxNumber: "",
  logoBase64: null,
  stampBase64: null,
  watermarkBase64: null,
  showWatermark: true,
  showStampOnInvoices: true,
  showStampOnReceipts: true,
  showStampOnStatements: true,
  footerText: "",
  invoiceCashTitleAr: "فاتورة نقدًا",
  invoiceCashTitleEn: "Cash Invoice",
  invoiceCreditTitleAr: "فاتورةنقدا / على الحساب",
  invoiceCreditTitleEn: "Cash / Credit Invoice",
  invoiceTitleFontSize: 25,
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

  const refresh = async () => {
    try {
      const token = sessionStorage.getItem("auth_token");
      
      const res = await fetch(`${API_BASE}/company-settings?ts=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
  
      if (res.ok) {
        const data = await res.json();
        const merged = { ...DEFAULT_SETTINGS, ...data };
        setSettings(merged);
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
      }
    } catch {
      // use cached
    }
  };

  useEffect(() => { refresh(); }, []);

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
