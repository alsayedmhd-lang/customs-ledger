-- Preserve historical SQLite records whose invoices or receipts were deleted.
-- Run once in the empty ledgerServer database in pgAdmin.
BEGIN;

ALTER TABLE public.invoice_accounting
  DROP CONSTRAINT IF EXISTS invoice_accounting_invoice_id_fkey;
ALTER TABLE public.customer_ledger
  DROP CONSTRAINT IF EXISTS customer_ledger_invoice_id_fkey,
  DROP CONSTRAINT IF EXISTS customer_ledger_receipt_id_fkey;
ALTER TABLE public.invoice_audit_logs
  DROP CONSTRAINT IF EXISTS invoice_audit_logs_invoice_id_fkey;

COMMIT;
