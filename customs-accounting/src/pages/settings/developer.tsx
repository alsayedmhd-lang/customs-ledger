import { useEffect, useRef, useState } from "react";
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
const UNLOCKED_AT_KEY = "developer_unlocked_at";
const ONLINE_DATABASE_CONNECTED_KEY = "developer_online_database_connected";
const DEVELOPER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;
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
  databaseProvider?: string | null;
  databaseMode?: DatabaseMode | null;
  databaseUseConnectionString?: boolean | null;
  databaseConnectionString?: string | null;
  databaseHost?: string | null;
  databasePort?: string | null;
  databaseName?: string | null;
  databaseUsername?: string | null;
  databasePassword?: string | null;
  syncMode?: SyncMode | null;
  syncAutoSync?: boolean | null;
  syncTiming?: AutoSyncTiming | null;
  syncIntervalMinutes?: number | null;
  syncLastSyncTime?: string | null;
  syncStatus?: SyncStatus | null;
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
  databaseProvider: "sqlite",
  databaseMode: "local",
  databaseUseConnectionString: false,
  databaseConnectionString: "",
  databaseHost: "",
  databasePort: "5432",
  databaseName: "",
  databaseUsername: "",
  databasePassword: "",
  syncMode: "local-to-online",
  syncAutoSync: false,
  syncTiming: "startup",
  syncIntervalMinutes: 30,
  syncLastSyncTime: "",
  syncStatus: "idle",
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
type SyncQueueItem = {
  id: number;
  entityType: string;
  entityId: string;
  operation: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
type SyncQueueStatus = {
  pending: number;
  synced: number;
  failed: number;
  lastSync: string | null;
  lastError: string | null;
  recent: SyncQueueItem[];
};
type ReadinessStatus = {
  apiStatus: "connected" | "error";
  onlineStatus: "online" | "offline";
};
type DataStorageAnalysisItem = {
  name: string;
  path: string;
  exists: boolean;
  type: "file" | "folder";
};
type DataStorageAnalysisReport = {
  canAnalyze: boolean;
  sourceRoot: string;
  targetRoot: string | null;
  targetWritable: boolean;
  items: DataStorageAnalysisItem[];
  warnings: string[];
};
type DataStorageAnalysisResult =
  | { ok: true; report: DataStorageAnalysisReport }
  | { ok: false; error: string };
type BackupReadinessReport = {
  ok: boolean;
  dataRoot: string;
  databasePath: string;
  databaseExists: boolean;
  databaseReadable: boolean;
  databaseSizeBytes: number;
  backupsRoot: string;
  backupsRootExists: boolean;
  backupsRootWritable: boolean;
  warnings: string[];
};
type BackupReadinessResult =
  | { ok: true; report: BackupReadinessReport }
  | { ok: false; error: string };
type BackupManifest = {
  backupId: string;
  createdAt: string;
  appVersion: string;
  platform: string;
  dataRoot: string;
  database: {
    path: string;
    exists: boolean;
    sizeBytes: number;
  };
  attachments: {
    exists: boolean;
  };
  backup: {
    type: string;
    compression: string;
  };
};
type BackupManifestResult =
  | { ok: true; manifest: BackupManifest }
  | { ok: false; error: string };
type BackupDirectoryResult =
  | {
      ok: true;
      backupDir: string;
      manifestPath: string;
      manifest: BackupManifest;
    }
  | { ok: false; error: string };
type BackupVerificationResult =
  | {
      ok: true;
      verified: true;
      backupDir: string;
      databaseSizeBytes: number;
      manifest: BackupManifest;
      warnings: string[];
    }
  | {
      ok: false;
      verified: false;
      backupDir?: string;
      error: string;
    };
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

function clearDeveloperUnlockSession() {
  sessionStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(UNLOCKED_AT_KEY);
}

function isDeveloperUnlockValid() {
  const unlocked = sessionStorage.getItem(UNLOCK_KEY) === "true";
  const unlockedAt = Number(sessionStorage.getItem(UNLOCKED_AT_KEY) || 0);

  return unlocked && unlockedAt > 0 && Date.now() - unlockedAt < DEVELOPER_IDLE_TIMEOUT_MS;
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
    online_connected: ["متصل بالأونلاين", "Connected"],
    online_disconnected: ["غير متصل بالأونلاين", "Disconnected"],
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

function formatSyncQueueDate(value: string | number | null | undefined, isAR: boolean) {
  if (!value) return isAR ? "لا يوجد" : "Never";
  const date = new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(isAR ? "ar" : "en");
}

function syncQueueStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "processing") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "done" || normalized === "success" || normalized === "synced") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-background text-muted-foreground";
}

function getSyncQueueDisplayStatus(status: SyncQueueStatus, isAR: boolean) {
  if (status.failed > 0) return isAR ? "فشلت" : "Failed";
  if (status.pending > 0) return isAR ? "قيد الانتظار" : "Pending";
  if (status.synced > 0) return isAR ? "نجحت" : "Synced";
  return isAR ? "خامل" : "Idle";
}

function getSyncEngineStatus(autoSync: boolean, onlineConnected: boolean, isAR: boolean) {
  if (autoSync) return isAR ? "تلقائي / نشط" : "Automatic / Active";
  if (onlineConnected) return isAR ? "وضع المزامنة: يدوي" : "Manual Sync Mode";
  return isAR ? "يدوي / غير متصل بالأونلاين" : "Manual / Online disconnected";
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
  const [isConnectingOnline, setIsConnectingOnline] = useState(false);
  const [isSyncQueueLoading, setIsSyncQueueLoading] = useState(false);
  const [isSyncWorkerRunning, setIsSyncWorkerRunning] = useState(false);
  const [isRetryingFailedSync, setIsRetryingFailedSync] = useState(false);
  const [isReadinessLoading, setIsReadinessLoading] = useState(false);
  const [isDataStorageAnalyzing, setIsDataStorageAnalyzing] = useState(false);
  const [isBackupReadinessAnalyzing, setIsBackupReadinessAnalyzing] = useState(false);
  const [isBackupManifestGenerating, setIsBackupManifestGenerating] = useState(false);
  const [isBackupDirectoryCreating, setIsBackupDirectoryCreating] = useState(false);
  const [isBackupVerifying, setIsBackupVerifying] = useState(false);
  const [onlineDatabaseConnected, setOnlineDatabaseConnected] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [syncWorkerMessage, setSyncWorkerMessage] = useState("");
  const [dataStorageAnalysis, setDataStorageAnalysis] = useState<DataStorageAnalysisResult | null>(null);
  const [backupReadinessAnalysis, setBackupReadinessAnalysis] = useState<BackupReadinessResult | null>(null);
  const [backupManifestResult, setBackupManifestResult] = useState<BackupManifestResult | null>(null);
  const [backupDirectoryResult, setBackupDirectoryResult] = useState<BackupDirectoryResult | null>(null);
  const [backupVerificationResult, setBackupVerificationResult] = useState<BackupVerificationResult | null>(null);
  const [settings, setSettings] = useState<DeveloperSettings>(defaultSettings);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [syncQueueStatus, setSyncQueueStatus] = useState<SyncQueueStatus>({
    pending: 0,
    synced: 0,
    failed: 0,
    lastSync: null,
    lastError: null,
    recent: [],
  });
  const [readinessStatus, setReadinessStatus] = useState<ReadinessStatus>({
    apiStatus: "error",
    onlineStatus: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  });
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
  const syncWorkerRunningRef = useRef(false);

  const developerTabs = tabs.map((tab) => ({
    ...tab,
    label: isAR ? tab.labelAr : tab.labelEn,
  }));

  useEffect(() => {
    if (isDeveloperUnlockValid()) {
      setUnlocked(true);
    } else {
      clearDeveloperUnlockSession();
    }

    setOnlineDatabaseConnected(sessionStorage.getItem(ONLINE_DATABASE_CONNECTED_KEY) === "true");
  }, []);

  useEffect(() => {
    return () => {
      clearDeveloperUnlockSession();
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    let idleTimer: ReturnType<typeof setTimeout>;
    const lockDeveloper = () => {
      clearDeveloperUnlockSession();
      setUnlocked(false);
      setPassword("");
      setError(isAR ? "انتهت جلسة المطور بسبب عدم النشاط" : "Developer session expired due to inactivity");
    };

    const resetIdleTimer = () => {
      sessionStorage.setItem(UNLOCKED_AT_KEY, Date.now().toString());
      clearTimeout(idleTimer);
      idleTimer = setTimeout(lockDeveloper, DEVELOPER_IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [unlocked, isAR]);

  useEffect(() => {
    if (unlocked) {
      void loadSettings();
      void loadSyncQueueStatus();
      void loadReadinessStatus();
      void loadStorageInfo();
    }
  }, [unlocked]);

  function applyDeveloperSettingsState(data: DeveloperSettings) {
    const nextSettings = { ...defaultSettings, ...data };
    setSettings(nextSettings);
    setDatabaseMode(nextSettings.databaseMode === "online" ? "online" : "local");
    setDatabaseConfig((current) => ({
      ...current,
      localPath: nextSettings.sqlitePath || current.localPath,
      host: nextSettings.databaseHost || "",
      port: nextSettings.databasePort || "5432",
      databaseName: nextSettings.databaseName || "",
      username: nextSettings.databaseUsername || "",
      password: nextSettings.databasePassword || "",
      useConnectionString: Boolean(nextSettings.databaseUseConnectionString),
      connectionString: nextSettings.databaseConnectionString || "",
    }));
    setSyncConfig((current) => ({
      ...current,
      mode: nextSettings.syncMode || "local-to-online",
      autoSync: Boolean(nextSettings.syncAutoSync),
      timing: nextSettings.syncTiming || "startup",
      intervalMinutes: Number(nextSettings.syncIntervalMinutes || 30),
      lastSyncTime: nextSettings.syncLastSyncTime || current.lastSyncTime,
      status: nextSettings.syncStatus || "idle",
    }));
    sessionStorage.setItem("developer_settings", JSON.stringify(nextSettings));
  }

  function buildDeveloperSettingsPayload() {
    return {
      ...settings,
      databaseProvider: databaseMode === "online" ? "postgresql" : "sqlite",
      databaseMode,
      databaseUseConnectionString: databaseConfig.useConnectionString,
      databaseConnectionString: databaseConfig.useConnectionString ? databaseConfig.connectionString : "",
      databaseHost: databaseConfig.host,
      databasePort: databaseConfig.port,
      databaseName: databaseConfig.databaseName,
      databaseUsername: databaseConfig.username,
      databasePassword: databaseConfig.password,
      syncMode: syncConfig.mode,
      syncAutoSync: syncConfig.autoSync,
      syncTiming: syncConfig.timing,
      syncIntervalMinutes: syncConfig.intervalMinutes,
      syncLastSyncTime: syncConfig.lastSyncTime,
      syncStatus: syncConfig.status,
    };
  }

  async function loadSettings() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/developer/settings`, { headers: authHeaders() });
      if (!res.ok) throw new Error(tr("تعذر تحميل إعدادات المطوّر", "Failed to load developer settings"));
      const data = await res.json();
      applyDeveloperSettingsState(data);
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
      sessionStorage.setItem(UNLOCKED_AT_KEY, Date.now().toString());
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
        body: JSON.stringify(buildDeveloperSettingsPayload()),
      });
      if (!res.ok) throw new Error(tr("تعذر حفظ إعدادات المطوّر", "Failed to save developer settings"));
      const data = await res.json();
      applyDeveloperSettingsState(data);
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

  async function loadSyncQueueStatus() {
    setIsSyncQueueLoading(true);
    try {
      const res = await fetch(`${API_BASE}/developer/sync-queue/status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSyncQueueStatus({
        pending: Number(data?.pending || 0),
        synced: Number(data?.synced || 0),
        failed: Number(data?.failed || 0),
        lastSync: data?.lastSync || null,
        lastError: data?.lastError || null,
        recent: Array.isArray(data?.recent) ? data.recent : [],
      });
    } catch {
      setSyncQueueStatus({ pending: 0, synced: 0, failed: 0, lastSync: null, lastError: null, recent: [] });
    } finally {
      setIsSyncQueueLoading(false);
    }
  }

  async function runSyncWorkerNow(options: { silent?: boolean } = {}) {
    if (syncWorkerRunningRef.current) return;

    const silent = Boolean(options.silent);
    syncWorkerRunningRef.current = true;
    if (!silent) {
      setSyncWorkerMessage("");
    }
    setIsSyncWorkerRunning(true);
    try {
      const res = await fetch(`${API_BASE}/developer/sync/run-once`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || tr("تعذر تشغيل المزامنة", "Failed to run sync"));
      }

      const count = Number(data.pendingCount ?? data.processedCount ?? 0);
      const processedCount = Number(data.processedCount || 0);
      if (data.onlineConnected) {
        sessionStorage.setItem(ONLINE_DATABASE_CONNECTED_KEY, "true");
        setOnlineDatabaseConnected(true);
      } else {
        sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
        setOnlineDatabaseConnected(false);
      }
      const autoRestoredCount = Number(data.autoRestoredCount || 0);
      const autoRestoreNotice =
        autoRestoredCount > 0
          ? tr(" تمت استعادة سجلات محذوفة تلقائيًا أثناء المزامنة", " Deleted records were restored automatically during sync.")
          : "";

      if (data.onlineConnected === false) {
        const lastError = String(data.lastError || "").trim();
        const isNotConfigured = lastError === "Online database connection string is not configured";
        const message = isNotConfigured
          ? tr("قاعدة البيانات السحابية غير مضبوطة", "Online database connection is not configured")
          : tr("تعذر الاتصال بقاعدة البيانات السحابية", "Unable to connect to online database");

        if (!silent) {
          setSyncWorkerMessage(lastError ? `${message}: ${lastError}` : message);
        }
        await loadSyncQueueStatus();
        return;
      }

      if (data.onlineConnected === true && processedCount === 0 && Number(data.pendingCount || 0) === 0) {
        if (!silent) {
          setSyncWorkerMessage(tr("لا توجد عناصر بانتظار المزامنة", "No pending sync items"));
        }
        await loadSyncQueueStatus();
        return;
      }

      if (silent) {
        if (processedCount > 0) {
          setSyncWorkerMessage(tr(`تمت مزامنة ${processedCount} عنصر.`, `${processedCount} sync item(s) processed.`));
        }
        await loadSyncQueueStatus();
        return;
      }

      setSyncWorkerMessage(
        tr(
          `قرأ العامل ${count} عنصرًا في الانتظار. ${data.message || ""}${autoRestoreNotice}`,
          `Worker read ${count} pending item(s). ${data.message || ""}${autoRestoreNotice}`
        )
      );
      await loadSyncQueueStatus();
    } catch (err) {
      if (!silent) {
        setSyncWorkerMessage(err instanceof Error ? err.message : tr("تعذر تشغيل المزامنة", "Failed to run sync"));
      }
    } finally {
      syncWorkerRunningRef.current = false;
      setIsSyncWorkerRunning(false);
    }
  }

  useEffect(() => {
    if (!unlocked || !onlineDatabaseConnected) return;

    const intervalId = window.setInterval(() => {
      if (syncWorkerRunningRef.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (!onlineDatabaseConnected) return;

      void runSyncWorkerNow({ silent: true });
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [unlocked, onlineDatabaseConnected]);

  async function retryFailedSyncItems() {
    setSyncWorkerMessage("");
    setIsRetryingFailedSync(true);
    try {
      const res = await fetch(`${API_BASE}/developer/sync-queue/retry-failed`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || tr("تعذر إعادة محاولة العناصر الفاشلة", "Failed to retry failed items"));
      }

      const count = Number(data.retriedCount || 0);
      setSyncWorkerMessage(
        tr(
          `تمت إعادة ${count} عنصر فاشل إلى الانتظار.`,
          `${count} failed item(s) reset to pending.`
        )
      );
      await loadSyncQueueStatus();
    } catch (err) {
      setSyncWorkerMessage(err instanceof Error ? err.message : tr("تعذر إعادة محاولة العناصر الفاشلة", "Failed to retry failed items"));
    } finally {
      setIsRetryingFailedSync(false);
    }
  }

  async function loadReadinessStatus() {
    setIsReadinessLoading(true);
    const onlineStatus = typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline";

    try {
      const res = await fetch(`${API_BASE}/healthz`, { headers: authHeaders() });
      setReadinessStatus({
        apiStatus: res.ok ? "connected" : "error",
        onlineStatus,
      });
    } catch {
      setReadinessStatus({
        apiStatus: "error",
        onlineStatus,
      });
    } finally {
      setIsReadinessLoading(false);
    }
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

  async function connectOnlineDatabase() {
    setDatabaseMessage("");

    if (databaseMode !== "online") {
      setDatabaseMessage(tr("اختر قاعدة أونلاين للاتصال", "Select Online database to connect"));
      return;
    }

    if (!databaseConfig.useConnectionString) {
      setDatabaseMessage(tr("فعّل خيار Connection String الكامل ثم أدخل الرابط", "Enable full connection string and enter the URL"));
      return;
    }

    const connectionString = databaseConfig.connectionString.trim();
    if (!connectionString) {
      setDatabaseMessage(tr("Connection String مطلوب للاتصال", "Connection string is required to connect"));
      return;
    }

    if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
      setDatabaseMessage(tr("يدعم الاتصال PostgreSQL connection string فقط حالياً", "Only PostgreSQL connection strings are supported for now"));
      return;
    }

    setIsConnectingOnline(true);
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

      sessionStorage.setItem(ONLINE_DATABASE_CONNECTED_KEY, "true");
      setOnlineDatabaseConnected(true);
      setDatabaseMessage(tr("Online: متصل بالأونلاين", "Online: Connected"));
    } catch {
      setDatabaseMessage(tr("تعذر الاتصال بقاعدة الأونلاين عبر الخادم", "Could not connect to the online database through the server"));
    } finally {
      setIsConnectingOnline(false);
    }
  }

  function disconnectOnlineDatabase() {
    sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
    setOnlineDatabaseConnected(false);
    setDatabaseMessage(tr("Online: غير متصل بالأونلاين", "Online: Disconnected"));
  }

  async function savePreparedConnection() {
    setError("");
    setDatabaseMessage("");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/developer/settings`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(buildDeveloperSettingsPayload()),
      });
      if (!res.ok) throw new Error(tr("تعذر حفظ إعدادات قاعدة البيانات", "Failed to save database settings"));
      const data = await res.json();
      applyDeveloperSettingsState(data);
      window.dispatchEvent(new CustomEvent("developer-settings-updated", { detail: data }));
      setDatabaseMessage(tr("تم حفظ إعدادات قاعدة البيانات", "Database settings saved"));
    } catch (err) {
      setDatabaseMessage(err instanceof Error ? err.message : tr("تعذر حفظ إعدادات قاعدة البيانات", "Failed to save database settings"));
    } finally {
      setIsSaving(false);
    }
  }

  function showLocalDatabasePreviewMessage() {
    setDatabaseMessage(tr("هذا الزر لا ينشئ قاعدة فعلية حالياً", "This button does not create an actual database right now"));
  }

  async function analyzeDataStorage() {
    setIsDataStorageAnalyzing(true);
    try {
      const api = (window as Window & {
        electronAPI?: {
          analyzeDataRootMigration?: () => Promise<DataStorageAnalysisResult>;
        };
      }).electronAPI;

      if (!api?.analyzeDataRootMigration) {
        setDataStorageAnalysis({ ok: false, error: isAR ? "واجهة تحليل تخزين البيانات غير متاحة" : "Data storage analysis API is unavailable" });
        return;
      }

      const result = await api.analyzeDataRootMigration();
      setDataStorageAnalysis(result);
    } catch (err) {
      setDataStorageAnalysis({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsDataStorageAnalyzing(false);
    }
  }

  async function analyzeBackupReadiness() {
    setIsBackupReadinessAnalyzing(true);
    try {
      const api = (window as Window & {
        electronAPI?: {
          analyzeBackupReadiness?: () => Promise<BackupReadinessResult>;
        };
      }).electronAPI;

      if (!api?.analyzeBackupReadiness) {
        setBackupReadinessAnalysis({ ok: false, error: isAR ? "واجهة جاهزية النسخ الاحتياطي غير متاحة" : "Backup readiness API is unavailable" });
        return;
      }

      const result = await api.analyzeBackupReadiness();
      setBackupReadinessAnalysis(result);
    } catch (err) {
      setBackupReadinessAnalysis({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBackupReadinessAnalyzing(false);
    }
  }

  async function generateBackupManifest() {
    setIsBackupManifestGenerating(true);
    try {
      const api = (window as Window & {
        electronAPI?: {
          createBackupManifest?: () => Promise<BackupManifestResult>;
        };
      }).electronAPI;

      if (!api?.createBackupManifest) {
        setBackupManifestResult({ ok: false, error: isAR ? "واجهة ملف وصف النسخة الاحتياطية غير متاحة" : "Backup manifest API is unavailable" });
        return;
      }

      const result = await api.createBackupManifest();
      setBackupManifestResult(result);
    } catch (err) {
      setBackupManifestResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBackupManifestGenerating(false);
    }
  }

  async function createBackupDirectory() {
    setIsBackupDirectoryCreating(true);
    try {
      const api = (window as Window & {
        electronAPI?: {
          createBackupDirectory?: () => Promise<BackupDirectoryResult>;
        };
      }).electronAPI;

      if (!api?.createBackupDirectory) {
        setBackupDirectoryResult({ ok: false, error: isAR ? "واجهة مجلد النسخة الاحتياطية غير متاحة" : "Backup directory API is unavailable" });
        return;
      }

      const result = await api.createBackupDirectory();
      setBackupDirectoryResult(result);
    } catch (err) {
      setBackupDirectoryResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBackupDirectoryCreating(false);
    }
  }

  async function loadStorageInfo() {
    try {
      const response = await fetch("/api/developer/storage/info", {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("auth_token") || ""}`,
        },
      });

      const data = await response.json();
      setStorageInfo(data);
    } catch (error) {
      console.error("Failed to load storage info", error);
    }
  }

  async function verifyLatestBackupDirectory() {
    setIsBackupVerifying(true);
    try {
      if (!backupDirectoryResult?.ok) {
        setBackupVerificationResult({
          ok: false,
          verified: false,
          error: isAR ? "لا يوجد مجلد نسخة احتياطية ناجح للتحقق منه" : "No successful backup folder is available to verify",
        });
        return;
      }

      const api = (window as Window & {
        electronAPI?: {
          verifyBackupDirectory?: (backupDir: string) => Promise<BackupVerificationResult>;
        };
      }).electronAPI;

      if (!api?.verifyBackupDirectory) {
        setBackupVerificationResult({
          ok: false,
          verified: false,
          backupDir: backupDirectoryResult.backupDir,
          error: isAR ? "واجهة التحقق من النسخة الاحتياطية غير متاحة" : "Backup verification API is unavailable",
        });
        return;
      }

      const result = await api.verifyBackupDirectory(backupDirectoryResult.backupDir);
      setBackupVerificationResult(result);
    } catch (err) {
      setBackupVerificationResult({
        ok: false,
        verified: false,
        backupDir: backupDirectoryResult?.ok ? backupDirectoryResult.backupDir : undefined,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBackupVerifying(false);
    }
  }

  const setBool = (key: BoolKey, checked: boolean) => setSettings((current) => ({ ...current, [key]: checked }));
  const setText = (key: TextKey, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  const dataStorageReport = dataStorageAnalysis?.ok ? dataStorageAnalysis.report : null;
  const backupReadinessReport = backupReadinessAnalysis?.ok ? backupReadinessAnalysis.report : null;
  const backupManifest = backupManifestResult?.ok ? backupManifestResult.manifest : null;
  const backupVerificationWarningsCount = backupVerificationResult?.ok ? backupVerificationResult.warnings.length : null;

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
            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <RefreshCw className={cn("h-4 w-4 text-primary", isSyncQueueLoading && "animate-spin")} />
                  <span>{tr("حالة قائمة المزامنة", "Sync queue status")}</span>
                  {isSyncQueueLoading && <span className="text-xs font-medium text-muted-foreground">{tr("جارٍ التحميل...", "Loading...")}</span>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadSyncQueueStatus} disabled={isSyncQueueLoading} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncQueueLoading && "animate-spin")} />
                  {tr("تحديث", "Refresh")}
                </Button>
                <Button type="button" size="sm" onClick={() => void runSyncWorkerNow()} disabled={isSyncWorkerRunning} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncWorkerRunning && "animate-spin")} />
                  {isSyncWorkerRunning ? tr("جارٍ التشغيل...", "Running...") : tr("تشغيل المزامنة الآن", "Run sync now")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryFailedSyncItems}
                  disabled={isRetryingFailedSync || syncQueueStatus.failed === 0}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRetryingFailedSync && "animate-spin")} />
                  {isRetryingFailedSync ? tr("جارٍ الإعادة...", "Retrying...") : tr("إعادة محاولة الفاشلة", "Retry Failed")}
                </Button>
              </div>
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                {tr("المزامنة التلقائية تعمل كل دقيقتين عند توفر الاتصال", "Auto sync runs every 2 minutes when connected")}
              </div>
              {syncWorkerMessage && (
                <div className="mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {syncWorkerMessage}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-5">
                <InfoRow isAR={isAR} label={tr("المزامنة المنتظرة", "Pending sync")} value={syncQueueStatus.pending} />
                <InfoRow isAR={isAR} label={tr("المزامنة الناجحة", "Synced")} value={syncQueueStatus.synced} />
                <InfoRow isAR={isAR} label={tr("المزامنة الفاشلة", "Failed sync")} value={syncQueueStatus.failed} />
                <InfoRow isAR={isAR} label={tr("آخر مزامنة", "Last sync")} value={formatSyncQueueDate(syncQueueStatus.lastSync, isAR)} />
                <InfoRow isAR={isAR} label={tr("آخر خطأ", "Last error")} value={syncQueueStatus.lastError || "-"} />
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">{tr("آخر عناصر القائمة", "Recent Queue Items")}</div>
                {syncQueueStatus.recent.length === 0 ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {tr("لا توجد عناصر في القائمة بعد", "No queue items yet")}
                  </div>
                ) : (
                  <div className="max-h-[250px] overflow-x-auto overflow-y-auto rounded-md border border-border">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{tr("الكيان", "Entity")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("العملية", "Operation")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("الحالة", "Status")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("المحاولات", "Attempts")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("آخر خطأ", "Last Error")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("تاريخ الإنشاء", "Created")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncQueueStatus.recent.map((item) => (
                          <tr key={item.id} className="border-t border-border">
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.entityType || "-"}</div>
                              <div className="text-muted-foreground">{item.entityId || "-"}</div>
                            </td>
                            <td className="px-3 py-2">{item.operation || "-"}</td>
                            <td className="px-3 py-2">
                              <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", syncQueueStatusBadgeClass(item.status || ""))}>
                                {item.status || "-"}
                              </span>
                            </td>
                            <td className="px-3 py-2">{item.attempts}</td>
                            <td className="px-3 py-2">
                              <div className="max-w-[220px] truncate" title={item.lastError || ""}>{item.lastError || "-"}</div>
                            </td>
                            <td className="px-3 py-2">{formatSyncQueueDate(item.createdAt, isAR)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Activity className={cn("h-4 w-4 text-primary", isReadinessLoading && "animate-pulse")} />
                  <span>{tr("حالة الشبكة وجاهزية المزامنة", "Network / Sync Readiness Status")}</span>
                  {isReadinessLoading && <span className="text-xs font-medium text-muted-foreground">{tr("جارٍ الفحص...", "Checking...")}</span>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadReadinessStatus} disabled={isReadinessLoading} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isReadinessLoading && "animate-spin")} />
                  {tr("تحديث", "Refresh")}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <InfoRow isAR={isAR} label={tr("وضع التطبيق", "App Mode")} value="SQLite Local" />
                <InfoRow isAR={isAR} label={tr("حالة API", "API Status")} value={readinessStatus.apiStatus === "connected" ? tr("متصل", "Connected") : tr("خطأ", "Error")} />
                <InfoRow isAR={isAR} label={tr("محرك المزامنة", "Sync Engine")} value={getSyncEngineStatus(syncConfig.autoSync, onlineDatabaseConnected, isAR)} />
                <InfoRow isAR={isAR} label={tr("آخر مزامنة", "Last Sync")} value={tr("غير متاح", "Not available")} />
                <InfoRow isAR={isAR} label={tr("حالة الاتصال", "Online Status")} value={readinessStatus.onlineStatus === "online" ? tr("متصل بالإنترنت", "Online") : tr("غير متصل", "Offline")} />
              </div>
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
                <div className="mb-4 flex h-10 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
                  <span className="text-muted-foreground">{tr("Online", "Online")}</span>
                  <span className={cn("font-semibold", onlineDatabaseConnected ? "text-emerald-600" : "text-red-600")}>
                    {onlineDatabaseConnected ? tr("متصل بالأونلاين", "Connected") : tr("غير متصل بالأونلاين", "Disconnected")}
                  </span>
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
                {onlineDatabaseConnected ? (
                  <Button type="button" variant="outline" onClick={disconnectOnlineDatabase} size="sm">{tr("فصل الاتصال", "Disconnect")}</Button>
                ) : (
                  <Button type="button" onClick={connectOnlineDatabase} size="sm" disabled={isConnectingOnline}>
                    {isConnectingOnline ? tr("جارٍ الاتصال...", "Connecting...") : tr("اتصال", "Connect")}
                  </Button>
                )}
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
                    <InfoRow isAR={isAR} label={tr("آخر مزامنة", "Last sync")} value={formatSyncQueueDate(syncQueueStatus.lastSync, isAR)} />
                    <InfoRow isAR={isAR} label={tr("الحالة", "Status")} value={getSyncQueueDisplayStatus(syncQueueStatus, isAR)} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "diagnostics" && (
        <div className="space-y-4">
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

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg">
                {tr("مسارات تخزين البيانات", "Data Storage Paths")}
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoRow isAR={isAR} label={tr("مسار البيانات", "Data Root")} value={storageInfo?.dataRoot} />
              <InfoRow isAR={isAR} label={tr("مصدر المسار", "Source")} value={storageInfo?.source} />
              <InfoRow isAR={isAR} label={tr("قاعدة البيانات", "Database Dir")} value={storageInfo?.databaseDir} />
              <InfoRow isAR={isAR} label={tr("النسخ الاحتياطية", "Backups Dir")} value={storageInfo?.backupsDir} />
              <InfoRow isAR={isAR} label={tr("المرفقات", "Attachments Dir")} value={storageInfo?.attachmentsDir} />
              <InfoRow isAR={isAR} label={tr("السجلات", "Logs Dir")} value={storageInfo?.logsDir} />
            </CardContent>
          </Card>

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Database className="h-4 w-4 text-primary" />
                  <span>{isAR ? "تحليل تخزين البيانات" : "Data Storage Analysis"}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={analyzeDataStorage} disabled={isDataStorageAnalyzing} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isDataStorageAnalyzing && "animate-spin")} />
                  {isDataStorageAnalyzing ? (isAR ? "جار التحليل..." : "Analyzing...") : (isAR ? "تحليل تخزين البيانات" : "Analyze Data Storage")}
                </Button>
              </div>

              {dataStorageAnalysis && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoRow isAR={isAR} label={isAR ? "الحالة" : "ok"} value={dataStorageAnalysis.ok} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار المصدر" : "sourceRoot"} value={dataStorageReport?.sourceRoot} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار الهدف" : "targetRoot"} value={dataStorageReport?.targetRoot} />
                    <InfoRow isAR={isAR} label={isAR ? "الهدف قابل للكتابة" : "targetWritable"} value={dataStorageReport?.targetWritable} />
                  </div>

                  {!dataStorageAnalysis.ok && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {dataStorageAnalysis.error}
                    </div>
                  )}

                  {dataStorageReport && (
                    <>
                      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                        <div className="mb-2 text-xs font-semibold text-muted-foreground">{isAR ? "التحذيرات" : "warnings"}</div>
                        {dataStorageReport.warnings.length > 0 ? (
                          <ul className="list-inside list-disc space-y-1">
                            {dataStorageReport.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted-foreground">{isAR ? "لا يوجد" : "None"}</div>
                        )}
                      </div>

                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[520px] text-left text-xs">
                          <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-semibold">{isAR ? "الاسم" : "name"}</th>
                              <th className="px-3 py-2 font-semibold">{isAR ? "النوع" : "type"}</th>
                              <th className="px-3 py-2 font-semibold">{isAR ? "موجود" : "exists"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataStorageReport.items.map((item) => (
                              <tr key={item.name} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{item.name}</td>
                                <td className="px-3 py-2">{item.type}</td>
                                <td className="px-3 py-2">{item.exists ? "true" : "false"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Database className="h-4 w-4 text-primary" />
                  <span>{isAR ? "جاهزية النسخ الاحتياطي" : "Backup Readiness"}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={analyzeBackupReadiness} disabled={isBackupReadinessAnalyzing} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isBackupReadinessAnalyzing && "animate-spin")} />
                  {isBackupReadinessAnalyzing ? (isAR ? "جار التحليل..." : "Analyzing...") : (isAR ? "تحليل جاهزية النسخ الاحتياطي" : "Analyze Backup Readiness")}
                </Button>
              </div>

              {backupReadinessAnalysis && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoRow isAR={isAR} label={isAR ? "الحالة" : "ok"} value={backupReadinessAnalysis.ok} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار البيانات" : "dataRoot"} value={backupReadinessReport?.dataRoot} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار قاعدة البيانات" : "databasePath"} value={backupReadinessReport?.databasePath} />
                    <InfoRow isAR={isAR} label={isAR ? "قاعدة البيانات موجودة" : "databaseExists"} value={backupReadinessReport?.databaseExists} />
                    <InfoRow isAR={isAR} label={isAR ? "قاعدة البيانات قابلة للقراءة" : "databaseReadable"} value={backupReadinessReport?.databaseReadable} />
                    <InfoRow isAR={isAR} label={isAR ? "حجم قاعدة البيانات بالبايت" : "databaseSizeBytes"} value={backupReadinessReport?.databaseSizeBytes} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار النسخ الاحتياطية" : "backupsRoot"} value={backupReadinessReport?.backupsRoot} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار النسخ موجود" : "backupsRootExists"} value={backupReadinessReport?.backupsRootExists} />
                    <InfoRow isAR={isAR} label={isAR ? "مسار النسخ قابل للكتابة" : "backupsRootWritable"} value={backupReadinessReport?.backupsRootWritable} />
                  </div>

                  {!backupReadinessAnalysis.ok && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {backupReadinessAnalysis.error}
                    </div>
                  )}

                  {backupReadinessReport && (
                    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground">{isAR ? "التحذيرات" : "warnings"}</div>
                      {backupReadinessReport.warnings.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1">
                          {backupReadinessReport.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground">{isAR ? "لا يوجد" : "None"}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>{isAR ? "ملف وصف النسخة الاحتياطية" : "Backup Manifest"}</span>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={generateBackupManifest} disabled={isBackupManifestGenerating} className="gap-2">
                    <RefreshCw className={cn("h-3.5 w-3.5", isBackupManifestGenerating && "animate-spin")} />
                    {isBackupManifestGenerating ? (isAR ? "جار الإنشاء..." : "Generating...") : (isAR ? "إنشاء ملف وصف النسخة الاحتياطية" : "Generate Backup Manifest")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={createBackupDirectory} disabled={isBackupDirectoryCreating} className="gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    {isBackupDirectoryCreating ? (isAR ? "جار الإنشاء..." : "Creating...") : (isAR ? "إنشاء مجلد النسخة الاحتياطية" : "Create Backup Folder")}
                  </Button>
                </div>
              </div>

              {(backupManifestResult || backupDirectoryResult) && (
                <div className="space-y-3">
                  {backupManifestResult && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoRow isAR={isAR} label={isAR ? "معرف النسخة" : "backupId"} value={backupManifest?.backupId} />
                      <InfoRow isAR={isAR} label={isAR ? "تاريخ الإنشاء" : "createdAt"} value={backupManifest?.createdAt} />
                      <InfoRow isAR={isAR} label={isAR ? "إصدار التطبيق" : "appVersion"} value={backupManifest?.appVersion} />
                      <InfoRow isAR={isAR} label={isAR ? "النظام" : "platform"} value={backupManifest?.platform} />
                      <InfoRow isAR={isAR} label={isAR ? "مسار البيانات" : "dataRoot"} value={backupManifest?.dataRoot} />
                      <InfoRow isAR={isAR} label={isAR ? "مسار قاعدة البيانات" : "database.path"} value={backupManifest?.database.path} />
                      <InfoRow isAR={isAR} label={isAR ? "قاعدة البيانات موجودة" : "database.exists"} value={backupManifest?.database.exists} />
                      <InfoRow isAR={isAR} label={isAR ? "حجم قاعدة البيانات" : "database.sizeBytes"} value={backupManifest?.database.sizeBytes} />
                      <InfoRow isAR={isAR} label={isAR ? "المرفقات موجودة" : "attachments.exists"} value={backupManifest?.attachments.exists} />
                      <InfoRow isAR={isAR} label={isAR ? "نوع النسخة" : "backup.type"} value={backupManifest?.backup.type} />
                      <InfoRow isAR={isAR} label={isAR ? "الضغط" : "backup.compression"} value={backupManifest?.backup.compression} />
                    </div>
                  )}

                  {backupDirectoryResult && (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoRow isAR={isAR} label={isAR ? "الحالة" : "ok"} value={backupDirectoryResult.ok} />
                        <InfoRow isAR={isAR} label={isAR ? "مجلد النسخة" : "backupDir"} value={backupDirectoryResult.ok ? backupDirectoryResult.backupDir : null} />
                        <InfoRow isAR={isAR} label={isAR ? "مسار ملف الوصف" : "manifestPath"} value={backupDirectoryResult.ok ? backupDirectoryResult.manifestPath : null} />
                      </div>

                      {backupDirectoryResult.ok ? (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                          {isAR ? "تم إنشاء مجلد النسخة الاحتياطية بنجاح." : "Backup folder created successfully."}
                        </div>
                      ) : (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {backupDirectoryResult.error}
                        </div>
                      )}
                    </div>
                  )}

                  {backupManifestResult && !backupManifestResult.ok && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {backupManifestResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  <span>{isAR ? "التحقق من النسخة الاحتياطية" : "Backup Verification"}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={verifyLatestBackupDirectory}
                  disabled={isBackupVerifying || !backupDirectoryResult?.ok}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isBackupVerifying && "animate-spin")} />
                  {isBackupVerifying ? (isAR ? "جار التحقق..." : "Verifying...") : (isAR ? "التحقق من آخر نسخة احتياطية" : "Verify Latest Backup")}
                </Button>
              </div>

              {backupVerificationResult && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoRow isAR={isAR} label={isAR ? "تم التحقق" : "verified"} value={backupVerificationResult.verified} />
                    <InfoRow
                      isAR={isAR}
                      label={isAR ? "حجم قاعدة البيانات بالبايت" : "databaseSizeBytes"}
                      value={backupVerificationResult.ok ? backupVerificationResult.databaseSizeBytes : null}
                    />
                    <InfoRow isAR={isAR} label={isAR ? "مجلد النسخة" : "backupDir"} value={backupVerificationResult.backupDir} />
                    <InfoRow isAR={isAR} label={isAR ? "عدد التحذيرات" : "warnings count"} value={backupVerificationWarningsCount} />
                  </div>

                  {backupVerificationResult.ok && backupVerificationResult.verified ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {isAR ? "تم التحقق من النسخة الاحتياطية بنجاح." : "Backup verified successfully."}
                    </div>
                  ) : (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {backupVerificationResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

        </div>
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
