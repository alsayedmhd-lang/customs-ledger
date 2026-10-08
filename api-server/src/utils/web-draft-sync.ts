import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { sqlite } from "@workspace/db";
import { blocksDocumentPull, readDocumentRestoreMarkers } from "./document-deletion-sync";

export async function ensureWebIdentityColumns() {
  if (!sqlite) throw new Error("SQLite unavailable");
  const db = sqlite;
  const needsMigration = ["invoices", "receipts"].some(table => {
    const columns = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(r => r.name));
    return !columns.has("sync_id") || !columns.has("created_source");
  });
  if (needsMigration) {
    const backupDir = join(dirname(db.name), "backups");
    mkdirSync(backupDir, { recursive: true });
    await db.backup(join(backupDir, `before-web-sync-${Date.now()}.db`));
  }
  for (const table of ["invoices", "receipts"]) {
    const cols = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(r => r.name));
    if (!cols.has("sync_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN sync_id TEXT`);
    if (!cols.has("created_source")) db.exec(`ALTER TABLE ${table} ADD COLUMN created_source TEXT NOT NULL DEFAULT 'desktop'`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_web_sync_id_unique ON ${table}(sync_id) WHERE sync_id IS NOT NULL`);
  }
}
function timestamp(value: any) { return value ? new Date(value).getTime() : Date.now(); }
function identity(table: string, numberColumn: string, row: any) {
  const matches = sqlite!.prepare(`SELECT id,sync_id,created_source FROM ${table} WHERE sync_id=? OR ${numberColumn}=?`).all(row.sync_id, row[numberColumn]) as any[];
  if (matches.length && (matches.length !== 1 || matches[0].sync_id !== row.sync_id || matches[0].created_source !== "web")) throw new Error(`WEB_IDENTITY_CONFLICT: ${row[numberColumn]}`);
  return matches[0]?.id as number | undefined;
}
function pending(kind: string, id: number) {
  return !!sqlite!.prepare("SELECT 1 FROM sync_queue WHERE entity_type=? AND entity_id=? AND status IN ('pending','failed') LIMIT 1").get(kind,String(id));
}
function save(table: string, values: Record<string, any>, id?: number) {
  const keys = Object.keys(values);
  if (id) { sqlite!.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(",")} WHERE id=?`).run(...Object.values(values),id); return id; }
  return Number(sqlite!.prepare(`INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(()=>"?").join(",")})`).run(...Object.values(values)).lastInsertRowid);
}
export async function pullWebInvoices(client: any, clients: Map<number,number>, resolveUser: (client:any,id:any)=>Promise<number|null>) {
  await ensureWebIdentityColumns();
  // to_jsonb keeps older Online installations without added columns compatible.
  const rows = (await client.query("SELECT i.*,to_jsonb(i)->>'sync_id' AS sync_id FROM invoices i WHERE to_jsonb(i)->>'created_source'='web' ORDER BY i.id")).rows as any[];
  const restoreMarkers = await readDocumentRestoreMarkers(client,"invoice");
  const map = new Map<number,number>(); let inserted=0, updated=0, skipped=0;
  for (const row of rows) {
    if (!row.sync_id || !/^INV-W-\d{4}-\d+$/.test(row.invoice_number)) throw new Error("Invalid Web invoice identity");
    const clientId=clients.get(Number(row.client_id)); if(!clientId) {skipped++;continue;}
    const userId=await resolveUser(client,row.created_by);
    const items=(await client.query("SELECT description,quantity,unit_price,total FROM invoice_items WHERE invoice_id=$1 ORDER BY id",[row.id])).rows as any[];
    sqlite!.transaction(()=>{
      const existing=identity("invoices","invoice_number",row);
      if(blocksDocumentPull("invoice",row,existing,clientId,null,restoreMarkers.get(Number(row.id))) || (existing && pending("invoice",existing))) {if(existing)map.set(Number(row.id),existing);skipped++;return;}
      const values:Record<string,any>={invoice_number:row.invoice_number,client_id:clientId,issue_date:row.issue_date,due_date:row.due_date||null,status:row.status||"draft",subtotal:Number(row.subtotal||0),tax_rate:Number(row.tax_rate||0),tax_amount:Number(row.tax_amount||0),total:Number(row.total||0),notes:row.notes||null,shipment_ref:row.shipment_ref||null,bill_of_lading:row.bill_of_lading||null,package_count:row.package_count??null,shipment_weight:row.shipment_weight==null?null:Number(row.shipment_weight),port_of_entry:row.port_of_entry||null,importer_exporter_name:row.importer_exporter_name||null,advance_payment:Number(row.advance_payment||0),created_by:userId,deleted_at:row.deleted_at?timestamp(row.deleted_at):null,created_at:timestamp(row.created_at),updated_at:timestamp(row.updated_at),sync_id:row.sync_id,created_source:"web"};
      const id=save("invoices",values,existing);
      // Atomic replacement: a failed item leaves the complete previous invoice intact.
      sqlite!.prepare("DELETE FROM invoice_items WHERE invoice_id=?").run(id);
      const insert=sqlite!.prepare("INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES(?,?,?,?,?)");
      for(const i of items) insert.run(id,i.description,Number(i.quantity),Number(i.unit_price),Number(i.total));
      map.set(Number(row.id),id); if(existing)updated++;else inserted++;
    })();
  }
  return {map,total:rows.length,inserted,updated,skipped};
}
export async function pullWebReceipts(client:any,clients:Map<number,number>,invoices:Map<number,number>,resolveUser:(client:any,id:any)=>Promise<number|null>) {
  await ensureWebIdentityColumns();
  const rows=(await client.query("SELECT r.*,to_jsonb(r)->>'sync_id' AS sync_id FROM receipts r WHERE to_jsonb(r)->>'created_source'='web' ORDER BY r.id")).rows as any[];
  const restoreMarkers = await readDocumentRestoreMarkers(client,"receipt");
  let inserted=0,updated=0,skipped=0;
  for(const row of rows) {
    if(!row.sync_id || !/^REC-W-\d{4}-\d+$/.test(row.receipt_number))throw new Error("Invalid Web receipt identity");
    const clientId=clients.get(Number(row.client_id));const invoiceId=row.invoice_id==null?null:invoices.get(Number(row.invoice_id));
    if(!clientId || (row.invoice_id!=null&&!invoiceId)){skipped++;continue;}
    const userId=await resolveUser(client,row.created_by);
    sqlite!.transaction(()=>{
      const existing=identity("receipts","receipt_number",row);
      if(blocksDocumentPull("receipt",row,existing,clientId,invoiceId,restoreMarkers.get(Number(row.id))) || (existing&&pending("receipt",existing))){skipped++;return;}
      save("receipts",{receipt_number:row.receipt_number,client_id:clientId,invoice_id:invoiceId,amount:Number(row.amount),payment_method:row.payment_method||"cash",status:row.status||"draft",notes:row.notes||null,receipt_date:row.receipt_date,created_by:userId,deleted_at:row.deleted_at?timestamp(row.deleted_at):null,created_at:timestamp(row.created_at),sync_id:row.sync_id,created_source:"web"},existing);
      if(existing)updated++;else inserted++;
    })();
  }
  return {total:rows.length,inserted,updated,skipped};
}
