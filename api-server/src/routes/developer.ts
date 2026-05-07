import { Router } from "express";
import { db, sqlite, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import packageJson from "../../../package.json";
import { requireAdmin } from "../middleware/auth";

const router = Router();
const require = createRequire(path.join(process.cwd(), "package.json"));
const { Client: PgClient } = require("pg") as {
  Client: new (config: { connectionString: string; connectionTimeoutMillis?: number; query_timeout?: number }) => {
    connect: () => Promise<void>;
    query: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
};

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
  ["prevent_rebrand_to_another_company", "ALTER TABLE company_settings ADD COLUMN prevent_rebrand_to_another_company INTEGER DEFAULT 0"],
  ["license_status", "ALTER TABLE company_settings ADD COLUMN license_status TEXT DEFAULT 'not_configured'"],
  ["licensed_company_name", "ALTER TABLE company_settings ADD COLUMN licensed_company_name TEXT DEFAULT ''"],
  ["license_id", "ALTER TABLE company_settings ADD COLUMN license_id TEXT DEFAULT ''"],
  ["hardware_id", "ALTER TABLE company_settings ADD COLUMN hardware_id TEXT DEFAULT ''"],
  ["issued_at", "ALTER TABLE company_settings ADD COLUMN issued_at TEXT DEFAULT ''"],
  ["expires_at", "ALTER TABLE company_settings ADD COLUMN expires_at TEXT DEFAULT ''"],
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

router.use("/developer", requireAdmin);

router.post("/developer/unlock", (req, res) => {
  const expectedPassword = process.env.DEVELOPER_PASSWORD;
  const password = String(req.body?.password ?? "");

  if (!expectedPassword) {
    return res.status(503).json({ error: "Developer password is not configured" });
  }

  if (password !== expectedPassword) {
    return res.status(401).json({ error: "Invalid developer password" });
  }

  return res.json({ success: true });
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
    if (!sqlite) {
      return res.json({ pending: 0, failed: 0, lastSync: null, recent: [] });
    }

    const table = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_queue'")
      .get();

    if (!table) {
      return res.json({ pending: 0, failed: 0, lastSync: null, recent: [] });
    }

    const pending = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'pending'")
      .get() as { count: number };
    const failed = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'failed'")
      .get() as { count: number };
    const lastSync = sqlite
      .prepare("SELECT MAX(COALESCE(updated_at, created_at)) AS value FROM sync_queue WHERE status = 'success'")
      .get() as { value: number | null };
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
      failed: Number(failed?.count || 0),
      lastSync: lastSync?.value ? new Date(Number(lastSync.value)).toISOString() : null,
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
