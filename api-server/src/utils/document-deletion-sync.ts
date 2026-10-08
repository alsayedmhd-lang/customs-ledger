import { refreshAndQueueInvoicePaymentStatus } from "./invoice-payment-state";
import { randomUUID } from "node:crypto";
import { sqlite } from "@workspace/db";
import { ensureSyncQueueTable } from "./ensure-sync-queue-table";

type Kind = "invoice" | "receipt";
type Change = { kind: Kind; operation: "delete" | "restore"; document: any; invoice: any; changedAt: number; changeId: string; userId: unknown };
const tableFor = (kind: Kind) => kind === "invoice" ? "invoices" : "receipts";
const numberFor = (kind: Kind) => kind === "invoice" ? "invoice_number" : "receipt_number";

const ensuredDatabases = new WeakSet<object>();
function ensureState() {
  if (!sqlite) throw new Error("SQLite unavailable for deletion sync");
  if (ensuredDatabases.has(sqlite)) return;
  ensureSyncQueueTable();
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ledger_document_deletion_state (
    entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, document_number TEXT NOT NULL,
    sync_id TEXT, operation TEXT NOT NULL, payload_json TEXT NOT NULL, queue_id INTEGER,
    PRIMARY KEY(entity_type, entity_id)
  );
  CREATE INDEX IF NOT EXISTS ledger_document_deletion_identity
    ON ledger_document_deletion_state(entity_type, document_number);`);
  ensuredDatabases.add(sqlite);
}
function state(kind: Kind, id: number) {
  return sqlite!.prepare("SELECT * FROM ledger_document_deletion_state WHERE entity_type=? AND entity_id=?").get(kind, id) as any;
}
function snapshot(kind: Kind, id: number) {
  return sqlite!.prepare(`SELECT * FROM ${tableFor(kind)} WHERE id=?`).get(id) as any;
}
function remember(change: Change, queueId: number | null) {
  sqlite!.prepare(`INSERT INTO ledger_document_deletion_state
    (entity_type,entity_id,document_number,sync_id,operation,payload_json,queue_id) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(entity_type,entity_id) DO UPDATE SET document_number=excluded.document_number,
      sync_id=excluded.sync_id,operation=excluded.operation,payload_json=excluded.payload_json,queue_id=excluded.queue_id`)
    .run(change.kind, change.document.id, change.document[numberFor(change.kind)], change.document.sync_id || null,
      change.operation, JSON.stringify(change), queueId);
}
function linkedInvoice(kind: Kind, document: any) {
  if (kind !== "receipt" || document.invoice_id == null) return null;
  return snapshot("invoice", Number(document.invoice_id)) ||
    JSON.parse(state("invoice", Number(document.invoice_id))?.payload_json || "null")?.document || null;
}

// Record the local change and queue its complete identity in the same SQLite transaction.
export function changeDocumentDeletion(kind: Kind, id: number, restore = false, userId: unknown = null) {
  ensureState();
  return sqlite!.transaction(() => {
    const before = snapshot(kind, id);
    if (!before || (restore && before.deleted_at == null)) return false;
    if (restore && kind === "receipt" && before.invoice_id != null) {
      const parent = snapshot("invoice", Number(before.invoice_id));
      if (!parent || parent.deleted_at != null) throw new Error("RESTORE_INVOICE_FIRST");
    }
    if (!restore && kind === "invoice") {
      const receipts = sqlite!.prepare("SELECT id FROM receipts WHERE invoice_id=? AND deleted_at IS NULL ORDER BY id").all(id) as any[];
      for (const receipt of receipts) changeDocumentDeletion("receipt", Number(receipt.id), false, userId);
    }
    const now = Date.now();
    const deletedAt = restore ? null : before.deleted_at ?? now;
    sqlite!.prepare(`UPDATE ${tableFor(kind)} SET deleted_at=?,status=?${kind === "invoice" ? ",updated_at=?" : ""} WHERE id=?`)
      .run(...(kind === "invoice" ? [deletedAt, restore ? "draft" : "cancelled", now, id] : [deletedAt, restore ? "draft" : "cancelled", id]));
    // Remove accounting effects in the same transaction as the cancellation and queue.
    if (sqlite!.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='customer_ledger'").get()) {
      sqlite!.prepare(kind === "invoice" ? "DELETE FROM customer_ledger WHERE invoice_id=?" : "DELETE FROM customer_ledger WHERE receipt_id=?").run(id);
    }
    if (kind === "receipt" && before.invoice_id != null) {
      refreshAndQueueInvoicePaymentStatus(Number(before.invoice_id));
    }
    const document = snapshot(kind, id);
    const change: Change = { kind, operation: restore ? "restore" : "delete", document,
      invoice: linkedInvoice(kind, document), changedAt: now, changeId: randomUUID(), userId };
    const queued = sqlite!.prepare(`INSERT INTO sync_queue
      (entity_type,entity_id,operation,payload_json,status,retry_count,created_at,updated_at)
      VALUES(?,?,?,?,'pending',0,?,?)`).run(kind, String(id), change.operation, JSON.stringify(change), now, now);
    remember(change, Number(queued.lastInsertRowid));
    return true;
  })();
}

export function permanentlyDeleteDocument(kind: Kind, id: number, userId: unknown = null) {
  ensureState();
  return sqlite!.transaction(() => {
    const document = snapshot(kind, id);
    if (!document) return false;
    if (document.deleted_at == null) throw new Error("Document must be in trash before permanent deletion");
    changeDocumentDeletion(kind, id, false, userId);
    if (kind === "invoice") {
      // Include receipts already in trash: preserve each deletion identity before removal.
      const linked = sqlite!.prepare("SELECT id FROM receipts WHERE invoice_id=? ORDER BY id").all(id) as any[];
      for (const receipt of linked) {
        permanentlyDeleteDocument("receipt", Number(receipt.id), userId);
      }
      sqlite!.prepare("DELETE FROM invoice_items WHERE invoice_id=?").run(id);
    }
    sqlite!.prepare(`DELETE FROM ${tableFor(kind)} WHERE id=?`).run(id);
    return true;
  })();
}

// Recover deletion intents made before this fix, without requeuing completed tombstones.
export function queueUntrackedDocumentDeletions() {
  ensureState();
  for (const kind of ["invoice", "receipt"] as Kind[]) {
    const rows = sqlite!.prepare(`SELECT id,status FROM ${tableFor(kind)} WHERE deleted_at IS NOT NULL`).all() as any[];
    for (const row of rows) if (!state(kind, Number(row.id)) || row.status !== "cancelled") changeDocumentDeletion(kind, Number(row.id));
  }
}

export function currentDocumentDeletion(kind: Kind, id: number): Change | null {
  ensureState();
  const saved = state(kind, id);
  if (!saved) return null;
  if (saved.operation === "restore") {
    const queue = sqlite!.prepare("SELECT status FROM sync_queue WHERE id=?").get(saved.queue_id) as any;
    if (saved.queue_id == null || queue?.status === "synced") return null;
  }
  return JSON.parse(saved.payload_json) as Change;
}

export async function readDocumentRestoreMarkers(client: any, kind: Kind) {
  const present = await client.query("SELECT to_regclass('public.ledger_document_sync_changes') AS changes");
  if (!present.rows[0]?.changes) return new Map<number, any>();
  const result = await client.query("SELECT entity_id,operation,change_id FROM ledger_document_sync_changes WHERE entity_type=$1", [kind]);
  return new Map<number, any>(result.rows.map((row: any) => [Number(row.entity_id), row]));
}

export function blocksDocumentPull(kind: Kind, online: any, localId?: number | null, localClientId?: number, localInvoiceId?: number | null, marker?: any) {
  ensureState();
  if (localId && sqlite!.prepare("SELECT 1 FROM sync_queue WHERE entity_type=? AND entity_id=? AND status IN ('pending','failed') LIMIT 1").get(kind, String(localId))) return true;
  if (localId && online.deleted_at != null) {
    acceptOnlineDocumentDeletion(kind, localId, online.deleted_at);
    return true;
  }
  if (localId && (kind === "receipt" ? online.status !== "issued" : !["issued", "paid"].includes(online.status)) &&
      sqlite!.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='customer_ledger'").get()) {
    sqlite!.prepare(kind === "invoice" ? "DELETE FROM customer_ledger WHERE invoice_id=?" : "DELETE FROM customer_ledger WHERE receipt_id=?").run(localId);
  }
  const canRestore = (saved: any) => {
    if (!saved || saved.operation !== "delete" || online.deleted_at != null || marker?.operation !== "restore") return false;
    const queued = saved.queue_id == null ? null : sqlite!.prepare("SELECT status FROM sync_queue WHERE id=?").get(saved.queue_id) as any;
    if (queued && queued.status !== "synced") return false;
    const old = JSON.parse(saved.payload_json) as Change;
    if (old.changeId === marker.change_id) return false;
    const document = { ...old.document, deleted_at: null, status: "draft" };
    sqlite!.transaction(() => {
      if (snapshot(kind, Number(document.id))) sqlite!.prepare(`UPDATE ${tableFor(kind)} SET deleted_at=NULL,status='draft' WHERE id=?`).run(Number(document.id));
      remember({ ...old, operation: "restore", document, changeId: marker.change_id }, null);
    })();
    return true;
  };
  if (localId) {
    const saved = state(kind, localId);
    const explicitlyRestored = canRestore(saved);
    if (!explicitlyRestored && (snapshot(kind, localId)?.deleted_at != null || saved?.operation === "delete")) return true;
  }
  const matches = sqlite!.prepare("SELECT * FROM ledger_document_deletion_state WHERE entity_type=? AND operation='delete' AND document_number=?").all(kind, online[numberFor(kind)]) as any[];
  return matches.some(saved => {
    const d = (JSON.parse(saved.payload_json) as Change).document;
    let matchesIdentity: boolean;
    if (d.created_source === "web" || online.created_source === "web") matchesIdentity = !!d.sync_id && d.sync_id === online.sync_id;
    else if (kind === "invoice") matchesIdentity = localClientId == null || Number(d.client_id) === localClientId;
    else matchesIdentity = Number(d.client_id) === localClientId && Number(d.amount) === Number(online.amount) &&
      (d.invoice_id == null ? localInvoiceId == null : Number(d.invoice_id) === localInvoiceId);
    return matchesIdentity && !canRestore(saved);
  });
}

// An ordinary update from another device must never undo an Online tombstone.
export function acceptOnlineDocumentDeletion(kind: Kind, id: number, deletedAt: unknown) {
  ensureState();
  sqlite!.transaction(() => {
    const before = snapshot(kind, id); if (!before) return;
    const parsed = new Date(deletedAt as string).getTime();
    const timestamp = Number.isFinite(parsed) ? parsed : Date.now();
    sqlite!.prepare(`UPDATE ${tableFor(kind)} SET deleted_at=?,status='cancelled' WHERE id=?`).run(timestamp, id);
    const document = snapshot(kind, id);
    if (sqlite!.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='customer_ledger'").get()) {
      sqlite!.prepare(kind === "invoice" ? "DELETE FROM customer_ledger WHERE invoice_id=?" : "DELETE FROM customer_ledger WHERE receipt_id=?").run(id);
    }
    remember({ kind, operation: "delete", document, invoice: linkedInvoice(kind, document), changedAt: timestamp, changeId: randomUUID(), userId: null }, null);
  })();
}

async function onlineInvoice(client: any, invoice: any) {
  const web = invoice.created_source === "web" || String(invoice.invoice_number).startsWith("INV-W-");
  if (web && !invoice.sync_id) throw new Error("WEB_DELETE_IDENTITY_MISSING: invoice");
  const result = await client.query(`SELECT id,deleted_at FROM invoices WHERE invoice_number=$1 AND
    ${web ? "to_jsonb(invoices)->>'sync_id'=$2 AND to_jsonb(invoices)->>'created_source'='web'" : "COALESCE(to_jsonb(invoices)->>'created_source','desktop')<>'web'"}
    LIMIT 2 FOR UPDATE`, web ? [invoice.invoice_number, invoice.sync_id] : [invoice.invoice_number]);
  if (result.rows.length > 1) throw new Error("Ambiguous invoice deletion identity");
  return result.rows[0] || null;
}

export async function pushDocumentDeletion(client: any, change: Change, resolveClientId: (client: any, id: number) => Promise<number>) {
  const { kind, document } = change;
  if (!["invoice", "receipt"].includes(kind) || !["delete", "restore"].includes(change.operation) || !document?.[numberFor(kind)]) throw new Error("Invalid deletion identity");
  await client.query("BEGIN");
  try {
    let row: any;
    if (kind === "invoice") row = await onlineInvoice(client, document);
    else {
      const web = document.created_source === "web" || String(document.receipt_number).startsWith("REC-W-");
      if (web) {
        if (!document.sync_id) throw new Error("WEB_DELETE_IDENTITY_MISSING: receipt");
        const initial = await client.query("SELECT id,invoice_id,deleted_at FROM receipts WHERE receipt_number=$1 AND to_jsonb(receipts)->>'sync_id'=$2 AND to_jsonb(receipts)->>'created_source'='web' LIMIT 2", [document.receipt_number, document.sync_id]);
        if (initial.rows.length > 1) throw new Error("Ambiguous receipt deletion identity");
        const parentId = initial.rows[0]?.invoice_id;
        if (parentId != null) await client.query("SELECT id FROM invoices WHERE id=$1 FOR UPDATE", [Number(parentId)]);
        const result = await client.query("SELECT id,invoice_id,deleted_at FROM receipts WHERE receipt_number=$1 AND to_jsonb(receipts)->>'sync_id'=$2 AND to_jsonb(receipts)->>'created_source'='web' LIMIT 2 FOR UPDATE", [document.receipt_number, document.sync_id]);
        if (result.rows[0] && String(result.rows[0].invoice_id ?? "") !== String(parentId ?? "")) throw new Error("Receipt changed during deletion; retry");
        if (result.rows.length > 1) throw new Error("Ambiguous receipt deletion identity");
        row = result.rows[0];
      } else {
        const clientId = await resolveClientId(client, Number(document.client_id));
        let invoiceId: number | null = null;
        if (document.invoice_id != null) {
          if (!change.invoice) throw new Error("Linked invoice deletion identity missing");
          const invoice = await onlineInvoice(client, change.invoice);
          if (!invoice) throw new Error("Linked Online invoice not found for receipt deletion");
          invoiceId = Number(invoice.id);
        }
        const result = await client.query(`SELECT id,invoice_id,deleted_at FROM receipts WHERE receipt_number=$1
          AND client_id=$2 AND invoice_id IS NOT DISTINCT FROM $3 AND amount=$4
          AND COALESCE(to_jsonb(receipts)->>'created_source','desktop')<>'web' LIMIT 2 FOR UPDATE`,
          [document.receipt_number, clientId, invoiceId, Number(document.amount)]);
        if (result.rows.length > 1) throw new Error("Ambiguous receipt deletion identity");
        row = result.rows[0];
        if (!row) {
          // An unsent local amount/invoice edit may differ from the Online snapshot.
          // Fall back only when this number identifies exactly one receipt for the mapped client.
          const numbered = await client.query(`SELECT id,invoice_id,deleted_at FROM receipts WHERE receipt_number=$1
            AND client_id=$2 AND COALESCE(to_jsonb(receipts)->>'created_source','desktop')<>'web' LIMIT 2 FOR UPDATE`,
            [document.receipt_number, clientId]);
          if (numbered.rows.length > 1) throw new Error("Ambiguous receipt deletion number");
          row = numbered.rows[0];
          if (row?.invoice_id != null && Number(row.invoice_id) !== invoiceId) {
            await client.query("SELECT id FROM invoices WHERE id=$1 FOR UPDATE", [Number(row.invoice_id)]);
          }
        }
      }
    }
    if (!row) {
      if (change.operation === "restore") throw new Error("Online document not found for explicit restore");
      // A never-uploaded or already-removed document is not recreated just to delete it.
      await client.query("COMMIT"); return { changed: false, restored: false };
    }
    await client.query(`CREATE TABLE IF NOT EXISTS ledger_document_sync_changes (
      entity_type text NOT NULL,entity_id integer NOT NULL,operation text NOT NULL,
      change_id text NOT NULL,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY(entity_type,entity_id)
    )`);
    const deletedAt = change.operation === "restore" ? null : new Date(Number(document.deleted_at ?? change.changedAt));
    if (change.operation === "restore" && kind === "receipt" && row.invoice_id != null) {
      const parent = await client.query("SELECT id,deleted_at FROM invoices WHERE id=$1 FOR UPDATE", [Number(row.invoice_id)]);
      if (!parent.rows[0] || parent.rows[0].deleted_at != null) throw new Error("RESTORE_INVOICE_FIRST");
    }
    if (change.operation === "delete" && kind === "invoice") {
      // Include Online receipts created on another device since the last pull.
      const linked = await client.query("UPDATE receipts SET deleted_at=COALESCE(deleted_at,$1),status='cancelled' WHERE invoice_id=$2 RETURNING id", [deletedAt, Number(row.id)]);
      for (const receipt of linked.rows) await client.query(`INSERT INTO ledger_document_sync_changes(entity_type,entity_id,operation,change_id)
        VALUES('receipt',$1,'delete',$2) ON CONFLICT(entity_type,entity_id) DO UPDATE SET operation='delete',change_id=excluded.change_id,changed_at=clock_timestamp()`, [Number(receipt.id), change.changeId]);
    }
    await client.query(`UPDATE ${tableFor(kind)} SET deleted_at=$1,status=$3${kind === "invoice" ? ",updated_at=clock_timestamp()" : ""} WHERE id=$2`, [deletedAt, Number(row.id), change.operation === "restore" ? "draft" : "cancelled"]);
    if (kind === "receipt" && row.invoice_id != null) {
      await client.query(`UPDATE invoices SET status=CASE WHEN COALESCE(advance_payment,0)+
        COALESCE((SELECT SUM(amount) FROM receipts WHERE invoice_id=invoices.id AND status='issued' AND deleted_at IS NULL),0)
        >=CASE WHEN COALESCE(subtotal,0)+COALESCE(tax_amount,0)>0 THEN COALESCE(subtotal,0)+COALESCE(tax_amount,0) ELSE COALESCE(total,0)+COALESCE(advance_payment,0) END
        THEN 'paid' ELSE 'issued' END,updated_at=clock_timestamp()
        WHERE id=$1 AND deleted_at IS NULL AND status IN ('issued','paid')`, [Number(row.invoice_id)]);
    }
    await client.query(`INSERT INTO ledger_document_sync_changes(entity_type,entity_id,operation,change_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(entity_type,entity_id) DO UPDATE SET operation=excluded.operation,
      change_id=excluded.change_id,changed_at=clock_timestamp()`, [kind, Number(row.id), change.operation, change.changeId]);
    await client.query("COMMIT"); return { changed: true, restored: change.operation === "restore" };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}
