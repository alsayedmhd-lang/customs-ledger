import { useEffect, useState } from "react";
import { Shield, Users, Database, Activity, PackageCheck, Copy, FileText, RefreshCw, Save, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "") + "/api";
const UNLOCK_KEY = "developer_unlocked";
const NA = "غير متاح";

type DeveloperSettings = {
  lockCompanyIdentity: boolean;
  lockCompanyName: boolean;
  lockLogo: boolean;
  lockStamp: boolean;
  lockLegalInfo: boolean;
  lockFooterBranding: boolean;
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
  { id: "security", label: "الحماية والترخيص", icon: Shield },
  { id: "manager", label: "صلاحيات المدير", icon: Users },
  { id: "database", label: "قاعدة البيانات", icon: Database },
  { id: "diagnostics", label: "النظام والتشخيص", icon: Activity },
  { id: "updates", label: "التحديث والتوزيع", icon: PackageCheck },
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

const securityToggles: Array<[BoolKey, string, string]> = [
  ["lockCompanyIdentity", "قفل هوية الشركة", "يمنع تعديل الاسم والترجمة والوصف"],
  ["lockCompanyName", "قفل اسم الشركة", "يمنع تغيير الاسم العربي أو الإنجليزي"],
  ["lockLogo", "قفل الشعار", "يمنع استبدال شعار الشركة"],
  ["lockStamp", "قفل الختم", "يمنع استبدال ختم الشركة"],
  ["lockLegalInfo", "قفل البيانات القانونية", "يحمي السجل والضريبة وبيانات التواصل"],
  ["lockFooterBranding", "قفل تذييل العلامة", "يمنع تغيير نصوص العلامة في التذييل"],
  ["preventRebrandToAnotherCompany", "منع إعادة العلامة لشركة أخرى", "يربط الهوية باسم الشركة المرخص"],
];

const managerToggles: Array<[BoolKey, string, string]> = [
  ["allowManagerEditLegalInfo", "إظهار تبويب بيانات الشركة", "يعرض بيانات الشركة ومعلومات التواصل والبيانات القانونية"],
  ["allowManagerEditBranding", "إظهار تبويب الشعارات", "يعرض تبويب الشعار والختم والعلامة المائية والتوقيعات"],
  ["allowManagerEditPrintSettings", "إظهار تبويب أدوات الطباعة", "يعرض تبويب عناوين الفواتير وخيارات الطباعة"],
  ["allowManagerEditInvoicesBackupImport", "إظهار تبويب النسخ الاحتياطي", "يعرض تبويب التصدير والاستيراد فقط"],
  ["allowManagerViewUpdate", "إظهار تبويب تحديث البرنامج", "يعرض تبويب فحص التحديثات والتوزيع"],
];

const licenseFields: Array<[TextKey, string]> = [
  ["licenseStatus", "حالة الترخيص"],
  ["licensedCompanyName", "اسم الشركة المرخص"],
  ["licenseId", "رقم الترخيص"],
  ["hardwareId", "معرّف الجهاز"],
  ["issuedAt", "تاريخ الإصدار"],
  ["expiresAt", "تاريخ الانتهاء"],
];

function authHeaders() {
  const token = sessionStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatBytes(value?: number | null) {
  if (!value) return NA;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value === undefined || value === null || value === "" ? NA : String(value)}</div>
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
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("security");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [settings, setSettings] = useState<DeveloperSettings>(defaultSettings);
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode>("local");
  const [databaseConfig, setDatabaseConfig] = useState({
    localPath: "lib/db/local.db",
    connectionStatus: "Connected",
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
    lastSyncTime: "غير متاح",
    status: "idle",
  });

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
      if (!res.ok) throw new Error("تعذر تحميل إعدادات المطوّر");
      const data = await res.json();
      setSettings({ ...defaultSettings, ...data });
      sessionStorage.setItem("developer_settings", JSON.stringify({ ...defaultSettings, ...data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل إعدادات المطوّر");
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
      if (!res.ok) throw new Error("كلمة المرور غير صحيحة");
      sessionStorage.setItem(UNLOCK_KEY, "true");
      setUnlocked(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "كلمة المرور غير صحيحة");
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
      if (!res.ok) throw new Error("تعذر حفظ إعدادات المطوّر");
      const data = await res.json();
      setSettings({ ...defaultSettings, ...data });
      sessionStorage.setItem("developer_settings", JSON.stringify({ ...defaultSettings, ...data }));
      window.dispatchEvent(new CustomEvent("developer-settings-updated", { detail: data }));
      setSavedMessage("تم الحفظ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ إعدادات المطوّر");
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
        connectionStatus: data.databaseStatus === "connected" ? "Connected" : "Not Connected",
      }));
    }
    setDatabaseMessage(data.databaseStatus === "connected" ? "الاتصال سليم" : "قاعدة البيانات غير متاحة");
  }

  async function copyDatabasePath() {
    await navigator.clipboard?.writeText(settings.sqlitePath || "");
    setDatabaseMessage(settings.sqlitePath ? "تم نسخ المسار" : "المسار غير متاح");
  }

  function createSqlFile() {
    window.open(`${API_BASE}/developer/database/sql`, "_blank");
  }

  function testPreparedConnection() {
    setDatabaseMessage(databaseMode === "local" ? "تم فحص إعدادات SQLite المحلية" : "تم فحص نموذج إعدادات الاتصال بدون إرسال أسرار");
  }

  function savePreparedConnection() {
    setDatabaseMessage("تم حفظ إعدادات العرض محليًا داخل الجلسة الحالية");
  }

  const setBool = (key: BoolKey, checked: boolean) => setSettings((current) => ({ ...current, [key]: checked }));
  const setText = (key: TextKey, value: string) => setSettings((current) => ({ ...current, [key]: value }));

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
        <Card className="w-full rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl">دخول المطوّر / Developer Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={unlockDeveloper} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="developer-password">كلمة المرور</Label>
                <Input id="developer-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              </div>
              {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>دخول</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">إعدادات المطوّر</h1>
          <p className="mt-1 text-sm text-muted-foreground">إعدادات حماية وتشخيص لا تعرض أسرار النظام أو كلمات المرور.</p>
        </div>
        <Button type="button" onClick={saveSettings} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "جار الحفظ..." : "حفظ"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {savedMessage && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMessage}</div>}

      {activeTab === "security" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="text-lg">الحماية والترخيص</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {securityToggles.map(([key, label, hint]) => (
                <ToggleRow key={key} label={label} hint={hint} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="text-lg">بيانات الترخيص</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {licenseFields.map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input value={settings[key] || ""} onChange={(event) => setText(key, event.target.value)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "manager" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">صلاحيات المدير</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {managerToggles.map(([key, label, hint]) => (
              <ToggleRow key={key} label={label} hint={hint} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "database" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">قاعدة البيانات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow label="مسار SQLite" value={settings.sqlitePath} />
              <InfoRow label="حالة قاعدة البيانات" value={settings.databaseStatus} />
              <InfoRow label="حجم قاعدة البيانات" value={formatBytes(settings.databaseSize)} />
              <InfoRow label="آخر نسخة احتياطية" value={settings.lastBackupAt} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={checkDatabase} className="gap-2"><RefreshCw className="h-4 w-4" />فحص الاتصال</Button>
              <Button type="button" variant="outline" onClick={copyDatabasePath} className="gap-2"><Copy className="h-4 w-4" />نسخ مسار قاعدة البيانات</Button>
              <Button type="button" variant="outline" onClick={createSqlFile} className="gap-2"><FileText className="h-4 w-4" />إنشاء ملف SQL</Button>
            </div>
            {databaseMessage && <div className="text-sm text-muted-foreground">{databaseMessage}</div>}

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                <Database className="h-4 w-4 text-primary" />
                <span>نوع قاعدة البيانات</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { id: "local" as DatabaseMode, icon: Database, label: "قاعدة محلية (SQLite)" },
                  { id: "online" as DatabaseMode, icon: Cloud, label: "قاعدة أونلاين (PostgreSQL / MySQL لاحقًا)" },
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
                  <span>قاعدة البيانات المحلية</span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <DevField label="مسار قاعدة البيانات">
                    <Input
                      value={databaseConfig.localPath}
                      onChange={(event) => setDatabaseConfig((current) => ({ ...current, localPath: event.target.value }))}
                      dir="ltr"
                    />
                  </DevField>
                  <DevField label="حالة الاتصال">
                    <div className="flex h-10 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
                      <span className={cn("font-semibold", databaseConfig.connectionStatus === "Connected" ? "text-emerald-600" : "text-red-600")}>
                        {databaseConfig.connectionStatus === "Connected" ? "متصل" : "غير متصل"}
                      </span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", databaseConfig.connectionStatus === "Connected" ? "bg-emerald-500" : "bg-red-500")} />
                    </div>
                  </DevField>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={testPreparedConnection} size="sm">إنشاء قاعدة جديدة</Button>
                  <Button type="button" variant="outline" onClick={createSqlFile} size="sm">تحميل ملف SQL لإنشاء قاعدة جديدة</Button>
                </div>
              </div>
            )}

            {databaseMode === "online" && (
              <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Cloud className="h-4 w-4 text-blue-600" />
                  <span>إعدادات قاعدة البيانات الأونلاين</span>
                </div>
                <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={databaseConfig.useConnectionString}
                    onChange={(event) => setDatabaseConfig((current) => ({ ...current, useConnectionString: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>استخدام Connection String كامل</span>
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
                    <DevField label="اسم قاعدة البيانات">
                      <Input value={databaseConfig.databaseName} onChange={(event) => setDatabaseConfig((current) => ({ ...current, databaseName: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label="اسم المستخدم">
                      <Input value={databaseConfig.username} onChange={(event) => setDatabaseConfig((current) => ({ ...current, username: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label="كلمة المرور">
                      <Input type="password" value={databaseConfig.password} onChange={(event) => setDatabaseConfig((current) => ({ ...current, password: event.target.value }))} dir="ltr" />
                    </DevField>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={testPreparedConnection} size="sm">اختبار الاتصال</Button>
                <Button type="button" variant="outline" onClick={savePreparedConnection} size="sm">حفظ الإعدادات</Button>
                <Button type="button" onClick={checkDatabase} size="sm">اتصال</Button>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span>خيارات المزامنة</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "local-to-online" as SyncMode, label: "مزامنة المحلي إلى الأونلاين" },
                      { id: "online-to-local" as SyncMode, label: "مزامنة الأونلاين إلى المحلي" },
                      { id: "bidirectional" as SyncMode, label: "مزامنة ثنائية الاتجاه" },
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
                    <span>الجدولة والحالة</span>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span>مزامنة تلقائية</span>
                    <input
                      type="checkbox"
                      checked={syncConfig.autoSync}
                      onChange={(event) => setSyncConfig((current) => ({ ...current, autoSync: event.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <DevField label="التوقيت">
                      <select
                        value={syncConfig.timing}
                        onChange={(event) => setSyncConfig((current) => ({ ...current, timing: event.target.value as AutoSyncTiming }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="startup">عند بدء التشغيل</option>
                        <option value="interval">كل فترة</option>
                      </select>
                    </DevField>
                    <DevField label="الفاصل بالدقائق">
                      <Input
                        type="number"
                        min={1}
                        value={syncConfig.intervalMinutes}
                        onChange={(event) => setSyncConfig((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))}
                      />
                    </DevField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoRow label="آخر مزامنة" value={syncConfig.lastSyncTime} />
                    <InfoRow label="الحالة" value={syncConfig.status} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "diagnostics" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">النظام والتشخيص</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <InfoRow label="إصدار التطبيق" value={settings.appVersion || import.meta.env.VITE_APP_VERSION} />
            <InfoRow label="مسار الواجهة" value={settings.frontendPath} />
            <InfoRow label="مسار الخادم" value={settings.backendPath} />
            <InfoRow label="حالة API" value={settings.apiStatus} />
            <InfoRow label="حالة ملف env" value={settings.envFileStatus} />
            <InfoRow label="حالة الموارد" value={settings.resourcesStatus} />
          </CardContent>
        </Card>
      )}

      {activeTab === "updates" && (
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-lg">التحديث والتوزيع</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <InfoRow label="إصدار التطبيق" value={settings.appVersion || import.meta.env.VITE_APP_VERSION} />
            <InfoRow label="وضع البناء" value={settings.buildMode} />
            <InfoRow label="نسخة packaged" value={settings.isPackaged ? "نعم" : "لا"} />
            <InfoRow label="مسار التثبيت" value={settings.installPath} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
