import {assertReceipt,assertRecord,recordWhere,requireRecord} from './record-access.mjs';
import {randomUUID} from 'node:crypto';
import {trashAllowed} from './trash.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
async function schema(db){
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_document_sync_changes (
 entity_type text NOT NULL,entity_id integer NOT NULL,operation text NOT NULL,change_id text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(entity_type,entity_id))`);
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_remote_trash_events (
 event_id text PRIMARY KEY,kind text NOT NULL,record_id integer NOT NULL,operation text NOT NULL,
 created_by integer NOT NULL,previous_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
}
async function permanentSchema(db){
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_remote_permanent_deletions (
 kind text NOT NULL,record_id integer NOT NULL,number text NOT NULL,sync_id text,
 client_id integer,invoice_number text,amount numeric,created_by integer NOT NULL,
 deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(kind,record_id))`);
 await db.query(`CREATE OR REPLACE FUNCTION ledger_remote_block_permanent_recreation() RETURNS trigger LANGUAGE plpgsql AS $body$
 DECLARE identity text; linked_number text;
 BEGIN
 identity:=to_jsonb(NEW)->>'sync_id';
 IF TG_TABLE_NAME='invoices' THEN
 IF EXISTS(SELECT 1 FROM ledger_remote_permanent_deletions d WHERE d.kind='invoice' AND
 ((identity IS NOT NULL AND d.sync_id=identity) OR d.number=NEW.invoice_number)) THEN
 RAISE EXCEPTION 'PERMANENTLY_DELETED_INVOICE' USING ERRCODE='23514'; END IF;
 ELSE
 SELECT invoice_number INTO linked_number FROM invoices WHERE id=NEW.invoice_id;
 IF EXISTS(SELECT 1 FROM ledger_remote_permanent_deletions d WHERE d.kind='receipt' AND
 ((identity IS NOT NULL AND d.sync_id=identity) OR
 ((identity IS NULL OR d.sync_id IS NULL) AND d.number=NEW.receipt_number AND d.client_id=NEW.client_id
 AND d.invoice_number IS NOT DISTINCT FROM linked_number AND d.amount=NEW.amount))) THEN
 RAISE EXCEPTION 'PERMANENTLY_DELETED_RECEIPT' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
 END $body$`);
 // Guard INSERT and identity edits from every writer, including older Desktop versions.
 await db.query('DROP TRIGGER IF EXISTS ledger_remote_permanent_guard ON invoices');
 await db.query('CREATE TRIGGER ledger_remote_permanent_guard BEFORE INSERT OR UPDATE OF invoice_number,sync_id ON invoices FOR EACH ROW EXECUTE FUNCTION ledger_remote_block_permanent_recreation()');
 await db.query('DROP TRIGGER IF EXISTS ledger_remote_permanent_guard ON receipts');
 await db.query('CREATE TRIGGER ledger_remote_permanent_guard BEFORE INSERT OR UPDATE OF receipt_number,sync_id,client_id,invoice_id,amount ON receipts FOR EACH ROW EXECUTE FUNCTION ledger_remote_block_permanent_recreation()');
}
export async function changeTrash(pool,input,user,enabled){
 if(!enabled)throw fail(409,'الحفظ غير مفعّل / Writes disabled');
 const kind=input?.kind,action=input?.action,id=Number(input?.id);
 if(!['invoice','receipt'].includes(kind)||!['restore','purge'].includes(action)||!Number.isSafeInteger(id)||id<=0||typeof input?.number!=='string'||!input.number)throw fail(400,'Invalid trash action');
 if(!trashAllowed(user,kind))throw fail(403,'Access denied');
 const table=kind==='invoice'?'invoices':'receipts',number=kind==='invoice'?'invoice_number':'receipt_number';
 const db=await pool.connect();try{
 await db.query('BEGIN READ WRITE');await schema(db);if(action==='purge')await permanentSchema(db);
 const account=(await db.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
 if(!account?.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!trashAllowed({...account,remotePages:user.remotePages},kind))throw fail(403,'Access denied');
 let parent=null;
 if(kind==='receipt'){
 const initial=(await db.query('SELECT id,invoice_id FROM receipts WHERE id=$1',[id])).rows[0];
 if(initial?.invoice_id)parent=(await db.query('SELECT id,invoice_number,status,deleted_at FROM invoices WHERE id=$1 FOR UPDATE',[initial.invoice_id])).rows[0];
 }
 const row=(await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
 if(!row){if(action==='purge'){
 const prior=(await db.query('SELECT number FROM ledger_remote_permanent_deletions WHERE kind=$1 AND record_id=$2',[kind,id])).rows[0];
 if(prior?.number===input.number){await db.query('COMMIT');return {id,replayed:true};}}
 throw fail(404,'المستند غير موجود / Document not found');}
 if(kind==='receipt')await assertReceipt(db,user,row);else assertRecord(user,row);if(row[number]!==input.number)throw fail(409,'تغير المستند؛ حدّث السلة / Document changed; refresh');
 if(!row.deleted_at)throw fail(409,'المستند خارج السلة؛ حدّث الصفحة / Document is no longer in trash');
 if(kind==='receipt'&&row.invoice_id&&(!parent||Number(parent.id)!==Number(row.invoice_id)))throw fail(409,'Linked invoice changed; refresh');
 if(action==='restore'){
 if(kind==='receipt'&&row.invoice_id&&(parent.deleted_at||parent.status==='cancelled'))throw fail(409,'استعد الفاتورة أولًا / Restore the invoice first');
 await db.query(`UPDATE ${table} SET deleted_at=NULL,status='draft'${kind==='invoice'?',updated_at=clock_timestamp()':''} WHERE id=$1`,[id]);
 }else{
 if(kind==='invoice'&&(await db.query('SELECT id FROM receipts WHERE invoice_id=$1 LIMIT 1',[id])).rows.length)throw fail(409,'احذف السندات المرتبطة نهائيًا أولًا / Permanently delete linked receipts first');
 await db.query(`INSERT INTO ledger_remote_permanent_deletions(kind,record_id,number,sync_id,client_id,invoice_number,amount,created_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(kind,record_id) DO NOTHING`,[kind,id,row[number],row.sync_id||null,row.client_id,kind==='receipt'?parent?.invoice_number||null:row.invoice_number,kind==='receipt'?row.amount:null,user.id]);
 const drafts=kind==='invoice'?'ledger_remote_invoice_drafts':'ledger_remote_receipt_drafts';
 if((await db.query('SELECT to_regclass($1) AS drafts',['public.'+drafts])).rows[0]?.drafts)await db.query(`DELETE FROM ${drafts} WHERE ${number}=$1 AND ($2::text IS NULL OR sync_id::text=$2)`,[row[number],row.sync_id||null]);
 if(kind==='invoice')await db.query('DELETE FROM invoice_items WHERE invoice_id=$1',[id]);
 await db.query(`DELETE FROM ${table} WHERE id=$1`,[id]);
 }
 const changeId=randomUUID();
 await db.query(`INSERT INTO ledger_document_sync_changes(entity_type,entity_id,operation,change_id)
 VALUES($1,$2,$3,$4) ON CONFLICT(entity_type,entity_id) DO UPDATE SET operation=excluded.operation,change_id=excluded.change_id,changed_at=clock_timestamp()`,[kind,id,action==='restore'?'restore':'delete',changeId]);
 await db.query('INSERT INTO ledger_remote_trash_events(event_id,kind,record_id,operation,created_by,previous_state) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[changeId,kind,id,action,user.id,JSON.stringify(row)]);
 await db.query('COMMIT');return {id,status:action==='restore'?'draft':null,action,replayed:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23503')throw fail(409,'يوجد ارتباط آخر يمنع الحذف النهائي / Other linked records prevent permanent deletion');throw e;}finally{db.release();}
}
