import { sqlite } from "@workspace/db";
import { ensureSyncQueueTable } from "./ensure-sync-queue-table";

// Payment-driven status changes and their sync event must commit together.
export function refreshAndQueueInvoicePaymentStatus(invoiceId: number | null | undefined) {
  if (!invoiceId) return false;
  if (!sqlite) throw new Error("SQLite unavailable for invoice status sync");
  ensureSyncQueueTable();
  return sqlite.transaction(() => {
    const invoice = sqlite!.prepare("SELECT * FROM invoices WHERE id=? AND deleted_at IS NULL").get(invoiceId) as any;
    if (!invoice || !["issued", "paid"].includes(invoice.status)) return false;
    const receipt = sqlite!.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM receipts WHERE invoice_id=? AND status='issued' AND deleted_at IS NULL").get(invoiceId) as {amount:number};
    const gross = Number(invoice.subtotal ?? 0) + Number(invoice.tax_amount ?? 0);
    const total = gross > 0 ? gross : Number(invoice.total ?? 0) + Number(invoice.advance_payment ?? 0);
    const paid = Number(invoice.advance_payment ?? 0) + Number(receipt.amount);
    const nextStatus = paid >= total ? "paid" : "issued";
    if (invoice.status === nextStatus) return false;
    const now = Date.now();
    sqlite!.prepare("UPDATE invoices SET status=?,updated_at=? WHERE id=?").run(nextStatus, now, invoiceId);
    sqlite!.prepare(`INSERT INTO sync_queue(entity_type,entity_id,operation,payload_json,status,retry_count,created_at,updated_at)
      VALUES('invoice',?,'update',?,'pending',0,?,?)`).run(String(invoiceId), JSON.stringify({invoiceId,invoiceNumber:invoice.invoice_number,status:nextStatus,updatedAt:now,reason:"receipt-payment-state"}), now, now);
    return true;
  })();
}
