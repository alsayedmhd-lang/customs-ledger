BEGIN;
CREATE TABLE IF NOT EXISTS ledger_remote_counters(kind text NOT NULL, year integer NOT NULL, last_number bigint NOT NULL DEFAULT 0, PRIMARY KEY(kind,year));
CREATE TABLE IF NOT EXISTS ledger_remote_invoice_drafts(
 sync_id uuid PRIMARY KEY,
 invoice_number text NOT NULL UNIQUE,
 client_id integer NOT NULL REFERENCES clients(id),
 created_by integer NOT NULL REFERENCES users(id),
 request_hash text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 CONSTRAINT ledger_remote_draft_status CHECK(payload->>'status'='draft'),
 CONSTRAINT ledger_remote_draft_source CHECK(payload->>'source'='web')
);
CREATE TABLE IF NOT EXISTS ledger_remote_receipt_drafts(
 sync_id uuid PRIMARY KEY,receipt_number text NOT NULL UNIQUE,
 client_id integer NOT NULL REFERENCES clients(id),created_by integer NOT NULL REFERENCES users(id),
 request_hash text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT NOW(),
 CHECK(payload->>'status'='draft'),CHECK(payload->>'source'='web')
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sync_id uuid;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_source text NOT NULL DEFAULT 'desktop';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sync_id uuid;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS created_source text NOT NULL DEFAULT 'desktop';
CREATE UNIQUE INDEX IF NOT EXISTS invoices_web_sync_id_unique ON invoices(sync_id) WHERE sync_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS receipts_web_sync_id_unique ON receipts(sync_id) WHERE sync_id IS NOT NULL;
COMMIT;
