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

type TabId = "preview" | "identity" | "contact" | "legal" | "branding" | "print" | "display";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
        <Icon className="w-4 h-4" />
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
  const logoRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const watermarkRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("identity");

  useEffect(() => {
    setForm({ ...DEFAULT_SETTINGS, ...settings });
    setLogoPreview(settings.logoBase64 || null);
    setStampPreview(settings.stampBase64 || null);
    setWatermarkPreview(settings.watermarkBase64 || null);
  }, [settings]);

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
    field: "logoBase64" | "stampBase64" | "watermarkBase64",
    setPreview: (v: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: isAR ? "الحجم كبير جداً (2 MB كحد أقصى)" : "File too large (max 2 MB)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setForm(p => ({ ...p, [field]: base64 }));
      setPreview(base64);
    };
    reader.readAsDataURL(file);
  };

    const handleSave = async () => {
      setSaving(true);
      try {
        const token = sessionStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/company-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(form),
        });
    
        if (!res.ok) throw new Error("Failed");
    
        const saved = await res.json();
        const mergedSaved = { ...DEFAULT_SETTINGS, ...saved };
    
        setForm(mergedSaved);
        setSettings(mergedSaved);
        localStorage.setItem("company_settings", JSON.stringify(mergedSaved));
    
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
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form[field] ? "translate-x-5" : ""}`}
      />
    </button>
  );

  const currentLogoSrc = logoPreview || logoSrc;
  const currentStampSrc = stampPreview || stampSrc;
  const currentWatermarkSrc = watermarkPreview || watermarkSrc;

  const TABS: { id: TabId; icon: React.ElementType; labelAr: string; labelEn: string; color: string }[] = [
    { id: "display",  icon: Palette,   labelAr: "المظهر",           labelEn: "Display",  color: "text-fuchsia-500"},
    { id: "preview",  icon: Eye,       labelAr: "معاينة الفاتورة", labelEn: "Preview",  color: "text-indigo-500" },
    { id: "identity", icon: Building2, labelAr: "هوية الشركة",    labelEn: "Identity", color: "text-blue-500"   },
    { id: "contact",  icon: Phone,     labelAr: "التواصل",         labelEn: "Contact",  color: "text-green-500"  },
    { id: "legal",    icon: Hash,      labelAr: "القانونية",        labelEn: "Legal",    color: "text-amber-500"  },
    { id: "branding", icon: Image,     labelAr: "الشعارات",         labelEn: "Branding", color: "text-purple-500" },
    { id: "print",    icon: Printer,   labelAr: "الطباعة",          labelEn: "Print",    color: "text-rose-500"   },
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
              {resolvedName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate leading-tight">{resolvedName || user?.displayName}</p>
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
              <tab.icon className={cn("w-4 h-4 shrink-0", activeTab === tab.id ? "text-primary" : tab.color)} />
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
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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

        {/* ── Display Tab ── */}
        {activeTab === "display" && (() => {
          const storedTheme = localStorage.getItem("theme");
          const currentTheme = storedTheme === "dark" ? "dark" : storedTheme === "light" ? "light" : "system";
          const toggleTheme = (mode: "light" | "dark" | "system") => {
            if (mode === "dark") { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
            else if (mode === "light") { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
            else { localStorage.removeItem("theme"); document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches); }
          };

          const ToggleSwitch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
            <button type="button" onClick={() => onChange(!on)} className={tog(on)}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
            </button>
          );

          const SectionCard = ({ icon: Icon, title, color, children }: { icon: React.ElementType; title: string; color: string; children: React.ReactNode }) => (
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
                <Icon className="w-4 h-4" /><h2 className="text-sm font-bold">{title}</h2>
              </div>
              <div className="p-5">{children}</div>
            </div>
          );

          return (
            <div className="space-y-5">

              {/* ─ Theme ─ */}
              <SectionCard icon={Sun} title={isAR ? "ثيم الواجهة" : "Interface Theme"} color="bg-yellow-500/5">
                <div className="grid grid-cols-3 gap-2">
                  {([["light", Sun, isAR ? "فاتح" : "Light"], ["dark", Moon, isAR ? "داكن" : "Dark"], ["system", Monitor, isAR ? "تلقائي" : "System"]] as const).map(([mode, Icon, label]) => (
                    <button key={mode} onClick={() => { toggleTheme(mode); }}
                      className={cn("flex flex-col items-center gap-2 py-4 px-2 rounded-xl text-xs font-semibold border-2 transition-all",
                        currentTheme === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <Icon className="w-5 h-5" />{label}
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
                      <Ic className="w-5 h-5" />
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
                          className="w-10 h-10 rounded-xl border border-border cursor-pointer p-0.5 bg-background"
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
                          <Upload className="w-4 h-4" />
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
                        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
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
                      <Icon className="w-5 h-5" />
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
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{isAR ? labelAr : labelEn}</p>
                          <p className="text-xs text-muted-foreground">{isAR ? hintAr : hintEn}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => updateDisplay({ [field]: !display[field] })} className={tog(!!display[field])}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${display[field] ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Reset note */}
              <div className="flex items-start gap-3 p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl text-sm text-fuchsia-700 dark:text-fuchsia-300">
                <Palette className="w-5 h-5 mt-0.5 shrink-0" />
                <p>{isAR
                  ? "جميع خيارات المظهر تُطبَّق فوراً وتُحفظ تلقائياً في المتصفح، ولا تؤثر على بيانات الفواتير أو الإعدادات الأخرى."
                  : "All display options are applied instantly and saved locally in the browser. They do not affect invoices or other settings."}</p>
              </div>
            </div>
          );
        })()}

        {/* ── Preview Tab ── */}
        {activeTab === "preview" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-indigo-500/5">
              <Eye className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold">{isAR ? "معاينة رأس الفاتورة" : "Invoice Header Preview"}</h2>
            </div>
            <div className="p-4">
              <div className="border-b-4 border-double border-gray-700 pb-3 pt-2 px-4 bg-white rounded-xl shadow-inner" style={{ fontFamily: "'Cairo', sans-serif" }}>
                <div className="flex items-start justify-between">
                  <div className="text-right">
                    <div className="text-lg font-black text-gray-900 leading-tight">{form.nameAr.split(" ").slice(0, 2).join(" ")}</div>
                    <div className="text-sm font-bold text-gray-700">{form.subtitleAr}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{form.nameEn}</div>
                    <div className="text-xs text-gray-500">{form.taglineAr}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src={currentLogoSrc} alt="logo" className="h-16 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-black text-gray-900 leading-tight">{form.nameEn.split(" ").slice(0, 3).join(" ")}</div>
                    <div className="text-sm font-bold text-gray-700">{form.subtitleEn}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{form.email}</div>
                    <div className="text-xs text-gray-500">Tel: {form.phone} · {form.poBox}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 mx-4 mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{isAR ? "هذه معاينة حية تعكس بيانات النماذج في الأقسام الأخرى." : "This is a live preview reflecting the data in the other sections."}</p>
            </div>
          </div>
        )}

        {/* ── Identity Tab ── */}
        {activeTab === "identity" && (
          <Section icon={Building2} title={isAR ? "هوية الشركة" : "Company Identity"} color="bg-blue-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "اسم الشركة (عربي)" : "Company Name (Arabic)"}>
                <input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} className={inp} placeholder="حول العالم للتخليص الجمركي" />
              </Field>
              <Field label={isAR ? "اسم الشركة (إنجليزي)" : "Company Name (English)"}>
                <input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="Around The World Customs Clearance" />
              </Field>
              <Field label={isAR ? "الترجمة الثانوية (عربي)" : "Subtitle (Arabic)"}>
                <input value={form.subtitleAr} onChange={e => setForm(p => ({ ...p, subtitleAr: e.target.value }))} className={inp} placeholder="للتخليص الجمركي" />
              </Field>
              <Field label={isAR ? "الترجمة الثانوية (إنجليزي)" : "Subtitle (English)"}>
                <input value={form.subtitleEn} onChange={e => setForm(p => ({ ...p, subtitleEn: e.target.value }))} className={inp} placeholder="Customs Clearance" />
              </Field>
              <Field label={isAR ? "الوصف (عربي)" : "Tagline (Arabic)"}>
                <input value={form.taglineAr} onChange={e => setForm(p => ({ ...p, taglineAr: e.target.value }))} className={inp} placeholder="خدمات التخليص الجمركي والشحن" />
              </Field>
              <Field label={isAR ? "الوصف (إنجليزي)" : "Tagline (English)"}>
                <input value={form.taglineEn} onChange={e => setForm(p => ({ ...p, taglineEn: e.target.value }))} className={inp} placeholder="Customs Clearance & Shipping Services" />
              </Field>
            </div>
          </Section>
        )}

        {/* ── Contact Tab ── */}
        {activeTab === "contact" && (
          <Section icon={Phone} title={isAR ? "معلومات التواصل" : "Contact Information"} color="bg-green-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "البريد الإلكتروني" : "Email"}>
                <div className="relative">
                  <Mail className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={`${inp} ps-9`} placeholder="example@company.com" type="email" />
                </div>
              </Field>
              <Field label={isAR ? "رقم الهاتف" : "Phone"}>
                <div className="relative">
                  <Phone className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={`${inp} ps-9`} placeholder="55251595" />
                </div>
              </Field>
              <Field label={isAR ? "العنوان" : "Address"}>
                <div className="relative">
                  <MapPin className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={`${inp} ps-9`} placeholder="Doha, Qatar" />
                </div>
              </Field>
              <Field label={isAR ? "صندوق البريد" : "P.O Box"}>
                <input value={form.poBox} onChange={e => setForm(p => ({ ...p, poBox: e.target.value }))} className={inp} placeholder="P.O BOX 8180" />
              </Field>
              <Field label={isAR ? "الموقع الإلكتروني" : "Website"}>
                <div className="relative">
                  <Globe className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                  <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} className={`${inp} ps-9`} placeholder="www.company.com" />
                </div>
              </Field>
            </div>
          </Section>
        )}

        {/* ── Legal Tab ── */}
        {activeTab === "legal" && (
          <Section icon={Hash} title={isAR ? "المعلومات القانونية" : "Legal Information"} color="bg-amber-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "رقم السجل التجاري" : "Commercial Registration No."}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                  <input value={form.crNumber} onChange={e => setForm(p => ({ ...p, crNumber: e.target.value }))} className={`${inp} ps-9`} placeholder="12345678" />
                </div>
              </Field>
              <Field label={isAR ? "الرقم الضريبي" : "Tax / VAT Number"}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
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
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "ضبط" : "Reset"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG/JPG · أقصى 2 MB" : "PNG/JPG · Max 2 MB"}</p>
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "logoBase64", setLogoPreview)} />
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
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "ضبط" : "Reset"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG شفاف · أقصى 2 MB" : "Transparent PNG · Max 2 MB"}</p>
                </div>
                <input ref={stampRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "stampBase64", setStampPreview)} />
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
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "ضبط" : "Reset"}
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
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{isAR ? labelAr : labelEn}</span>
                  </div>
                  <Toggle field={field} />
                </div>
              ))}
              <div className="pt-2 border-t border-border/40">
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
                <Field label={isAR ? "عنوان الفاتورة النقدية (عربي)" : "Cash Invoice Title (Arabic)"}>
              <input
                value={form.invoiceCashTitleAr}
                onChange={e => setForm(p => ({ ...p, invoiceCashTitleAr: e.target.value }))}
                className={inp}
              />
            </Field>
            
            <Field label={isAR ? "عنوان الفاتورة النقدية (إنجليزي)" : "Cash Invoice Title (English)"}>
              <input
                value={form.invoiceCashTitleEn}
                onChange={e => setForm(p => ({ ...p, invoiceCashTitleEn: e.target.value }))}
                className={inp}
              />
            </Field>
            
            <Field label={isAR ? "عنوان فاتورة الحساب (عربي)" : "Credit Invoice Title (Arabic)"}>
              <input
                value={form.invoiceCreditTitleAr}
                onChange={e => setForm(p => ({ ...p, invoiceCreditTitleAr: e.target.value }))}
                className={inp}
              />
            </Field>
            
            <Field label={isAR ? "عنوان فاتورة الحساب (إنجليزي)" : "Credit Invoice Title (English)"}>
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
              </div>
            </div>
          </Section>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-sm text-blue-700 dark:text-blue-300">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p>{isAR
            ? "جميع التغييرات تُطبَّق فوراً في كامل البرنامج وصفحات الطباعة عند الحفظ دون الحاجة لإعادة تشغيل."
            : "All changes are applied instantly across the entire app and print pages upon saving — no restart needed."}</p>
        </div>
      </div>
    </motion.div>
  );
}
