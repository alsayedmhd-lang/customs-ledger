import {assertReceipt,assertRecord,recordWhere,requireRecord} from './record-access.mjs';
import {randomUUID} from 'node:crypto';
import {canIssue,gross,invoiceStatus,validateReceiptIssue} from './issue-document.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export const canDeleteInvoice=user=>canIssue(user,'invoice')&&canIssue(user,'receipt');
function identity(value){
 if(/^web:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)))return [null,String(value).slice(4).toLowerCase()];
 const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)throw fail(400,'Invalid invoice');return [id,null];
}
const selectInvoice="SELECT * FROM invoices WHERE (($1::integer IS NOT NULL AND id=$1) OR ($2::text IS NOT NULL AND to_jsonb(invoices)->>'sync_id'=$2))";
export async function readInvoicePayment(pool,id,user,enabled){
 if(!enabled)throw fail(409,'Saving disabled');if(!canIssue(user,'receipt'))throw fail(403,'Access denied');
 const invoice=(await pool.query(selectInvoice+' AND deleted_at IS NULL',identity(id))).rows[0];
 if(!invoice)throw fail(404,'Invoice not found');assertRecord(user,invoice);
 const existing=(await pool.query("SELECT id,created_by,client_id FROM receipts WHERE invoice_id=$1 AND deleted_at IS NULL AND status IN ('draft','issued') ORDER BY id LIMIT 1",[invoice.id])).rows[0];if(existing)await assertReceipt(pool,user,{...existing,invoice_id:invoice.id});
 if(existing)return {existingReceiptId:existing.id};
 if(!['issued','paid'].includes(invoice.status))throw fail(409,'أصدر الفاتورة أولًا / Issue the invoice first');
 const paid=Number((await pool.query("SELECT COALESCE(SUM(amount),0) AS paid FROM receipts WHERE invoice_id=$1 AND status='issued' AND deleted_at IS NULL",[invoice.id])).rows[0]?.paid||0);
 const remaining=Math.max(0,gross(invoice)-Number(invoice.advance_payment||0)-paid);
 if(remaining<=0)throw fail(409,'الفاتورة مسددة بالكامل / Invoice is fully paid');
 return {invoice:{id:invoice.id,client_id:invoice.client_id,invoice_number:invoice.invoice_number,remaining:remaining.toFixed(2)}};
}
export async function completePayment(db,draft){
 const invoice=(await db.query('SELECT * FROM invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[draft.invoiceId])).rows[0];
 if(!invoice)throw fail(409,'Invoice unavailable');
 const paid=Number((await db.query("SELECT COALESCE(SUM(amount),0) AS paid FROM receipts WHERE invoice_id=$1 AND status='issued' AND deleted_at IS NULL",[invoice.id])).rows[0]?.paid||0);
 validateReceiptIssue({amount:draft.amount,client_id:draft.clientId},invoice,paid);
 await db.query("UPDATE receipts SET status='issued' WHERE id=$1 AND status='draft' AND deleted_at IS NULL",[draft.onlineId]);
 await db.query('UPDATE invoices SET status=$1,updated_at=clock_timestamp() WHERE id=$2',[invoiceStatus(invoice,paid+Number(draft.amount)),invoice.id]);
 draft.paymentStatus='issued';
}
export async function deleteInvoice(pool,input,user,enabled){
 if(!enabled)throw fail(409,'Deleting disabled');if(!canDeleteInvoice(user))throw fail(403,'Access denied');
 const ids=identity(input?.id);if(typeof input?.number!=='string'||!input.number)throw fail(400,'Invoice number required');
 const db=await pool.connect();try{
 await db.query('BEGIN READ WRITE');
 const account=(await db.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
 if(!account?.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!canDeleteInvoice(account))throw fail(403,'Access denied');
 const invoice=(await db.query(selectInvoice+' FOR UPDATE',ids)).rows[0];if(!invoice)throw fail(404,'Invoice not found');assertRecord(user,invoice);
 if(invoice.invoice_number!==input.number)throw fail(409,'تغيرت الفاتورة؛ حدّث الصفحة / Invoice changed; refresh');
 if(invoice.deleted_at){await db.query('COMMIT');return {id:invoice.id,replayed:true};}
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_document_sync_changes (
 entity_type text NOT NULL,entity_id integer NOT NULL,operation text NOT NULL,
 change_id text NOT NULL,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(entity_type,entity_id))`);
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_remote_delete_events (
 event_id text PRIMARY KEY,invoice_id integer NOT NULL,created_by integer NOT NULL,
 previous_state jsonb NOT NULL,linked_receipts jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
 const linked=(await db.query('SELECT * FROM receipts WHERE invoice_id=$1 FOR UPDATE',[invoice.id])).rows;
 for(const receipt of linked)await assertReceipt(db,user,receipt);const changeId=randomUUID(),deletedAt=new Date();
 await db.query("UPDATE receipts SET deleted_at=COALESCE(deleted_at,$1),status='cancelled' WHERE invoice_id=$2",[deletedAt,invoice.id]);
 for(const receipt of linked)await marker(db,'receipt',receipt.id,changeId);
 await db.query("UPDATE invoices SET deleted_at=$1,status='cancelled',updated_at=clock_timestamp() WHERE id=$2",[deletedAt,invoice.id]);
 await marker(db,'invoice',invoice.id,changeId);
 await db.query('INSERT INTO ledger_remote_delete_events(event_id,invoice_id,created_by,previous_state,linked_receipts) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',[changeId,invoice.id,user.id,JSON.stringify(invoice),JSON.stringify(linked)]);
 await db.query('COMMIT');return {id:invoice.id,status:'cancelled',linkedReceipts:linked.filter(r=>!r.deleted_at).length,replayed:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
async function marker(db,kind,id,changeId){await db.query(`INSERT INTO ledger_document_sync_changes(entity_type,entity_id,operation,change_id)
 VALUES($1,$2,'delete',$3) ON CONFLICT(entity_type,entity_id) DO UPDATE SET operation='delete',change_id=excluded.change_id,changed_at=clock_timestamp()`,[kind,id,changeId]);}

export async function deleteReceipt(pool,input,user,enabled){
 if(!enabled)throw fail(409,'Deleting disabled');if(!canIssue(user,'receipt'))throw fail(403,'Access denied');
 const id=Number(input?.id);if(!Number.isSafeInteger(id)||id<=0||typeof input?.number!=='string')throw fail(400,'Invalid receipt');
 const db=await pool.connect();try{
 await db.query('BEGIN READ WRITE');
 const account=(await db.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
 if(!account?.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!canIssue(account,'receipt'))throw fail(403,'Access denied');
 const initial=(await db.query('SELECT id,invoice_id FROM receipts WHERE id=$1',[id])).rows[0];if(!initial)throw fail(404,'Receipt not found');
 if(initial.invoice_id)await db.query('SELECT id FROM invoices WHERE id=$1 FOR UPDATE',[initial.invoice_id]);
 const receipt=(await db.query('SELECT * FROM receipts WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!receipt||String(receipt.invoice_id||'')!==String(initial.invoice_id||''))throw fail(409,'Receipt changed; retry');
 await assertReceipt(db,user,receipt);if(receipt.receipt_number!==input.number)throw fail(409,'Receipt changed; refresh');
 if(receipt.deleted_at){await db.query('COMMIT');return {id,replayed:true};}
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_document_sync_changes (
 entity_type text NOT NULL,entity_id integer NOT NULL,operation text NOT NULL,
 change_id text NOT NULL,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(entity_type,entity_id))`);
 await db.query(`CREATE TABLE IF NOT EXISTS ledger_remote_receipt_delete_events (
 event_id text PRIMARY KEY,receipt_id integer NOT NULL,created_by integer NOT NULL,
 previous_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
 await db.query("UPDATE receipts SET deleted_at=clock_timestamp(),status='cancelled' WHERE id=$1",[id]);
 const changeId=randomUUID();await marker(db,'receipt',id,changeId);
 if(receipt.invoice_id)await db.query(`UPDATE invoices SET status=CASE WHEN COALESCE(advance_payment,0)+
 COALESCE((SELECT SUM(amount) FROM receipts WHERE invoice_id=invoices.id AND status='issued' AND deleted_at IS NULL),0)
 >=CASE WHEN COALESCE(subtotal,0)+COALESCE(tax_amount,0)>0 THEN COALESCE(subtotal,0)+COALESCE(tax_amount,0) ELSE COALESCE(total,0)+COALESCE(advance_payment,0) END
 THEN 'paid' ELSE 'issued' END,updated_at=clock_timestamp()
 WHERE id=$1 AND deleted_at IS NULL AND status IN ('issued','paid')`,[receipt.invoice_id]);
 await db.query('INSERT INTO ledger_remote_receipt_delete_events(event_id,receipt_id,created_by,previous_state) VALUES($1,$2,$3,$4::jsonb)',[changeId,id,user.id,JSON.stringify(receipt)]);
 await db.query('COMMIT');return {id,status:'cancelled',replayed:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
