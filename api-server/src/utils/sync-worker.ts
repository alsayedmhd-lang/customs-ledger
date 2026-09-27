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
  status: string | null;
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

type LocalUserRow = {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  displayNameAr: string | null;
  displayNameEn: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  receiverSignatureBase64: string | null;
  createdAt: number | null;
};

type LocalClientRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

type LocalTemplateRow = {
  id: number;
  description: string;
  defaultUnitPrice: number | null;
  createdAt: number | null;
};

type OnlineClientRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

type OnlineInvoiceRow = {
  id: number;
  invoice_number: string;
  client_id: number;
  issue_date: string;
  due_date: string | null;
  status: string | null;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  notes: string | null;
  shipment_ref: string | null;
  bill_of_lading: string | null;
  package_count: number | string | null;
  shipment_weight: number | string | null;
  port_of_entry: string | null;
  importer_exporter_name: string | null;
  advance_payment: number | string | null;
  created_by: number | null;
  deleted_at: string | Date | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

type OnlineInvoiceItemRow = {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  total: number | string;
};

type OnlineReceiptRow = {
  id: number;
  receipt_number: string;
  client_id: number;
  invoice_id: number | null;
  amount: number | string;
  payment_method: string | null;
  status: string | null;
  notes: string | null;
  receipt_date: string;
  created_by: number | null;
  deleted_at: string | Date | null;
  created_at: string | Date | null;
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

function findLocalInvoiceIdByShipmentRef(
  shipmentRef: string | null | undefined
) {
  if (!sqlite) return null;

  const normalizedShipmentRef = String(shipmentRef ?? "").trim();

  if (!normalizedShipmentRef) {
    return null;
  }

  const rows = sqlite
    .prepare(`
      SELECT id
      FROM invoices
      WHERE trim(COALESCE(shipment_ref, '')) = ?
      LIMIT 2
    `)
    .all(normalizedShipmentRef) as Array<{ id: number }>;

  if (rows.length > 1) {
    throw new Error(
      `Ambiguous local invoice match for shipment_ref ${normalizedShipmentRef}`
    );
  }

  return rows[0]?.id ? Number(rows[0].id) : null;
}

function getAvailableLocalInvoiceNumber(
  requestedInvoiceNumber: string | null | undefined
) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const requested = String(requestedInvoiceNumber ?? "").trim();

  if (!requested) {
    throw new Error("Online invoice has no invoice number");
  }

  const exactMatch = sqlite
    .prepare(`
      SELECT id
      FROM invoices
      WHERE trim(COALESCE(invoice_number, '')) = ?
      LIMIT 1
    `)
    .get(requested) as { id: number } | undefined;

  if (!exactMatch) {
    return requested;
  }

  let suffix = 1;

  while (true) {
    const candidate = `${requested} (${suffix})`;

    const existing = sqlite
      .prepare(`
        SELECT id
        FROM invoices
        WHERE trim(COALESCE(invoice_number, '')) = ?
        LIMIT 1
      `)
      .get(candidate) as { id: number } | undefined;

    if (!existing) {
      return candidate;
    }

    suffix += 1;
  }
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
        status,
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

function findLocalReceiptIdForOnlineReceipt(
  localClientId: number,
  localInvoiceId: number | null,
  amount: number
) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const rows = sqlite
    .prepare(`
      SELECT id
      FROM receipts
      WHERE client_id = ?
        AND invoice_id IS ?
        AND amount = ?
      ORDER BY id
      LIMIT 2
    `)
    .all(
      localClientId,
      localInvoiceId,
      amount
    ) as Array<{ id: number }>;

  if (rows.length > 1) {
    throw new Error(
      `Ambiguous local receipt match: clientId=${localClientId}, invoiceId=${localInvoiceId}, amount=${amount}`
    );
  }

  return rows[0]?.id
    ? Number(rows[0].id)
    : null;
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

function getLocalUser(userId: number | null | undefined) {
  if (!sqlite || !userId) return undefined;

  return sqlite
    .prepare(`
      SELECT
        id,
        username,
        password_hash AS passwordHash,
        display_name AS displayName,
        display_name_ar AS displayNameAr,
        display_name_en AS displayNameEn,
        role,
        email,
        phone,
        receiver_signature_base64 AS receiverSignatureBase64,
        created_at AS createdAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(userId)) as LocalUserRow | undefined;
}

function getLocalUsers() {
  if (!sqlite) return [];

  return sqlite
    .prepare(`
      SELECT
        id,
        username,
        password_hash AS passwordHash,
        display_name AS displayName,
        display_name_ar AS displayNameAr,
        display_name_en AS displayNameEn,
        role,
        email,
        phone,
        receiver_signature_base64 AS receiverSignatureBase64,
        created_at AS createdAt
      FROM users
      ORDER BY id ASC
    `)
    .all() as LocalUserRow[];
}

function getLocalClient(clientId: number) {
  return sqlite
    ?.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        address,
        tax_id AS taxId,
        notes,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM clients
      WHERE id = ?
      LIMIT 1
    `)
    .get(Number(clientId)) as LocalClientRow | undefined;
}

function getLocalClients() {
  return sqlite?.prepare(`
    SELECT id, name, email, phone, address, tax_id AS taxId, notes,
           created_at AS createdAt, updated_at AS updatedAt
    FROM clients ORDER BY id ASC
  `).all() as LocalClientRow[] | undefined;
}

function getLocalTemplates() {
  return sqlite?.prepare(`
    SELECT id, description, default_unit_price AS defaultUnitPrice,
           created_at AS createdAt
    FROM invoice_item_templates ORDER BY id ASC
  `).all() as LocalTemplateRow[] | undefined;
}

function toPgTimestamp(value: number | null | undefined) {
  return value ? new Date(Number(value)) : null;
}

function toSqliteTimestamp(value: string | Date | null | undefined) {
  if (!value) return null;

  const timestamp = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
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
  const taxId = String(localClient.taxId || "").trim();
  const email = String(localClient.email || "").trim().toLowerCase();
  const phone = String(localClient.phone || "")
    .replace(/[^\d+]/g, "")
    .trim();

  const matchedIds = new Set<number>();

  if (taxId) {
    const result = await client.query(
      `
        SELECT id
        FROM clients
        WHERE trim(COALESCE(tax_id, '')) = $1
        LIMIT 2
      `,
      [taxId]
    ) as { rows?: Array<{ id: number }> };

    if ((result.rows?.length || 0) > 1) {
      throw new Error(
        `Ambiguous online client match by tax_id for local client ${localClient.id}`
      );
    }

    if (result.rows?.[0]?.id) {
      matchedIds.add(Number(result.rows[0].id));
    }
  }

  if (email) {
    const result = await client.query(
      `
        SELECT id
        FROM clients
        WHERE lower(trim(COALESCE(email, ''))) = $1
        LIMIT 2
      `,
      [email]
    ) as { rows?: Array<{ id: number }> };

    if ((result.rows?.length || 0) > 1) {
      throw new Error(
        `Ambiguous online client match by email for local client ${localClient.id}`
      );
    }

    if (result.rows?.[0]?.id) {
      matchedIds.add(Number(result.rows[0].id));
    }
  }

  if (phone) {
    const result = await client.query(
      `
        SELECT id
        FROM clients
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $1
        LIMIT 2
      `,
      [phone]
    ) as { rows?: Array<{ id: number }> };

    if ((result.rows?.length || 0) > 1) {
      throw new Error(
        `Ambiguous online client match by phone for local client ${localClient.id}`
      );
    }

    if (result.rows?.[0]?.id) {
      matchedIds.add(Number(result.rows[0].id));
    }
  }

  if (matchedIds.size > 1) {
    throw new Error(
      `CLIENT_IDENTITY_CONFLICT: tax ID, email, or phone for local client ${localClient.id} match different online clients`
    );
  }

  const onlineClientId = Array.from(matchedIds)[0] ?? null;

  if (onlineClientId) {
    console.log("[SYNC][CLIENT_MAPPING]", {
      localClientId: localClient.id,
      onlineClientId,
      matchedBy: "tax_id/email/phone",
    });
  }

  return onlineClientId;
}

function findLocalClientIdForOnlineClient(onlineClient: OnlineClientRow) {
  if (!sqlite) return null;

  const taxId = String(onlineClient.tax_id || "").trim();
  const email = String(onlineClient.email || "").trim().toLowerCase();
  const phone = String(onlineClient.phone || "")
    .replace(/[^\d+]/g, "")
    .trim();

  const matchedIds = new Set<number>();

  if (taxId) {
    const rows = sqlite
      .prepare(`
        SELECT id
        FROM clients
        WHERE trim(COALESCE(tax_id, '')) = ?
        LIMIT 2
      `)
      .all(taxId) as Array<{ id: number }>;

    if (rows.length > 1) {
      throw new Error(
        `Ambiguous local client match by tax_id for online client ${onlineClient.id}`
      );
    }

    if (rows[0]?.id) {
      matchedIds.add(Number(rows[0].id));
    }
  }

  if (email) {
    const rows = sqlite
      .prepare(`
        SELECT id
        FROM clients
        WHERE lower(trim(COALESCE(email, ''))) = ?
        LIMIT 2
      `)
      .all(email) as Array<{ id: number }>;

    if (rows.length > 1) {
      throw new Error(
        `Ambiguous local client match by email for online client ${onlineClient.id}`
      );
    }

    if (rows[0]?.id) {
      matchedIds.add(Number(rows[0].id));
    }
  }

  if (phone) {
    const rows = sqlite
      .prepare(`
        SELECT id
        FROM clients
        WHERE replace(
                replace(
                  replace(
                    replace(
                      replace(COALESCE(phone, ''), ' ', ''),
                    '-', ''),
                  '(', ''),
                ')', ''),
              '.', '') = ?
        LIMIT 2
      `)
      .all(phone) as Array<{ id: number }>;

    if (rows.length > 1) {
      throw new Error(
        `Ambiguous local client match by phone for online client ${onlineClient.id}`
      );
    }

    if (rows[0]?.id) {
      matchedIds.add(Number(rows[0].id));
    }
  }

  if (matchedIds.size > 1) {
    throw new Error(
      `CLIENT_IDENTITY_CONFLICT: tax ID, email, or phone for online client ${onlineClient.id} match different local clients`
    );
  }

  const localClientId = Array.from(matchedIds)[0] ?? null;

  if (localClientId) {
    console.log("[SYNC][CLIENT_MAPPING][ONLINE_TO_LOCAL]", {
      onlineClientId: onlineClient.id,
      localClientId,
      matchedBy: "tax_id/email/phone",
    });
  }

  return localClientId;
}

async function pullClientsFromOnline(client: any) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const result = await client.query(`
    SELECT
      id,
      name,
      email,
      phone,
      address,
      tax_id,
      notes,
      created_at,
      updated_at
    FROM clients
    ORDER BY id ASC
  `) as { rows?: OnlineClientRow[] };

  const onlineClients = result.rows || [];
  const clientIdMap = new Map<number, number>();

  let inserted = 0;
  let updated = 0;

  for (const onlineClient of onlineClients) {
    const name = String(onlineClient.name || "").trim();

    if (!name) {
      throw new Error(
        `Online client ${onlineClient.id} has no name`
      );
    }

    const existingLocalId =
      findLocalClientIdForOnlineClient(onlineClient);

    if (existingLocalId) {
      const existing = sqlite
        .prepare(`
          SELECT
            id,
            name,
            email,
            phone,
            address,
            tax_id AS taxId,
            notes,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM clients
          WHERE id = ?
          LIMIT 1
        `)
        .get(existingLocalId) as
        | {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            taxId: string | null;
            notes: string | null;
            createdAt: number | null;
            updatedAt: number | null;
          }
        | undefined;

      if (!existing) {
        throw new Error(
          `Mapped local client ${existingLocalId} was not found`
        );
      }

      sqlite
        .prepare(`
          UPDATE clients
          SET
            name = ?,
            email = ?,
            phone = ?,
            address = ?,
            tax_id = ?,
            notes = ?,
            created_at = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          name,
          onlineClient.email ?? existing.email,
          onlineClient.phone ?? existing.phone,
          onlineClient.address ?? existing.address,
          onlineClient.tax_id ?? existing.taxId,
          onlineClient.notes ?? existing.notes,
          toSqliteTimestamp(onlineClient.created_at) ?? existing.createdAt,
          toSqliteTimestamp(onlineClient.updated_at) ??
            existing.updatedAt ??
            Date.now(),
          existingLocalId
        );

      clientIdMap.set(Number(onlineClient.id), existingLocalId);
      updated += 1;

      console.log("[SYNC][PULL][CLIENT][UPDATE]", {
        onlineClientId: onlineClient.id,
        localClientId: existingLocalId,
      });

      continue;
    }

    const insertResult = sqlite
      .prepare(`
        INSERT INTO clients (
          name,
          email,
          phone,
          address,
          tax_id,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        name,
        onlineClient.email ?? null,
        onlineClient.phone ?? null,
        onlineClient.address ?? null,
        onlineClient.tax_id ?? null,
        onlineClient.notes ?? null,
        toSqliteTimestamp(onlineClient.created_at) ?? Date.now(),
        toSqliteTimestamp(onlineClient.updated_at) ?? Date.now()
      );

    const localClientId = Number(insertResult.lastInsertRowid);

    clientIdMap.set(Number(onlineClient.id), localClientId);
    inserted += 1;

    console.log("[SYNC][PULL][CLIENT][INSERT]", {
      onlineClientId: onlineClient.id,
      localClientId,
    });
  }

  console.log("[SYNC][PULL][CLIENTS][DONE]", {
    online: onlineClients.length,
    inserted,
    updated,
  });

  return {
    clientIdMap,
    total: onlineClients.length,
    inserted,
    updated,
  };
}

async function pullInvoicesFromOnline(
  client: any,
  clientIdMap: Map<number, number>
) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const result = await client.query(`
    SELECT
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
    FROM invoices
    ORDER BY id ASC
  `) as { rows?: OnlineInvoiceRow[] };

  const onlineInvoices = result.rows || [];
  const invoiceIdMap = new Map<number, number>();
  const invoiceIdsAllowedForItemPull = new Set<number>();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const onlineInvoice of onlineInvoices) {
    const localClientId =
      clientIdMap.get(Number(onlineInvoice.client_id));

    if (!localClientId) {
      console.warn("[SYNC][PULL][INVOICE][SKIP_CLIENT]", {
        onlineInvoiceId: onlineInvoice.id,
        onlineClientId: onlineInvoice.client_id,
      });

      skipped += 1;
      continue;
    }

    const shipmentRef =
      String(onlineInvoice.shipment_ref ?? "").trim() || null;

    const existingLocalId =
      findLocalInvoiceIdByShipmentRef(shipmentRef);

    if (existingLocalId) {
      const localInvoice = getLocalInvoice(String(existingLocalId));

      const localUpdatedAt = localInvoice?.updatedAt
        ? new Date(localInvoice.updatedAt).getTime()
        : 0;

      const onlineUpdatedAt = onlineInvoice.updated_at
        ? new Date(onlineInvoice.updated_at).getTime()
        : 0;

      if (localUpdatedAt > onlineUpdatedAt) {
        console.log("[SYNC][PULL][INVOICE][SKIP_OLDER_ONLINE]", {
          onlineInvoiceId: onlineInvoice.id,
          localInvoiceId: existingLocalId,
          shipmentRef,
          localUpdatedAt,
          onlineUpdatedAt,
        });

        invoiceIdMap.set(
          Number(onlineInvoice.id),
          existingLocalId
        );

        skipped += 1;
        continue;
      }

      if (
        localUpdatedAt > 0 &&
        onlineUpdatedAt > 0 &&
        localUpdatedAt === onlineUpdatedAt
      ) {
        invoiceIdMap.set(
          Number(onlineInvoice.id),
          existingLocalId
        );



        skipped += 1;
        continue;
      }

      sqlite
        .prepare(`
          UPDATE invoices
          SET
            client_id = ?,
            issue_date = ?,
            due_date = ?,
            status = ?,
            subtotal = ?,
            tax_rate = ?,
            tax_amount = ?,
            total = ?,
            notes = ?,
            shipment_ref = ?,
            bill_of_lading = ?,
            package_count = ?,
            shipment_weight = ?,
            port_of_entry = ?,
            importer_exporter_name = ?,
            advance_payment = ?,
            created_by = ?,
            deleted_at = ?,
            created_at = COALESCE(?, created_at),
            updated_at = COALESCE(?, updated_at)
          WHERE id = ?
        `)
        .run(
          localClientId,
          String(onlineInvoice.issue_date || todayIsoDate()),
          onlineInvoice.due_date
            ? String(onlineInvoice.due_date)
            : null,
          onlineInvoice.status ?? "draft",
          Number(onlineInvoice.subtotal ?? 0),
          Number(onlineInvoice.tax_rate ?? 0),
          Number(onlineInvoice.tax_amount ?? 0),
          Number(onlineInvoice.total ?? 0),
          onlineInvoice.notes ?? null,
          shipmentRef,
          onlineInvoice.bill_of_lading ?? null,
          onlineInvoice.package_count === null
            ? null
            : Number(onlineInvoice.package_count),
          onlineInvoice.shipment_weight === null
            ? null
            : Number(onlineInvoice.shipment_weight),
          onlineInvoice.port_of_entry ?? null,
          onlineInvoice.importer_exporter_name ?? null,
          Number(onlineInvoice.advance_payment ?? 0),
          onlineInvoice.created_by ?? null,
          toSqliteTimestamp(onlineInvoice.deleted_at),
          toSqliteTimestamp(onlineInvoice.created_at),
          toSqliteTimestamp(onlineInvoice.updated_at),
          existingLocalId
        );

      invoiceIdMap.set(
        Number(onlineInvoice.id),
        existingLocalId
      );

      invoiceIdsAllowedForItemPull.add(Number(onlineInvoice.id));

      updated += 1;

      console.log("[SYNC][PULL][INVOICE][UPDATE]", {
        onlineInvoiceId: onlineInvoice.id,
        localInvoiceId: existingLocalId,
        shipmentRef,
        localUpdatedAt,
        onlineUpdatedAt,
      });

      continue;
    }

  const localInvoiceNumber =
    getAvailableLocalInvoiceNumber(onlineInvoice.invoice_number);

    const insertResult = sqlite
      .prepare(`
        INSERT INTO invoices (
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
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .run(
        localInvoiceNumber,
        localClientId,
        String(onlineInvoice.issue_date || todayIsoDate()),
        onlineInvoice.due_date
          ? String(onlineInvoice.due_date)
          : null,
        onlineInvoice.status ?? "draft",
        Number(onlineInvoice.subtotal ?? 0),
        Number(onlineInvoice.tax_rate ?? 0),
        Number(onlineInvoice.tax_amount ?? 0),
        Number(onlineInvoice.total ?? 0),
        onlineInvoice.notes ?? null,
        shipmentRef,
        onlineInvoice.bill_of_lading ?? null,
        onlineInvoice.package_count === null
          ? null
          : Number(onlineInvoice.package_count),
        onlineInvoice.shipment_weight === null
          ? null
          : Number(onlineInvoice.shipment_weight),
        onlineInvoice.port_of_entry ?? null,
        onlineInvoice.importer_exporter_name ?? null,
        Number(onlineInvoice.advance_payment ?? 0),
        onlineInvoice.created_by ?? null,
        toSqliteTimestamp(onlineInvoice.deleted_at),
        toSqliteTimestamp(onlineInvoice.created_at) ?? Date.now(),
        toSqliteTimestamp(onlineInvoice.updated_at) ?? Date.now()
      );

    const localInvoiceId =
      Number(insertResult.lastInsertRowid);

    invoiceIdMap.set(
      Number(onlineInvoice.id),
      localInvoiceId
    );

    invoiceIdsAllowedForItemPull.add(Number(onlineInvoice.id));

    inserted += 1;

    console.log("[SYNC][PULL][INVOICE][INSERT]", {
      onlineInvoiceId: onlineInvoice.id,
      localInvoiceId,
      shipmentRef,
    });
  }

  console.log("[SYNC][PULL][INVOICES][DONE]", {
    online: onlineInvoices.length,
    inserted,
    updated,
    skipped,
  });

  return {
    invoiceIdMap,
    invoiceIdsAllowedForItemPull,
    total: onlineInvoices.length,
    inserted,
    updated,
    skipped,
  };
}

async function pullInvoiceItemsFromOnline(
  client: any,
  invoiceIdMap: Map<number, number>,
  invoiceIdsAllowedForItemPull: Set<number>
) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const result = await client.query(`
    SELECT
      id,
      invoice_id,
      description,
      quantity,
      unit_price,
      total
    FROM invoice_items
    ORDER BY invoice_id ASC, id ASC
  `) as { rows?: OnlineInvoiceItemRow[] };

  const onlineItems = result.rows || [];

  const itemsByOnlineInvoiceId =
    new Map<number, OnlineInvoiceItemRow[]>();

  for (const onlineItem of onlineItems) {
    const onlineInvoiceId = Number(onlineItem.invoice_id);

    const currentItems =
      itemsByOnlineInvoiceId.get(onlineInvoiceId) || [];

    currentItems.push(onlineItem);
    itemsByOnlineInvoiceId.set(onlineInvoiceId, currentItems);
  }

  let invoicesProcessed = 0;
  let inserted = 0;
  let skipped = 0;

  for (const onlineInvoiceId of invoiceIdsAllowedForItemPull) {
    const localInvoiceId =
      invoiceIdMap.get(Number(onlineInvoiceId));

    if (!localInvoiceId) {
      console.warn("[SYNC][PULL][INVOICE_ITEMS][SKIP_MAPPING]", {
        onlineInvoiceId,
      });

      skipped += 1;
      continue;
    }

    const invoiceItems =
      itemsByOnlineInvoiceId.get(Number(onlineInvoiceId)) || [];

    // Online هو المصدر المقبول لهذه الفاتورة في هذه الدورة.
    // نحذف الأصناف المحلية أولًا حتى يتم أيضًا تمثيل حالة
    // أن الفاتورة Online لا تحتوي على أي أصناف.
    sqlite
      .prepare(`
        DELETE FROM invoice_items
        WHERE invoice_id = ?
      `)
      .run(localInvoiceId);

    const insertItem = sqlite.prepare(`
      INSERT INTO invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        total
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const onlineItem of invoiceItems) {
      insertItem.run(
        localInvoiceId,
        String(onlineItem.description || ""),
        Number(onlineItem.quantity ?? 0),
        Number(onlineItem.unit_price ?? 0),
        Number(onlineItem.total ?? 0)
      );

      inserted += 1;
    }

    invoicesProcessed += 1;

    console.log("[SYNC][PULL][INVOICE_ITEMS][INVOICE_DONE]", {
      onlineInvoiceId,
      localInvoiceId,
      items: invoiceItems.length,
    });
  }

  console.log("[SYNC][PULL][INVOICE_ITEMS][DONE]", {
    onlineItems: onlineItems.length,
    invoicesProcessed,
    inserted,
    skipped,
  });

  return {
    total: onlineItems.length,
    invoicesProcessed,
    inserted,
    skipped,
  };
}

async function resolveLocalUserIdFromOnline(
  client: any,
  onlineUserId: number | null | undefined
): Promise<number | null> {
  if (!sqlite || !onlineUserId) return null;

  const result = await client.query(
    `
      SELECT username
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [Number(onlineUserId)]
  ) as { rows?: Array<{ username: string }> };

  const username = String(result.rows?.[0]?.username || "").trim();
  if (!username) return null;

  const localUser = sqlite
    .prepare(`
      SELECT id
      FROM users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
      LIMIT 2
    `)
    .all(username) as Array<{ id: number }>;

  if (localUser.length > 1) {
    throw new Error(`Ambiguous local user match for username: ${username}`);
  }

  return localUser[0]?.id ? Number(localUser[0].id) : null;
}

async function pullReceiptsFromOnline(
  client: any,
  clientIdMap: Map<number, number>,
  invoiceIdMap: Map<number, number>
) {
  if (!sqlite) {
    throw new Error("SQLite database is not available");
  }

  const result = await client.query(`
    SELECT
      id,
      receipt_number,
      client_id,
      invoice_id,
      amount,
      payment_method,
      status,
      notes,
      receipt_date,
      created_by,
      deleted_at,
      created_at
    FROM receipts
    ORDER BY id ASC
  `) as { rows?: OnlineReceiptRow[] };

  const onlineReceipts = result.rows || [];

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const onlineReceipt of onlineReceipts) {
    const localClientId =
      clientIdMap.get(Number(onlineReceipt.client_id));

    if (!localClientId) {
      console.warn("[SYNC][PULL][RECEIPT][SKIP_CLIENT_MAPPING]", {
        onlineReceiptId: onlineReceipt.id,
        onlineClientId: onlineReceipt.client_id,
      });

      skipped += 1;
      continue;
    }

    let localInvoiceId: number | null = null;

    if (onlineReceipt.invoice_id !== null) {
      localInvoiceId =
        invoiceIdMap.get(Number(onlineReceipt.invoice_id)) ?? null;

      if (!localInvoiceId) {
        console.warn("[SYNC][PULL][RECEIPT][SKIP_INVOICE_MAPPING]", {
          onlineReceiptId: onlineReceipt.id,
          onlineInvoiceId: onlineReceipt.invoice_id,
        });

        skipped += 1;
        continue;
      }
    }

    const amount = Number(onlineReceipt.amount ?? 0);

    const localCreatedBy = await resolveLocalUserIdFromOnline(
      client,
      onlineReceipt.created_by
    );

    const existingLocalId =
      findLocalReceiptIdForOnlineReceipt(
        localClientId,
        localInvoiceId,
        amount
      );

    if (existingLocalId) {
      sqlite
        .prepare(`
          UPDATE receipts
          SET
            receipt_number = ?,
            client_id = ?,
            invoice_id = ?,
            amount = ?,
            payment_method = ?,
            status = ?,
            notes = ?,
            receipt_date = ?,
            created_by = ?,
            deleted_at = ?,
            created_at = ?
          WHERE id = ?
        `)
        .run(
          String(onlineReceipt.receipt_number || ""),
          localClientId,
          localInvoiceId,
          amount,
          String(onlineReceipt.payment_method || "cash"),
          String(onlineReceipt.status || "draft"),
          onlineReceipt.notes ?? null,
          String(onlineReceipt.receipt_date || ""),
          localCreatedBy,
          toSqliteTimestamp(onlineReceipt.deleted_at),
          toSqliteTimestamp(onlineReceipt.created_at),
          existingLocalId
        );

      updated += 1;
      continue;
    }

    sqlite
      .prepare(`
        INSERT INTO receipts (
          receipt_number,
          client_id,
          invoice_id,
          amount,
          payment_method,
          status,
          notes,
          receipt_date,
          created_by,
          deleted_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        String(onlineReceipt.receipt_number || ""),
        localClientId,
        localInvoiceId,
        amount,
        String(onlineReceipt.payment_method || "cash"),
        String(onlineReceipt.status || "draft"),
        onlineReceipt.notes ?? null,
        String(onlineReceipt.receipt_date || ""),
        localCreatedBy,
        toSqliteTimestamp(onlineReceipt.deleted_at),
        toSqliteTimestamp(onlineReceipt.created_at)
      );

    inserted += 1;
  }

  console.log("[SYNC][PULL][RECEIPTS][DONE]", {
    total: onlineReceipts.length,
    inserted,
    updated,
    skipped,
  });

  return {
    total: onlineReceipts.length,
    inserted,
    updated,
    skipped,
  };
}

export async function runOnlineToLocalSyncOnce(): Promise<{
  onlineConnected: boolean;
  lastError: string | null;
  clients: {
    total: number;
    inserted: number;
    updated: number;
  };
  invoices: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
  invoiceItems: {
    total: number;
    invoicesProcessed: number;
    inserted: number;
    skipped: number;
  };
  receipts: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
}> {
  const emptyResult = {
    onlineConnected: false,
    lastError: null as string | null,
    clients: {
      total: 0,
      inserted: 0,
      updated: 0,
    },
    invoices: {
      total: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    invoiceItems: {
      total: 0,
      invoicesProcessed: 0,
      inserted: 0,
      skipped: 0,
    },
    receipts: {
      total: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
  };

  if (!sqlite) {
    return {
      ...emptyResult,
      lastError: "SQLite database is unavailable",
    };
  }

  const connectionString = getOnlineConnectionString();

  if (!connectionString) {
    return {
      ...emptyResult,
      lastError: "Online database connection string is not configured",
    };
  }

  let client: any = null;

  try {
    client = await createOnlineClient(connectionString);

    console.log("[SYNC][PULL] Online database connection: Connected");

    const clientsResult =
      await pullClientsFromOnline(client);

    const invoicesResult =
      await pullInvoicesFromOnline(
        client,
        clientsResult.clientIdMap
      );

    const invoiceItemsResult =
      await pullInvoiceItemsFromOnline(
        client,
        invoicesResult.invoiceIdMap,
        invoicesResult.invoiceIdsAllowedForItemPull
      );

    const receiptsResult =
      await pullReceiptsFromOnline(
        client,
        clientsResult.clientIdMap,
        invoicesResult.invoiceIdMap
      );

    console.log("[SYNC][PULL][DONE]", {
      clients: clientsResult,
      invoices: {
        total: invoicesResult.total,
        inserted: invoicesResult.inserted,
        updated: invoicesResult.updated,
        skipped: invoicesResult.skipped,
      },
      invoiceItems: invoiceItemsResult,
      receipts: receiptsResult,
    });

    return {
      onlineConnected: true,
      lastError: null,
      clients: {
        total: clientsResult.total,
        inserted: clientsResult.inserted,
        updated: clientsResult.updated,
      },
      invoices: {
        total: invoicesResult.total,
        inserted: invoicesResult.inserted,
        updated: invoicesResult.updated,
        skipped: invoicesResult.skipped,
      },
      invoiceItems: invoiceItemsResult,
      receipts: receiptsResult,
    };
  } catch (err) {
    const lastError = errorMessage(err);

    console.error("[SYNC][PULL][ERROR]", err);

    return {
      ...emptyResult,
      lastError,
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore connection close errors.
      }
    }
  }
}

// A template has no invoice dependency. Copy missing templates before clients.
// Match on description because local numeric IDs are not shared across devices.
async function syncTemplatesBeforeQueue(client: any) {
  for (const template of getLocalTemplates() || []) {
    const description = String(template.description || "").trim();
    if (!description) throw new Error(`Local template ${template.id} has no description`);
    const existing = await client.query(
      "SELECT id FROM invoice_item_templates WHERE lower(trim(description)) = $1 LIMIT 1",
      [normalizeText(description)]
    ) as { rows?: Array<{ id: number }> };

    if (existing.rows?.length) continue;
    await client.query(
      `INSERT INTO invoice_item_templates (description, default_unit_price, created_at)
       VALUES ($1, $2, $3)`,
      [description, Number(template.defaultUnitPrice ?? 0), toPgTimestamp(template.createdAt) ?? new Date()]
    );
  }
}

// Every invoice and receipt refers to a client, so create missing clients first.
// PostgreSQL IDENTITY generates the online ID; later references resolve it by
// the same business-field matching already used by this worker.
async function syncClientsBeforeQueue(client: any) {
  for (const localClient of getLocalClients() || []) {
    const name = String(localClient.name || "").trim();
    if (!name) throw new Error(`Local client ${localClient.id} has no name`);
    if (await findOnlineClientId(client, localClient)) continue;
    await client.query(
      `INSERT INTO clients (name, email, phone, address, tax_id, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [name, localClient.email, localClient.phone, localClient.address,
       localClient.taxId, localClient.notes,
       toPgTimestamp(localClient.createdAt) ?? new Date(),
       toPgTimestamp(localClient.updatedAt) ?? new Date()]
    );
  }
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

async function getOnlineReceiptId(client: any, receiptNumber: string, localReceipt?: LocalReceiptRow | null) {
  let result: { rows?: Array<{ id: number }> };
  if (localReceipt) {
    const mapping = await resolveReceiptOnlineMapping(client, localReceipt);
    result = await client.query(
      `SELECT id FROM receipts WHERE client_id = $1
         AND invoice_id IS NOT DISTINCT FROM $2 AND amount = $3 LIMIT 2`,
      [mapping.onlineClientId, mapping.onlineInvoiceId, Number(localReceipt.amount ?? 0)]
    );
  } else {
    result = await client.query(
      `SELECT id FROM receipts WHERE receipt_number = $1 LIMIT 2`,
      [String(receiptNumber || "")]
    );
  }
  if ((result.rows?.length ?? 0) > 1) {
    throw new Error(`Ambiguous online receipt for accounting: ${receiptNumber}`);
  }
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

async function resolveOnlineUserId(
  client: any,
  localUserId: number | null | undefined
): Promise<number | null> {
  if (!localUserId) return null;

  const localUser = getLocalUser(localUserId);
  if (!localUser) {
    throw new Error(`Local user not found for userId: ${localUserId}`);
  }

  const username = String(localUser.username || "").trim();
  if (!username) {
    throw new Error(`Local user has no username for userId: ${localUserId}`);
  }

  const existing = await client.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
      LIMIT 2
    `,
    [username]
  ) as { rows?: Array<{ id: number }> };

  if ((existing.rows?.length ?? 0) > 1) {
    throw new Error(`Ambiguous online user match for username: ${username}`);
  }

  if (existing.rows?.[0]?.id) {
    return Number(existing.rows[0].id);
  }

  const inserted = await client.query(
    `
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        display_name_ar,
        display_name_en,
        role,
        email,
        phone,
        receiver_signature_base64,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `,
    [
      username,
      localUser.passwordHash,
      localUser.displayName,
      localUser.displayNameAr ?? null,
      localUser.displayNameEn ?? null,
      localUser.role || "user",
      localUser.email ?? null,
      localUser.phone ?? null,
      localUser.receiverSignatureBase64 ?? null,
      toPgTimestamp(localUser.createdAt) ?? new Date(),
    ]
  ) as { rows?: Array<{ id: number }> };

  const onlineUserId = inserted.rows?.[0]?.id;
  if (!onlineUserId) {
    throw new Error(`Failed to create online user for username: ${username}`);
  }

  return Number(onlineUserId);
}

async function pushReceipt(client: any, receipt: LocalReceiptRow, operation: string, stats: SyncRunStats) {
  logReceiptSync(operation, receipt);
  const mapping = await resolveReceiptOnlineMapping(client, receipt);
  const onlineCreatedBy = await resolveOnlineUserId(client, receipt.createdBy);
  const amount = Number(receipt.amount ?? 0);
  // A receipt number can repeat. The accounting identity requested here is
  // client + invoice (including a null invoice) + amount.
  const existing = await client.query(
    `SELECT id, receipt_number, deleted_at FROM receipts
     WHERE client_id = $1 AND invoice_id IS NOT DISTINCT FROM $2
       AND amount = $3
     ORDER BY id LIMIT 2`,
    [mapping.onlineClientId, mapping.onlineInvoiceId, amount]
  ) as { rows?: Array<{ id: number; receipt_number: string; deleted_at: unknown }> };
  if ((existing.rows?.length ?? 0) > 1) {
    throw new Error(`Ambiguous online receipt match for local receiptId: ${receipt.id}`);
  }
  const row = existing.rows?.[0];
  if (row) {
    await autoRestoreOnlineReceiptIfNeeded(client, row, receipt, stats);
    await client.query(
      `UPDATE receipts SET receipt_number = $1, client_id = $2,
        invoice_id = $3, amount = $4, payment_method = $5,
        status = $6, notes = $7, receipt_date = $8,
        created_by = $9 WHERE id = $10`,
      [
        String(receipt.receiptNumber || ""),
        mapping.onlineClientId,
        mapping.onlineInvoiceId,
        amount,
        String(receipt.paymentMethod || "cash"),
        String(receipt.status || "draft"),
        receipt.notes ?? null,
        String(receipt.receiptDate || todayIsoDate()),
        onlineCreatedBy,
        Number(row.id),
      ]
    );
    return;
  }
  await client.query(
    `INSERT INTO receipts (
      receipt_number, client_id, invoice_id, amount,
      payment_method, status, notes, receipt_date, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      String(receipt.receiptNumber || ""),
      mapping.onlineClientId,
      mapping.onlineInvoiceId,
      amount,
      String(receipt.paymentMethod || "cash"),
      String(receipt.status || "draft"),
      receipt.notes ?? null,
      String(receipt.receiptDate || todayIsoDate()),
      onlineCreatedBy,
      toPgTimestamp(receipt.createdAt) ?? new Date()
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
    onlineReceiptId = await getOnlineReceiptId(client, receiptNumber, localReceipt);

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
        ORDER BY CASE entity_type
          WHEN 'invoice' THEN 0
          WHEN 'receipt' THEN 1
          WHEN 'accounting' THEN 2
          WHEN 'customer_ledger' THEN 2
          ELSE 3 END, created_at ASC, id ASC
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
      try {
        // A failed prerequisite keeps the queue untouched so it can be retried.
        await syncTemplatesBeforeQueue(client);
        await syncClientsBeforeQueue(client);
      } catch (err) {
        lastError = errorMessage(err);
        console.error("[SYNC][PREREQUISITES][ERROR]", err);
        return { pendingCount: pending.length, processedCount: 0, onlineConnected: true,
          lastError, autoRestoredCount: stats.autoRestoredCount };
      }
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
