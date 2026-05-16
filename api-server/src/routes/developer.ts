import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db, sqlite, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import packageJson from "../../../package.json";
import { requireAdmin } from "../middleware/auth";
import { ensureSyncQueueTable } from "../utils/ensure-sync-queue-table";
import { runSyncWorkerOnce } from "../utils/sync-worker";
import { getStorageInfo } from "../utils/storage/get-storage-info";

const router = Router();
const require = createRequire(path.join(process.cwd(), "package.json"));
const BetterSqliteDatabase = require("better-sqlite3") as new (
  filename: string,
  options?: { readonly?: boolean; fileMustExist?: boolean },
) => {
  prepare: (sql: string) => { all: () => Array<Record<string, unknown>> };
  close: () => void;
};
const { Client: PgClient } = require("pg") as {
  Client: new (config: { connectionString: string; connectionTimeoutMillis?: number; query_timeout?: number }) => {
    connect: () => Promise<void>;
    query: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
};

function isExternalDeveloperModeRequest(req: Request) {
  return req.header("x-developer-mode") === "true" && req.header("x-developer-unlocked") === "true";
}

function requireDeveloperAccess(req: Request, res: Response, next: NextFunction) {
  if (isExternalDeveloperModeRequest(req)) {
    req.user = {
      userId: 0,
      username: "developer",
      role: "admin",
    };
    return next();
  }

  return requireAdmin(req, res, next);
}


const developerPermissionColumns = [
  [
    "allow_manager_edit_accountant_signature",
    "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_accountant_signature INTEGER DEFAULT 0",
  ],
  [
    "allow_manager_edit_legal_info",
    "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_legal_info INTEGER DEFAULT 0",
  ],
  [
    "allow_manager_edit_invoices_backup_import",
    "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_invoices_backup_import INTEGER DEFAULT 0",
  ],
  [
    "allow_manager_edit_appearance",
    "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_appearance INTEGER DEFAULT 0",
  ],
  [
    "allow_manager_edit_print_settings",
    "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_print_settings INTEGER DEFAULT 0",
  ],
  ["allow_manager_view_preview", "ALTER TABLE company_settings ADD COLUMN allow_manager_view_preview INTEGER DEFAULT 0"],
  ["allow_manager_view_update", "ALTER TABLE company_settings ADD COLUMN allow_manager_view_update INTEGER DEFAULT 0"],
  ["allow_manager_edit_branding", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_branding INTEGER DEFAULT 0"],
  ["allow_manager_edit_registration_settings", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_registration_settings INTEGER DEFAULT 0"],
  ["allow_manager_edit_sensitive_users", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_sensitive_users INTEGER DEFAULT 0"],
  ["lock_company_identity", "ALTER TABLE company_settings ADD COLUMN lock_company_identity INTEGER DEFAULT 0"],
  ["lock_company_name", "ALTER TABLE company_settings ADD COLUMN lock_company_name INTEGER DEFAULT 0"],
  ["lock_logo", "ALTER TABLE company_settings ADD COLUMN lock_logo INTEGER DEFAULT 0"],
  ["lock_stamp", "ALTER TABLE company_settings ADD COLUMN lock_stamp INTEGER DEFAULT 0"],
  ["lock_legal_info", "ALTER TABLE company_settings ADD COLUMN lock_legal_info INTEGER DEFAULT 0"],
  ["lock_footer_branding", "ALTER TABLE company_settings ADD COLUMN lock_footer_branding INTEGER DEFAULT 0"],
  ["login_footer_text", "ALTER TABLE company_settings ADD COLUMN login_footer_text TEXT DEFAULT ''"],
  ["login_message_text", "ALTER TABLE company_settings ADD COLUMN login_message_text TEXT DEFAULT ''"],
  ["login_message_type", "ALTER TABLE company_settings ADD COLUMN login_message_type TEXT DEFAULT 'welcome'"],
  ["prevent_rebrand_to_another_company", "ALTER TABLE company_settings ADD COLUMN prevent_rebrand_to_another_company INTEGER DEFAULT 0"],
  ["license_status", "ALTER TABLE company_settings ADD COLUMN license_status TEXT DEFAULT 'not_configured'"],
  ["licensed_company_name", "ALTER TABLE company_settings ADD COLUMN licensed_company_name TEXT DEFAULT ''"],
  ["license_id", "ALTER TABLE company_settings ADD COLUMN license_id TEXT DEFAULT ''"],
  ["hardware_id", "ALTER TABLE company_settings ADD COLUMN hardware_id TEXT DEFAULT ''"],
  ["issued_at", "ALTER TABLE company_settings ADD COLUMN issued_at TEXT DEFAULT ''"],
  ["expires_at", "ALTER TABLE company_settings ADD COLUMN expires_at TEXT DEFAULT ''"],
  ["database_provider", "ALTER TABLE company_settings ADD COLUMN database_provider TEXT DEFAULT 'sqlite'"],
  ["database_mode", "ALTER TABLE company_settings ADD COLUMN database_mode TEXT DEFAULT 'local'"],
  ["database_use_connection_string", "ALTER TABLE company_settings ADD COLUMN database_use_connection_string INTEGER DEFAULT 0"],
  ["database_connection_string", "ALTER TABLE company_settings ADD COLUMN database_connection_string TEXT DEFAULT ''"],
  ["database_host", "ALTER TABLE company_settings ADD COLUMN database_host TEXT DEFAULT ''"],
  ["database_port", "ALTER TABLE company_settings ADD COLUMN database_port TEXT DEFAULT '5432'"],
  ["database_name", "ALTER TABLE company_settings ADD COLUMN database_name TEXT DEFAULT ''"],
  ["database_username", "ALTER TABLE company_settings ADD COLUMN database_username TEXT DEFAULT ''"],
  ["database_password", "ALTER TABLE company_settings ADD COLUMN database_password TEXT DEFAULT ''"],
  ["sync_mode", "ALTER TABLE company_settings ADD COLUMN sync_mode TEXT DEFAULT 'local-to-online'"],
  ["sync_auto_sync", "ALTER TABLE company_settings ADD COLUMN sync_auto_sync INTEGER DEFAULT 0"],
  ["sync_timing", "ALTER TABLE company_settings ADD COLUMN sync_timing TEXT DEFAULT 'startup'"],
  ["sync_interval_minutes", "ALTER TABLE company_settings ADD COLUMN sync_interval_minutes INTEGER DEFAULT 30"],
  ["sync_last_sync_time", "ALTER TABLE company_settings ADD COLUMN sync_last_sync_time TEXT DEFAULT ''"],
  ["sync_status", "ALTER TABLE company_settings ADD COLUMN sync_status TEXT DEFAULT 'idle'"],
] as const;

function ensureDeveloperSettingsColumns() {
  if (!sqlite) return;

  const table = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_settings'")
    .get();

  if (!table) return;

  const columns = sqlite.prepare("PRAGMA table_info(company_settings)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));

  for (const [column, sql] of developerPermissionColumns) {
    if (!existing.has(column)) sqlite.exec(sql);
  }
}

function toBool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function sanitizeDatabaseError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "Connection failed";

  if (code === "ENOTFOUND") return "Host not found";
  if (code === "ECONNREFUSED") return "Connection refused";
  if (code === "ETIMEDOUT" || code === "ETIMEOUT") return "Connection timed out";
  if (code === "ECONNRESET") return "Connection was reset";
  if (/password authentication failed/i.test(message)) return "Authentication failed";
  if (/database .* does not exist/i.test(message)) return "Database does not exist";
  if (/no pg_hba.conf entry/i.test(message)) return "Access rejected by PostgreSQL host rules";
  if (/self-signed certificate/i.test(message)) return "TLS certificate is not trusted";

  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").slice(0, 180);
}

function isPostgresConnectionString(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

type DiagnosticStatus = "pass" | "warning" | "critical";

type DiagnosticCheck = {
  id: string;
  status: DiagnosticStatus;
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

const STORAGE_CONFIG_FILE = "storage-config.json";
const SYSTEM_SUBFOLDERS = ["database", "attachments", "backups", "license", "logs", "config"] as const;

function nodeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getNodeErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

async function pathExists(targetPath: string) {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function safeStat(targetPath: string) {
  try {
    return await fs.promises.stat(targetPath);
  } catch {
    return null;
  }
}

function maskSensitiveString(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[masked-postgres-connection-string]")
    .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, "Bearer [masked-token]")
    .replace(/(password|token|secret|connectionString|connection_string)=([^;&\s]+)/gi, "$1=[masked]");
}

function sanitizeDiagnosticExportValue(value: unknown): unknown {
  if (typeof value === "string") {
    return maskSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticExportValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/password|secret|token|connection.?string|authorization/i.test(key)) {
      sanitized[key] = "[masked]";
      continue;
    }

    sanitized[key] = sanitizeDiagnosticExportValue(nestedValue);
  }

  return sanitized;
}

async function resolveDiagnosticsStorageContext() {
  const cwd = process.cwd();
  const envDataRoot = process.env.APP_DATA_ROOT?.trim();
  const sqlitePath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : null;
  const configCandidates = [
    envDataRoot ? path.join(path.resolve(envDataRoot), STORAGE_CONFIG_FILE) : null,
    path.join(cwd, STORAGE_CONFIG_FILE),
    envDataRoot ? path.join(path.resolve(envDataRoot), "config", STORAGE_CONFIG_FILE) : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  let storageConfigPath: string | null = null;
  let configuredDataRoot: string | null = null;
  let storageConfigError: string | null = null;

  for (const configPath of configCandidates) {
    if (!(await pathExists(configPath))) continue;

    storageConfigPath = configPath;
    try {
      const parsed = JSON.parse(await fs.promises.readFile(configPath, "utf8")) as { dataRoot?: unknown };
      if (typeof parsed.dataRoot === "string" && parsed.dataRoot.trim()) {
        configuredDataRoot = path.resolve(parsed.dataRoot.trim());
      } else {
        storageConfigError = "storage-config.json does not contain a valid dataRoot string";
      }
    } catch (error) {
      storageConfigError = nodeErrorMessage(error);
    }
    break;
  }

  let dataRootSource: "env" | "config" | "sqlite-path" | "fallback" = "fallback";
  let dataRoot = path.resolve(cwd);

  if (envDataRoot) {
    dataRoot = path.resolve(envDataRoot);
    dataRootSource = "env";
  } else if (configuredDataRoot) {
    dataRoot = configuredDataRoot;
    dataRootSource = "config";
  } else if (sqlitePath && path.basename(path.dirname(sqlitePath)).toLowerCase() === "database") {
    dataRoot = path.dirname(path.dirname(sqlitePath));
    dataRootSource = "sqlite-path";
  }

  return {
    cwd,
    dataRoot,
    dataRootSource,
    sqlitePath: sqlitePath || path.join(dataRoot, "database", "local.db"),
    storageConfigPath,
    configuredDataRoot,
    storageConfigError,
  };
}

async function buildSystemDiagnostics() {
  const checkedAt = new Date().toISOString();
  const checks: DiagnosticCheck[] = [];

  const addCheck = (check: DiagnosticCheck) => {
    checks.push(check);
  };

  const addExceptionCheck = (id: string, area: string, location: string, error: unknown) => {
    addCheck({
      id,
      status: "critical",
      area,
      location,
      messageAr: "تعذر إكمال هذا الفحص.",
      messageEn: "This check could not be completed.",
      causeAr: "حدث خطأ أثناء قراءة حالة النظام.",
      causeEn: "An error occurred while reading system state.",
      suggestedFixAr: "راجع تفاصيل الخطأ ثم أصلح صلاحيات المسار أو إعداداته.",
      suggestedFixEn: "Review the error details, then fix the path permissions or configuration.",
      details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  };

  let context: Awaited<ReturnType<typeof resolveDiagnosticsStorageContext>>;
  try {
    context = await resolveDiagnosticsStorageContext();
  } catch (error) {
    context = {
      cwd: process.cwd(),
      dataRoot: process.cwd(),
      dataRootSource: "fallback",
      sqlitePath: process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : path.join(process.cwd(), "database", "local.db"),
      storageConfigPath: null,
      configuredDataRoot: null,
      storageConfigError: nodeErrorMessage(error),
    };
    addExceptionCheck("storage-context", "storage", process.cwd(), error);
  }

  try {
    const stats = await safeStat(context.dataRoot);
    const isDirectory = Boolean(stats?.isDirectory());
    addCheck({
      id: "data-root-exists",
      status: isDirectory ? "pass" : "critical",
      area: "storage",
      location: context.dataRoot,
      messageAr: isDirectory ? "مسار البيانات موجود." : "مسار البيانات غير موجود.",
      messageEn: isDirectory ? "Data Root exists." : "Data Root does not exist.",
      causeAr: isDirectory ? "تم العثور على مجلد البيانات." : "لم يتم العثور على مجلد البيانات في المسار المتوقع.",
      causeEn: isDirectory ? "The data folder was found." : "The data folder was not found at the expected path.",
      suggestedFixAr: isDirectory ? "لا يلزم إجراء." : "تحقق من إعدادات مسار البيانات أو أعد اختيار مجلد بيانات صحيح من أدوات التخزين.",
      suggestedFixEn: isDirectory ? "No action required." : "Check Data Root configuration or choose a valid data folder from storage tools.",
      details: { source: context.dataRootSource },
    });
  } catch (error) {
    addExceptionCheck("data-root-exists", "storage", context.dataRoot, error);
  }

  try {
    const stats = await safeStat(context.sqlitePath);
    const exists = Boolean(stats?.isFile());
    addCheck({
      id: "database-file-exists",
      status: exists ? "pass" : "critical",
      area: "database",
      location: context.sqlitePath,
      messageAr: exists ? "ملف قاعدة البيانات local.db موجود." : "ملف قاعدة البيانات local.db غير موجود.",
      messageEn: exists ? "The local.db database file exists." : "The local.db database file is missing.",
      causeAr: exists ? "تم العثور على ملف قاعدة البيانات." : "لا يوجد ملف قاعدة بيانات في المسار المستخدم حاليًا.",
      causeEn: exists ? "The database file was found." : "No database file was found at the current database path.",
      suggestedFixAr: exists ? "لا يلزم إجراء." : "تحقق من SQLITE_DB_PATH أو مسار Data Root قبل تشغيل أي عمليات.",
      suggestedFixEn: exists ? "No action required." : "Check SQLITE_DB_PATH or the Data Root path before running operations.",
      details: { sizeBytes: stats?.size ?? null, sqlitePathFromEnv: Boolean(process.env.SQLITE_DB_PATH) },
    });
  } catch (error) {
    addExceptionCheck("database-file-exists", "database", context.sqlitePath, error);
  }

  try {
    await fs.promises.access(context.sqlitePath, fs.constants.R_OK);
    if (sqlite) {
      sqlite.prepare("SELECT 1 AS ok").get();
    }
    addCheck({
      id: "database-readable",
      status: sqlite ? "pass" : "warning",
      area: "database",
      location: context.sqlitePath,
      messageAr: sqlite ? "قاعدة البيانات قابلة للقراءة." : "ملف قاعدة البيانات قابل للقراءة لكن اتصال SQLite غير متاح.",
      messageEn: sqlite ? "The database is readable." : "The database file is readable, but the SQLite connection is unavailable.",
      causeAr: sqlite ? "نجح اختبار القراءة." : "تمت قراءة الملف، لكن الخادم لا يملك اتصال SQLite نشطًا.",
      causeEn: sqlite ? "The read test succeeded." : "The file can be read, but the server has no active SQLite connection.",
      suggestedFixAr: sqlite ? "لا يلزم إجراء." : "تحقق من DB_PROVIDER و SQLITE_DB_PATH عند تشغيل الخادم.",
      suggestedFixEn: sqlite ? "No action required." : "Check DB_PROVIDER and SQLITE_DB_PATH when starting the server.",
      details: { sqliteConnection: Boolean(sqlite) },
    });
  } catch (error) {
    addCheck({
      id: "database-readable",
      status: "critical",
      area: "database",
      location: context.sqlitePath,
      messageAr: "قاعدة البيانات غير قابلة للقراءة.",
      messageEn: "The database is not readable.",
      causeAr: "فشل اختبار قراءة ملف قاعدة البيانات أو استعلام SELECT 1.",
      causeEn: "The database file read test or SELECT 1 query failed.",
      suggestedFixAr: "تحقق من وجود الملف وصلاحيات القراءة وأن الملف ليس تالفًا.",
      suggestedFixEn: "Check that the file exists, read permissions are available, and the database is not corrupted.",
      details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  }

  try {
    const integrityDb = new BetterSqliteDatabase(context.sqlitePath, { readonly: true, fileMustExist: true });
    try {
      const rows = integrityDb.prepare("PRAGMA integrity_check;").all();
      const results = rows.map((row) => String(Object.values(row)[0] ?? ""));
      const passed = results.length === 1 && results[0].toLowerCase() === "ok";

      addCheck({
        id: "sqlite-integrity-check",
        status: passed ? "pass" : "critical",
        area: "database",
        location: context.sqlitePath,
        messageAr: passed ? "قاعدة البيانات سليمة." : "توجد مشكلة في سلامة قاعدة البيانات.",
        messageEn: passed ? "Database integrity check passed." : "Database integrity check failed.",
        causeAr: passed ? "فحص SQLite integrity_check أعاد ok." : "فحص SQLite أعاد أخطاء.",
        causeEn: passed ? "SQLite integrity_check returned ok." : "SQLite integrity_check returned errors.",
        suggestedFixAr: passed
          ? "لا يلزم إجراء."
          : "أنشئ نسخة احتياطية فورًا ثم راجع قاعدة البيانات أو استرجع آخر نسخة سليمة.",
        suggestedFixEn: passed
          ? "No action required."
          : "Create an emergency backup immediately, then inspect the database or restore the latest valid backup.",
        details: passed ? { result: "ok" } : { errorCount: results.length },
      });
    } finally {
      integrityDb.close();
    }
  } catch (error) {
    addCheck({
      id: "sqlite-integrity-check",
      status: "critical",
      area: "database",
      location: context.sqlitePath,
      messageAr: "توجد مشكلة في سلامة قاعدة البيانات.",
      messageEn: "Database integrity check failed.",
      causeAr: "تعذر تشغيل فحص SQLite integrity_check.",
      causeEn: "SQLite integrity_check could not be executed.",
      suggestedFixAr: "تحقق من وجود ملف قاعدة البيانات وصلاحيات القراءة، ثم أعد تشغيل الفحص.",
      suggestedFixEn: "Check that the database file exists and is readable, then run diagnostics again.",
      details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  }

  for (const folderName of SYSTEM_SUBFOLDERS) {
    const folderPath = path.join(context.dataRoot, folderName);
    try {
      const stats = await safeStat(folderPath);
      const exists = Boolean(stats?.isDirectory());
      addCheck({
        id: `system-folder-${folderName}`,
        status: exists ? "pass" : "warning",
        area: "storage",
        location: folderPath,
        messageAr: exists ? `مجلد ${folderName} موجود.` : `مجلد ${folderName} غير موجود.`,
        messageEn: exists ? `The ${folderName} folder exists.` : `The ${folderName} folder is missing.`,
        causeAr: exists ? "تم العثور على المجلد." : "لم يتم العثور على المجلد ضمن Data Root.",
        causeEn: exists ? "The folder was found." : "The folder was not found under Data Root.",
        suggestedFixAr: exists ? "لا يلزم إجراء." : "اترك الإصلاح لخطوة repair لاحقة أو تحقق من إعدادات التخزين يدويًا.",
        suggestedFixEn: exists ? "No action required." : "Leave repair to a later repair action or check storage settings manually.",
      });
    } catch (error) {
      addExceptionCheck(`system-folder-${folderName}`, "storage", folderPath, error);
    }
  }

  try {
    const tempPath = path.join(context.dataRoot, `.customs-ledger-diagnostics-${process.pid}-${Date.now()}.tmp`);
    await fs.promises.writeFile(tempPath, "diagnostics", { encoding: "utf8", flag: "wx" });
    await fs.promises.rm(tempPath, { force: true });
    addCheck({
      id: "data-root-write-test",
      status: "pass",
      area: "storage",
      location: context.dataRoot,
      messageAr: "اختبار الكتابة داخل Data Root نجح.",
      messageEn: "Data Root write test passed.",
      causeAr: "تم إنشاء ملف مؤقت صغير وحذفه فورًا.",
      causeEn: "A small temporary file was created and deleted immediately.",
      suggestedFixAr: "لا يلزم إجراء.",
      suggestedFixEn: "No action required.",
    });
  } catch (error) {
    addCheck({
      id: "data-root-write-test",
      status: "critical",
      area: "storage",
      location: context.dataRoot,
      messageAr: "اختبار الكتابة داخل Data Root فشل.",
      messageEn: "Data Root write test failed.",
      causeAr: "لا يستطيع الخادم إنشاء ملف مؤقت داخل مسار البيانات.",
      causeEn: "The server cannot create a temporary file inside Data Root.",
      suggestedFixAr: "تحقق من صلاحيات الكتابة أو اختر مسار بيانات قابلًا للكتابة.",
      suggestedFixEn: "Check write permissions or choose a writable Data Root.",
      details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  }

  for (const folderName of ["attachments", "backups"] as const) {
    const folderPath = path.join(context.dataRoot, folderName);
    try {
      const stats = await safeStat(folderPath);
      if (!stats?.isDirectory()) {
        addCheck({
          id: `${folderName}-folder-health`,
          status: "warning",
          area: folderName,
          location: folderPath,
          messageAr: `تعذر فحص مجلد ${folderName} لأنه غير موجود.`,
          messageEn: `The ${folderName} folder cannot be inspected because it is missing.`,
          causeAr: "المجلد غير موجود ضمن Data Root.",
          causeEn: "The folder is missing under Data Root.",
          suggestedFixAr: "تحقق من إعدادات التخزين ولا تنشئ مجلدات يدويًا إلا ضمن إجراء إصلاح واضح.",
          suggestedFixEn: "Check storage settings and avoid manually creating folders except through a clear repair action.",
        });
        continue;
      }

      await fs.promises.access(folderPath, fs.constants.R_OK);
      const sample = await fs.promises.readdir(folderPath);
      addCheck({
        id: `${folderName}-folder-health`,
        status: "pass",
        area: folderName,
        location: folderPath,
        messageAr: `مجلد ${folderName} موجود وقابل للقراءة.`,
        messageEn: `The ${folderName} folder exists and is readable.`,
        causeAr: "نجح فحص الوصول للمجلد.",
        causeEn: "Folder access check succeeded.",
        suggestedFixAr: "لا يلزم إجراء.",
        suggestedFixEn: "No action required.",
        details: { sampleCount: sample.length },
      });
    } catch (error) {
      addExceptionCheck(`${folderName}-folder-health`, folderName, folderPath, error);
    }
  }

  try {
    const backupsPath = path.join(context.dataRoot, "backups");
    const backupsStats = await safeStat(backupsPath);

    if (!backupsStats?.isDirectory()) {
      addCheck({
        id: "last-backup-health",
        status: "warning",
        area: "backups",
        location: backupsPath,
        messageAr: "لا توجد نسخة احتياطية محفوظة.",
        messageEn: "No backup was found.",
        causeAr: "مجلد النسخ الاحتياطية غير موجود أو غير قابل للفحص.",
        causeEn: "The backups folder does not exist or cannot be inspected.",
        suggestedFixAr: "أنشئ نسخة احتياطية من صفحة المطور.",
        suggestedFixEn: "Create a backup from Developer Tools.",
        details: { backupsPath },
      });
    } else {
      const backupEntries = await fs.promises.readdir(backupsPath, { withFileTypes: true });
      const candidates = await Promise.all(
        backupEntries.map(async (entry) => {
          const entryPath = path.join(backupsPath, entry.name);
          const stats = await safeStat(entryPath);
          const manifestPath = entry.isDirectory()
            ? path.join(entryPath, "manifest.json")
            : entry.name.toLowerCase() === "manifest.json"
              ? entryPath
              : null;
          const manifestStats = manifestPath ? await safeStat(manifestPath) : null;

          return {
            backupPath: entry.isDirectory() ? entryPath : path.dirname(entryPath),
            entryPath,
            hasManifest: Boolean(manifestStats?.isFile()),
            isBackupLike: entry.isDirectory() || /^backup[-_]/i.test(entry.name) || Boolean(manifestStats?.isFile()),
            manifestPath,
            updatedAtMs: Math.max(stats?.mtimeMs || 0, manifestStats?.mtimeMs || 0),
          };
        }),
      );
      const backupCandidates = candidates
        .filter((candidate) => candidate.isBackupLike)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      const latestBackup = backupCandidates[0] || null;

      if (!latestBackup) {
        addCheck({
          id: "last-backup-health",
          status: "warning",
          area: "backups",
          location: backupsPath,
          messageAr: "لا توجد نسخة احتياطية محفوظة.",
          messageEn: "No backup was found.",
          causeAr: "لم يتم العثور على ملف أو مجلد نسخة احتياطية داخل مجلد backups.",
          causeEn: "No backup file or folder was found inside the backups folder.",
          suggestedFixAr: "أنشئ نسخة احتياطية من صفحة المطور.",
          suggestedFixEn: "Create a backup from Developer Tools.",
          details: { backupsPath, entries: backupEntries.length },
        });
      } else if (!latestBackup.hasManifest || !latestBackup.manifestPath) {
        addCheck({
          id: "last-backup-health",
          status: "warning",
          area: "backups",
          location: latestBackup.backupPath,
          messageAr: "توجد نسخة احتياطية لكن ملف manifest غير صالح.",
          messageEn: "A backup was found but its manifest is missing or invalid.",
          causeAr: "لم يتم العثور على manifest.json داخل أحدث نسخة احتياطية.",
          causeEn: "manifest.json was not found in the latest backup.",
          suggestedFixAr: "أنشئ نسخة احتياطية جديدة.",
          suggestedFixEn: "Create a new backup.",
          details: { backupPath: latestBackup.backupPath, manifestFound: false },
        });
      } else {
        try {
          const manifest = JSON.parse(await fs.promises.readFile(latestBackup.manifestPath, "utf8")) as {
            createdAt?: unknown;
            manifestVersion?: unknown;
            formatVersion?: unknown;
            backup?: { formatVersion?: unknown };
          };
          const createdAt = typeof manifest.createdAt === "string" ? manifest.createdAt : null;
          const manifestVersion =
            manifest.manifestVersion ?? manifest.backup?.formatVersion ?? manifest.formatVersion ?? undefined;
          const details: Record<string, unknown> = {
            backupPath: latestBackup.backupPath,
            createdAt: createdAt || new Date(latestBackup.updatedAtMs).toISOString(),
          };

          if (manifestVersion !== undefined) {
            details.manifestVersion = manifestVersion;
          }

          addCheck({
            id: "last-backup-health",
            status: "pass",
            area: "backups",
            location: latestBackup.backupPath,
            messageAr: "تم العثور على نسخة احتياطية صالحة.",
            messageEn: "A valid backup was found.",
            causeAr: "تمت قراءة manifest.json بنجاح.",
            causeEn: "manifest.json was read successfully.",
            suggestedFixAr: "لا يلزم إجراء.",
            suggestedFixEn: "No action required.",
            details,
          });
        } catch (error) {
          addCheck({
            id: "last-backup-health",
            status: "warning",
            area: "backups",
            location: latestBackup.backupPath,
            messageAr: "توجد نسخة احتياطية لكن ملف manifest غير صالح.",
            messageEn: "A backup was found but its manifest is missing or invalid.",
            causeAr: "تعذرت قراءة manifest.json أو تحليله.",
            causeEn: "manifest.json could not be read or parsed.",
            suggestedFixAr: "أنشئ نسخة احتياطية جديدة.",
            suggestedFixEn: "Create a new backup.",
            details: { backupPath: latestBackup.backupPath, error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
          });
        }
      }
    }
  } catch (error) {
    addCheck({
      id: "last-backup-health",
      status: "warning",
      area: "backups",
      location: path.join(context.dataRoot, "backups"),
      messageAr: "تعذر فحص آخر نسخة احتياطية.",
      messageEn: "Last backup health could not be checked.",
      causeAr: "حدث خطأ أثناء قراءة مجلد النسخ الاحتياطية.",
      causeEn: "An error occurred while reading the backups folder.",
      suggestedFixAr: "تحقق من صلاحيات قراءة مجلد النسخ الاحتياطية ثم أعد تشغيل الفحص.",
      suggestedFixEn: "Check read permissions for the backups folder, then run diagnostics again.",
      details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  }

  try {
    const hasConfig = Boolean(context.storageConfigPath && !context.storageConfigError);
    addCheck({
      id: "storage-config",
      status: hasConfig || context.dataRootSource !== "fallback" ? "pass" : "warning",
      area: "storage",
      location: context.storageConfigPath || context.cwd,
      messageAr: hasConfig ? "ملف storage-config.json موجود وقابل للقراءة." : "لا يوجد storage-config.json صالح؛ النظام يستخدم fallback أو إعدادات بيئية.",
      messageEn: hasConfig ? "storage-config.json exists and is readable." : "No valid storage-config.json was found; the system is using fallback or environment settings.",
      causeAr: hasConfig ? "تمت قراءة إعداد مسار البيانات." : "لم يتم العثور على إعداد تخزين صريح صالح.",
      causeEn: hasConfig ? "The data root configuration was read." : "No valid explicit storage configuration was found.",
      suggestedFixAr: hasConfig ? "لا يلزم إجراء." : "إذا كان هذا غير مقصود، احفظ مسار بيانات واضحًا من أدوات التخزين.",
      suggestedFixEn: hasConfig ? "No action required." : "If this is unintended, save an explicit Data Root from the storage tools.",
      details: {
        dataRootSource: context.dataRootSource,
        configuredDataRoot: context.configuredDataRoot,
        storageConfigError: context.storageConfigError,
      },
    });
  } catch (error) {
    addExceptionCheck("storage-config", "storage", context.cwd, error);
  }

  try {
    if (!sqlite) {
      addCheck({
        id: "sync-queue-status",
        status: "warning",
        area: "sync",
        location: "sync_queue",
        messageAr: "تعذر فحص sync_queue لأن اتصال SQLite غير متاح.",
        messageEn: "sync_queue could not be checked because SQLite is unavailable.",
        causeAr: "الخادم لا يملك اتصال SQLite نشطًا.",
        causeEn: "The server has no active SQLite connection.",
        suggestedFixAr: "تحقق من إعدادات تشغيل قاعدة البيانات.",
        suggestedFixEn: "Check database startup settings.",
      });
    } else {
      const table = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_queue'").get();

      if (!table) {
        addCheck({
          id: "sync-queue-status",
          status: "warning",
          area: "sync",
          location: "sync_queue",
          messageAr: "جدول sync_queue غير موجود.",
          messageEn: "The sync_queue table does not exist.",
          causeAr: "قد لا تكون المزامنة مفعلة أو لم يتم إنشاء جدولها بعد.",
          causeEn: "Sync may not be enabled or its table has not been created yet.",
          suggestedFixAr: "لا تنشئ الجدول من هذا الفحص؛ اترك ذلك لمنطق المزامنة الحالي عند الحاجة.",
          suggestedFixEn: "Do not create the table from this check; let the existing sync logic create it when needed.",
        });
      } else {
        const pending = sqlite.prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'pending'").get() as { count: number };
        const failed = sqlite.prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'failed'").get() as { count: number };
        const lastError = sqlite
          .prepare(`
            SELECT last_error AS value
            FROM sync_queue
            WHERE status = 'failed' AND last_error IS NOT NULL AND last_error <> ''
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT 1
          `)
          .get() as { value: string | null } | undefined;
        const failedCount = Number(failed?.count || 0);
        const pendingCount = Number(pending?.count || 0);

        addCheck({
          id: "sync-queue-status",
          status: failedCount > 0 ? "warning" : "pass",
          area: "sync",
          location: "sync_queue",
          messageAr: failedCount > 0 ? "توجد عناصر مزامنة فاشلة." : "جدول sync_queue قابل للقراءة.",
          messageEn: failedCount > 0 ? "There are failed sync queue items." : "The sync_queue table is readable.",
          causeAr: failedCount > 0 ? "بعض عناصر المزامنة انتهت بحالة failed." : "نجح فحص جدول المزامنة.",
          causeEn: failedCount > 0 ? "Some sync items are in failed status." : "The sync table check succeeded.",
          suggestedFixAr: failedCount > 0 ? "راجع آخر خطأ ثم استخدم أدوات المزامنة الحالية لإعادة المحاولة عند الحاجة." : "لا يلزم إجراء.",
          suggestedFixEn: failedCount > 0 ? "Review the last error, then use the existing sync tools to retry if needed." : "No action required.",
          details: {
            pending: pendingCount,
            failed: failedCount,
            lastError: lastError?.value || null,
          },
        });
      }
    }
  } catch (error) {
    addExceptionCheck("sync-queue-status", "sync", "sync_queue", error);
  }

  const summary = checks.reduce(
    (acc, check) => {
      if (check.status === "critical") acc.critical += 1;
      if (check.status === "warning") acc.warnings += 1;
      if (check.status === "pass") acc.passed += 1;
      return acc;
    },
    { critical: 0, warnings: 0, passed: 0 },
  );

  return {
    ok: summary.critical === 0,
    checkedAt,
    summary,
    checks,
  };
}

function mapDeveloperPermissions(settings: any) {
  const sqlitePath = process.env.SQLITE_DB_PATH || "";
  const databaseSize = sqlitePath && fs.existsSync(sqlitePath) ? fs.statSync(sqlitePath).size : null;
  const hardwareId =
    settings?.hardwareId ||
    crypto.createHash("sha256").update(`${os.hostname()}-${os.userInfo().username}`).digest("hex").slice(0, 16);
  return {
    lockCompanyIdentity: toBool(settings?.lockCompanyIdentity),
    lockCompanyName: toBool(settings?.lockCompanyName),
    lockLogo: toBool(settings?.lockLogo),
    lockStamp: toBool(settings?.lockStamp),
    lockLegalInfo: toBool(settings?.lockLegalInfo),
    lockFooterBranding: toBool(settings?.lockFooterBranding),
    loginFooterText: settings?.loginFooterText || "",
    loginMessageText: settings?.loginMessageText || "",
    loginMessageType: settings?.loginMessageType || "welcome",
    preventRebrandToAnotherCompany: toBool(settings?.preventRebrandToAnotherCompany),
    licenseStatus: settings?.licenseStatus || "not_configured",
    licensedCompanyName: settings?.licensedCompanyName || "",
    licenseId: settings?.licenseId || "",
    hardwareId,
    issuedAt: settings?.issuedAt || "",
    expiresAt: settings?.expiresAt || "",
    allowManagerEditAccountantSignature: toBool(settings?.allowManagerEditAccountantSignature),
    allowManagerEditLegalInfo: toBool(settings?.allowManagerEditLegalInfo),
    allowManagerEditInvoicesBackupImport: toBool(settings?.allowManagerEditInvoicesBackupImport),
    allowManagerEditAppearance: toBool(settings?.allowManagerEditAppearance),
    allowManagerEditPrintSettings: toBool(settings?.allowManagerEditPrintSettings),
    allowManagerViewPreview: toBool(settings?.allowManagerViewPreview),
    allowManagerViewUpdate: toBool(settings?.allowManagerViewUpdate),
    allowManagerEditBranding: toBool(settings?.allowManagerEditBranding),
    allowManagerEditRegistrationSettings: toBool(settings?.allowManagerEditRegistrationSettings),
    allowManagerEditSensitiveUsers: toBool(settings?.allowManagerEditSensitiveUsers),
    databaseProvider: settings?.databaseProvider || "sqlite",
    databaseMode: settings?.databaseMode || "local",
    databaseUseConnectionString: toBool(settings?.databaseUseConnectionString),
    databaseConnectionString: settings?.databaseConnectionString || "",
    databaseHost: settings?.databaseHost || "",
    databasePort: settings?.databasePort || "5432",
    databaseName: settings?.databaseName || "",
    databaseUsername: settings?.databaseUsername || "",
    databasePassword: settings?.databasePassword || "",
    syncMode: settings?.syncMode || "local-to-online",
    syncAutoSync: toBool(settings?.syncAutoSync),
    syncTiming: settings?.syncTiming || "startup",
    syncIntervalMinutes: Number(settings?.syncIntervalMinutes || 30),
    syncLastSyncTime: settings?.syncLastSyncTime || "",
    syncStatus: settings?.syncStatus || "idle",
    sqlitePath: sqlitePath || null,
    databaseStatus: sqlite ? "connected" : "unavailable",
    databaseSize,
    lastBackupAt: null,
    appVersion: `v${packageJson.version}`,
    frontendPath: path.resolve(process.cwd(), "customs-accounting"),
    backendPath: process.cwd(),
    apiStatus: "online",
    envFileStatus: fs.existsSync(path.resolve(process.cwd(), "api-server/.env")) ? "present" : "not_found",
    resourcesStatus: fs.existsSync(path.resolve(process.cwd(), "release")) ? "present" : "not_available",
    buildMode: process.env.NODE_ENV || "development",
    isPackaged: process.env.NODE_ENV === "production",
    installPath: process.cwd(),
  };
}

async function getSettingsRow() {
  ensureDeveloperSettingsColumns();

  let [settings] = await db.select().from(companySettingsTable).limit(1);

  if (!settings) {
    [settings] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
  }

  return settings;
}

ensureDeveloperSettingsColumns();
ensureSyncQueueTable();

router.post("/developer/unlock", (req, res) => {
  const expectedPassword = process.env.DEVELOPER_PASSWORD;
  const password = String(req.body?.password ?? "");

  console.log("[DEV_UNLOCK]", {
    hasExpectedPassword: Boolean(expectedPassword),
    expectedLength: expectedPassword?.length ?? 0,
    receivedLength: password.length,
  });

  if (!expectedPassword || password !== expectedPassword) {
    return res.status(401).json({ ok: false, error: "invalid_developer_password" });
  }

  return res.json({ ok: true });
});

router.use("/developer", requireDeveloperAccess);

router.get("/developer/storage/info", async (_req, res) => {
  try {
    const storageInfo = await getStorageInfo({
      getPath() {
        return process.env.APP_DATA_ROOT || process.cwd();
      },
    });

    res.json(storageInfo);
  } catch (error) {
    console.error("[STORAGE_INFO] Failed to resolve storage info", error);

      res.status(500).json({
        message: "Failed to load storage info",
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

router.get("/developer/system-diagnostics", async (_req, res) => {
  try {
    return res.json(await buildSystemDiagnostics());
  } catch (error) {
    console.error("[SYSTEM_DIAGNOSTICS] Unexpected failure", error);

    const checkedAt = new Date().toISOString();
    return res.json({
      ok: false,
      checkedAt,
      summary: { critical: 1, warnings: 0, passed: 0 },
      checks: [
        {
          id: "system-diagnostics-unexpected-error",
          status: "critical",
          area: "diagnostics",
          location: "api-server",
          messageAr: "فشل فحص صحة النظام بشكل غير متوقع.",
          messageEn: "System diagnostics failed unexpectedly.",
          causeAr: "حدث خطأ عام خارج الفحوصات الجزئية.",
          causeEn: "A top-level error occurred outside the individual checks.",
          suggestedFixAr: "راجع سجل الخادم ثم أعد تشغيل الفحص.",
          suggestedFixEn: "Review the server log, then run diagnostics again.",
          details: { error: nodeErrorMessage(error), code: getNodeErrorCode(error) },
        },
      ],
    });
  }
});

router.get("/developer/system-diagnostics/export", async (_req, res) => {
  try {
    const [diagnostics, context] = await Promise.all([
      buildSystemDiagnostics(),
      resolveDiagnosticsStorageContext().catch(() => null),
    ]);
    const generatedAt = new Date().toISOString();
    const report = sanitizeDiagnosticExportValue({
      generatedAt,
      appName: "Customs Ledger SQLite",
      appVersion: `v${packageJson.version}`,
      dataRoot: context?.dataRoot || null,
      diagnostics,
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=customs-ledger-diagnostics.json");
    return res.send(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error("[SYSTEM_DIAGNOSTICS_EXPORT] Failed to generate report", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to export diagnostic report",
      details: { message: nodeErrorMessage(error), code: getNodeErrorCode(error) },
    });
  }
});

router.get("/developer/settings", async (_req, res) => {
  try {
    const settings = await getSettingsRow();
    return res.json(mapDeveloperPermissions(settings));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch developer settings" });
  }
});

router.get("/developer/database/check", (_req, res) => {
  return res.json({
    databaseStatus: sqlite ? "connected" : "unavailable",
    sqlitePath: process.env.SQLITE_DB_PATH || null,
  });
});

router.get("/developer/database/sql", (_req, res) => {
  try {
    if (!sqlite) return res.status(503).json({ error: "SQLite database is unavailable" });
    const dump = sqlite.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name").all() as Array<{ sql: string }>;
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=database-schema.sql");
    return res.send(dump.map((row) => `${row.sql};`).join("\n\n"));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create SQL file" });
  }
});

router.get("/developer/sync-queue/status", (_req, res) => {
  try {
    ensureSyncQueueTable();

    if (!sqlite) {
      return res.json({ pending: 0, synced: 0, failed: 0, lastSync: null, lastError: null, recent: [] });
    }

    const table = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_queue'")
      .get();

    if (!table) {
      return res.json({ pending: 0, synced: 0, failed: 0, lastSync: null, lastError: null, recent: [] });
    }

    const pending = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'pending'")
      .get() as { count: number };
    const failed = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'failed'")
      .get() as { count: number };
    const synced = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status IN ('success', 'synced', 'done')")
      .get() as { count: number };
    const lastSync = sqlite
      .prepare("SELECT MAX(COALESCE(updated_at, created_at)) AS value FROM sync_queue WHERE status IN ('success', 'synced', 'done')")
      .get() as { value: number | null };
    const lastError = sqlite
      .prepare(`
        SELECT last_error AS value
        FROM sync_queue
        WHERE status = 'failed' AND last_error IS NOT NULL AND last_error <> ''
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 1
      `)
      .get() as { value: string | null } | undefined;
    const recent = sqlite
      .prepare(`
        SELECT
          id,
          entity_type AS entityType,
          entity_id AS entityId,
          operation,
          status,
          retry_count AS attempts,
          last_error AS lastError,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM sync_queue
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .all() as Array<{
        id: number;
        entityType: string;
        entityId: string;
        operation: string;
        status: string;
        attempts: number;
        lastError: string | null;
        createdAt: number | null;
        updatedAt: number | null;
      }>;

    return res.json({
      pending: Number(pending?.count || 0),
      synced: Number(synced?.count || 0),
      failed: Number(failed?.count || 0),
      lastSync: lastSync?.value ? new Date(Number(lastSync.value)).toISOString() : null,
      lastError: lastError?.value || null,
      recent: recent.map((item) => ({
        ...item,
        attempts: Number(item.attempts || 0),
        createdAt: item.createdAt ? new Date(Number(item.createdAt)).toISOString() : null,
        updatedAt: item.updatedAt ? new Date(Number(item.updatedAt)).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to read sync queue status" });
  }
});

router.post("/developer/sync-queue/retry-failed", (_req, res) => {
  try {
    ensureSyncQueueTable();

    if (!sqlite) {
      return res.status(503).json({ ok: false, error: "SQLite database is unavailable" });
    }

    const result = sqlite
      .prepare(`
        UPDATE sync_queue
        SET status = 'pending',
            retry_count = 0,
            last_error = NULL,
            updated_at = ?
        WHERE status = 'failed'
      `)
      .run(Date.now()) as { changes?: number };

    return res.json({
      ok: true,
      retriedCount: Number(result.changes || 0),
      message: "Failed sync queue items were reset to pending.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Failed to reset failed sync queue items" });
  }
});

router.post("/developer/sync/run-once", async (_req, res) => {
  const result = await runSyncWorkerOnce();

  return res.json({
    ok: true,
    pendingCount: result.pendingCount,
    processedCount: result.processedCount,
    onlineConnected: result.onlineConnected,
    lastError: result.lastError,
    autoRestoredCount: result.autoRestoredCount,
    message: result.onlineConnected
      ? "Online: Connected. Sync worker completed."
      : `Online: Disconnected${result.lastError ? ` - ${result.lastError}` : ""}`,
  });
});

router.post("/developer/sync/check-connection", async (_req, res) => {
  const settings = await getSettingsRow();
  const connectionString = String((settings as any)?.databaseConnectionString || "").trim();

  console.log("[SYNC][CHECK_CONNECTION]", { hasConnectionString: Boolean(connectionString) });

  if (!connectionString) {
    return res.json({
      ok: true,
      onlineConnected: false,
      message: "Online: Disconnected - connection string is not configured",
    });
  }

  if (!isPostgresConnectionString(connectionString)) {
    return res.json({
      ok: true,
      onlineConnected: false,
      message: "Online: Disconnected - only PostgreSQL connection strings are supported",
    });
  }

  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });

  try {
    await client.connect();
    await client.query("select 1");
    console.log("[SYNC][CHECK_CONNECTION] Online: Connected");
    return res.json({ ok: true, onlineConnected: true, message: "Online: Connected" });
  } catch (err) {
    const error = sanitizeDatabaseError(err);
    console.warn("[SYNC][CHECK_CONNECTION] Online: Disconnected", error);
    return res.json({
      ok: true,
      onlineConnected: false,
      lastError: error,
      message: `Online: Disconnected - ${error}`,
    });
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore close errors; this endpoint only warms up/checks the online connection.
    }
  }
});

router.post("/developer/database/test-online", async (req, res) => {
  const connectionString = String(req.body?.connectionString || "").trim();

  if (!connectionString) {
    return res.status(400).json({ success: false, error: "Connection string is required" });
  }

  if (!isPostgresConnectionString(connectionString)) {
    return res.status(400).json({ success: false, error: "Only PostgreSQL connection strings are supported" });
  }

  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });

  try {
    await client.connect();
    await client.query("select 1");
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: sanitizeDatabaseError(err) });
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore close errors; this endpoint only reports the connection test result.
    }
  }
});

router.put("/developer/settings", async (req, res) => {
  try {
    const settings = await getSettingsRow();
    const body = req.body ?? {};

    const [updated] = await db
      .update(companySettingsTable)
      .set({
        lockCompanyIdentity: !!body.lockCompanyIdentity,
        lockCompanyName: !!body.lockCompanyName,
        lockLogo: !!body.lockLogo,
        lockStamp: !!body.lockStamp,
        lockLegalInfo: !!body.lockLegalInfo,
        lockFooterBranding: !!body.lockFooterBranding,
        loginFooterText: String(body.loginFooterText || ""),
        loginMessageText: String(body.loginMessageText || ""),
        loginMessageType: String(body.loginMessageType || "welcome"),
        preventRebrandToAnotherCompany: !!body.preventRebrandToAnotherCompany,
        licenseStatus: String(body.licenseStatus || ""),
        licensedCompanyName: String(body.licensedCompanyName || ""),
        licenseId: String(body.licenseId || ""),
        hardwareId: String(body.hardwareId || ""),
        issuedAt: String(body.issuedAt || ""),
        expiresAt: String(body.expiresAt || ""),
        allowManagerEditAccountantSignature: !!body.allowManagerEditAccountantSignature,
        allowManagerEditLegalInfo: !!body.allowManagerEditLegalInfo,
        allowManagerEditInvoicesBackupImport: !!body.allowManagerEditInvoicesBackupImport,
        allowManagerEditAppearance: !!body.allowManagerEditAppearance,
        allowManagerEditPrintSettings: !!body.allowManagerEditPrintSettings,
        allowManagerViewPreview: !!body.allowManagerViewPreview,
        allowManagerViewUpdate: !!body.allowManagerViewUpdate,
        allowManagerEditBranding: !!body.allowManagerEditBranding,
        allowManagerEditRegistrationSettings: !!body.allowManagerEditRegistrationSettings,
        allowManagerEditSensitiveUsers: !!body.allowManagerEditSensitiveUsers,
        databaseProvider: String(body.databaseProvider || "sqlite"),
        databaseMode: String(body.databaseMode || "local"),
        databaseUseConnectionString: !!body.databaseUseConnectionString,
        databaseConnectionString: String(body.databaseConnectionString || ""),
        databaseHost: String(body.databaseHost || ""),
        databasePort: String(body.databasePort || "5432"),
        databaseName: String(body.databaseName || ""),
        databaseUsername: String(body.databaseUsername || ""),
        databasePassword: String(body.databasePassword || ""),
        syncMode: String(body.syncMode || "local-to-online"),
        syncAutoSync: !!body.syncAutoSync,
        syncTiming: String(body.syncTiming || "startup"),
        syncIntervalMinutes: Number(body.syncIntervalMinutes || 30),
        syncLastSyncTime: String(body.syncLastSyncTime || ""),
        syncStatus: String(body.syncStatus || "idle"),
        updatedAt: new Date(),
      } as any)
      .where(eq(companySettingsTable.id, Number(settings.id)))
      .returning();

    return res.json(mapDeveloperPermissions(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update developer settings" });
  }
});

export default router;
