import { useEffect, useState } from "react";
import { Shield, Users, Database, Activity, PackageCheck, Copy, FileText, RefreshCw, Save, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import SettingsShell from "@/components/layout/SettingsShell";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "") + "/api";
const UNLOCK_KEY = "developer_unlocked";
const DEFAULT_LOGIN_FOOTER_TEXT = "Internal Accounting System For Companes - alsayed.mhd@gmail.com - Phone - 00201009697521 - 0097460020446";

type DeveloperSettings = {
  lockCompanyIdentity: boolean;
  lockCompanyName: boolean;
  lockLogo: boolean;
  lockStamp: boolean;
  lockLegalInfo: boolean;
  lockFooterBranding: boolean;
  loginFooterText: string;
  preventRebrandToAnotherCompany: boolean;
  licenseStatus: string;
  licensedCompanyName: string;
  licenseId: string;
  hardwareId: string;
  issuedAt: string;
  expiresAt: string;
  allowManagerEditAccountantSignature: boolean;
  allowManagerEditLegalInfo: boolean;
  allowManagerEditInvoicesBackupImport: boolean;
  allowManagerEditAppearance: boolean;
  allowManagerEditPrintSettings: boolean;
  allowManagerViewPreview: boolean;
  allowManagerViewUpdate: boolean;
  allowManagerEditBranding: boolean;
  allowManagerEditRegistrationSettings: boolean;
  allowManagerEditSensitiveUsers: boolean;
  sqlitePath?: string | null;
  databaseStatus?: string | null;
  databaseSize?: number | null;
  lastBackupAt?: string | null;
  appVersion?: string | null;
  frontendPath?: string | null;
  backendPath?: string | null;
  apiStatus?: string | null;
  envFileStatus?: string | null;
  resourcesStatus?: string | null;
  buildMode?: string | null;
  isPackaged?: boolean | null;
  installPath?: string | null;
};

const defaultSettings: DeveloperSettings = {
  lockCompanyIdentity: false,
  lockCompanyName: false,
  lockLogo: false,
  lockStamp: false,
  lockLegalInfo: false,
  lockFooterBranding: false,
  loginFooterText: "",
  preventRebrandToAnotherCompany: false,
  licenseStatus: "not_configured",
  licensedCompanyName: "",
  licenseId: "",
  hardwareId: "",
  issuedAt: "",
  expiresAt: "",
  allowManagerEditAccountantSignature: false,
  allowManagerEditLegalInfo: false,
  allowManagerEditInvoicesBackupImport: false,
  allowManagerEditAppearance: false,
  allowManagerEditPrintSettings: false,
  allowManagerViewPreview: false,
  allowManagerViewUpdate: false,
  allowManagerEditBranding: false,
  allowManagerEditRegistrationSettings: false,
  allowManagerEditSensitiveUsers: false,
};

const tabs = [
  { id: "security", labelAr: "الحماية والترخيص", labelEn: "Security & License", icon: Shield },
  { id: "manager", labelAr: "صلاحيات المدير", labelEn: "Manager Access", icon: Users },
  { id: "database", labelAr: "قاعدة البيانات", labelEn: "Database", icon: Database },
  { id: "diagnostics", labelAr: "النظام والتشخيص", labelEn: "Diagnostics", icon: Activity },
  { id: "updates", labelAr: "التحديث والتوزيع", labelEn: "Updates", icon: PackageCheck },
] as const;

type TabId = (typeof tabs)[number]["id"];
type DatabaseMode = "local" | "online";
type SyncMode = "local-to-online" | "online-to-local" | "bidirectional";
type AutoSyncTiming = "startup" | "interval";
type SyncStatus = "idle" | "success" | "failed" | "in-progress";
type BoolKey = {
  [K in keyof DeveloperSettings]: DeveloperSettings[K] extends boolean ? K : never;
}[keyof DeveloperSettings];
type TextKey = {
  [K in keyof DeveloperSettings]: DeveloperSettings[K] extends string ? K : never;
}[keyof DeveloperSettings];

const securityToggles: Array<[BoolKey, string, string, string, string]> = [
  ["lockCompanyIdentity", "قفل هوية الشركة", "Lock company identity", "يمنع تعديل الاسم والترجمة والوصف", "Prevents editing the name, translations, and description"],
  ["lockCompanyName", "قفل اسم الشركة", "Lock company name", "يمنع تغيير الاسم العربي أو الإنجليزي", "Prevents changing the Arabic or English company name"],
  ["lockLogo", "قفل الشعار", "Lock logo", "يمنع استبدال شعار الشركة", "Prevents replacing the company logo"],
  ["lockStamp", "قفل الختم", "Lock stamp", "يمنع استبدال ختم الشركة", "Prevents replacing the company stamp"],
  ["lockLegalInfo", "قفل البيانات القانونية", "Lock legal info", "يحمي السجل والضريبة وبيانات التواصل", "Protects registration, tax, and contact details"],
  ["lockFooterBranding", "قفل تذييل العلامة", "Lock footer branding", "يمنع تغيير نصوص العلامة في التذييل", "Prevents changing branding text in the footer"],
  ["preventRebrandToAnotherCompany", "منع إعادة العلامة لشركة أخرى", "Prevent rebranding to another company", "يربط الهوية باسم الشركة المرخص", "Keeps the identity tied to the licensed company name"],
];

const managerToggles: Array<[BoolKey, string, string, string, string]> = [
  ["allowManagerEditLegalInfo", "إظهار تبويب بيانات الشركة", "Show company info tab", "يعرض بيانات الشركة ومعلومات التواصل والبيانات القانونية", "Shows company, contact, and legal information"],
  ["allowManagerEditBranding", "إظهار تبويب الشعارات", "Show branding tab", "يعرض تبويب الشعار والختم والعلامة المائية والتوقيعات", "Shows logo, stamp, watermark, and signature settings"],
  ["allowManagerEditPrintSettings", "إظهار تبويب أدوات الطباعة", "Show print tools tab", "يعرض تبويب عناوين الفواتير وخيارات الطباعة", "Shows invoice titles and print options"],
  ["allowManagerEditInvoicesBackupImport", "إظهار تبويب النسخ الاحتياطي", "Show backup tab", "يعرض تبويب التصدير والاستيراد فقط", "Shows export and import only"],
  ["allowManagerViewUpdate", "إظهار تبويب تحديث البرنامج", "Show update tab", "يعرض تبويب فحص التحديثات والتوزيع", "Shows update checking and distribution"],
];

const licenseFields: Array<[TextKey, string, string]> = [
  ["licenseStatus", "حالة الترخيص", "License status"],
  ["licensedCompanyName", "اسم الشركة المرخص", "Licensed company name"],
  ["licenseId", "رقم الترخيص", "License ID"],
  ["hardwareId", "معرّف الجهاز", "Hardware ID"],
  ["issuedAt", "تاريخ الإصدار", "Issued at"],
  ["expiresAt", "تاريخ الانتهاء", "Expires at"],
];

function authHeaders() {
  const token = sessionStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatBytes(value: number | null | undefined, isAR: boolean) {
  if (!value) return isAR ? "غير متاح" : "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDisplayValue(value: string | number | boolean | null | undefined, isAR: boolean) {
  if (value === undefined || value === null || value === "") return isAR ? "غير متاح" : "Unavailable";
  if (typeof value === "boolean") return value ? (isAR ? "نعم" : "Yes") : (isAR ? "لا" : "No");
  const normalized = String(value);
  const labels: Record<string, [string, string]> = {
    connected: ["متصل", "Connected"],
    "not connected": ["غير متصل", "Not connected"],
    not_connected: ["غير متصل", "Not connected"],
    unavailable: ["غير متاح", "Unavailable"],
    idle: ["خامل", "Idle"],
    success: ["نجحت", "Success"],
    failed: ["فشلت", "Failed"],
    "in-progress": ["قيد التنفيذ", "In progress"],
    startup: ["عند بدء التشغيل", "On startup"],
    interval: ["كل فترة", "Interval"],
  };
  return labels[normalized.toLowerCase()]?.[isAR ? 0 : 1] ?? normalized;
}

function InfoRow({ label, value, isAR }: { label: string; value?: string | number | boolean | null; isAR: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{formatDisplayValue(value, isAR)}</div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function DevField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function DeveloperSettingsPage() {
  const { lang, isRTL } = useLanguage();
  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("security");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [settings, setSettings] = useState<DeveloperSettings>(defaultSettings);
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode>("local");
  const [databaseConfig, setDatabaseConfig] = useState({
    localPath: "lib/db/local.db",
    connectionStatus: "connected",
    host: "",
    port: "5432",
    databaseName: "",
    username: "",
    password: "",
    useConnectionString: false,
    connectionString: "",
  });
  const [syncConfig, setSyncConfig] = useState<{
    mode: SyncMode;
    autoSync: boolean;
    timing: AutoSyncTiming;
    intervalMinutes: number;
    lastSyncTime: string;
    status: SyncStatus;
  }>({
    mode: "local-to-online",
    autoSync: false,
    timing: "startup",
    intervalMinutes: 30,
    lastSyncTime: tr("غير متاح", "Unavailable"),
    status: "idle",
  });

  const developerTabs = tabs.map((tab) => ({
    ...tab,
    label: isAR ? tab.labelAr : tab.labelEn,
  }));

  useEffect(() => {
    if (sessionStorage.getItem(UNLOCK_KEY) === "true") setUnlocked(true);
  }, []);

  useEffect(() => {
    if (unlocked) void loadSettings();
  }, [unlocked]);

  async function loadSettings() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/developer/settings`, { headers: authHeaders() });
      if (!res.ok) throw new Error(tr("تعذر تحميل إعدادات المطوّر", "Failed to load developer settings"));
      const data = await res.json();
      setSettings({ ...defaultSettings, ...data });
      sessionStorage.setItem("developer_settings", JSON.stringify({ ...defaultSettings, ...data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("تعذر تحميل إعدادات المطوّر", "Failed to load developer settings"));
    }
  }

  async function unlockDeveloper(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/developer/unlock`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(tr("كلمة المرور غير صحيحة", "Incorrect password"));
      sessionStorage.setItem(UNLOCK_KEY, "true");
      setUnlocked(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("كلمة المرور غير صحيحة", "Incorrect password"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveSettings() {
    setError("");
    setSavedMessage("");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/developer/settings`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(tr("تعذر حفظ إعدادات المطوّر", "Failed to save developer settings"));
      const data = await res.json();
      setSettings({ ...defaultSettings, ...data });
      sessionStorage.setItem("developer_settings", JSON.stringify({ ...defaultSettings, ...data }));
      window.dispatchEvent(new CustomEvent("developer-settings-updated", { detail: data }));
      setSavedMessage(tr("تم الحفظ", "Saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("تعذر حفظ إعدادات المطوّر", "Failed to save developer settings"));
    } finally {
      setIsSaving(false);
    }
  }

  async function checkDatabase() {
    setDatabaseMessage("");
    const res = await fetch(`${API_BASE}/developer/database/check`, { headers: authHeaders() });
    const data = await res.json();
    setSettings((current) => ({ ...current, ...data }));
    if (data.sqlitePath) {
      setDatabaseConfig((current) => ({
        ...current,
        localPath: data.sqlitePath,
        connectionStatus: data.databaseStatus === "connected" ? "connected" : "not_connected",
      }));
    }
    setDatabaseMessage(data.databaseStatus === "connected" ? tr("الاتصال سليم", "Connection OK") : tr("قاعدة البيانات غير متاحة", "Database unavailable"));
  }

  async function copyDatabasePath() {
    await navigator.clipboard?.writeText(settings.sqlitePath || "");
    setDatabaseMessage(settings.sqlitePath ? tr("تم نسخ المسار", "Path copied") : tr("المسار غير متاح", "Path unavailable"));
  }

  function createSqlFile() {
    window.open(`${API_BASE}/developer/database/sql`, "_blank");
  }

  async function testPreparedConnection() {
    setDatabaseMessage("");

    if (databaseMode !== "online") {
      setDatabaseMessage(tr("اختر قاعدة أونلاين لاختبار Connection String", "Select Online database to test the connection string"));
      return;
    }

    if (!databaseConfig.useConnectionString) {
      setDatabaseMessage(tr("فعّل خيار Connection String الكامل ثم أدخل الرابط", "Enable full connection string and enter the URL"));
      return;
    }

    const connectionString = databaseConfig.connectionString.trim();
    if (!connectionString) {
      setDatabaseMessage(tr("Connection String مطلوب لاختبار الاتصال", "Connection string is required to test the connection"));
      return;
    }

    if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
      setDatabaseMessage(tr("يدعم الاختبار PostgreSQL connection string فقط حالياً", "Only PostgreSQL connection strings are supported for now"));
      return;
    }

    setIsTestingConnection(true);
    try {
      const res = await fetch(`${API_BASE}/developer/database/test-online`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setDatabaseMessage(data?.error ? tr(`فشل الاتصال: ${data.error}`, `Connection failed: ${data.error}`) : tr("فشل الاتصال", "Connection failed"));
        return;
      }

      setDatabaseMessage(tr("تم الاتصال بنجاح", "Connected successfully"));
    } catch {
      setDatabaseMessage(tr("تعذر اختبار الاتصال بالخادم", "Could not test the connection through the server"));
    } finally {
      setIsTestingConnection(false);
    }
  }

  function savePreparedConnection() {
    setDatabaseMessage(tr("تم حفظ إعدادات العرض محليًا داخل الجلسة الحالية", "Display settings saved locally in this session"));
  }

  function showLocalDatabasePreviewMessage() {
    setDatabaseMessage(tr("هذا الزر لا ينشئ قاعدة فعلية حالياً", "This button does not create an actual database right now"));
  }

  const setBool = (key: BoolKey, checked: boolean) => setSettings((current) => ({ ...current, [key]: checked }));
  const setText = (key: TextKey, value: string) => setSettings((current) => ({ ...current, [key]: value }));

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
        <Card className="w-full rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl">{tr("دخول المطوّر", "Developer Login")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={unlockDeveloper} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="developer-password">{tr("كلمة المرور", "Password")}</Label>
                <Input id="developer-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              </div>
              {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? tr("جارٍ الدخول...", "Signing in...") : tr("دخول", "Sign in")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SettingsShell
      dir={isRTL ? "rtl" : "ltr"}
      width="default"
      title={isAR ? "إعدادات المطوّر" : "Developer Settings"}
      description={isAR ? "إعدادات حماية وتشخيص لا تعرض أسرار النظام أو كلمات المرور." : "System protection, diagnostics, database, and release controls."}
      tabs={developerTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <Button type="button" onClick={saveSettings} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? (isAR ? "جارٍ الحفظ..." : "Saving...") : (isAR ? "حفظ" : "Save")}
        </Button>
      }
    >

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {savedMessage && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMessage}</div>}

      {activeTab === "security" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="text-lg">{tr("الحماية والترخيص", "Security & License")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {securityToggles.map(([key, labelAr, labelEn, hintAr, hintEn]) => (
                <ToggleRow key={key} label={tr(labelAr, labelEn)} hint={tr(hintAr, hintEn)} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="text-lg">{tr("بيانات الترخيص", "License Details")}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="space-y-1">
                <Label>{tr("نص أسفل صفحة الدخول", "Login footer text")}</Label>
                <Textarea
                  value={settings.loginFooterText || DEFAULT_LOGIN_FOOTER_TEXT}
                  onChange={(event) => setText("loginFooterText", event.target.value)}
                  className="min-h-20"
                />
              </div>
              {licenseFields.map(([key, labelAr, labelEn]) => (
                <div key={key} className="space-y-1">
                  <Label>{tr(labelAr, labelEn)}</Label>
                  <Input value={settings[key] || ""} onChange={(event) => setText(key, event.target.value)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "manager" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">{tr("صلاحيات المدير", "Manager Access")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {managerToggles.map(([key, labelAr, labelEn, hintAr, hintEn]) => (
              <ToggleRow key={key} label={tr(labelAr, labelEn)} hint={tr(hintAr, hintEn)} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "database" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">{tr("قاعدة البيانات", "Database")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow isAR={isAR} label={tr("مسار SQLite", "SQLite path")} value={settings.sqlitePath} />
              <InfoRow isAR={isAR} label={tr("حالة قاعدة البيانات", "Database status")} value={settings.databaseStatus} />
              <InfoRow isAR={isAR} label={tr("حجم قاعدة البيانات", "Database size")} value={formatBytes(settings.databaseSize, isAR)} />
              <InfoRow isAR={isAR} label={tr("آخر نسخة احتياطية", "Last backup")} value={settings.lastBackupAt} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={checkDatabase} className="gap-2"><RefreshCw className="h-4 w-4" />{tr("فحص الاتصال", "Check connection")}</Button>
              <Button type="button" variant="outline" onClick={copyDatabasePath} className="gap-2"><Copy className="h-4 w-4" />{tr("نسخ مسار قاعدة البيانات", "Copy database path")}</Button>
              <Button type="button" variant="outline" onClick={createSqlFile} className="gap-2"><FileText className="h-4 w-4" />{tr("إنشاء ملف SQL", "Create SQL file")}</Button>
            </div>
            {databaseMessage && <div className="text-sm text-muted-foreground">{databaseMessage}</div>}

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                <Database className="h-4 w-4 text-primary" />
                <span>{tr("نوع قاعدة البيانات", "Database type")}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { id: "local" as DatabaseMode, icon: Database, label: tr("قاعدة محلية (SQLite)", "Local database (SQLite)") },
                  { id: "online" as DatabaseMode, icon: Cloud, label: tr("قاعدة أونلاين (PostgreSQL / MySQL لاحقًا)", "Online database (PostgreSQL / MySQL later)") },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDatabaseMode(option.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                      databaseMode === option.id ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-background hover:border-primary/40"
                    )}
                  >
                    <option.icon className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {databaseMode === "local" && (
              <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Database className="h-4 w-4 text-emerald-600" />
                  <span>{tr("قاعدة البيانات المحلية", "Local database")}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <DevField label={tr("مسار قاعدة البيانات", "Database path")}>
                    <Input
                      value={databaseConfig.localPath}
                      onChange={(event) => setDatabaseConfig((current) => ({ ...current, localPath: event.target.value }))}
                      dir="ltr"
                    />
                  </DevField>
                  <DevField label={tr("حالة الاتصال", "Connection status")}>
                    <div className="flex h-10 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
                      <span className={cn("font-semibold", databaseConfig.connectionStatus === "connected" ? "text-emerald-600" : "text-red-600")}>
                        {formatDisplayValue(databaseConfig.connectionStatus, isAR)}
                      </span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", databaseConfig.connectionStatus === "connected" ? "bg-emerald-500" : "bg-red-500")} />
                    </div>
                  </DevField>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={showLocalDatabasePreviewMessage} size="sm">{tr("إنشاء قاعدة جديدة", "Create new database")}</Button>
                  <Button type="button" variant="outline" onClick={createSqlFile} size="sm">{tr("تحميل ملف SQL لإنشاء قاعدة جديدة", "Download SQL file to create a new database")}</Button>
                </div>
              </div>
            )}

            {databaseMode === "online" && (
              <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Cloud className="h-4 w-4 text-blue-600" />
                  <span>{tr("إعدادات قاعدة البيانات الأونلاين", "Online database settings")}</span>
                </div>
                <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={databaseConfig.useConnectionString}
                    onChange={(event) => setDatabaseConfig((current) => ({ ...current, useConnectionString: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{tr("استخدام Connection String كامل", "Use full connection string")}</span>
                </label>

                {databaseConfig.useConnectionString ? (
                  <DevField label="Connection String">
                    <Input
                      type="password"
                      value={databaseConfig.connectionString}
                      onChange={(event) => setDatabaseConfig((current) => ({ ...current, connectionString: event.target.value }))}
                      placeholder="postgresql://user:password@host:5432/database"
                      dir="ltr"
                    />
                  </DevField>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <DevField label="Host">
                      <Input value={databaseConfig.host} onChange={(event) => setDatabaseConfig((current) => ({ ...current, host: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label="Port">
                      <Input value={databaseConfig.port} onChange={(event) => setDatabaseConfig((current) => ({ ...current, port: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label={tr("اسم قاعدة البيانات", "Database name")}>
                      <Input value={databaseConfig.databaseName} onChange={(event) => setDatabaseConfig((current) => ({ ...current, databaseName: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label={tr("اسم المستخدم", "Username")}>
                      <Input value={databaseConfig.username} onChange={(event) => setDatabaseConfig((current) => ({ ...current, username: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label={tr("كلمة المرور", "Password")}>
                      <Input type="password" value={databaseConfig.password} onChange={(event) => setDatabaseConfig((current) => ({ ...current, password: event.target.value }))} dir="ltr" />
                    </DevField>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={testPreparedConnection} size="sm" disabled={isTestingConnection}>
                  {isTestingConnection ? tr("جارٍ الاختبار...", "Testing...") : tr("اختبار الاتصال", "Test connection")}
                </Button>
                <Button type="button" variant="outline" onClick={savePreparedConnection} size="sm">{tr("حفظ الإعدادات", "Save settings")}</Button>
                <Button type="button" onClick={checkDatabase} size="sm">{tr("اتصال", "Connect")}</Button>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span>{tr("خيارات المزامنة", "Sync options")}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "local-to-online" as SyncMode, label: tr("مزامنة المحلي إلى الأونلاين", "Sync local to online") },
                      { id: "online-to-local" as SyncMode, label: tr("مزامنة الأونلاين إلى المحلي", "Sync online to local") },
                      { id: "bidirectional" as SyncMode, label: tr("مزامنة ثنائية الاتجاه", "Bidirectional sync") },
                    ].map((mode) => (
                      <label key={mode.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <input
                          type="radio"
                          checked={syncConfig.mode === mode.id}
                          onChange={() => setSyncConfig((current) => ({ ...current, mode: mode.id }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{mode.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <Activity className="h-4 w-4 text-primary" />
                    <span>{tr("الجدولة والحالة", "Schedule and status")}</span>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span>{tr("مزامنة تلقائية", "Auto sync")}</span>
                    <input
                      type="checkbox"
                      checked={syncConfig.autoSync}
                      onChange={(event) => setSyncConfig((current) => ({ ...current, autoSync: event.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <DevField label={tr("التوقيت", "Timing")}>
                      <select
                        value={syncConfig.timing}
                        onChange={(event) => setSyncConfig((current) => ({ ...current, timing: event.target.value as AutoSyncTiming }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="startup">{tr("عند بدء التشغيل", "On startup")}</option>
                        <option value="interval">{tr("كل فترة", "Interval")}</option>
                      </select>
                    </DevField>
                    <DevField label={tr("الفاصل بالدقائق", "Interval in minutes")}>
                      <Input
                        type="number"
                        min={1}
                        value={syncConfig.intervalMinutes}
                        onChange={(event) => setSyncConfig((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))}
                      />
                    </DevField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoRow isAR={isAR} label={tr("آخر مزامنة", "Last sync")} value={syncConfig.lastSyncTime} />
                    <InfoRow isAR={isAR} label={tr("الحالة", "Status")} value={syncConfig.status} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "diagnostics" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">{tr("النظام والتشخيص", "Diagnostics")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <InfoRow isAR={isAR} label={tr("إصدار التطبيق", "App version")} value={settings.appVersion || import.meta.env.VITE_APP_VERSION} />
            <InfoRow isAR={isAR} label={tr("مسار الواجهة", "Frontend path")} value={settings.frontendPath} />
            <InfoRow isAR={isAR} label={tr("مسار الخادم", "Backend path")} value={settings.backendPath} />
            <InfoRow isAR={isAR} label={tr("حالة API", "API status")} value={settings.apiStatus} />
            <InfoRow isAR={isAR} label={tr("حالة ملف env", "env file status")} value={settings.envFileStatus} />
            <InfoRow isAR={isAR} label={tr("حالة الموارد", "Resources status")} value={settings.resourcesStatus} />
          </CardContent>
        </Card>
      )}

      {activeTab === "updates" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">{tr("التحديث والتوزيع", "Updates and Distribution")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <InfoRow isAR={isAR} label={tr("إصدار التطبيق", "App version")} value={settings.appVersion || import.meta.env.VITE_APP_VERSION} />
            <InfoRow isAR={isAR} label={tr("وضع البناء", "Build mode")} value={settings.buildMode} />
            <InfoRow isAR={isAR} label={tr("نسخة packaged", "Packaged build")} value={settings.isPackaged} />
            <InfoRow isAR={isAR} label={tr("مسار التثبيت", "Install path")} value={settings.installPath} />
          </CardContent>
        </Card>
      )}
    </SettingsShell>
  );
}
