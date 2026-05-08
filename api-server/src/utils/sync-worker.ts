import { sqlite } from "@workspace/db";
import { createRequire } from "module";
import { ensureSyncQueueTable } from "./ensure-sync-queue-table";

const require = createRequire(process.cwd() + "/package.json");
const { Client: PgClient } = require("pg") as {
  Client: new (config: { connectionString: string; connectionTimeoutMillis?: number; query_timeout?: number }) => {
    connect: () => Promise<void>;
    query: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number }>;
    end: () => Promise<void>;
  };
};

type SyncQueueRow = {
  id: number;
  entityType: string;
  entityId: string;
  operation: string;
  payloadJson: string | null;
  retryCount: number;
};

type LocalInvoiceRow = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  issueDate: string;
  dueDate: string | null;
  status: string | null;
  subtotal: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  total: number | null;
  notes: string | null;
  shipmentRef: string | null;
  billOfLading: string | null;
  packageCount: number | null;
  shipmentWeight: number | null;
  portOfEntry: string | null;
  importerExporterName: string | null;
  advancePayment: number | null;
  createdBy: number | null;
  deletedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
};

type LocalClientRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
};

function getOnlineConnectionString() {
  if (!sqlite) return "";

  const row = sqlite
    .prepare(`
      SELECT database_connection_string AS connectionString
      FROM company_settings
      ORDER BY id ASC
      LIMIT 1
    `)
    .get() as { connectionString?: string | null } | undefined;

  return String(row?.connectionString || "").trim();
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getLocalInvoice(entityId: string) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        invoice_number AS invoiceNumber,
        client_id AS clientId,
        issue_date AS issueDate,
        due_date AS dueDate,
        status,
        subtotal,
        tax_rate AS taxRate,
        tax_amount AS taxAmount,
        total,
        notes,
        shipment_ref AS shipmentRef,
        bill_of_lading AS billOfLading,
        package_count AS packageCount,
        shipment_weight AS shipmentWeight,
        port_of_entry AS portOfEntry,
        importer_exporter_name AS importerExporterName,
        advance_payment AS advancePayment,
        created_by AS createdBy,
        deleted_at AS deletedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM invoices
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(entityId)) as LocalInvoiceRow | undefined;
}

function getLocalClient(clientId: number) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        tax_id AS taxId
      FROM clients
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(clientId)) as LocalClientRow | undefined;
}

function toPgTimestamp(value: number | null | undefined) {
  return value ? new Date(Number(value)) : null;
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function getInvoiceIssueDate(invoice: LocalInvoiceRow) {
  return String(invoice.issueDate || "").trim() || todayIsoDate();
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
}

function logInvoiceSync(operation: string, invoice: LocalInvoiceRow) {
  console.log("[SYNC][INVOICE]", {
    operation,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  });
}

function markSynced(id: number) {
  const now = Date.now();
  sqlite
    ?.prepare(`
      UPDATE sync_queue
      SET status = 'synced',
          synced_at = ?,
          last_error = NULL,
          updated_at = ?
      WHERE id = ?
    `)
    .run(now, now, id);
}

function markFailed(row: SyncQueueRow, message: string) {
  sqlite
    ?.prepare(`
      UPDATE sync_queue
      SET status = 'failed',
          retry_count = ?,
          last_error = ?,
          updated_at = ?
      WHERE id = ?
    `)
    .run(Number(row.retryCount || 0) + 1, message, Date.now(), row.id);
}

function markRetrying(row: SyncQueueRow) {
  sqlite
    ?.prepare(`
      UPDATE sync_queue
      SET status = 'pending',
          updated_at = ?
      WHERE id = ?
    `)
    .run(Date.now(), row.id);
}

async function createOnlineClient(connectionString: string) {
  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });

  await client.connect();
  await client.query("select 1");
  console.log("Sync worker PostgreSQL select 1 succeeded");

  return client;
}

async function getOnlineClientColumns(client: any) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'clients'
  `) as { rows?: Array<{ column_name: string }> };

  return new Set((result.rows || []).map((row) => row.column_name));
}

async function findOnlineClientId(client: any, localClient: LocalClientRow) {
  const columns = await getOnlineClientColumns(client);
  const attempts: Array<{ column: string; value: string; normalized?: boolean }> = [];
  const taxValue = String(localClient.taxId || "").trim();
  const emailValue = String(localClient.email || "").trim();
  const phoneValue = String(localClient.phone || "").trim();
  const nameValue = normalizeText(localClient.name);

  for (const column of ["tax_number", "tax_id"]) {
    if (taxValue && columns.has(column)) attempts.push({ column, value: taxValue });
  }

  for (const column of ["cr_number"]) {
    if (taxValue && columns.has(column)) attempts.push({ column, value: taxValue });
  }

  if (emailValue && columns.has("email")) attempts.push({ column: "email", value: emailValue });
  if (phoneValue && columns.has("phone")) attempts.push({ column: "phone", value: phoneValue });

  for (const column of ["name_ar", "name_en", "name"]) {
    if (nameValue && columns.has(column)) attempts.push({ column, value: nameValue, normalized: true });
  }

  for (const attempt of attempts) {
    const result = await client.query(
      attempt.normalized
        ? `SELECT id FROM clients WHERE lower(trim(${attempt.column})) = $1 LIMIT 1`
        : `SELECT id FROM clients WHERE ${attempt.column} = $1 LIMIT 1`,
      [attempt.value]
    ) as { rows?: Array<{ id: number }> };

    const id = result.rows?.[0]?.id;
    if (id) {
      console.log("[SYNC][CLIENT_MAPPING]", {
        localClientId: localClient.id,
        onlineClientId: id,
        matchedBy: attempt.column,
      });
      return Number(id);
    }
  }

  return null;
}

async function resolveOnlineClientId(client: any, invoice: LocalInvoiceRow) {
  const localClient = getLocalClient(invoice.clientId);
  if (!localClient) {
    throw new Error(`Local client not found for local clientId: ${invoice.clientId}`);
  }

  const onlineClientId = await findOnlineClientId(client, localClient);
  if (!onlineClientId) {
    throw new Error(`Online client mapping not found for local clientId: ${invoice.clientId}`);
  }

  return onlineClientId;
}

async function pushInvoiceCreate(client: any, invoice: LocalInvoiceRow, onlineClientId: number) {
  const issueDate = getInvoiceIssueDate(invoice);
  logInvoiceSync("create", invoice);
  console.log("Sync worker pushing invoice", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, issueDate });
  console.log("[SYNC][INVOICE][PAYLOAD]", {
    operation: "create",
    localInvoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    onlineClientId,
  });

  const existing = await client.query(
    `
      SELECT id, invoice_number
      FROM invoices
      WHERE invoice_number = $1 OR id = $2
      ORDER BY CASE WHEN invoice_number = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [String(invoice.invoiceNumber || ""), Number(invoice.id)]
  ) as { rowCount?: number; rows?: Array<{ id: number; invoice_number: string }> };
  console.log("[SYNC][INVOICE][FOUND]", existing.rows?.[0] || null);

  if (existing.rowCount && existing.rows?.[0]) {
    await client.query(
      `
        UPDATE invoices
        SET invoice_number = $1,
            issue_date = $2,
            due_date = $3,
            client_id = $4,
            shipment_ref = $5,
            status = $6,
            total = $7,
            updated_at = $8
        WHERE id = $9
      `,
      [
        String(invoice.invoiceNumber || ""),
        issueDate,
        invoice.dueDate ?? null,
        onlineClientId,
        invoice.shipmentRef ?? null,
        String(invoice.status || "draft"),
        Number(invoice.total ?? 0),
        toPgTimestamp(invoice.updatedAt) ?? new Date(),
        Number(existing.rows[0].id),
      ]
    );
    return;
  }

  await client.query(
    `
        INSERT INTO invoices (
          id,
          invoice_number,
          client_id,
          issue_date,
          due_date,
          status,
          subtotal,
          tax_rate,
          tax_amount,
          total,
          notes,
          shipment_ref,
          bill_of_lading,
          package_count,
          shipment_weight,
          port_of_entry,
          importer_exporter_name,
          advance_payment,
          created_by,
          deleted_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22
        )
      `,
    [
      Number(invoice.id),
      String(invoice.invoiceNumber || ""),
      onlineClientId,
      issueDate,
      invoice.dueDate ?? null,
      String(invoice.status || "draft"),
      Number(invoice.subtotal ?? 0),
      Number(invoice.taxRate ?? 0),
      Number(invoice.taxAmount ?? 0),
      Number(invoice.total ?? 0),
      invoice.notes ?? null,
      invoice.shipmentRef ?? null,
      invoice.billOfLading ?? null,
      invoice.packageCount ?? null,
      invoice.shipmentWeight ?? null,
      invoice.portOfEntry ?? null,
      invoice.importerExporterName ?? null,
      Number(invoice.advancePayment ?? 0),
      invoice.createdBy ?? null,
      toPgTimestamp(invoice.deletedAt),
      toPgTimestamp(invoice.createdAt) ?? new Date(),
      toPgTimestamp(invoice.updatedAt) ?? new Date(),
    ]
  );
}

async function pushInvoiceUpdate(client: any, invoice: LocalInvoiceRow, onlineClientId: number) {
  const issueDate = getInvoiceIssueDate(invoice);
  logInvoiceSync("update", invoice);
  console.log("Sync worker updating invoice", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, issueDate });
  console.log("[SYNC][INVOICE][PAYLOAD]", {
    operation: "update",
    localInvoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    onlineClientId,
  });

  const existing = await client.query(
    `
      SELECT id, invoice_number
      FROM invoices
      WHERE invoice_number = $1
      LIMIT 1
    `,
    [String(invoice.invoiceNumber || "")]
  ) as { rowCount?: number; rows?: Array<{ id: number; invoice_number: string }> };
  console.log("[SYNC][INVOICE][FOUND]", existing.rows?.[0] || null);

  const result = await client.query(
    `
      UPDATE invoices
      SET issue_date = $1,
          due_date = $2,
          client_id = $3,
          shipment_ref = $4,
          status = $5,
          total = $6,
          updated_at = $7
      WHERE invoice_number = $8
    `,
    [
      issueDate,
      invoice.dueDate ?? null,
      onlineClientId,
      invoice.shipmentRef ?? null,
      String(invoice.status || "draft"),
      Number(invoice.total ?? 0),
      toPgTimestamp(invoice.updatedAt) ?? new Date(),
      String(invoice.invoiceNumber || ""),
    ]
  );

  if (!result.rowCount) {
    throw new Error(`Online invoice not found for update: ${invoice.invoiceNumber}`);
  }
}

export async function runSyncWorkerOnce(): Promise<{
  pendingCount: number;
  processedCount: number;
  onlineConnected: boolean;
  lastError: string | null;
}> {
  try {
    ensureSyncQueueTable();

    if (!sqlite) {
      console.log("Sync worker pending items: 0");
      return { pendingCount: 0, processedCount: 0, onlineConnected: false, lastError: "SQLite database is unavailable" };
    }

    const pending = sqlite
      .prepare(`
        SELECT
          id,
          entity_type AS entityType,
          entity_id AS entityId,
          operation,
          payload_json AS payloadJson,
          retry_count AS retryCount
        FROM sync_queue
        WHERE status = 'pending'
           OR (status = 'failed' AND retry_count < 5)
        ORDER BY created_at ASC, id ASC
        LIMIT 10
      `)
      .all() as SyncQueueRow[];

    console.log(`Sync worker items to process: ${pending.length}`);

    const connectionString = getOnlineConnectionString();
    console.log("Sync worker connection string loaded:", Boolean(connectionString));
    let processedCount = 0;
    let onlineConnected = false;
    let lastError: string | null = null;
    let client: any = null;

    if (connectionString) {
      try {
        client = await createOnlineClient(connectionString);
        onlineConnected = true;
        console.log("Online database connection: Connected");
      } catch (err) {
        lastError = errorMessage(err);
        console.warn("Online database connection: Disconnected", lastError);

        for (const row of pending) {
          if (row.entityType === "invoice" && (row.operation === "create" || row.operation === "update")) {
            markRetrying(row);
            markFailed(row, lastError);
          }
        }

        return { pendingCount: pending.length, processedCount: 0, onlineConnected: false, lastError };
      }
    }

    try {
      for (const row of pending) {
        if (row.entityType !== "invoice" || (row.operation !== "create" && row.operation !== "update")) {
          continue;
        }

        try {
          markRetrying(row);

          if (!client) {
            throw new Error("Online database connection string is not configured");
          }

          const invoice = getLocalInvoice(row.entityId);
          if (!invoice) {
            throw new Error(`Local invoice not found for sync entityId ${row.entityId}`);
          }

          console.log("Sync worker loaded local invoice", {
            invoiceId: invoice.id,
            issueDate: getInvoiceIssueDate(invoice),
          });

          const onlineClientId = await resolveOnlineClientId(client, invoice);

          if (row.operation === "create") {
            await pushInvoiceCreate(client, invoice, onlineClientId);
          } else {
            await pushInvoiceUpdate(client, invoice, onlineClientId);
          }
          markSynced(row.id);
          processedCount += 1;
        } catch (err) {
          console.error("[SYNC][INVOICE][ERROR]", err);
          lastError = errorMessage(err);
          markFailed(row, lastError);
        }
      }
    } finally {
      if (client) {
        try {
          await client.end();
        } catch {
          // Ignore close errors; queue status records the push result.
        }
      }
    }

    return { pendingCount: pending.length, processedCount, onlineConnected, lastError };
  } catch (err) {
    console.warn("Sync worker failed", err);
    return { pendingCount: 0, processedCount: 0, onlineConnected: false, lastError: errorMessage(err) };
  }
}
