import ResizableScrollArea from "@/components/layout/ResizableScrollArea";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Shield, Users, Database, Activity, PackageCheck, Copy, FileText, RefreshCw, Save, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import SettingsShell from "@/components/layout/SettingsShell";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "") + "/api";
const UNLOCK_KEY = "developer_unlocked";
const UNLOCKED_AT_KEY = "developer_unlocked_at";
const ONLINE_DATABASE_CONNECTED_KEY = "developer_online_database_connected";
const DEVELOPER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_LOGIN_FOOTER_TEXT = "Internal Accounting System For Companes - alsayed.mhd@gmail.com - Phone - 00201009697521 - 0097460020446";
type LoginMessageType = "welcome" | "notice" | "warning" | "quote";

type DeveloperSettings = {
  lockCompanyIdentity: boolean;
  lockCompanyName: boolean;
  lockLogo: boolean;
  lockStamp: boolean;
  lockLegalInfo: boolean;
  lockFooterBranding: boolean;
  loginFooterText: string;
  loginMessageText: string;
  loginMessageType: LoginMessageType;
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
  loginMessageText: "",
  loginMessageType: "welcome",
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
type SystemDiagnosticStatus = "pass" | "warning" | "critical";
type SystemDiagnosticCheck = {
  id: string;
  status: SystemDiagnosticStatus;
  area: string;
  location: string;
  messageAr: string;
  messageEn: string;
  causeAr: string;
  causeEn: string;
  suggestedFixAr: string;
  suggestedFixEn: string;
  details?: unknown;
};
type SystemDiagnosticsResult = {
  ok: boolean;
  checkedAt: string;
  summary: {
    critical: number;
    warnings: number;
    passed: number;
  };
  checks: SystemDiagnosticCheck[];
};
type ReadinessStatus = {
  apiStatus: "connected" | "error";
  sqliteStatus: "connected" | "unavailable";
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
  [K in keyof DeveloperSettings]-?: NonNullable<DeveloperSettings[K]> extends boolean ? K : never;
}[keyof DeveloperSettings];
type TextKey = {
  [K in keyof DeveloperSettings]-?: NonNullable<DeveloperSettings[K]> extends string ? K : never;
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

const loginMessageTypeOptions: Array<{ value: LoginMessageType; labelAr: string; labelEn: string }> = [
  { value: "welcome", labelAr: "واجهة / ترحيب", labelEn: "Welcome" },
  { value: "notice", labelAr: "تنبيه", labelEn: "Notice" },
  { value: "warning", labelAr: "تحذير", labelEn: "Warning" },
  { value: "quote", labelAr: "آية / اقتباس", labelEn: "Verse / Quote" },
];

function authHeaders() {
  const token = sessionStorage.getItem("auth_token");
  const developerModeFromLogin =
    sessionStorage.getItem("developer_entry_from_login") === "true" &&
    isDeveloperUnlockValid();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(developerModeFromLogin
      ? {
          "x-developer-mode": "true",
          "x-developer-unlocked": "true",
        }
      : {}),
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
    untested: ["لم يُفحص بعد", "Not checked yet"],
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

function diagnosticStatusBadgeClass(status: SystemDiagnosticStatus) {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function getDiagnosticStatusLabel(status: SystemDiagnosticStatus, isAR: boolean) {
  if (status === "pass") return isAR ? "ناجح" : "Pass";
  if (status === "warning") return isAR ? "تحذير" : "Warning";
  return isAR ? "حرج" : "Critical";
}

function getSyncQueueDisplayStatus(status: SyncQueueStatus, isAR: boolean) {
  if (status.failed > 0) return isAR ? "فشلت" : "Failed";
  if (status.pending > 0) return isAR ? "قيد الانتظار" : "Pending";
  if (status.synced > 0) return isAR ? "نجحت" : "Synced";
  return isAR ? "خامل" : "Idle";
}

function SectionNavigation({ options, value, onChange, label }: {
  options: Array<{ id: string; label: string; hint: string; icon: React.ElementType }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="grid gap-3 md:grid-cols-3">
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn("flex items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            value === option.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:bg-muted/50")}>
          <option.icon className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{option.hint}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}

function InfoRow({ label, value, isAR }: { label: string; value?: string | number | boolean | null; isAR: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
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
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function DeveloperSettingsPage() {
  const [location, setLocation] = useLocation();
  const { lang, isRTL } = useLanguage();
  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("security");
  const [databaseSection, setDatabaseSection] = useState("local");
  const [diagnosticsSection, setDiagnosticsSection] = useState("system");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isConnectingOnline, setIsConnectingOnline] = useState(false);
  const [isSyncQueueLoading, setIsSyncQueueLoading] = useState(false);
  const [isSyncWorkerRunning, setIsSyncWorkerRunning] = useState(false);
  const [isRetryingFailedSync, setIsRetryingFailedSync] = useState(false);
  const [isReadinessLoading, setIsReadinessLoading] = useState(false);
  const [isDataStorageAnalyzing, setIsDataStorageAnalyzing] = useState(false);
  const [isSystemDiagnosticsRunning, setIsSystemDiagnosticsRunning] = useState(false);
  const [isSystemDiagnosticsExporting, setIsSystemDiagnosticsExporting] = useState(false);
  const [isSystemDiagnosticsPdfExporting, setIsSystemDiagnosticsPdfExporting] = useState(false);
  const [isSavingCurrentDataRoot, setIsSavingCurrentDataRoot] = useState(false);
  const [isBackupReadinessAnalyzing, setIsBackupReadinessAnalyzing] = useState(false);
  const [isBackupManifestGenerating, setIsBackupManifestGenerating] = useState(false);
  const [isBackupDirectoryCreating, setIsBackupDirectoryCreating] = useState(false);
  const [isBackupVerifying, setIsBackupVerifying] = useState(false);
  const [onlineDatabaseConnected, setOnlineDatabaseConnected] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [internalDatabaseMessage, setInternalDatabaseMessage] = useState("");
  const [internalAutoStatus, setInternalAutoStatus] = useState<{ running: boolean; lastCheckAt: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; lastError: string | null } | null>(null);
  const [isSavingInternalDatabase, setIsSavingInternalDatabase] = useState(false);
  const [isTestingInternalDatabase, setIsTestingInternalDatabase] = useState(false);
  const [isCheckingInternalReadiness, setIsCheckingInternalReadiness] = useState(false);
  const [internalJournalCount, setInternalJournalCount] = useState<number | null>(null);
  const [serverJournalCount, setServerJournalCount] = useState<number | null>(null);
  const [isCheckingInternalJournal, setIsCheckingInternalJournal] = useState(false);
  const [isCheckingServerJournal, setIsCheckingServerJournal] = useState(false);
  const [isRunningInternalPush, setIsRunningInternalPush] = useState(false);
  const [isRunningInternalPull, setIsRunningInternalPull] = useState(false);
  const [isRunningInternalBidirectional, setIsRunningInternalBidirectional] = useState(false);
  const [isCompletingAccounting, setIsCompletingAccounting] = useState(false);
  const [internalReadiness, setInternalReadiness] = useState<{
    schemaComplete: boolean;
    tables: Array<{ name: string; localCount: number | null; internalCount: number | null }>;
  } | null>(null);
  const [internalDatabaseConnectionStatus, setInternalDatabaseConnectionStatus] = useState<"untested" | "connected" | "failed">("untested");
  const [internalDatabaseConfig, setInternalDatabaseConfig] = useState({
    host: "", port: "5432", databaseName: "", username: "", password: "", connectionString: "",
    syncMode: "bidirectional", autoSync: false, timing: "startup", intervalMinutes: 30,
  });
  const [syncWorkerMessage, setSyncWorkerMessage] = useState("");
  const [systemDiagnostics, setSystemDiagnostics] = useState<SystemDiagnosticsResult | null>(null);
  const [systemDiagnosticsError, setSystemDiagnosticsError] = useState("");
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
    sqliteStatus: "unavailable",
  });
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode>("local");
  const [licenseDeviceId, setLicenseDeviceId] = useState("");
  const [licenseCustomerName, setLicenseCustomerName] = useState("");
  const [licenseTargetDeviceId, setLicenseTargetDeviceId] = useState("");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [generatedLicenseText, setGeneratedLicenseText] = useState("");
  const [databaseConfig, setDatabaseConfig] = useState({
    localPath: "lib/db/local.db",
    connectionStatus: "untested",
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
  const isDeveloperSettingsRoute = location === "/settings/developer";

  useEffect(() => {
    if (!isDeveloperSettingsRoute) {
      setLocation("/settings");
    }
  }, [isDeveloperSettingsRoute, setLocation]);

  useEffect(() => {
    if (isDeveloperUnlockValid()) {
      setUnlocked(true);
    } else {
      clearDeveloperUnlockSession();
    }

    setOnlineDatabaseConnected(sessionStorage.getItem(ONLINE_DATABASE_CONNECTED_KEY) === "true");
    void loadCurrentLicenseStatus();
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
      void (async () => {
        await loadSettings();
        await loadInternalDatabaseSettings();
        await loadCurrentLicenseStatus();
      })();
      void loadSyncQueueStatus();
      void loadReadinessStatus();
      void loadStorageInfo();
    }
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !onlineDatabaseConnected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSyncQueueStatus();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [unlocked, onlineDatabaseConnected]);

  function applyDeveloperSettingsState(data: DeveloperSettings) {
    const nextSettings = { ...defaultSettings, ...data };
    setSettings(nextSettings);
    const onlineEnabled = nextSettings.databaseMode === "online";
    setDatabaseMode(onlineEnabled ? "online" : "local");
    setOnlineDatabaseConnected(onlineEnabled);
    if (onlineEnabled) sessionStorage.setItem(ONLINE_DATABASE_CONNECTED_KEY, "true");
    else sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
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

  function applyLicenseStatusState(status: any) {
    if (!status) return;

    setSettings((current) => ({
      ...current,
      licenseStatus: status.status || (status.valid ? "active" : status.reason || current.licenseStatus),
      licensedCompanyName: status.customerName || current.licensedCompanyName,
      licenseId: status.licenseId || current.licenseId,
      hardwareId: status.hardwareId || status.deviceId || status.currentDeviceId || current.hardwareId,
      issuedAt: status.issuedAt || current.issuedAt,
      expiresAt: status.expiresAt || status.expiryDate || current.expiresAt,
    }));
  }

  async function loadCurrentLicenseStatus() {
    try {
      const status = await window.electronAPI?.getLicenseStatus?.();
      applyLicenseStatusState(status);
    } catch (error) {
      console.error("Failed to load license status", error);
    }
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

  async function loadInternalDatabaseSettings() {
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/settings`, { headers: authHeaders() });
      if (!response.ok) throw new Error(tr("تعذر تحميل إعدادات الخادم الداخلي", "Failed to load internal server settings"));
      const data = await response.json();
      setInternalDatabaseConfig({
        host: data.host || "", port: data.port || "5432", databaseName: data.databaseName || "",
        username: data.username || "", password: data.password || "", connectionString: data.connectionString || "",
        syncMode: data.syncMode || "bidirectional", autoSync: Boolean(data.autoSync),
        timing: data.timing || "startup", intervalMinutes: Number(data.intervalMinutes || 30),
      });
      void checkInternalAutoStatus();
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر تحميل إعدادات الخادم الداخلي", "Failed to load internal server settings"));
    }
  }

  async function checkInternalAutoStatus() {
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/auto-status`, { headers: authHeaders() });
      if (!response.ok) throw new Error();
      setInternalAutoStatus(await response.json());
      const [local, server] = await Promise.allSettled([
        fetch(`${API_BASE}/developer/internal-database/journal-status`, { headers: authHeaders() }),
        fetch(`${API_BASE}/developer/internal-database/server-journal-status`, { headers: authHeaders() }),
      ]);
      if (local.status === "fulfilled" && local.value.ok) {
        const data = await local.value.json();
        if (data.ok) setInternalJournalCount(Number(data.pendingChanges || 0));
        else setInternalJournalCount(null);
      } else {
        setInternalJournalCount(null);
      }
      if (server.status === "fulfilled") {
        if (server.value.ok) {
          const data = await server.value.json();
          setInternalDatabaseConnectionStatus(data.ok ? "connected" : "failed");
          setServerJournalCount(data.ok ? Number(data.pendingChanges || 0) : null);
        } else {
          setInternalDatabaseConnectionStatus("failed");
          setServerJournalCount(null);
        }
      } else {
        setInternalDatabaseConnectionStatus("failed");
        setServerJournalCount(null);
      }
    } catch {
      setInternalAutoStatus(null);
      setInternalDatabaseConnectionStatus("untested");
      setInternalJournalCount(null);
      setServerJournalCount(null);
      setInternalDatabaseMessage(tr("تعذر قراءة حالة المزامنة التلقائية", "Could not read automatic sync status"));
    }
  }

  async function saveInternalDatabaseSettings() {
    setInternalDatabaseMessage("");
    setIsSavingInternalDatabase(true);
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/settings`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(internalDatabaseConfig),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (problem.error === "Disable Online automatic sync before enabling internal automatic sync") {
          throw new Error(tr("أوقف مزامنة Online التلقائية أولاً", "Turn off Online automatic sync first"));
        }
        if (problem.error === "Invalid internal sync settings") {
          throw new Error(tr("تحقق من خيارات المزامنة والفاصل الزمني (1 إلى 1440 دقيقة)", "Check sync options and the interval (1 to 1440 minutes)"));
        }
        if (problem.error === "Invalid internal database port") {
          throw new Error(tr("المنفذ يجب أن يكون رقمًا بين 1 و65535", "Port must be between 1 and 65535"));
        }
        if (problem.error === "Only PostgreSQL connection strings are supported") {
          throw new Error(tr("رابط الاتصال يجب أن يبدأ بـ postgresql:// أو postgres://", "Connection string must start with postgresql:// or postgres://"));
        }
        throw new Error(tr("تعذر حفظ إعدادات الخادم الداخلي", "Failed to save internal server settings"));
      }
      const data = await response.json();
      setInternalDatabaseConfig(data);
      setInternalDatabaseConnectionStatus("untested");
      setInternalDatabaseMessage(tr("تم حفظ إعدادات الخادم الداخلي", "Internal server settings saved"));
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر حفظ إعدادات الخادم الداخلي", "Failed to save internal server settings"));
    } finally {
      setIsSavingInternalDatabase(false);
    }
  }

  async function testInternalDatabaseConnection() {
    setInternalDatabaseMessage("");
    setIsTestingInternalDatabase(true);
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/test-connection`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setInternalDatabaseConnectionStatus("failed");
        setInternalDatabaseMessage(data.error
          ? tr(`فشل الاتصال: ${data.error}`, `Connection failed: ${data.error}`)
          : tr("فشل اختبار الاتصال", "Connection test failed"));
        return;
      }
      setInternalDatabaseConnectionStatus("connected");
      setInternalDatabaseMessage(tr("نجح الاتصال بالخادم الداخلي", "Internal server connection succeeded"));
    } catch {
      setInternalDatabaseConnectionStatus("failed");
      setInternalDatabaseMessage(tr("تعذر الوصول إلى خدمة اختبار الاتصال", "Could not reach the connection test service"));
    } finally {
      setIsTestingInternalDatabase(false);
    }
  }

  async function checkInternalSyncReadiness() {
    setIsCheckingInternalReadiness(true);
    setInternalDatabaseMessage("");
    setInternalReadiness(null);
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/sync-readiness`, {
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("فشل فحص الجداول", "Table check failed"));
      setInternalReadiness(data);
      setInternalDatabaseMessage(data.schemaComplete
        ? tr("الجداول موجودة. راجع أعداد السجلات قبل تشغيل المزامنة.", "Tables exist. Review record counts before starting sync.")
        : tr("بعض الجداول مفقودة. أكمل إنشاءها قبل تشغيل المزامنة.", "Some tables are missing. Create them before starting sync."));
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر فحص الجداول", "Could not check tables"));
    } finally {
      setIsCheckingInternalReadiness(false);
    }
  }

  async function checkInternalJournal() {
    setIsCheckingInternalJournal(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/journal-status`, {
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("تعذر فحص التغييرات", "Could not check changes"));
      const count = Number(data.pendingChanges || 0);
      setInternalJournalCount(count);
      setInternalDatabaseMessage(tr(
        `التغييرات المحلية المنتظرة للخادم الداخلي: ${count}`,
        `Local changes pending for internal server: ${count}`,
      ));
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر فحص التغييرات", "Could not check changes"));
    } finally {
      setIsCheckingInternalJournal(false);
    }
  }

  async function checkServerJournal() {
    setIsCheckingServerJournal(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/server-journal-status`, {
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("تعذر فحص تغييرات الخادم", "Could not check server changes"));
      const count = Number(data.pendingChanges || 0);
      setServerJournalCount(count);
      setInternalDatabaseMessage(tr(
        `تعديلات PostgreSQL المباشرة في السجل: ${count}`,
        `Direct PostgreSQL edits in journal: ${count}`,
      ));
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر فحص تغييرات الخادم", "Could not check server changes"));
    } finally {
      setIsCheckingServerJournal(false);
    }
  }

  async function runInternalBidirectional() {
    if (!window.confirm(tr(
      "ستُرسل التغييرات المحلية وتُستلم تغييرات الخادم الداخلي. إذا تغيّر السجل نفسه في الجهتين ستتوقف المزامنة دون إرسال التعارض. تأكد من وجود نسخة احتياطية حديثة للقاعدتين. هل تريد التنفيذ؟",
      "Local changes will be sent and internal server changes received. If the same record changed on both sides, the sync stops before sending the conflict. Ensure recent backups of both databases. Proceed?",
    ))) return;
    setIsRunningInternalBidirectional(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/sync-bidirectional`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("فشلت المزامنة الثنائية", "Bidirectional sync failed"));
      setInternalDatabaseMessage(tr(
        `اكتملت المزامنة الثنائية: أُرسلت ${Number(data.pushed?.processed || 0)} تغييرات محلية، واستُلمت ${Number(data.pulled?.processed || 0)} تغييرات من الخادم (${Number(data.pulled?.inserted || 0)} جديد، ${Number(data.pulled?.updated || 0)} محدّث).`,
        `Bidirectional sync complete: ${Number(data.pushed?.processed || 0)} local events sent, ${Number(data.pulled?.processed || 0)} server events received (${Number(data.pulled?.inserted || 0)} inserted, ${Number(data.pulled?.updated || 0)} updated).`,
      ));
      setInternalJournalCount(null);
      setServerJournalCount(null);
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("فشلت المزامنة الثنائية", "Bidirectional sync failed"));
    } finally {
      setIsRunningInternalBidirectional(false);
    }
  }

  async function runInternalPush() {
    setIsRunningInternalPush(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/sync-local-to-server`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("فشلت المزامنة الداخلية", "Internal sync failed"));
      setInternalDatabaseMessage(tr(
        `نُقلت ${Number(data.processed || 0)} تغييرات إلى الخادم الداخلي. افحص التغييرات مجددًا.`,
        `${Number(data.processed || 0)} changes sent to the internal server. Check changes again.`,
      ));
      setInternalJournalCount(null);
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("فشلت المزامنة الداخلية", "Internal sync failed"));
    } finally {
      setIsRunningInternalPush(false);
    }
  }

  async function runInternalPull() {
    if (!window.confirm(tr(
      "سيُحدّث هذا الإجراء السجلات المحلية من الخادم الداخلي، بشرط عدم وجود تغييرات محلية منتظرة. خذ نسخة احتياطية من local.db قبل المتابعة. هل تريد التنفيذ؟",
      "This will update local records from the internal server if no local changes are pending. Back up local.db before continuing. Proceed?",
    ))) return;
    setIsRunningInternalPull(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/sync-server-to-local`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("فشل استلام بيانات الخادم الداخلي", "Could not receive internal server data"));
      setInternalDatabaseMessage(tr(
        `اكتملت المزامنة: ${Number(data.inserted || 0)} سجل جديد، و${Number(data.updated || 0)} سجل محدّث. الحذف غير مشمول.`,
        `Sync complete: ${Number(data.inserted || 0)} inserted, ${Number(data.updated || 0)} updated. Deletions are not included.`,
      ));
      setInternalJournalCount(null);
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("فشل استلام بيانات الخادم الداخلي", "Could not receive internal server data"));
    } finally {
      setIsRunningInternalPull(false);
    }
  }

  async function completeInternalAccountingRows() {
    setIsCompletingAccounting(true);
    setInternalDatabaseMessage("");
    try {
      const response = await fetch(`${API_BASE}/developer/internal-database/complete-accounting`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || tr("تعذر إكمال سجلات الحسابات", "Could not complete accounting records"));
      setInternalDatabaseMessage(tr(
        `اكتملت سجلات الحسابات: أضيفت المعرفات ${(data.insertedIds || []).join(", ") || "لا يوجد"}. افحص الأعداد مرة أخرى.`,
        `Accounting records completed: added IDs ${(data.insertedIds || []).join(", ") || "none"}. Check the counts again.`,
      ));
      setInternalReadiness(null);
    } catch (error) {
      setInternalDatabaseMessage(error instanceof Error ? error.message : tr("تعذر إكمال سجلات الحسابات", "Could not complete accounting records"));
    } finally {
      setIsCompletingAccounting(false);
    }
  }

  useEffect(() => {
    setInternalDatabaseConnectionStatus("untested");
    setInternalReadiness(null);
  }, [internalDatabaseConfig]);

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
      setError("");
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

    try {
      const res = await fetch(`${API_BASE}/healthz`, { headers: authHeaders() });
      const databaseRes = res.ok ? await fetch(`${API_BASE}/developer/database/check`, { headers: authHeaders() }) : null;
      const database = databaseRes?.ok ? await databaseRes.json() : null;
      setReadinessStatus({
        apiStatus: res.ok ? "connected" : "error",
        sqliteStatus: database?.databaseStatus === "connected" ? "connected" : "unavailable",
      });
    } catch {
      setReadinessStatus({
        apiStatus: "error",
        sqliteStatus: "unavailable",
      });
    } finally {
      setIsReadinessLoading(false);
    }
  }

  useEffect(() => {
    async function loadLicenseDeviceId() {
      try {
        const id = await window.electronAPI?.getLicenseDeviceId?.();

        if (id) {
          setLicenseDeviceId(id);
        }
      } catch (error) {
        console.error("Failed to load license device id", error);
      }
    }

    loadLicenseDeviceId();
  }, []);
  async function copyDatabasePath() {
    await navigator.clipboard?.writeText(settings.sqlitePath || "");
    setDatabaseMessage(settings.sqlitePath ? tr("تم نسخ المسار", "Path copied") : tr("المسار غير متاح", "Path unavailable"));
  }
  async function copyLicenseDeviceId() {
    await navigator.clipboard?.writeText(licenseDeviceId || "");

    setSavedMessage(
      tr(
        "تم نسخ رقم الجهاز بنجاح",
        "Device ID copied successfully"
      )
    );

    setTimeout(() => {
      setSavedMessage("");
    }, 2000);
  }

  async function generateClientLicenseText() {
    const license = {
      customerName: licenseCustomerName || "TRIAL CUSTOMER",
      licenseType: "trial",
      deviceId: licenseTargetDeviceId,
      expiryDate: licenseExpiryDate,
      issuedAt: new Date().toISOString(),
    };

    const result = await (window as any).electronAPI?.createSignedLicense?.(license);

    if (!result?.success || !result.license) {
      setSavedMessage(tr("فشل توليد توقيع الترخيص", "Failed to sign license"));
      return;
    }

    setGeneratedLicenseText(JSON.stringify(result.license, null, 2));
  }

  function downloadGeneratedLicenseFile() {
    if (!generatedLicenseText) return;

    const safeCustomerName =
      (licenseCustomerName || "customer")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "-") || "customer";
    const blob = new Blob([generatedLicenseText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `license-${safeCustomerName}.json`;

    try {
      link.click();
      toast({
        title: tr("تم حفظ ملف الترخيص", "License file saved"),
        description: tr("يمكنك إرسال الملف للعميل لتفعيل النسخة", "You can send the file to the customer to activate the build"),
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function activateCurrentLicense() {
    try {
      setIsActivatingLicense(true);
      const issuedAt = new Date().toISOString();
      const license = {
        licenseId: `DEV-${Date.now()}`,
        customerName: licenseCustomerName || "TRIAL CUSTOMER",
        licenseType: "trial",
        deviceId: licenseTargetDeviceId || licenseDeviceId,
        expiryDate: licenseExpiryDate,
        issuedAt,
      };

      const signedResult = await (window as any).electronAPI?.createSignedLicense?.(license);

      if (!signedResult?.success || !signedResult.license) {
        setSavedMessage(tr("فشل توليد توقيع الترخيص", "Failed to sign license"));
        return;
      }

      const result = await window.electronAPI?.saveCurrentLicense?.(signedResult.license);

      if (!result?.ok && !result?.success) {
        setSavedMessage(tr("فشل تفعيل الترخيص", "Failed to activate license"));
        return;
      }

      setSettings((current) => ({
        ...current,
        licenseStatus: "active",
        licensedCompanyName: license.customerName,
        licenseId: license.licenseId,
        hardwareId: license.deviceId,
        issuedAt: license.issuedAt,
        expiresAt: license.expiryDate,
      }));

      const status = await window.electronAPI?.getLicenseStatus?.();
      applyLicenseStatusState(status);

      toast({
        title: tr("تم تفعيل النسخة", "Build activated"),
        description: tr("تم حفظ الترخيص بنجاح", "License saved successfully"),
      });
    } catch (error) {
      console.error("Failed to activate current license", error);
      setSavedMessage(tr("حدث خطأ أثناء تفعيل الترخيص", "License activation failed"));
    } finally {
      setIsActivatingLicense(false);
    }
  }


  async function createSqlFile() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/developer/database/sql`, { headers: authHeaders() });
      if (!res.ok) throw new Error(tr("تعذر تنزيل ملف SQL", "Failed to download SQL file"));

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "database-schema.sql";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("تعذر تنزيل ملف SQL", "Failed to download SQL file"));
    }
  }

  async function testPreparedConnection() {
    setDatabaseMessage("");

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

      const activation = await fetch(`${API_BASE}/developer/sync/online-connection`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ enabled: true, connectionString }),
      });
      if (!activation.ok) throw new Error(tr("تعذر تفعيل مزامنة الأونلاين", "Could not enable online synchronization"));
      applyDeveloperSettingsState(await activation.json());
      sessionStorage.setItem(ONLINE_DATABASE_CONNECTED_KEY, "true");
      setOnlineDatabaseConnected(true);
      setDatabaseMessage(tr("Online: متصل بالأونلاين", "Online: Connected"));
    } catch {
      setDatabaseMessage(tr("تعذر الاتصال بقاعدة الأونلاين عبر الخادم", "Could not connect to the online database through the server"));
    } finally {
      setIsConnectingOnline(false);
    }
  }

  async function disconnectOnlineDatabase() {
    setDatabaseMessage("");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/developer/sync/online-connection`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ enabled: false }),
      });
      if (!res.ok) throw new Error(tr("تعذر فصل مزامنة الأونلاين", "Could not disconnect online synchronization"));
      applyDeveloperSettingsState(await res.json());
      sessionStorage.removeItem(ONLINE_DATABASE_CONNECTED_KEY);
      setOnlineDatabaseConnected(false);
      setDatabaseMessage(tr("تم فصل الأونلاين وإيقاف مزامنته على هذا الجهاز", "Online synchronization is disconnected on this device"));
    } catch (err) {
      setDatabaseMessage(err instanceof Error ? err.message : tr("تعذر فصل الاتصال", "Could not disconnect"));
    } finally {
      setIsSaving(false);
    }
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
      const response = await fetch(`${API_BASE}/developer/storage/info`, { headers: authHeaders() });

      const data = await response.json();
      setStorageInfo(data);
    } catch (error) {
      console.error("Failed to load storage info", error);
    }
  }

  function getCurrentDataRootPath() {
    return (
      storageInfo?.dataRoot ||
      settings.sqlitePath
        ?.replace(/\\database\\local\.db$/i, "")
        ?.replace(/\/database\/local\.db$/i, "") ||
      ""
    );
  }

  async function saveCurrentDataRoot() {
    const dataRoot = getCurrentDataRootPath();

    if (!dataRoot) {
      alert(tr("مسار البيانات الحالي غير متوفر", "Current Data Root path is not available"));
      return;
    }

    setIsSavingCurrentDataRoot(true);
    try {
      const api = (window as Window & {
        electronAPI?: {
          saveCurrentDataRootConfig?: (expectedDataRoot: string) => Promise<{
            ok?: boolean;
            error?: string;
            configPath?: string;
            mirrorConfigPath?: string;
            dataRoot?: string;
          }>;
        };
      }).electronAPI;

      if (!api?.saveCurrentDataRootConfig) {
        alert(tr("واجهة تثبيت مسار البيانات غير متاحة", "Save Current Data Root API is unavailable"));
        return;
      }

      const result = await api.saveCurrentDataRootConfig(dataRoot);

      if (!result?.ok) {
        alert(result?.error || tr("تعذر تثبيت مسار البيانات الحالي", "Failed to save the current Data Root"));
        return;
      }

      alert(
        `${tr("تم تثبيت مسار البيانات الحالي بنجاح", "Current Data Root saved successfully")}\n\n${result.dataRoot || dataRoot}`
      );
      await loadStorageInfo();
      await runSystemDiagnostics();
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("تعذر تثبيت مسار البيانات الحالي", "Failed to save the current Data Root"));
    } finally {
      setIsSavingCurrentDataRoot(false);
    }
  }

  async function runSystemDiagnostics() {
    setSystemDiagnosticsError("");
    setIsSystemDiagnosticsRunning(true);
    try {
      const response = await fetch(`${API_BASE}/developer/system-diagnostics`, { headers: authHeaders() });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        throw new Error(tr("تعذر تشغيل فحص صحة النظام", "Failed to run system diagnostics"));
      }

      setSystemDiagnostics(data);
    } catch (error) {
      setSystemDiagnosticsError(error instanceof Error ? error.message : tr("تعذر تشغيل فحص صحة النظام", "Failed to run system diagnostics"));
    } finally {
      setIsSystemDiagnosticsRunning(false);
    }
  }

  async function fetchSystemDiagnosticsReportData() {
    const response = await fetch(`${API_BASE}/developer/system-diagnostics`, { headers: authHeaders() });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      throw new Error(tr("تعذر تحميل بيانات تقرير الفحص", "Failed to load diagnostic report data"));
    }

    setSystemDiagnostics(data);
    return data as SystemDiagnosticsResult;
  }

  function buildDiagnosticsFileName() {
    const date = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");

    return `ledger-diagnostics-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}.json`;
  }

  function maskDiagnosticReportText(value: string) {
    return value
      .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[masked-postgres-connection-string]")
      .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, "Bearer [masked-token]")
      .replace(/(password|token|secret|connectionString|connection_string)=([^;&\s"'<>]+)/gi, "$1=[masked]");
  }

  function escapeDiagnosticReportHtml(value: string | number | boolean | null | undefined) {
    const raw = maskDiagnosticReportText(formatDisplayValue(value, isAR));

    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSystemDiagnosticsDataRoot(data: SystemDiagnosticsResult) {
    return storageInfo?.dataRoot || data.checks.find((check) => check.id === "data-root-exists")?.location || "";
  }

  function buildSystemDiagnosticsPrintHtml(data: SystemDiagnosticsResult) {
    const direction = isAR ? "rtl" : "ltr";
    const align = isAR ? "right" : "left";
    const checkedAt = formatSyncQueueDate(data.checkedAt, isAR);
    const appVersion = import.meta.env.VITE_APP_VERSION || settings.appVersion || "";
    const dataRoot = getSystemDiagnosticsDataRoot(data);
    const statusClass = (status: SystemDiagnosticStatus) => {
      if (status === "pass") return "status-pass";
      if (status === "warning") return "status-warning";
      return "status-critical";
    };
    const rows = data.checks
      .map((check) => {
        const message = isAR ? check.messageAr : check.messageEn;
        const cause = isAR ? check.causeAr : check.causeEn;
        const suggestedFix = isAR ? check.suggestedFixAr : check.suggestedFixEn;

        return `
          <tr>
            <td><span class="status ${statusClass(check.status)}">${escapeDiagnosticReportHtml(getDiagnosticStatusLabel(check.status, isAR))}</span></td>
            <td>${escapeDiagnosticReportHtml(check.area)}</td>
            <td class="path">${escapeDiagnosticReportHtml(check.location)}</td>
            <td>${escapeDiagnosticReportHtml(message)}</td>
            <td>${escapeDiagnosticReportHtml(cause)}</td>
            <td>${escapeDiagnosticReportHtml(suggestedFix)}</td>
          </tr>
        `;
      })
      .join("");

    return `<!doctype html>
<html lang="${isAR ? "ar" : "en"}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <title>${escapeDiagnosticReportHtml(tr("Ledger - تقرير تشخيص النظام", "Ledger - System Diagnostics Report"))}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #ffffff;
      font-family: Arial, Tahoma, sans-serif;
      direction: ${direction};
      text-align: ${align};
      font-size: 12px;
      line-height: 1.45;
    }
    .report-page {
      padding: 14mm;
    }
    .header {
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      color: #4b5563;
    }
    .meta strong { color: #111827; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 16px 0;
    }
    .summary-card {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px;
      background: #f9fafb;
    }
    .summary-label {
      color: #6b7280;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .summary-value {
      margin-top: 4px;
      font-size: 22px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td {
      border: 1px solid #d1d5db;
      padding: 7px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    th {
      background: #f3f4f6;
      color: #374151;
      font-size: 11px;
      font-weight: 800;
    }
    .path {
      color: #374151;
      font-family: Consolas, "Courier New", monospace;
      font-size: 10px;
    }
    .status {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .status-pass { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
    .status-warning { color: #b45309; background: #fffbeb; border-color: #fde68a; }
    .status-critical { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    .footer {
      margin-top: 14px;
      color: #6b7280;
      font-size: 10px;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .report-page {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="report-page">
  <section class="header">
    <h1>${escapeDiagnosticReportHtml(tr("Ledger - تقرير تشخيص النظام", "Ledger - System Diagnostics Report"))}</h1>
    <div class="meta">
      <div><strong>${escapeDiagnosticReportHtml(tr("التاريخ والوقت", "Date and time"))}:</strong> ${escapeDiagnosticReportHtml(checkedAt)}</div>
      <div><strong>${escapeDiagnosticReportHtml(tr("إصدار التطبيق", "App Version"))}:</strong> ${escapeDiagnosticReportHtml(appVersion)}</div>
      <div><strong>${escapeDiagnosticReportHtml(tr("مسار البيانات", "Data Root"))}:</strong> ${escapeDiagnosticReportHtml(dataRoot)}</div>
      <div><strong>${escapeDiagnosticReportHtml(tr("حالة التقرير", "Report Status"))}:</strong> ${escapeDiagnosticReportHtml(data.ok ? tr("لا توجد أخطاء حرجة", "No critical issues") : tr("توجد أخطاء حرجة", "Critical issues found"))}</div>
    </div>
  </section>
  <section class="summary">
    <div class="summary-card"><div class="summary-label">${escapeDiagnosticReportHtml(tr("ناجح", "Passed"))}</div><div class="summary-value">${escapeDiagnosticReportHtml(data.summary.passed)}</div></div>
    <div class="summary-card"><div class="summary-label">${escapeDiagnosticReportHtml(tr("تحذيرات", "Warnings"))}</div><div class="summary-value">${escapeDiagnosticReportHtml(data.summary.warnings)}</div></div>
    <div class="summary-card"><div class="summary-label">${escapeDiagnosticReportHtml(tr("حرج", "Critical"))}</div><div class="summary-value">${escapeDiagnosticReportHtml(data.summary.critical)}</div></div>
  </section>
  <table>
    <thead>
      <tr>
        <th style="width: 10%;">${escapeDiagnosticReportHtml(tr("الحالة", "Status"))}</th>
        <th style="width: 10%;">${escapeDiagnosticReportHtml(tr("القسم", "Area"))}</th>
        <th style="width: 18%;">${escapeDiagnosticReportHtml(tr("المكان", "Location"))}</th>
        <th style="width: 20%;">${escapeDiagnosticReportHtml(tr("الرسالة", "Message"))}</th>
        <th style="width: 20%;">${escapeDiagnosticReportHtml(tr("السبب", "Cause"))}</th>
        <th style="width: 22%;">${escapeDiagnosticReportHtml(tr("الحل المقترح", "Suggested Fix"))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${escapeDiagnosticReportHtml(tr("تقرير دعم فني للقراءة فقط. لا يحتوي على إصلاحات تلقائية.", "Read-only technical support report. No repair actions are included."))}</div>
  </main>
</body>
</html>`;
  }

  async function exportSystemDiagnosticsPdf() {
    setSystemDiagnosticsError("");
    setIsSystemDiagnosticsPdfExporting(true);
    try {
      const data = systemDiagnostics || (await fetchSystemDiagnosticsReportData());
      const printWindow = window.open("", "ledger-diagnostics-report", "width=1100,height=800");

      if (!printWindow) {
        throw new Error(tr("تعذر فتح نافذة الطباعة. تحقق من إعدادات المتصفح.", "Could not open the print window. Check browser popup settings."));
      }

      printWindow.document.open();
      printWindow.document.write(buildSystemDiagnosticsPrintHtml(data));
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      setSystemDiagnosticsError(error instanceof Error ? error.message : tr("تعذر توليد ملف PDF", "Failed to generate PDF"));
    } finally {
      setIsSystemDiagnosticsPdfExporting(false);
    }
  }

  async function exportSystemDiagnosticsReport() {
    setSystemDiagnosticsError("");
    setIsSystemDiagnosticsExporting(true);
    try {
      const response = await fetch(`${API_BASE}/developer/system-diagnostics/export`, { headers: authHeaders() });
      const reportText = await response.text();

      if (!response.ok) {
        let message = tr("تعذر تصدير تقرير الفحص", "Failed to export diagnostic report");
        try {
          const parsed = JSON.parse(reportText);
          message = parsed?.error || message;
        } catch {
          // Keep the translated fallback when the server does not return JSON.
        }
        throw new Error(message);
      }

      const blob = new Blob([reportText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = buildDiagnosticsFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSystemDiagnosticsError(error instanceof Error ? error.message : tr("تعذر تصدير تقرير الفحص", "Failed to export diagnostic report"));
    } finally {
      setIsSystemDiagnosticsExporting(false);
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

  if (!isDeveloperSettingsRoute) {
    return null;
  }

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
    <div dir={isRTL ? "rtl" : "ltr"} className="ledger-developer-settings ms-0 me-auto w-full max-w-[1120px]">
      <style>{`
        .ledger-developer-settings input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]),
        .ledger-developer-settings select { min-height: 40px; font-size: 14px; line-height: 20px; border-radius: 8px; }
        .ledger-developer-settings textarea { font-size: 14px; line-height: 1.6; border-radius: 8px; }
        .ledger-developer-settings label { font-size: 14px; line-height: 20px; }
        .ledger-developer-settings button:not([role="switch"]):not([role="checkbox"]):not([role="radio"]) { min-height: 36px; font-size: 14px; }
        .ledger-developer-settings input[type="number"] { max-width: 160px; }
      `}</style>
    <SettingsShell<TabId>
      dir={isRTL ? "rtl" : "ltr"}
      title={isAR ? "إعدادات المطوّر" : "Developer Settings"}
      description={tr("إدارة الحماية والصلاحيات وقواعد البيانات وأدوات صيانة النظام.", "Manage security, permissions, databases, and system maintenance tools.")}
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
        <div className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle className="text-lg">{tr("إعدادات الحماية", "Security Settings")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {securityToggles.map(([key, labelAr, labelEn, hintAr, hintEn]) => (
                <ToggleRow key={key} label={tr(labelAr, labelEn)} hint={tr(hintAr, hintEn)} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle className="text-lg">{tr("رسالة صفحة تسجيل الدخول", "Login Page Message")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{tr("نص الرسالة", "Message text")}</Label>
                <Textarea
                  value={settings.loginMessageText}
                  onChange={(event) => setText("loginMessageText", event.target.value)}
                  className="min-h-28"
                  placeholder={tr("اتركها فارغة لإخفاء الرسالة", "Leave empty to hide the message")}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("نوع الرسالة", "Message type")}</Label>
                <RadioGroup
                  value={settings.loginMessageType || "welcome"}
                  onValueChange={(value) => setText("loginMessageType", value as LoginMessageType)}
                  className="grid gap-2 md:grid-cols-2"
                >
                  {loginMessageTypeOptions.map((option) => (
                    <Label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                      <RadioGroupItem value={option.value} />
                      <span>{tr(option.labelAr, option.labelEn)}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={saveSettings} disabled={isSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? tr("جاري الحفظ...", "Saving...") : tr("حفظ", "Save")}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
          <Card className="rounded-2xl border-border/70 shadow-sm">
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
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>{tr("رقم الجهاز", "Device ID")}</Label>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={copyLicenseDeviceId}
                    disabled={!licenseDeviceId}
                  >
                    <Copy className="h-4 w-4" />
                    {tr("نسخ", "Copy")}
                  </Button>
                </div>

                <Input
                  value={licenseDeviceId}
                  readOnly
                  dir="ltr"
                  className="font-mono text-xs"
                  placeholder={tr("جاري تحميل رقم الجهاز...", "Loading device ID...")}
                />

                <p className="text-xs text-muted-foreground">
                  {tr(
                    "أرسل رقم الجهاز لتفعيل البرنامج",
                    "Send this device ID to activate the software"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                <div className="font-semibold text-sm">
                  {tr("مولد ترخيص العميل", "Client License Generator")}
                </div>

                <Input
                  value={licenseCustomerName}
                  onChange={(event) => setLicenseCustomerName(event.target.value)}
                  placeholder={tr("اسم العميل", "Customer name")}
                />

                <Input
                  value={licenseTargetDeviceId}
                  onChange={(event) => setLicenseTargetDeviceId(event.target.value)}
                  placeholder={tr("رقم جهاز العميل", "Customer Device ID")}
                  dir="ltr"
                  className="font-mono text-xs"
                />

                <Input
                  value={licenseExpiryDate}
                  onChange={(event) => setLicenseExpiryDate(event.target.value)}
                  placeholder="2026-06-30"
                  dir="ltr"
                />

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={generateClientLicenseText}
                >
                  {tr("توليد الترخيص", "Generate License")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={activateCurrentLicense}
                  disabled={isActivatingLicense}
                >
                  {isActivatingLicense ? tr("جاري التفعيل...", "Activating...") : tr("تفعيل هذه النسخة", "Activate This Build")}
                </Button>

                {generatedLicenseText && (
                  <>
                    <Textarea
                      value={generatedLicenseText}
                      readOnly
                      dir="ltr"
                      className="min-h-40 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={downloadGeneratedLicenseFile}
                    >
                      {tr("حفظ ملف الترخيص", "Save License File")}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
       )}

       {activeTab === "manager" && (
        <div className="grid gap-4">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader><CardTitle className="text-lg">{tr("صلاحيات المدير", "Manager Access")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {managerToggles.map(([key, labelAr, labelEn, hintAr, hintEn]) => (
              <ToggleRow key={key} label={tr(labelAr, labelEn)} hint={tr(hintAr, hintEn)} checked={!!settings[key]} onChange={(checked) => setBool(key, checked)} />
            ))}
          </CardContent>
        </Card>
        </div>
      )}

      {activeTab === "database" && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader><CardTitle className="text-lg">{tr("قاعدة البيانات", "Database")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SectionNavigation label={tr("أقسام قواعد البيانات", "Database sections")} value={databaseSection} onChange={setDatabaseSection} options={[
              { id: "local", label: tr("المحلية", "Local"), hint: tr("SQLite ومسار البيانات", "SQLite and data location"), icon: Database },
              { id: "online", label: tr("الأونلاين", "Online"), hint: tr("الاتصال والمزامنة عبر الإنترنت", "Internet connection and sync"), icon: Cloud },
              { id: "internal", label: tr("الخادم الداخلي", "Internal Server"), hint: tr("اتصال الشبكة والمزامنة الداخلية", "Network connection and internal sync"), icon: Database },
            ]} />

            <section hidden={databaseSection !== "local"} className="rounded-xl border border-border bg-background">
              <div className="flex items-center gap-3 px-5 py-4 text-base font-semibold text-foreground">
                <span className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />{tr("قاعدة البيانات المحلية (SQLite)", "Local database (SQLite)")}</span>
              </div>
              <div className="space-y-4 border-t border-border p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow isAR={isAR} label={tr("مسار SQLite", "SQLite path")} value={settings.sqlitePath} />
              <InfoRow isAR={isAR} label={tr("حالة قاعدة البيانات", "Database status")} value={settings.databaseStatus} />
              <InfoRow isAR={isAR} label={tr("حجم قاعدة البيانات", "Database size")} value={formatBytes(settings.databaseSize, isAR)} />
              <InfoRow isAR={isAR} label={tr("آخر نسخة احتياطية", "Last backup")} value={settings.lastBackupAt} />
              <InfoRow isAR={isAR} label={tr("حالة API المحلي", "Local API status")} value={readinessStatus.apiStatus === "connected" ? tr("يستجيب", "Responding") : tr("لا يستجيب", "Not responding")} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { void checkDatabase(); void loadReadinessStatus(); }} disabled={isReadinessLoading} className="gap-2"><RefreshCw className={cn("h-4 w-4", isReadinessLoading && "animate-spin")} />{tr("فحص الاتصال", "Check connection")}</Button>
              <Button type="button" variant="outline" onClick={copyDatabasePath} className="gap-2"><Copy className="h-4 w-4" />{tr("نسخ مسار قاعدة البيانات", "Copy database path")}</Button>
            </div>

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
                  <DevField label={tr("حالة قاعدة SQLite المحلية", "Local SQLite database status")}>
                    <div className="flex h-10 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
                      <span className={cn("font-semibold", databaseConfig.connectionStatus === "connected" ? "text-emerald-600" : databaseConfig.connectionStatus === "untested" ? "text-muted-foreground" : "text-red-600")}>
                        {formatDisplayValue(databaseConfig.connectionStatus, isAR)}
                      </span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", databaseConfig.connectionStatus === "connected" ? "bg-emerald-500" : databaseConfig.connectionStatus === "untested" ? "bg-muted-foreground" : "bg-red-500")} />
                    </div>
                  </DevField>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={createSqlFile} size="sm">{tr("تحميل ملف SQL لإنشاء قاعدة جديدة", "Download SQL file to create a new database")}</Button>
                </div>
              </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {tr("إدارة مسار البيانات", "Data Root Management")}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1">
                    {tr(
                      "إدارة مكان تخزين قاعدة البيانات والمرفقات والنسخ الاحتياطية والسجلات وملفات النظام.",
                      "Manage where the application stores database, attachments, backups, logs, and configuration files."
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">
                  {tr("مسار البيانات الحالي", "Current Data Root")}
                </p>

                <p className="text-xs text-muted-foreground break-all">
                  {settings.sqlitePath
                    ? settings.sqlitePath
                        .replace(/\\database\\local\.db$/i, "")
                        .replace(/\/database\/local\.db$/i, "")
                    : tr("لم يتم التحميل بعد", "Not loaded yet")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const result =
                      await window.electronAPI?.chooseDataRootFolder?.();

                    if (result?.canceled) {
                      return;
                    }

                    if (!result?.ok) {
                      alert(
                        result?.error ||
                          tr(
                            "فشل اختيار المجلد",
                            "Failed to choose folder"
                          )
                      );

                      return;
                    }

                    const writeTest =
                      await window.electronAPI?.testDataRootWrite?.(result.path);

                    if (!writeTest?.ok) {
                      alert(
                        writeTest?.error ||
                          tr(
                            "تم اختيار المجلد لكن فشل اختبار الكتابة",
                            "Folder selected but write test failed"
                          )
                      );

                      return;
                    }

                    const saveResult =
                      await window.electronAPI?.saveDataRootConfig?.(result.path);

                    if (!saveResult?.ok) {
                      alert(
                        saveResult?.error ||
                          tr(
                            "تم اختيار المجلد واختبار الكتابة، لكن فشل حفظ إعداد المسار",
                            "Folder selected and write test passed, but saving data root setting failed"
                          )
                      );

                      return;
                    }

                    alert(
                      tr(
                        "تم اختيار المجلد واختبار الكتابة وحفظ إعداد المسار بنجاح",
                        "Folder selected, write test completed, and data root setting saved successfully"
                      ) +
                        "\n\n" +
                        result.path
                    );
                  }}
                  className="px-4 py-2 rounded-xl border bg-background hover:bg-muted transition text-sm font-medium"
                >
                  {tr("اختيار مجلد جديد", "Choose New Folder")}
                </button>
                <button
                  type="button"
                  onClick={saveCurrentDataRoot}
                  disabled={isSavingCurrentDataRoot}
                  className="px-4 py-2 rounded-xl border bg-background hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  {isSavingCurrentDataRoot
                    ? tr("جاري التثبيت...", "Saving...")
                    : tr("تثبيت مسار البيانات الحالي", "Save Current Data Root")}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const dataRoot =
                      settings.sqlitePath
                        ?.replace(/\\database\\local\.db$/i, "")
                        ?.replace(/\/database\/local\.db$/i, "");

                    if (!dataRoot) {
                      alert(
                        tr(
                          "مسار البيانات غير متوفر",
                          "Data root path is not available"
                        )
                      );

                      return;
                    }

                    const result =
                      await window.electronAPI?.testDataRootWrite?.(dataRoot);

                    if (result?.ok) {
                      alert(
                        tr(
                          "تم اختبار الكتابة بنجاح",
                          "Write test completed successfully"
                        )
                      );
                    } else {
                      alert(
                        result?.error ||
                          tr(
                            "فشل اختبار الكتابة",
                            "Write test failed"
                          )
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-xl border bg-background hover:bg-muted transition text-sm font-medium"
                >
                  {tr("اختبار الكتابة", "Test Write")}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const dataRoot =
                      settings.sqlitePath
                        ?.replace(/\\database\\local\.db$/i, "")
                        ?.replace(/\/database\/local\.db$/i, "");

                    if (!dataRoot) {
                      alert(
                        tr(
                          "مسار البيانات غير متوفر",
                          "Data root path is not available"
                        )
                      );

                      return;
                    }

                    await window.electronAPI?.openExternalFile?.(dataRoot);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition text-sm font-medium"
                >
                  {tr("فتح مجلد البيانات", "Open Data Folder")}
                </button>

              </div>

            </div>
              </div>
            </section>
            <section hidden={databaseSection !== "online"} className="rounded-xl border border-border bg-background">
              <div className="flex items-center gap-3 px-5 py-4 text-base font-semibold text-foreground">
                <span className="flex items-center gap-2"><Cloud className="h-5 w-5 text-primary" />{tr("قاعدة البيانات عبر الإنترنت (PostgreSQL)", "Online database (PostgreSQL)")}</span>
              </div>
              <div className="space-y-4 border-t border-border p-5">
              <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Cloud className="h-4 w-4 text-blue-600" />
                  <span>{tr("إعدادات قاعدة البيانات عبر الإنترنت", "Online database settings")}</span>
                </div>
                <div className="mb-4 flex h-10 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
                  <span className="text-muted-foreground">{tr("تفعيل مزامنة الأونلاين", "Online sync setting")}</span>
                  <span className={cn("font-semibold", onlineDatabaseConnected ? "text-emerald-600" : "text-red-600")}>
                    {onlineDatabaseConnected ? tr("مزامنة الأونلاين مفعّلة", "Online sync enabled") : tr("متوقفة على هذا الجهاز", "Off on this device")}
                  </span>
                </div>
                <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={databaseConfig.useConnectionString}
                    onChange={(event) => setDatabaseConfig((current) => ({ ...current, useConnectionString: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{tr("استخدام رابط اتصال كامل", "Use a full connection string")}</span>
                </label>

                {databaseConfig.useConnectionString ? (
                  <DevField label={tr("رابط الاتصال", "Connection string")}>
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
                    <DevField label={tr("عنوان الخادم", "Host")}>
                      <Input value={databaseConfig.host} onChange={(event) => setDatabaseConfig((current) => ({ ...current, host: event.target.value }))} dir="ltr" />
                    </DevField>
                    <DevField label={tr("المنفذ", "Port")}>
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
            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={testPreparedConnection} size="sm" disabled={isTestingConnection}>
                  {isTestingConnection ? tr("جارٍ الاختبار...", "Testing...") : tr("اختبار الاتصال", "Test connection")}
                </Button>
                <Button type="button" variant="outline" onClick={savePreparedConnection} size="sm">{tr("حفظ الإعدادات", "Save settings")}</Button>
                {onlineDatabaseConnected ? (
                  <Button type="button" variant="outline" onClick={disconnectOnlineDatabase} size="sm" disabled={isSaving}>{tr("فصل الاتصال", "Disconnect")}</Button>
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
            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
                {syncConfig.autoSync && onlineDatabaseConnected
                  ? syncConfig.timing === "interval"
                    ? tr(`تعمل المزامنة تلقائيًا عند تشغيل البرنامج، ثم كل ${syncConfig.intervalMinutes} دقيقة أثناء تشغيله.`, `Automatic sync runs when the app starts, then every ${syncConfig.intervalMinutes} minute(s) while it is running.`)
                    : tr("تعمل المزامنة تلقائيًا بعد تسجيل الدخول.", "Automatic sync runs after sign-in.")
                  : tr("المزامنة التلقائية متوقفة على هذا الجهاز.", "Automatic sync is off on this device.")}
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
                <div className="mb-2 text-sm font-medium text-muted-foreground">{tr("آخر عناصر القائمة", "Recent Queue Items")}</div>
                {syncQueueStatus.recent.length === 0 ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {tr("لا توجد عناصر في القائمة بعد", "No queue items yet")}
                  </div>
                ) : (
                  <ResizableScrollArea storageKey="settings-developer" maxHeight={250} className="rounded-md border border-border">
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
                              <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-sm font-semibold", syncQueueStatusBadgeClass(item.status || ""))}>
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
                  </ResizableScrollArea>
                )}
              </div>
            </div>
              </div>
            </section>
            <section hidden={databaseSection !== "internal"} className="rounded-xl border border-border bg-background">
              <div className="flex items-center gap-3 px-5 py-4 text-base font-semibold text-foreground">
                <span className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />{tr("قاعدة بيانات الخادم الداخلي", "Internal server database")}</span>
              </div>
              <div className="space-y-4 border-t border-border p-5">
                <p className="text-sm text-muted-foreground">
                  {tr("احفظ إعدادات PostgreSQL الخاصة بالشبكة الداخلية، ثم اختبر الاتصال أو تابع حالة المزامنة أدناه.", "Save the internal PostgreSQL settings, then test the connection or review sync status below.")}
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <DevField label={tr("عنوان الخادم الداخلي", "Internal server address")}>
                    <Input value={internalDatabaseConfig.host} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, host: event.target.value }))} placeholder="192.168.1.10" dir="ltr" />
                  </DevField>
                  <DevField label={tr("المنفذ", "Port")}>
                    <Input value={internalDatabaseConfig.port} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, port: event.target.value }))} placeholder="5432" dir="ltr" />
                  </DevField>
                  <DevField label={tr("اسم قاعدة البيانات", "Database name")}>
                    <Input value={internalDatabaseConfig.databaseName} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, databaseName: event.target.value }))} placeholder="ledger" dir="ltr" />
                  </DevField>
                  <DevField label={tr("اسم المستخدم", "Username")}>
                    <Input value={internalDatabaseConfig.username} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, username: event.target.value }))} dir="ltr" />
                  </DevField>
                  <DevField label={tr("كلمة المرور", "Password")}>
                    <Input value={internalDatabaseConfig.password} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, password: event.target.value }))} type="password" dir="ltr" />
                  </DevField>
                  <DevField label={tr("رابط الاتصال البديل", "Alternative connection string")}>
                    <Input value={internalDatabaseConfig.connectionString} onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, connectionString: event.target.value }))} type="password" placeholder="postgresql://..." dir="ltr" />
                  </DevField>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow isAR={isAR} label={tr("آخر فحص للخادم الداخلي", "Last internal server check")} value={internalDatabaseConnectionStatus === "connected" ? tr("نجح الاتصال", "Connection succeeded") : internalDatabaseConnectionStatus === "failed" ? tr("فشل الاتصال", "Connection failed") : tr("لم يُختبر بعد", "Not tested yet")} />
                  <InfoRow isAR={isAR} label={tr("حالة المزامنة الداخلية", "Internal sync status")} value={!internalDatabaseConfig.autoSync ? tr("التشغيل التلقائي متوقف", "Automatic sync is off") : internalAutoStatus?.running ? tr("المزامنة جارية", "Sync in progress") : internalAutoStatus?.lastError ? tr("آخر محاولة فشلت", "Last attempt failed") : internalAutoStatus?.lastSuccessAt ? tr("آخر محاولة نجحت", "Last attempt succeeded") : tr("بانتظار أول تشغيل", "Waiting for first run")} />
                  <InfoRow isAR={isAR} label={tr("التغييرات المحلية المنتظرة للخادم الداخلي", "Local changes pending for internal server")} value={internalJournalCount ?? tr("لم تُفحص", "Not checked")} />
                  <InfoRow isAR={isAR} label={tr("تعديلات الخادم المباشرة في السجل", "Direct server edits in journal")} value={serverJournalCount ?? tr("تعذر الفحص", "Unavailable")} />
                </div>
                <div className="grid gap-4 rounded-xl border border-border bg-background/70 p-4 xl:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold">{tr("اتجاه المزامنة الداخلية", "Internal sync direction")}</h4>
                    {[
                      { id: "local-to-internal", ar: "من المحلي إلى الخادم الداخلي", en: "Local to internal server" },
                      { id: "internal-to-local", ar: "من الخادم الداخلي إلى المحلي", en: "Internal server to local" },
                      { id: "bidirectional", ar: "مزامنة ثنائية الاتجاه", en: "Bidirectional sync" },
                    ].map((option) => (
                      <label key={option.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <input type="radio" name="internal-sync-mode" className="h-4 w-4 accent-primary"
                          checked={internalDatabaseConfig.syncMode === option.id}
                          onChange={() => setInternalDatabaseConfig((current) => ({ ...current, syncMode: option.id }))} />
                        <span>{tr(option.ar, option.en)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold">{tr("جدولة المزامنة الداخلية", "Internal sync schedule")}</h4>
                    <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <span>{tr("تشغيل تلقائي عند تفعيل المزامنة", "Auto sync when available")}</span>
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={internalDatabaseConfig.autoSync}
                        onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, autoSync: event.target.checked }))} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <DevField label={tr("التوقيت", "Timing")}>
                        <select className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                          value={internalDatabaseConfig.timing}
                          onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, timing: event.target.value }))}>
                          <option value="startup">{tr("عند بدء التشغيل", "On startup")}</option>
                          <option value="interval">{tr("كل فترة", "At intervals")}</option>
                        </select>
                      </DevField>
                      <DevField label={tr("الفاصل بالدقائق", "Interval in minutes")}>
                        <Input type="number" min={1} max={1440} value={internalDatabaseConfig.intervalMinutes}
                          onChange={(event) => setInternalDatabaseConfig((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))} />
                      </DevField>
                    </div>
                    <p className="text-xs text-muted-foreground">{tr("بعد حفظ التفعيل، تعمل المزامنة تلقائيًا عند بدء البرنامج أو كل فترة حسب اختيارك. التعارض والحذف من الخادم يوقفان المزامنة الثنائية للمراجعة.", "After saving, sync runs automatically on startup or at the selected interval. Conflicts and server deletions stop bidirectional sync for review.")}</p>
                    {internalAutoStatus && <p className="text-xs text-muted-foreground">{tr("آخر فحص للجدولة", "Last schedule check")}: {internalAutoStatus.lastCheckAt ? new Date(internalAutoStatus.lastCheckAt).toLocaleString() : tr("لا يوجد", "None")} · {tr("آخر محاولة", "Last attempt")}: {internalAutoStatus.lastAttemptAt ? new Date(internalAutoStatus.lastAttemptAt).toLocaleString() : tr("لا توجد", "None")} · {tr("آخر نجاح", "Last success")}: {internalAutoStatus.lastSuccessAt ? new Date(internalAutoStatus.lastSuccessAt).toLocaleString() : tr("لا يوجد", "None")} {internalAutoStatus.running ? tr("· جارٍ التشغيل", "· Running") : ""} {internalAutoStatus.lastError ? `· ${tr("آخر خطأ", "Last error")}: ${internalAutoStatus.lastError}` : ""}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={checkInternalAutoStatus}>{tr("تحديث حالة التشغيل التلقائي", "Refresh automatic sync status")}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={saveInternalDatabaseSettings} disabled={isSavingInternalDatabase}>
                    {isSavingInternalDatabase ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ الإعدادات", "Save settings")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={testInternalDatabaseConnection} disabled={isTestingInternalDatabase || isSavingInternalDatabase}>
                    {isTestingInternalDatabase ? tr("جارٍ الاختبار...", "Testing...") : tr("اختبار الاتصال", "Test connection")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={checkInternalSyncReadiness} disabled={isCheckingInternalReadiness || isSavingInternalDatabase}>
                    {isCheckingInternalReadiness ? tr("جارٍ فحص الجداول...", "Checking tables...") : tr("فحص جاهزية الجداول", "Check table readiness")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={checkInternalJournal} disabled={isCheckingInternalJournal}>
                    {isCheckingInternalJournal ? tr("جارٍ فحص التغييرات...", "Checking changes...") : tr("فحص التغييرات الداخلية", "Check internal changes")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={checkServerJournal} disabled={isCheckingServerJournal}>
                    {isCheckingServerJournal ? tr("جارٍ فحص الخادم...", "Checking server...") : tr("فحص سجل تعديلات الخادم", "Check server edit journal")}
                  </Button>
                  {internalReadiness?.tables.some((row) => row.name === "invoice_accounting" && row.localCount !== null && row.internalCount !== null && row.internalCount < row.localCount) && (
                    <Button type="button" variant="outline" size="sm" onClick={completeInternalAccountingRows} disabled={isCompletingAccounting}>
                      {isCompletingAccounting ? tr("جارٍ إكمال الحسابات...", "Completing accounting...") : tr("إكمال سجلات الحسابات", "Complete accounting records")}
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={runInternalPush}
                    disabled={isRunningInternalPush || internalDatabaseConfig.syncMode !== "local-to-internal"}>
                    {isRunningInternalPush ? tr("جارٍ إرسال التغييرات...", "Sending changes...") : tr("مزامنة المحلي إلى الداخلي الآن", "Sync local to internal now")}
                  </Button>
                  <Button type="button" size="sm" onClick={runInternalPull}
                    disabled={isRunningInternalPull || internalDatabaseConfig.syncMode !== "internal-to-local"}>
                    {isRunningInternalPull ? tr("جارٍ استلام البيانات...", "Receiving data...") : tr("مزامنة الداخلي إلى المحلي الآن", "Sync internal to local now")}
                  </Button>
                  <Button type="button" size="sm" onClick={runInternalBidirectional}
                    disabled={isRunningInternalBidirectional || internalDatabaseConfig.syncMode !== "bidirectional"}>
                    {isRunningInternalBidirectional ? tr("جارٍ المزامنة الثنائية...", "Syncing both directions...") : tr("مزامنة ثنائية الآن", "Bidirectional sync now")}
                  </Button>
                </div>
                {(internalJournalCount !== null || serverJournalCount !== null) && (
                  <p className="text-xs text-muted-foreground">{tr(
                    `المنتظر محليًا: ${internalJournalCount ?? "—"} | تعديلات الخادم المباشرة: ${serverJournalCount ?? "—"}`,
                    `Local pending: ${internalJournalCount ?? "—"} | Direct server edits: ${serverJournalCount ?? "—"}`,
                  )}</p>
                )}
                <p className="text-xs text-muted-foreground">{tr(
                  "تغييرات الأجهزة الأخرى لا تظهر في عدّاد تعديلات الخادم المباشرة؛ تلتقطها المزامنة الثنائية بفحص السجلات.",
                  "Edits from other devices are not counted as direct server edits; bidirectional sync finds them by checking the records.",
                )}</p>
                {internalDatabaseMessage && <p role="status" className="text-sm text-muted-foreground">{internalDatabaseMessage}</p>}
                {internalReadiness && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50"><tr>
                        <th className="p-2 text-start">{tr("الجدول", "Table")}</th>
                        <th className="p-2 text-start">{tr("المحلي", "Local")}</th>
                        <th className="p-2 text-start">{tr("الخادم الداخلي", "Internal server")}</th>
                      </tr></thead>
                      <tbody>{internalReadiness.tables.map((row) => (
                        <tr key={row.name} className="border-t border-border">
                          <td className="p-2" dir="ltr">{row.name}</td>
                          <td className="p-2">{row.localCount ?? tr("مفقود", "Missing")}</td>
                          <td className="p-2">{row.internalCount ?? tr("مفقود", "Missing")}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
            {databaseMessage && <div role="status" className="text-sm text-muted-foreground">{databaseMessage}</div>}
          </CardContent>
        </Card>
      )}

      {activeTab === "diagnostics" && (
        <div className="space-y-4">
          <SectionNavigation label={tr("أقسام الصيانة", "Maintenance sections")} value={diagnosticsSection} onChange={setDiagnosticsSection} options={[
            { id: "system", label: tr("صحة النظام", "System Health"), hint: tr("حالة الخدمات وتقارير الفحص", "Service status and diagnostic reports"), icon: Activity },
            { id: "storage", label: tr("التخزين", "Storage"), hint: tr("مسارات الملفات وتحليل التخزين", "File locations and storage analysis"), icon: Database },
            { id: "backup", label: tr("النسخ الاحتياطي", "Backup"), hint: tr("الجاهزية والوصف والتحقق", "Readiness, manifest, and verification"), icon: PackageCheck },
          ]} />
          <div hidden={diagnosticsSection !== "system"} className="space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle className="text-lg">{tr("النظام والتشخيص", "Diagnostics")}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoRow isAR={isAR} label={tr("مسار الواجهة", "Frontend path")} value={settings.frontendPath} />
              <InfoRow isAR={isAR} label={tr("مسار الخادم", "Backend path")} value={settings.backendPath} />
              <InfoRow isAR={isAR} label={tr("حالة API", "API status")} value={settings.apiStatus} />
              <InfoRow isAR={isAR} label={tr("حالة ملف env", "env file status")} value={settings.envFileStatus} />
              <InfoRow isAR={isAR} label={tr("حالة الموارد", "Resources status")} value={settings.resourcesStatus} />
            </CardContent>
          </Card>


          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="w-full pb-2 text-lg">{tr("فحص صحة النظام", "System Diagnostics")}</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={runSystemDiagnostics} disabled={isSystemDiagnosticsRunning} className="gap-2">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSystemDiagnosticsRunning && "animate-spin")} />
                  {isSystemDiagnosticsRunning ? tr("جار الفحص...", "Running...") : tr("فحص صحة النظام", "Run System Diagnostics")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportSystemDiagnosticsReport}
                  disabled={isSystemDiagnosticsExporting}
                  className="gap-2"
                >
                  <FileText className={cn("h-3.5 w-3.5", isSystemDiagnosticsExporting && "animate-pulse")} />
                  {isSystemDiagnosticsExporting ? tr("جاري التصدير...", "Exporting...") : tr("تصدير تقرير الفحص", "Export Diagnostic Report")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportSystemDiagnosticsPdf}
                  disabled={isSystemDiagnosticsPdfExporting}
                  className="gap-2"
                >
                  <FileText className={cn("h-3.5 w-3.5", isSystemDiagnosticsPdfExporting && "animate-pulse")} />
                  {isSystemDiagnosticsPdfExporting ? tr("جاري تجهيز PDF...", "Preparing PDF...") : tr("تصدير PDF", "Export PDF")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveCurrentDataRoot}
                  disabled={isSavingCurrentDataRoot}
                  className="gap-2"
                >
                  <Save className={cn("h-3.5 w-3.5", isSavingCurrentDataRoot && "animate-pulse")} />
                  {isSavingCurrentDataRoot
                    ? tr("جاري التثبيت...", "Saving...")
                    : tr("تثبيت مسار البيانات الحالي", "Save Current Data Root")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemDiagnosticsError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {systemDiagnosticsError}
                </div>
              )}

              {isSystemDiagnosticsRunning && !systemDiagnostics && (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {tr("يتم تشغيل فحوصات القراءة فقط الآن.", "Read-only checks are running now.")}
                </div>
              )}

              {systemDiagnostics && (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <InfoRow isAR={isAR} label={tr("آخر فحص", "Checked at")} value={systemDiagnostics.checkedAt} />
                    <InfoRow isAR={isAR} label={tr("ناجح", "Passed")} value={systemDiagnostics.summary.passed} />
                    <InfoRow isAR={isAR} label={tr("تحذيرات", "Warnings")} value={systemDiagnostics.summary.warnings} />
                    <InfoRow isAR={isAR} label={tr("حرج", "Critical")} value={systemDiagnostics.summary.critical} />
                  </div>

                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{tr("الحالة", "Status")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("المكان", "Location")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("السبب", "Cause")}</th>
                          <th className="px-3 py-2 font-semibold">{tr("الحل المقترح", "Suggested fix")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemDiagnostics.checks.map((check) => (
                          <tr key={check.id} className="border-t border-border align-top">
                            <td className="px-3 py-2">
                              <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-sm font-semibold", diagnosticStatusBadgeClass(check.status))}>
                                {getDiagnosticStatusLabel(check.status, isAR)}
                              </span>
                              <div className="mt-1 text-sm text-muted-foreground">{check.area}</div>
                            </td>
                            <td className="max-w-[220px] break-all px-3 py-2">
                              <div className="font-medium">{isAR ? check.messageAr : check.messageEn}</div>
                              <div className="mt-1 text-muted-foreground">{check.location}</div>
                            </td>
                            <td className="px-3 py-2">{isAR ? check.causeAr : check.causeEn}</td>
                            <td className="px-3 py-2">{isAR ? check.suggestedFixAr : check.suggestedFixEn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          </div>
          <div hidden={diagnosticsSection !== "storage"} className="space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                        <div className="mb-2 text-sm font-medium text-muted-foreground">{isAR ? "التحذيرات" : "warnings"}</div>
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

          </div>
          <div hidden={diagnosticsSection !== "backup"} className="space-y-4">
            <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                      <div className="mb-2 text-sm font-medium text-muted-foreground">{isAR ? "التحذيرات" : "warnings"}</div>
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        </div>
      )}
    </SettingsShell>
    </div>
  );
}
