import InvoicePrintHeader from "@/components/invoice-print-header";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useCompanySettings, DEFAULT_SETTINGS, type CompanySettings } from "@/lib/company-settings-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2, Globe, Phone, Mail, MapPin, Hash, Upload, Save, RefreshCw,
  Stamp, Eye, Shield, Printer, Info, Image, RotateCcw, User,
  Palette, Sun, Moon, Monitor, Zap, ZapOff, Layers, RectangleHorizontal, Square, Minus,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalSpaceAround,
  Wallpaper, SlidersHorizontal, Ban, Blend,
} from "lucide-react";
import { useDisplaySettings, COLOR_PRESETS, SIDEBAR_COLOR_PRESETS, type PrimaryColor, type BorderRadius, type Density, type SidebarColor, type BgType } from "@/lib/display-settings-context";

type TabId = "preview" | "company" | "branding" | "print" | "display";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inp = "w-full px-3 py-2 text-sm bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const tog = (on: boolean) =>
  `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? "bg-primary" : "bg-muted-foreground/30"}`;

export default function SettingsPage() {
  const { user } = useAuth();
  const { lang, isRTL } = useLanguage();
  const isAR = lang === "ar";
  const { display, update: updateDisplay } = useDisplaySettings();
  const { settings, refresh, setSettings, logoSrc, stampSrc, watermarkSrc } = useCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState<CompanySettings>({ ...DEFAULT_SETTINGS });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [accountantSignaturePreview, setAccountantSignaturePreview] = useState<string | null>(null);
  const [receiverSignaturePreview, setReceiverSignaturePreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const accountantSignatureRef = useRef<HTMLInputElement>(null);
  const receiverSignatureRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const watermarkRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("identity");

  useEffect(() => {
    setForm({ ...DEFAULT_SETTINGS, ...settings });
    setLogoPreview(settings.logoBase64 || null);
    setStampPreview(settings.stampBase64 || null);
    setWatermarkPreview(settings.watermarkBase64 || null);
    setAccountantSignaturePreview(settings.accountantSignatureBase64 || null);
    setReceiverSignaturePreview(settings.receiverSignatureBase64 || null);
  }, [settings]);

  // Export invoices backup
  const exportInvoices = async () => {
    try {
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("http://127.0.0.1:3000/api/invoices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert(isAR ? "فشل الاتصال بالفواتير" : "Failed to connect invoices");
        return;
      }

      const invoices = await res.json();

      const invoicesWithItems = await Promise.all(
        invoices.map(async (invoice: any) => {
          const detailRes = await fetch(`http://127.0.0.1:3000/api/invoices/${invoice.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!detailRes.ok) {
            return invoice;
          }

          return await detailRes.json();
        })
      );

      const blob = new Blob([JSON.stringify(invoicesWithItems, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "invoices-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
    }
  };

  // Export receipts backup
  const exportReceipts = async () => {
    try {
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("http://127.0.0.1:3000/api/receipts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert(isAR ? "فشل الاتصال بسندات القبض" : "Failed to connect receipts");
        return;
      }

      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "receipts-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
    }
  };
    // Export clients backup
    const exportClients = async () => {
      try {
        const token = sessionStorage.getItem("auth_token");

        const res = await fetch("http://127.0.0.1:3000/api/clients", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          alert(isAR ? "فشل الاتصال بالعملاء" : "Failed to connect clients");
          return;
        }

        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "clients-backup.json";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
      }
    };
      // Export items backup
    const exportItems = async () => {
      try {
        const token = sessionStorage.getItem("auth_token");

        const res = await fetch("http://127.0.0.1:3000/api/invoice-item-templates", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          alert(isAR ? "فشل الاتصال بالبـنود" : "Failed to connect items");
          return;
        }

        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "items-backup.json";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
      }
    };

    // Import invoices backup
    const importInvoices = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/invoices/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      alert("تم استيراد الفواتير بنجاح");
      if (!res.ok) {
        alert(isAR ? "فشل استيراد الفواتير" : "Failed to import invoices");
        return;
      }
    };

    // Import receipts backup
    const importReceipts = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/receipts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد السندات" : "Failed to import receipts");
        return;
      }

      alert(isAR ? "تم استيراد السندات بنجاح" : "Receipts imported successfully");
          };

    // Import clients backup
    const importClients = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/clients/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد العملاء" : "Failed to import clients");
        return;
      }
    };

    // Import items backup
    const importItems = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/invoice-item-templates/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد البنود" : "Failed to import items");
        return;
      }
    };


  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Shield className="w-16 h-16 opacity-20" />
        <p className="text-lg font-semibold">{isAR ? "هذه الصفحة للمدير فقط" : "Admin access only"}</p>
      </div>
    );
  }

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field:
      | "logoBase64"
      | "stampBase64"
      | "watermarkBase64"
      | "accountantSignatureBase64"
      | "receiverSignatureBase64",
    setPreview: (v: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: isAR ? "الحجم كبير جداً (2 MB كحد أقصى)" : "File too large (max 2 MB)", variant: "destructive" });
      return;
    }
    compressImageToDataUrl(file, {
      maxWidth: field === "watermarkBase64" ? 1600 : 1200,
      maxHeight: field === "watermarkBase64" ? 1600 : 1200,
      quality: field === "watermarkBase64" ? 0.75 : 0.82,
      outputType: "image/jpeg",
    })
      .then((compressedBase64) => {
        if (!compressedBase64) throw new Error("empty");
        setForm((p) => ({ ...p, [field]: compressedBase64 }));
        setPreview(compressedBase64);
      })
      .catch(async () => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setForm((p) => ({ ...p, [field]: base64 }));
          setPreview(base64);
        };
        reader.readAsDataURL(file);
      });
    };
    const MAX_IMAGE_DIMENSION = 1200;
    const OUTPUT_QUALITY = 0.82;
    
    async function compressImageToDataUrl(
      file: File,
      options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        outputType?: "image/jpeg" | "image/png" | "image/webp";
      }
    ): Promise<string> {
      const {
        maxWidth = MAX_IMAGE_DIMENSION,
        maxHeight = MAX_IMAGE_DIMENSION,
        quality = OUTPUT_QUALITY,
        outputType = "image/png",
      } = options || {};
    
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
    
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = fileDataUrl;
      });
    
      let targetWidth = img.width;
      let targetHeight = img.height;
    
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight, 1);
    
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
    
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    
      return canvas.toDataURL(outputType, quality);
    }
    
    const handleImageRemove = (
      field: "logoBase64" | "stampBase64" | "watermarkBase64" | "accountantSignatureBase64" | "receiverSignatureBase64",
      setPreview?: (value: string) => void
    ) => {
      setForm((prev) => ({ ...prev, [field]: null }));
      setPreview?.("");
    };
  
    const handleSave = async () => {
      setSaving(true);
      try {
        const token = sessionStorage.getItem("auth_token");
        const { id, updatedAt, createdAt, ...rawPayload } = form as any;

        const payload = {
          ...rawPayload,
          nameAr: rawPayload.nameAr ?? "",
          nameEn: rawPayload.nameEn ?? "",
          subtitleAr: rawPayload.subtitleAr ?? "",
          subtitleEn: rawPayload.subtitleEn ?? "",
          taglineAr: rawPayload.taglineAr ?? "",
          taglineEn: rawPayload.taglineEn ?? "",
          email: rawPayload.email ?? "",
          phone: rawPayload.phone ?? "",
          address: rawPayload.address ?? "",
          poBox: rawPayload.poBox ?? "",
          website: rawPayload.website ?? "",
          crNumber: rawPayload.crNumber ?? "",
          taxNumber: rawPayload.taxNumber ?? "",
          footerText: rawPayload.footerText ?? "",
          logoSize: Number(rawPayload.logoSize ?? 80),
          invoiceCashTitleAr: rawPayload.invoiceCashTitleAr ?? "",
          invoiceCashTitleEn: rawPayload.invoiceCashTitleEn ?? "",
          invoiceCreditTitleAr: rawPayload.invoiceCreditTitleAr ?? "",
          invoiceCreditTitleEn: rawPayload.invoiceCreditTitleEn ?? "",
          showWatermark: rawPayload.showWatermark ?? true,
          showStampOnInvoices: rawPayload.showStampOnInvoices ?? true,
          showStampOnReceipts: rawPayload.showStampOnReceipts ?? true,
          showStampOnStatements: rawPayload.showStampOnStatements ?? true,
          accountantSignatureBase64: rawPayload.accountantSignatureBase64 ?? null,
          receiverSignatureBase64: rawPayload.receiverSignatureBase64 ?? null,
          showAccountantSignature: rawPayload.showAccountantSignature ?? true,
          showReceiverSignature: rawPayload.showReceiverSignature ?? true,
          invoiceTitleFontSize: Number(rawPayload.invoiceTitleFontSize ?? 25),
        };
        console.log("payload accountant:", payload.accountantSignatureBase64?.slice?.(0, 50));
        const res = await fetch(`${API_BASE}/company-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
    
        if (!res.ok) throw new Error("Failed");
    
        const saved = await res.json();
        const mergedSaved = { ...DEFAULT_SETTINGS, ...saved };
    
        setForm(mergedSaved);
        setSettings(mergedSaved);
        sessionStorage.setItem("company_settings", JSON.stringify(mergedSaved));
    
        await refresh();
    
        toast({
          title: isAR
            ? "✅ تم الحفظ بنجاح — التغييرات مفعلة الآن"
            : "✅ Saved — changes are now active",
        });
      } catch {
        toast({
          title: isAR ? "حدث خطأ أثناء الحفظ" : "Save failed",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    };

  const Toggle = ({ field }: { field: keyof CompanySettings }) => (
    <button
      type="button"
      onClick={() => setForm(p => ({ ...p, [field]: !p[field] }))}
      className={tog(!!form[field])}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form[field] ? "translate-x-5" : ""}`}
      />
    </button>
  );

  const currentLogoSrc = logoPreview || logoSrc;
  const currentStampSrc = stampPreview || stampSrc;
  const currentWatermarkSrc = watermarkPreview || watermarkSrc;

  const TABS = [
    { id: "display", icon: Palette, labelAr: "المظهر", labelEn: "Display", color: "text-fuchsia-500" },
    { id: "preview", icon: Eye, labelAr: "النسخ الاحتياطي والاستيراد", labelEn: "Export & Import", color: "text-indigo-500" },
    { id: "company", icon: Building2, labelAr: "بيانات الشركة", labelEn: "Company", color: "text-blue-500" },
    { id: "branding", icon: Image, labelAr: "الشعارات", labelEn: "Branding", color: "text-purple-500" },
    { id: "print", icon: Printer, labelAr: "أدوات الطباعة", labelEn: "Print Tools", color: "text-rose-500" },
  ];

  const resolvedName = (isAR ? user?.displayNameAr : user?.displayNameEn) || user?.displayName || "";
  const roleLabel = isAR
    ? (user?.role === "admin" ? "مدير" : user?.role === "supervisor" ? "مشرف" : "مستخدم")
    : (user?.role === "admin" ? "Admin" : user?.role === "supervisor" ? "Supervisor" : "User");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      dir={isRTL ? "rtl" : "ltr"}
      className="flex gap-5 pb-10 items-start"
    >
      {/* ── Sticky Sidebar ─────────────────────────────────────── */}
      <div className="sticky top-4 self-start w-48 shrink-0 space-y-3">

        {/* User card */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
              {resolvedName?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate leading-tight">
                {isAR ? (resolvedName || user?.displayName) : (user?.displayNameEn || resolvedName || user?.displayName)}
              </p>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Tab list */}
        <nav className="bg-card rounded-2xl border border-border/50 shadow-sm p-2 space-y-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-start",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5 shrink-0", activeTab === tab.id ? "text-primary" : tab.color)} />
              {isAR ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </nav>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 text-sm"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? (isAR ? "جارٍ الحفظ..." : "Saving...") : (isAR ? "حفظ التغييرات" : "Save Changes")}
        </button>
      </div>

      {/* ── Content Area ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Section title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isAR ? "إعدادات البرنامج" : "App Settings"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAR ? "تحكم كامل في هوية الشركة وإعدادات الطباعة" : "Full control over company identity and print settings"}
            </p>
          </div>
        </div>

           {/* ── Always Visible Invoice Preview ── */}
          <div className="p-4">
            <div
              className="bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden"
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              {/* Invoice real header preview */}
              <InvoicePrintHeader
                company={form}
                logoSrc={currentLogoSrc}
                isAR={isAR}
                invoiceNumber="INV-PREVIEW"
                statusText="صادرة"
              />
            </div>
            </div>

          {/* ── Preview Tab Content ── */}
            {activeTab === "preview" && (
              <Section
                icon={Eye}
                title={isAR ? "النسخ الاحتياطي والاستيراد" : "Preview Tools & Backup"}
                color="bg-indigo-500/5"
              >
            <div className="mt-6 rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAR ? "بيانات البرنامج" : "Program Data"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAR
                      ? "تصدير واستيراد بيانات البرنامج من مكان واحد."
                      : "Export and import program data from one place."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const password = window.confirm(
                          isAR ? "هل تريد تصدير النسخة الاحتياطية؟" : "Export backup?"
                        )
                          ? "1234"
                          : "";
                      if (!password) return;

                      console.log("PASSWORD:", password);

                      const token = sessionStorage.getItem("auth_token");

                      const [invoices, receipts, clients, items] = await Promise.all([
                        fetch("http://127.0.0.1:3000/api/invoices", {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.json()),

                        fetch("http://127.0.0.1:3000/api/receipts", {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.json()),

                        fetch("http://127.0.0.1:3000/api/clients", {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.json()),

                        fetch("http://127.0.0.1:3000/api/invoice-item-templates", {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.json()),
                      ]);

                      console.log("DATA READY", invoices, receipts, clients, items);

                      const fullData = {
                        password,
                        invoices,
                        receipts,
                        clients,
                        items,
                      };

                      const blob = new Blob([JSON.stringify(fullData, null, 2)], {
                        type: "application/json",
                      });

                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "full-backup.json";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {isAR ? "تصدير كامل البيانات" : "Export Full Data"}
                  </button>
                  <button
                      type="button"
                      onClick={() => document.getElementById("full-import")?.click()}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {isAR ? "استيراد كامل البيانات" : "Import Full Data"}
                    </button>

                    <input
                      id="full-import"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const fullData = JSON.parse(await file.text());

                        const enteredPassword = window.confirm(
                          isAR ? "هل كلمة المرور هي 1234 ؟" : "Is password 1234?"
                        )
                          ? "1234"
                          : "";

                        if (fullData.password !== enteredPassword) {
                          alert(isAR ? "كلمة المرور غير صحيحة" : "Wrong password");
                          return;
                        }

                        if (fullData.clients) {
                          const blob = new Blob([JSON.stringify(fullData.clients)], { type: "application/json" });
                          await importClients(new File([blob], "clients.json"));
                        }

                        if (fullData.items) {
                          const blob = new Blob([JSON.stringify(fullData.items)], { type: "application/json" });
                          await importItems(new File([blob], "items.json"));
                        }

                        if (fullData.invoices) {
                          const blob = new Blob([JSON.stringify(fullData.invoices)], { type: "application/json" });
                          await importInvoices(new File([blob], "invoices.json"));
                        }

                        if (fullData.receipts) {
                          const blob = new Blob([JSON.stringify(fullData.receipts)], { type: "application/json" });
                          await importReceipts(new File([blob], "receipts.json"));
                        }

                        alert(isAR ? "تم استيراد كامل البيانات" : "Full data imported successfully");
                      }}
                    />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                    { key: "invoices", title: isAR ? "الفواتير" : "Invoices" },
                    { key: "receipts", title: isAR ? "سندات القبض" : "Receipts" },
                    { key: "clients", title: isAR ? "العملاء" : "Clients" },
                    { key: "items", title: isAR ? "البنود" : "Items" },
                ].map(({ key, title }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-all"
                  >
                    <span className="text-sm font-bold text-slate-800">{title}</span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (key === "invoices") {
                            exportInvoices();
                          }

                          if (key === "receipts") {
                            exportReceipts();
                          }

                          if (key === "clients") {
                            exportClients();
                          }

                          if (key === "items") {
                            exportItems();
                          }
                        }}
                        className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {isAR ? "تصدير" : "Export"}
                      </button>
                      <button
                        type="button"
                        disabled={false}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".json,application/json";

                          input.onchange = () => {
                              const file = input.files?.[0];
                              if (!file) return;

                              console.log("IMPORT FILE:", file);

                              if (key === "invoices") importInvoices(file);
                              if (key === "receipts") importReceipts(file);
                              if (key === "clients") importClients(file);
                              if (key === "items") importItems(file);
                            };
                          input.click();
                        }}
                        className="rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                      >
                        {isAR ? "استيراد" : "Import"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </Section>
            )}

        {/* ── Display Tab ── */}
        {activeTab === "display" && (() => {
          const storedTheme = sessionStorage.getItem("theme");
          const currentTheme = storedTheme === "dark" ? "dark" : storedTheme === "light" ? "light" : "system";
          const toggleTheme = (mode: "light" | "dark" | "system") => {
            if (mode === "dark") { document.documentElement.classList.add("dark"); sessionStorage.setItem("theme", "dark"); }
            else if (mode === "light") { document.documentElement.classList.remove("dark"); sessionStorage.setItem("theme", "light"); }
            else { sessionStorage.removeItem("theme"); document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches); }
          };

          const ToggleSwitch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
            <button type="button" onClick={() => onChange(!on)} className={tog(on)}>
              <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
            </button>
          );

          const SectionCard = ({ icon: Icon, title, color, children }: { icon: React.ElementType; title: string; color: string; children: React.ReactNode }) => (
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
                <Icon className="w-3.5 h-3.5" /><h2 className="text-sm font-bold">{title}</h2>
              </div>
              <div className="p-5">{children}</div>
            </div>
          );

          return (
            <>
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">

              {/* ─ Theme ─ */}
              <SectionCard icon={Sun} title={isAR ? "ثيم الواجهة" : "Interface Theme"} color="bg-yellow-500/5">
                <div className="grid grid-cols-3 gap-2">
                  {([["light", Sun, isAR ? "فاتح" : "Light"], ["dark", Moon, isAR ? "داكن" : "Dark"], ["system", Monitor, isAR ? "تلقائي" : "System"]] as const).map(([mode, Icon, label]) => (
                    <button key={mode} onClick={() => { toggleTheme(mode); }}
                      className={cn("flex flex-col items-center gap-2 py-4 px-2 rounded-xl text-xs font-semibold border-2 transition-all",
                        currentTheme === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Primary Color ─ */}
              <SectionCard icon={Palette} title={isAR ? "اللون الأساسي" : "Primary Color"} color="bg-fuchsia-500/5">
                <div className="grid grid-cols-7 gap-2">
                  {(Object.entries(COLOR_PRESETS) as [PrimaryColor, typeof COLOR_PRESETS[PrimaryColor]][]).map(([key, preset]) => (
                    <button key={key} onClick={() => updateDisplay({ primaryColor: key })}
                      title={isAR ? preset.labelAr : preset.labelEn}
                      className={cn("flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all text-xs font-semibold",
                        display.primaryColor === key ? "border-current shadow-lg scale-105" : "border-transparent hover:border-border hover:scale-105"
                      )}
                      style={{ color: preset.hex }}
                    >
                      <span className="w-8 h-8 rounded-full shadow-md border-2 border-white/20 block"
                        style={{ background: preset.hex }} />
                      <span className="text-foreground">{isAR ? preset.labelAr : preset.labelEn}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{isAR ? "معاينة:" : "Preview:"}</span>
                  <div className="flex items-center gap-2">
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center text-white"
                      style={{ background: COLOR_PRESETS[display.primaryColor].hex }}>
                      {isAR ? "زر أساسي" : "Primary Button"}
                    </span>
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center border-2"
                      style={{ borderColor: COLOR_PRESETS[display.primaryColor].hex, color: COLOR_PRESETS[display.primaryColor].hex }}>
                      {isAR ? "حد ملوّن" : "Outline"}
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* ─ Sidebar Color ─ */}
              <SectionCard icon={Layers} title={isAR ? "لون الشريط الجانبي" : "Sidebar Color"} color="bg-slate-500/5">
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(SIDEBAR_COLOR_PRESETS) as [SidebarColor, typeof SIDEBAR_COLOR_PRESETS[SidebarColor]][]).map(([key, preset]) => (
                    <button key={key} onClick={() => updateDisplay({ sidebarColor: key })}
                      title={isAR ? preset.labelAr : preset.labelEn}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium",
                        display.sidebarColor === key
                          ? "border-primary shadow-md scale-105"
                          : "border-transparent hover:border-border hover:scale-105"
                      )}
                    >
                      {/* Mini gradient preview */}
                      <div className="w-full h-10 rounded-lg shadow-inner border border-white/10 overflow-hidden">
                        <div className="w-full h-full" style={{ background: `linear-gradient(180deg, ${preset.from} 0%, ${preset.to} 100%)` }} />
                      </div>
                      <span className="text-foreground text-center leading-tight">{isAR ? preset.labelAr : preset.labelEn}</span>
                    </button>
                  ))}
                </div>
                {/* Live preview mini sidebar */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-2">{isAR ? "معاينة مصغّرة:" : "Preview:"}</p>
                  <div className="h-16 rounded-xl overflow-hidden shadow-md flex items-stretch"
                    style={{ background: `linear-gradient(180deg, ${SIDEBAR_COLOR_PRESETS[display.sidebarColor].from} 0%, ${SIDEBAR_COLOR_PRESETS[display.sidebarColor].to} 100%)` }}>
                    <div className="flex items-center gap-2 px-4">
                      <div className="w-6 h-6 rounded-lg bg-white/10" />
                      <div className="space-y-1">
                        <div className="w-16 h-2 rounded bg-white/30" />
                        <div className="w-10 h-1.5 rounded bg-white/15" />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ─ App Background ─ */}
              <SectionCard icon={Wallpaper} title={isAR ? "خلفية التطبيق" : "App Background"} color="bg-indigo-500/5">
                {/* Type selector */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {([
                    { v: "none"  as BgType, Icon: Ban,     labelAr: "بدون",    labelEn: "None"  },
                    { v: "color" as BgType, Icon: Blend,   labelAr: "لون",     labelEn: "Color" },
                    { v: "image" as BgType, Icon: Wallpaper, labelAr: "صورة",  labelEn: "Image" },
                  ]).map(({ v, Icon: Ic, labelAr, labelEn }) => (
                    <button key={v} onClick={() => updateDisplay({ bgType: v })}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.bgType === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <Ic className="w-3.5 h-3.5" />
                      {isAR ? labelAr : labelEn}
                    </button>
                  ))}
                </div>

                {/* Color picker */}
                {display.bgType === "color" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                        {isAR ? "اختر اللون" : "Pick color"}
                      </label>
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="color"
                          value={display.bgColor}
                          onChange={e => updateDisplay({ bgColor: e.target.value })}
                          className="w-8 h-8 rounded-xl border border-border cursor-pointer p-0.5 bg-background"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {["#e8f0fe","#fce4ec","#e8f5e9","#fff3e0","#f3e5f5","#e0f7fa","#fafafa","#1e1e2e"].map(c => (
                            <button key={c} onClick={() => updateDisplay({ bgColor: c })}
                              title={c}
                              className={cn("w-6 h-6 rounded-lg border-2 transition-all hover:scale-110",
                                display.bgColor === c ? "border-primary scale-110 shadow-md" : "border-border/50"
                              )}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Mini preview */}
                    <div className="h-16 rounded-xl border border-border/40 overflow-hidden relative">
                      <div className="absolute inset-0" style={{ backgroundColor: display.bgColor, opacity: display.bgOpacity / 100 }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">{isAR ? "معاينة الخلفية" : "Background preview"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image upload */}
                {display.bgType === "image" && (() => {
                  const bgImgRef = { current: null as HTMLInputElement | null };
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => bgImgRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow hover:bg-primary/90 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {isAR ? "رفع صورة" : "Upload Image"}
                        </button>
                        {display.bgImage && (
                          <button
                            onClick={() => updateDisplay({ bgImage: "" })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {isAR ? "إزالة" : "Remove"}
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={el => { bgImgRef.current = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 600 * 1024) {
                              toast({ title: isAR ? "الصورة كبيرة جداً (600KB حد أقصى)" : "Image too large (max 600KB)", variant: "destructive" });
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = ev => updateDisplay({ bgImage: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                      {/* Preview */}
                      <div className="h-28 rounded-xl border border-border/40 overflow-hidden relative bg-muted/20">
                        {display.bgImage ? (
                          <>
                            <img src={display.bgImage} alt="bg preview"
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ opacity: display.bgOpacity / 100 }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-medium bg-black/30 text-white px-2 py-1 rounded-lg">{isAR ? "معاينة" : "Preview"}</span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                            <Wallpaper className="w-8 h-8 opacity-30" />
                            <p className="text-xs">{isAR ? "لم تُختر صورة بعد" : "No image selected"}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{isAR ? "الحد الأقصى للحجم: 600KB · الصيغ المقبولة: JPG, PNG, WebP" : "Max size: 600KB · Accepted: JPG, PNG, WebP"}</p>
                    </div>
                  );
                })()}

                {/* Opacity slider — shown when type != none */}
                {display.bgType !== "none" && (
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {isAR ? "درجة الشفافية" : "Opacity"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary tabular-nums">{display.bgOpacity}%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={5} max={80} step={1}
                        value={display.bgOpacity}
                        onChange={e => updateDisplay({ bgOpacity: Number(e.target.value) })}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">5%</span>
                        <span className="text-[10px] text-muted-foreground">80%</span>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* ─ Border Radius ─ */}
              <SectionCard icon={Square} title={isAR ? "حجم الزوايا" : "Border Radius"} color="bg-blue-500/5">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { v: "sharp"   as BorderRadius, labelAr: "حادة",    labelEn: "Sharp",   radius: "rounded-sm",  Icon: Minus },
                    { v: "normal"  as BorderRadius, labelAr: "متوسطة",  labelEn: "Normal",  radius: "rounded-xl",  Icon: RectangleHorizontal },
                    { v: "rounded" as BorderRadius, labelAr: "ناعمة",   labelEn: "Rounded", radius: "rounded-full", Icon: Square },
                  ]).map(({ v, labelAr, labelEn, radius, Icon }) => (
                    <button key={v} onClick={() => updateDisplay({ borderRadius: v })}
                      className={cn("flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.borderRadius === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      )}>
                      <div className={`w-10 h-6 border-2 ${display.borderRadius === v ? "border-primary" : "border-current"} ${radius}`} />
                      {isAR ? labelAr : labelEn}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Density ─ */}
              <SectionCard icon={AlignVerticalSpaceAround} title={isAR ? "كثافة العرض (حجم النص)" : "Display Density (Font Size)"} color="bg-teal-500/5">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { v: "compact"     as Density, labelAr: "مضغوط",   labelEn: "Compact",     Icon: AlignVerticalJustifyStart,  hint: "12.5px" },
                    { v: "normal"      as Density, labelAr: "عادي",    labelEn: "Normal",      Icon: AlignVerticalJustifyCenter, hint: "14px"   },
                    { v: "comfortable" as Density, labelAr: "مريح",    labelEn: "Comfortable", Icon: AlignVerticalSpaceAround,   hint: "15.5px" },
                  ]).map(({ v, labelAr, labelEn, Icon, hint }) => (
                    <button key={v} onClick={() => updateDisplay({ density: v })}
                      className={cn("flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.density === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      )}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{isAR ? labelAr : labelEn}</span>
                      <span className="font-mono text-[10px] opacity-60">{hint}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Toggles ─ */}
              <SectionCard icon={Layers} title={isAR ? "خيارات إضافية" : "Extra Options"} color="bg-slate-500/5">
                <div className="space-y-1">
                  {[
                    {
                      field: "sidebarGlass" as const,
                      Icon: Layers,
                      labelAr: "الشريط الجانبي الزجاجي",
                      labelEn: "Glass Sidebar Effect",
                      hintAr: "تأثير شفافية وضبابية على الشريط الجانبي",
                      hintEn: "Frosted glass blur effect on the sidebar",
                    },
                    {
                      field: "animations" as const,
                      Icon: display.animations ? Zap : ZapOff,
                      labelAr: "تأثيرات الحركة",
                      labelEn: "Animations",
                      hintAr: "تفعيل / إيقاف انتقالات وحركات الواجهة",
                      hintEn: "Enable or disable UI transitions and motion effects",
                    },
                  ].map(({ field, Icon, labelAr, labelEn, hintAr, hintEn }) => (
                    <div key={field} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{isAR ? labelAr : labelEn}</p>
                          <p className="text-xs text-muted-foreground">{isAR ? hintAr : hintEn}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => updateDisplay({ [field]: !display[field] })} className={tog(!!display[field])}>
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${display[field] ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
            </>
          );
        })()}

        {/* ── Identity Tab ── */}
        {activeTab === "company" && (
          <Section icon={Building2} title={isAR ? "هوية الشركة" : "Company Identity"} color="bg-blue-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={isAR ? "اسم الشركة (عربي)" : "Company Name (Arabic)"}>
              <input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} className={inp} placeholder="اسم الشركة بالعربي" />
            </Field>
            
            <Field label={isAR ? "اسم الشركة (إنجليزي)" : "Company Name (English)"}>
              <input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="Enter company name in English" />
            </Field>
            
            <Field label={isAR ? "الترجمة الثانوية (عربي)" : "Subtitle (Arabic)"}>
              <input value={form.subtitleAr} onChange={e => setForm(p => ({ ...p, subtitleAr: e.target.value }))} className={inp} placeholder="الترجمة الثانوية بالعربي" />
            </Field>
            
            <Field label={isAR ? "الترجمة الثانوية (إنجليزي)" : "Subtitle (English)"}>
              <input value={form.subtitleEn} onChange={e => setForm(p => ({ ...p, subtitleEn: e.target.value }))} className={inp} placeholder="Enter subtitle in English" />
            </Field>
            
            <Field label={isAR ? "الوصف (عربي)" : "Tagline (Arabic)"}>
              <input value={form.taglineAr} onChange={e => setForm(p => ({ ...p, taglineAr: e.target.value }))} className={inp} placeholder="وصف النشاط بالعربي" />
            </Field>
            
            <Field label={isAR ? "الوصف (إنجليزي)" : "Tagline (English)"}>
              <input value={form.taglineEn} onChange={e => setForm(p => ({ ...p, taglineEn: e.target.value }))} className={inp} placeholder="Enter business description in English" />
            </Field>
            </div>
          </Section>
        )}

        {/* ── Contact Tab ── */}
        {activeTab === "company" &&(
          <Section icon={Phone} title={isAR ? "معلومات التواصل" : "Contact Information"} color="bg-green-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "البريد الإلكتروني" : "Email"}>
                <div className="relative">
                  <Mail className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل البريد الإلكتروني" : "Enter email address"} type="email" />
                </div>
              </Field>
              <Field label={isAR ? "رقم الهاتف" : "Phone"}>
                <div className="relative">
                  <Phone className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل رقم الهاتف" : "Enter phone number"} />
                </div>
              </Field>
              <Field label={isAR ? "العنوان" : "Address"}>
                <div className="relative">
                  <MapPin className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل عنوان الشركة" : "Enter company address"} />
                </div>
              </Field>
              <Field label={isAR ? "صندوق البريد" : "P.O Box"}>
                <input value={form.poBox} onChange={e => setForm(p => ({ ...p, poBox: e.target.value }))} className={inp} placeholder={isAR ? "أدخل صندوق البريد" : "Enter P.O Box"} />
              </Field>
              <Field label={isAR ? "الموقع الإلكتروني" : "Website"}>
                <div className="relative">
                  <Globe className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل الموقع الإلكتروني" : "Enter website"} />
                </div>
              </Field>
            </div>
          </Section>
        )}

        {/* ── Legal Tab ── */}
        {activeTab === "company" && (
          <Section icon={Hash} title={isAR ? "القانونية والنسخ" : "Legal & Backup"} color="bg-amber-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "رقم السجل التجاري" : "Commercial Registration No."}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.crNumber} onChange={e => setForm(p => ({ ...p, crNumber: e.target.value }))} className={`${inp} ps-9`} placeholder="12345678" />
                </div>
              </Field>
              <Field label={isAR ? "الرقم الضريبي" : "Tax / VAT Number"}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.taxNumber} onChange={e => setForm(p => ({ ...p, taxNumber: e.target.value }))} className={`${inp} ps-9`} placeholder="VAT-123456" />
                </div>
              </Field>
            </div>

          </Section>
        )}

        {/* ── Branding Tab ── */}
        {activeTab === "branding" && (
          <Section icon={Image} title={isAR ? "الشعار والختم والعلامة المائية" : "Logo, Stamp & Watermark"} color="bg-purple-500/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "شعار الشركة" : "Company Logo"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img src={currentLogoSrc} alt="logo" className="h-16 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => logoRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع شعار" : "Upload"}
                    </button>
                    {logoPreview && (
                      <button type="button" onClick={() => { setLogoPreview(null); setForm(p => ({ ...p, logoBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG/JPG · أقصى 2 MB" : "PNG/JPG · Max 2 MB"}</p>
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "logoBase64", setLogoPreview)} />
              
                 <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isAR ? "حجم الشعار" : "Logo Size"}
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="200"
                    value={form.logoSize || 80}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, logoSize: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>   
              
              </div>
              {/* Stamp */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "ختم الشركة" : "Company Stamp"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img src={currentStampSrc} alt="stamp" className="h-16 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => stampRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع ختم" : "Upload"}
                    </button>
                    {stampPreview && (
                      <button type="button" onClick={() => { setStampPreview(null); setForm(p => ({ ...p, stampBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG شفاف · أقصى 2 MB" : "Transparent PNG · Max 2 MB"}</p>
                </div>
                <input ref={stampRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "stampBase64", setStampPreview)} />
              </div>
              
                {/* Accountant Signature */}
                <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isAR ? "توقيع المحاسب" : "Accountant Signature"}
                </p>

                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img
                    src={accountantSignaturePreview || ""}
                    alt="accountant-signature"
                    className="h-16 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => accountantSignatureRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isAR ? "رفع توقيع" : "Upload"}
                    </button>

                    {accountantSignaturePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountantSignaturePreview(null);
                          setForm((p) => ({ ...p, accountantSignatureBase64: null }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {isAR ? "PNG شفاف · أقصى 2 MB" : "Transparent PNG · Max 2 MB"}
                  </p>
                </div>

                <input
                  ref={accountantSignatureRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "accountantSignatureBase64", setAccountantSignaturePreview)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium">
                  {isAR ? "إظهار توقيع المحاسب" : "Show Accountant Signature"}
                </span>
                <Toggle field="showAccountantSignature" />
              </div>

              {/* Watermark */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "العلامة المائية" : "Watermark"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-purple-400/40 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 transition-colors min-h-[160px]">
                  <img src={currentWatermarkSrc} alt="watermark" className="h-16 w-auto object-contain opacity-40" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => watermarkRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع واترمارك" : "Upload"}
                    </button>
                    {watermarkPreview && (
                      <button type="button" onClick={() => { setWatermarkPreview(null); setForm(p => ({ ...p, watermarkBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "خلفية شفافة في الطباعة · يُستخدم الشعار بديلاً" : "Transparent print background · Falls back to logo"}</p>
                </div>
                <input ref={watermarkRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "watermarkBase64", setWatermarkPreview)} />
              </div>
            </div>
          </Section>
        )}

        {/* ── Print Tab ── */}
        {activeTab === "print" && (
          <Section icon={Printer} title={isAR ? "خيارات الطباعة" : "Print Options"} color="bg-rose-500/5">
            <div className="space-y-4">
              {[
                { field: "showWatermark" as const, labelAr: "إظهار العلامة المائية في صفحات الطباعة", labelEn: "Show watermark on print pages", icon: Eye },
                { field: "showStampOnInvoices" as const, labelAr: "إظهار الختم على الفواتير", labelEn: "Show stamp on invoices", icon: Stamp },
                { field: "showStampOnReceipts" as const, labelAr: "إظهار الختم على سندات القبض", labelEn: "Show stamp on receipts", icon: Stamp },
                { field: "showStampOnStatements" as const, labelAr: "إظهار الختم على كشوف الحساب", labelEn: "Show stamp on statements", icon: Stamp },
              ].map(({ field, labelAr, labelEn, icon: Icon }) => (
                <div key={field} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{isAR ? labelAr : labelEn}</span>
                  </div>
                  <Toggle field={field} />
                </div>
              ))}
            
            <Field label={isAR ? "عنوان الفاتورة الأساسي" : "Main Invoice Title"}>
              <input
                value={form.invoiceCreditTitleAr}
                onChange={e => setForm(p => ({ ...p, invoiceCreditTitleAr: e.target.value }))}
                className={inp}
              />
            </Field>
            
            <Field label={isAR ? "عنوان الفاتورة الفرعي" : "Sub Invoice Title"}>
              <input
                value={form.invoiceCreditTitleEn}
                onChange={e => setForm(p => ({ ...p, invoiceCreditTitleEn: e.target.value }))}
                className={inp}
              />
            </Field>
            
            <Field label={isAR ? "حجم عنوان الفاتورة" : "Invoice Title Font Size"}>
              <input
                type="number"
                value={form.invoiceTitleFontSize}
                onChange={e => setForm(p => ({ ...p, invoiceTitleFontSize: Number(e.target.value) }))}
                className={inp}
              />
            </Field>
                <Field
                  label={isAR ? "نص التذييل في صفحات الطباعة" : "Footer text on print pages"}
                  hint={isAR ? "يظهر في أسفل كل فاتورة وسند" : "Appears at the bottom of each invoice and receipt"}
                >
                  <textarea
                    value={form.footerText}
                    onChange={e => setForm(p => ({ ...p, footerText: e.target.value }))}
                    rows={3}
                    className={`${inp} resize-none`}
                    placeholder={isAR ? "مثال: شكراً لتعاملكم معنا · جميع الأسعار شاملة الضريبة" : "e.g. Thank you for your business"}
                  />
                </Field>
              </div>
          </Section>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-sm text-blue-700 dark:text-blue-300">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>{isAR
            ? "جميع التغييرات تُطبَّق فوراً في كامل البرنامج وصفحات الطباعة عند الحفظ دون الحاجة لإعادة تشغيل."
            : "All changes are applied instantly across the entire app and print pages upon saving — no restart needed."}</p>
        </div>
      </div>
    </motion.div>
  );
}
