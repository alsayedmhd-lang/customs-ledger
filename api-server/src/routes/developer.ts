import { Router } from "express";
import { db, sqlite, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import packageJson from "../../../package.json";

const router = Router();

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
  ["allow_manager_edit_branding", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_branding INTEGER DEFAULT 0"],
  ["allow_manager_edit_registration_settings", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_registration_settings INTEGER DEFAULT 0"],
  ["allow_manager_edit_sensitive_users", "ALTER TABLE company_settings ADD COLUMN allow_manager_edit_sensitive_users INTEGER DEFAULT 0"],
  ["lock_company_identity", "ALTER TABLE company_settings ADD COLUMN lock_company_identity INTEGER DEFAULT 0"],
  ["lock_company_name", "ALTER TABLE company_settings ADD COLUMN lock_company_name INTEGER DEFAULT 0"],
  ["lock_logo", "ALTER TABLE company_settings ADD COLUMN lock_logo INTEGER DEFAULT 0"],
  ["lock_stamp", "ALTER TABLE company_settings ADD COLUMN lock_stamp INTEGER DEFAULT 0"],
  ["lock_legal_info", "ALTER TABLE company_settings ADD COLUMN lock_legal_info INTEGER DEFAULT 0"],
  ["lock_footer_branding", "ALTER TABLE company_settings ADD COLUMN lock_footer_branding INTEGER DEFAULT 0"],
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
