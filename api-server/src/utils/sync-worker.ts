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

type SyncRunStats = {
  autoRestoredCount: number;
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

type LocalInvoiceItemRow = {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type LocalReceiptRow = {
  id: number;
  receiptNumber: string;
  clientId: number;
  invoiceId: number | null;
  amount: number;
  paymentMethod: string | null;
  notes: string | null;
  receiptDate: string;
  createdBy: number | null;
  deletedAt: number | null;
  createdAt: number | null;
};

type LocalAccountingRow = {
  id: number;
  clientId: number;
  invoiceId: number | null;
  receiptId: number | null;
  entryDate: string;
  entryType: string;
  descriptionAr: string;
  descriptionEn: string;
  referenceType: string;
  referenceNumber: string | null;
  debit: number;
  credit: number;
  balanceImpact: number;
  createdBy: number | null;
  createdAt: string | null;
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

function getLocalInvoiceItems(localInvoiceId: number) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        invoice_id AS invoiceId,
        description,
        quantity,
        unit_price AS unitPrice,
        total
      FROM invoice_items
      WHERE invoice_id = ?
      ORDER BY id ASC
    `)
    .all(Number(localInvoiceId)) as LocalInvoiceItemRow[] | undefined;
}

function getLocalReceipt(entityId: string) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        receipt_number AS receiptNumber,
        client_id AS clientId,
        invoice_id AS invoiceId,
        amount,
        payment_method AS paymentMethod,
        notes,
        receipt_date AS receiptDate,
        created_by AS createdBy,
        deleted_at AS deletedAt,
        created_at AS createdAt
      FROM receipts
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(entityId)) as LocalReceiptRow | undefined;
}

function getLocalAccountingEntry(entityId: string) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        client_id AS clientId,
        invoice_id AS invoiceId,
        receipt_id AS receiptId,
        entry_date AS entryDate,
        entry_type AS entryType,
        description_ar AS descriptionAr,
        description_en AS descriptionEn,
        reference_type AS referenceType,
        reference_number AS referenceNumber,
        debit,
        credit,
        balance_impact AS balanceImpact,
        created_by AS createdBy,
        created_at AS createdAt
      FROM customer_ledger
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(entityId)) as LocalAccountingRow | undefined;
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

function hasDeletedAt(row: { deleted_at?: unknown } | null | undefined) {
  return row?.deleted_at !== null && row?.deleted_at !== undefined;
}

async function autoRestoreOnlineInvoiceIfNeeded(
  client: any,
  row: { id: number; invoice_number?: string; deleted_at?: unknown } | null | undefined,
  invoice: LocalInvoiceRow,
  stats: SyncRunStats
) {
  if (!row || !hasDeletedAt(row)) return;

  await client.query("UPDATE invoices SET deleted_at = NULL WHERE id = $1", [Number(row.id)]);
  stats.autoRestoredCount += 1;
  console.log("[SYNC][AUTO_RESTORE][INVOICE]", {
    onlineInvoiceId: Number(row.id),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber || row.invoice_number || null,
  });
}

async function autoRestoreOnlineReceiptIfNeeded(
  client: any,
  row: { id: number; receipt_number?: string; deleted_at?: unknown } | null | undefined,
  receipt: LocalReceiptRow,
  stats: SyncRunStats
) {
  if (!row || !hasDeletedAt(row)) return;

  await client.query("UPDATE receipts SET deleted_at = NULL WHERE id = $1", [Number(row.id)]);
  stats.autoRestoredCount += 1;
  console.log("[SYNC][AUTO_RESTORE][RECEIPT]", {
    onlineReceiptId: Number(row.id),
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber || row.receipt_number || null,
  });
}

function isSupportedSyncRow(row: SyncQueueRow) {
  return (
    (row.entityType === "invoice" || row.entityType === "receipt" || row.entityType === "accounting" || row.entityType === "customer_ledger") &&
    (row.operation === "create" || row.operation === "update")
  );
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
  return resolveOnlineClientIdForLocalClientId(client, invoice.clientId);
}

async function resolveOnlineClientIdForLocalClientId(client: any, localClientId: number) {
  const localClient = getLocalClient(localClientId);
  if (!localClient) {
    throw new Error(`Local client not found for local clientId: ${localClientId}`);
  }

  const onlineClientId = await findOnlineClientId(client, localClient);
  if (!onlineClientId) {
    throw new Error(`Online client mapping not found for local clientId: ${localClientId}`);
  }

  return onlineClientId;
}

async function pushInvoiceCreate(client: any, invoice: LocalInvoiceRow, onlineClientId: number, stats: SyncRunStats) {
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
      SELECT id, invoice_number, deleted_at
      FROM invoices
      WHERE invoice_number = $1 OR id = $2
      ORDER BY CASE WHEN invoice_number = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [String(invoice.invoiceNumber || ""), Number(invoice.id)]
  ) as { rowCount?: number; rows?: Array<{ id: number; invoice_number: string; deleted_at: unknown }> };
  console.log("[SYNC][INVOICE][FOUND]", existing.rows?.[0] || null);

  if (existing.rowCount && existing.rows?.[0]) {
    await autoRestoreOnlineInvoiceIfNeeded(client, existing.rows[0], invoice, stats);
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

async function pushInvoiceUpdate(client: any, invoice: LocalInvoiceRow, onlineClientId: number, stats: SyncRunStats) {
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
      SELECT id, invoice_number, deleted_at
      FROM invoices
      WHERE invoice_number = $1
      LIMIT 1
    `,
    [String(invoice.invoiceNumber || "")]
  ) as { rowCount?: number; rows?: Array<{ id: number; invoice_number: string; deleted_at: unknown }> };
  console.log("[SYNC][INVOICE][FOUND]", existing.rows?.[0] || null);
  await autoRestoreOnlineInvoiceIfNeeded(client, existing.rows?.[0], invoice, stats);

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

async function getOnlineInvoiceId(client: any, invoiceNumber: string) {
  const result = await client.query(
    `
      SELECT id
      FROM invoices
      WHERE invoice_number = $1
      LIMIT 1
    `,
    [String(invoiceNumber || "")]
  ) as { rows?: Array<{ id: number }> };

  const onlineInvoiceId = result.rows?.[0]?.id;
  if (!onlineInvoiceId) {
    throw new Error(`Online invoice not found for item sync: ${invoiceNumber}`);
  }

  return Number(onlineInvoiceId);
}

async function getOnlineInvoiceMapping(client: any, invoiceNumber: string) {
  const result = await client.query(
    `
      SELECT id, client_id
      FROM invoices
      WHERE invoice_number = $1
      LIMIT 1
    `,
    [String(invoiceNumber || "")]
  ) as { rows?: Array<{ id: number; client_id: number }> };

  const row = result.rows?.[0];
  if (!row) return null;

  return {
    onlineInvoiceId: Number(row.id),
    onlineClientId: Number(row.client_id),
  };
}

async function hasOnlineInvoice(client: any, invoiceNumber: string) {
  return Boolean(await getOnlineInvoiceMapping(client, invoiceNumber));
}

async function getOnlineReceiptId(client: any, receiptNumber: string) {
  const result = await client.query(
    `
      SELECT id
      FROM receipts
      WHERE receipt_number = $1
      LIMIT 1
    `,
    [String(receiptNumber || "")]
  ) as { rows?: Array<{ id: number }> };

  const onlineReceiptId = result.rows?.[0]?.id;
  return onlineReceiptId ? Number(onlineReceiptId) : null;
}

async function syncInvoiceItems(client: any, invoice: LocalInvoiceRow) {
  const onlineInvoiceId = await getOnlineInvoiceId(client, invoice.invoiceNumber);
  const items = getLocalInvoiceItems(invoice.id) || [];

  console.log("[SYNC][INVOICE_ITEMS]", {
    localInvoiceId: invoice.id,
    onlineInvoiceId,
    count: items.length,
  });

  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [onlineInvoiceId]);

    for (const item of items) {
      await client.query(
        `
          INSERT INTO invoice_items (
            invoice_id,
            description,
            quantity,
            unit_price,
            total
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          onlineInvoiceId,
          String(item.description || ""),
          Number(item.quantity ?? 0),
          Number(item.unitPrice ?? 0),
          Number(item.total ?? 0),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

function logReceiptSync(operation: string, receipt: LocalReceiptRow) {
  console.log("[SYNC][RECEIPT]", {
    operation,
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
  });
}

async function resolveReceiptOnlineMapping(client: any, receipt: LocalReceiptRow) {
  if (receipt.invoiceId) {
    const localInvoice = getLocalInvoice(String(receipt.invoiceId));
    if (!localInvoice) {
      throw new Error(`Local invoice mapping not found for receiptId: ${receipt.id}`);
    }

    const onlineInvoice = await getOnlineInvoiceMapping(client, localInvoice.invoiceNumber);
    if (!onlineInvoice) {
      throw new Error(`Online invoice mapping not found for receiptId: ${receipt.id}`);
    }

    console.log("[SYNC][RECEIPT][MAPPING]", {
      localInvoiceId: receipt.invoiceId,
      onlineInvoiceId: onlineInvoice.onlineInvoiceId,
      onlineClientId: onlineInvoice.onlineClientId,
    });

    return onlineInvoice;
  }

  const onlineClientId = await resolveOnlineClientIdForLocalClientId(client, receipt.clientId);
  console.log("[SYNC][RECEIPT][MAPPING]", {
    localInvoiceId: null,
    onlineInvoiceId: null,
    onlineClientId,
  });

  return {
    onlineInvoiceId: null,
    onlineClientId,
  };
}

async function pushReceipt(client: any, receipt: LocalReceiptRow, operation: string, stats: SyncRunStats) {
  logReceiptSync(operation, receipt);
  const mapping = await resolveReceiptOnlineMapping(client, receipt);
  const existing = await client.query(
    `
      SELECT id, receipt_number, deleted_at
      FROM receipts
      WHERE receipt_number = $1
      LIMIT 1
    `,
    [String(receipt.receiptNumber || "")]
  ) as { rowCount?: number; rows?: Array<{ id: number; receipt_number: string; deleted_at: unknown }> };

  if (existing.rowCount && existing.rows?.[0]) {
    await autoRestoreOnlineReceiptIfNeeded(client, existing.rows[0], receipt, stats);
    await client.query(
      `
        UPDATE receipts
        SET client_id = $1,
            invoice_id = $2,
            amount = $3,
            payment_method = $4,
            notes = $5,
            receipt_date = $6
        WHERE id = $7
      `,
      [
        mapping.onlineClientId,
        mapping.onlineInvoiceId,
        Number(receipt.amount ?? 0),
        String(receipt.paymentMethod || "cash"),
        receipt.notes ?? null,
        String(receipt.receiptDate || todayIsoDate()),
        Number(existing.rows[0].id),
      ]
    );
    return;
  }

  if (operation === "update") {
    console.log("[SYNC][RECEIPT][FALLBACK_CREATE]", {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
    });
  }

  await client.query(
    `
      INSERT INTO receipts (
        receipt_number,
        client_id,
        invoice_id,
        amount,
        payment_method,
        notes,
        receipt_date,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      String(receipt.receiptNumber || ""),
      mapping.onlineClientId,
      mapping.onlineInvoiceId,
      Number(receipt.amount ?? 0),
      String(receipt.paymentMethod || "cash"),
      receipt.notes ?? null,
      String(receipt.receiptDate || todayIsoDate()),
      toPgTimestamp(receipt.createdAt) ?? new Date(),
    ]
  );
}

async function hasOnlineTable(client: any, tableName: string) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  ) as { rowCount?: number };

  return Number(result.rowCount || 0) > 0;
}

async function resolveAccountingOnlineMapping(client: any, entry: LocalAccountingRow) {
  let onlineInvoiceId: number | null = null;
  let onlineReceiptId: number | null = null;
  let onlineClientId: number | null = null;

  if (entry.referenceType === "invoice" || entry.invoiceId) {
    const localInvoice = entry.invoiceId ? getLocalInvoice(String(entry.invoiceId)) : null;
    const invoiceNumber = localInvoice?.invoiceNumber || entry.referenceNumber || "";
    const onlineInvoice = await getOnlineInvoiceMapping(client, invoiceNumber);

    if (!onlineInvoice) {
      throw new Error(`Online invoice mapping not found for accountingId: ${entry.id}`);
    }

    onlineInvoiceId = onlineInvoice.onlineInvoiceId;
    onlineClientId = onlineInvoice.onlineClientId;
  }

  if (entry.referenceType === "receipt" || entry.receiptId) {
    const localReceipt = entry.receiptId ? getLocalReceipt(String(entry.receiptId)) : null;
    const receiptNumber = localReceipt?.receiptNumber || entry.referenceNumber || "";
    onlineReceiptId = await getOnlineReceiptId(client, receiptNumber);

    if (!onlineReceiptId) {
      throw new Error(`Online receipt mapping not found for accountingId: ${entry.id}`);
    }

    if (localReceipt?.invoiceId) {
      const localInvoice = getLocalInvoice(String(localReceipt.invoiceId));
      const onlineInvoice = localInvoice ? await getOnlineInvoiceMapping(client, localInvoice.invoiceNumber) : null;
      if (!onlineInvoice) {
        throw new Error(`Online invoice mapping not found for accountingId: ${entry.id}`);
      }
      onlineInvoiceId = onlineInvoice.onlineInvoiceId;
      onlineClientId = onlineInvoice.onlineClientId;
    } else if (!onlineClientId) {
      onlineClientId = await resolveOnlineClientIdForLocalClientId(client, entry.clientId);
    }
  }

  if (!onlineClientId) {
    onlineClientId = await resolveOnlineClientIdForLocalClientId(client, entry.clientId);
  }

  return { onlineClientId, onlineInvoiceId, onlineReceiptId };
}

async function pushAccountingEntry(client: any, entry: LocalAccountingRow, operation: string) {
  console.log("[SYNC][ACCOUNTING]", {
    operation,
    referenceType: entry.referenceType,
    referenceNumber: entry.referenceNumber,
  });

  if (!(await hasOnlineTable(client, "customer_ledger"))) {
    console.log("[SYNC][ACCOUNTING][SKIPPED_NO_TABLE]", {
      referenceType: entry.referenceType,
      referenceNumber: entry.referenceNumber,
      entryType: entry.entryType,
    });
    return;
  }

  const mapping = await resolveAccountingOnlineMapping(client, entry);
  const existing = await client.query(
    `
      SELECT id
      FROM customer_ledger
      WHERE reference_type = $1
        AND reference_number = $2
        AND entry_type = $3
      LIMIT 1
    `,
    [String(entry.referenceType || ""), String(entry.referenceNumber || ""), String(entry.entryType || "")]
  ) as { rowCount?: number; rows?: Array<{ id: number }> };

  if (existing.rowCount && existing.rows?.[0]) {
    console.log("[SYNC][ACCOUNTING][SKIPPED_ALREADY_EXISTS]", {
      referenceType: entry.referenceType,
      referenceNumber: entry.referenceNumber,
      entryType: entry.entryType,
    });

    await client.query(
      `
        UPDATE customer_ledger
        SET client_id = $1,
            invoice_id = $2,
            receipt_id = $3,
            entry_date = $4,
            description_ar = $5,
            description_en = $6,
            debit = $7,
            credit = $8,
            balance_impact = $9
        WHERE id = $10
      `,
      [
        mapping.onlineClientId,
        mapping.onlineInvoiceId,
        mapping.onlineReceiptId,
        String(entry.entryDate || todayIsoDate()),
        String(entry.descriptionAr || ""),
        String(entry.descriptionEn || ""),
        Number(entry.debit ?? 0),
        Number(entry.credit ?? 0),
        Number(entry.balanceImpact ?? 0),
        Number(existing.rows[0].id),
      ]
    );
    return;
  }

  await client.query(
    `
      INSERT INTO customer_ledger (
        client_id,
        invoice_id,
        receipt_id,
        entry_date,
        entry_type,
        description_ar,
        description_en,
        reference_type,
        reference_number,
        debit,
        credit,
        balance_impact,
        created_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `,
    [
      mapping.onlineClientId,
      mapping.onlineInvoiceId,
      mapping.onlineReceiptId,
      String(entry.entryDate || todayIsoDate()),
      String(entry.entryType || ""),
      String(entry.descriptionAr || ""),
      String(entry.descriptionEn || ""),
      String(entry.referenceType || ""),
      String(entry.referenceNumber || ""),
      Number(entry.debit ?? 0),
      Number(entry.credit ?? 0),
      Number(entry.balanceImpact ?? 0),
      entry.createdBy ?? null,
      entry.createdAt ? new Date(entry.createdAt) : new Date(),
    ]
  );
}

export async function runSyncWorkerOnce(): Promise<{
  pendingCount: number;
  processedCount: number;
  onlineConnected: boolean;
  lastError: string | null;
  autoRestoredCount: number;
}> {
  try {
    ensureSyncQueueTable();

    if (!sqlite) {
      console.log("Sync worker pending items: 0");
      return { pendingCount: 0, processedCount: 0, onlineConnected: false, lastError: "SQLite database is unavailable", autoRestoredCount: 0 };
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
    const stats: SyncRunStats = { autoRestoredCount: 0 };

    if (!connectionString) {
      lastError = "Online database connection string is not configured";
      console.warn("Online database connection: Disconnected", lastError);
      return { pendingCount: pending.length, processedCount: 0, onlineConnected: false, lastError, autoRestoredCount: stats.autoRestoredCount };
    }

    try {
      client = await createOnlineClient(connectionString);
      onlineConnected = true;
      console.log("Online database connection: Connected");
    } catch (err) {
      lastError = errorMessage(err);
      console.warn("Online database connection: Disconnected", lastError);
      return { pendingCount: pending.length, processedCount: 0, onlineConnected: false, lastError, autoRestoredCount: stats.autoRestoredCount };
    }

    try {
      for (const row of pending) {
        if (!isSupportedSyncRow(row)) {
          continue;
        }

        try {
          markRetrying(row);

          if (row.entityType === "invoice") {
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
              await pushInvoiceCreate(client, invoice, onlineClientId, stats);
            } else if (await hasOnlineInvoice(client, invoice.invoiceNumber)) {
              await pushInvoiceUpdate(client, invoice, onlineClientId, stats);
            } else {
              console.log("[SYNC][INVOICE][FALLBACK_CREATE]", {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
              });
              await pushInvoiceCreate(client, invoice, onlineClientId, stats);
            }

            await syncInvoiceItems(client, invoice);
          } else if (row.entityType === "receipt") {
            const receipt = getLocalReceipt(row.entityId);
            if (!receipt) {
              throw new Error(`Local receipt not found for sync entityId ${row.entityId}`);
            }

            await pushReceipt(client, receipt, row.operation, stats);
          } else {
            const accountingEntry = getLocalAccountingEntry(row.entityId);
            if (!accountingEntry) {
              throw new Error(`Local accounting entry not found for sync entityId ${row.entityId}`);
            }

            await pushAccountingEntry(client, accountingEntry, row.operation);
          }

          markSynced(row.id);
          processedCount += 1;
        } catch (err) {
          console.error(`[SYNC][${row.entityType.toUpperCase()}][ERROR]`, err);
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

    return { pendingCount: pending.length, processedCount, onlineConnected, lastError, autoRestoredCount: stats.autoRestoredCount };
  } catch (err) {
    console.warn("Sync worker failed", err);
    return { pendingCount: 0, processedCount: 0, onlineConnected: false, lastError: errorMessage(err), autoRestoredCount: 0 };
  }
}
