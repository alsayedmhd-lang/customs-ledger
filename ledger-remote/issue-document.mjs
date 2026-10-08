import {assertReceipt,assertRecord,recordWhere,requireRecord} from './record-access.mjs';
import {decimal} from './draft.mjs';
import {normalizeShipmentFullNumber} from './declaration-numbering.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function canIssue(user,kind){let p={};try{p=typeof user?.permissions==='string'?JSON.parse(user.permissions):user?.permissions||{};}catch{}return ['invoice','receipt'].includes(kind)&&(user?.role==='admin'||(['manager','user','supervisor'].includes(user?.role)&&p[kind==='invoice'?'canEditInvoices':'canEditReceipts']===true));}
const num=value=>Number(value||0);
export function gross(invoice){const sum=num(invoice.subtotal)+num(invoice.tax_amount);return sum>0?sum:num(invoice.total)+num(invoice.advance_payment);}
export function invoiceStatus(invoice,paid){return num(invoice.advance_payment)+num(paid)>=gross(invoice)?'paid':'issued';}
export function validateReceiptIssue(receipt,invoice,paid){if(decimal(receipt.amount)<=0n)throw fail(400,'مبلغ السند غير صحيح / Invalid receipt amount');if(!invoice)return;if(Number(receipt.client_id)!==Number(invoice.client_id)||!['issued','paid'].includes(invoice.status))throw fail(409,'أصدر الفاتورة أولًا وتحقق من العميل / Issue the invoice first and check client');if(num(receipt.amount)>Math.max(0,gross(invoice)-num(invoice.advance_payment)-num(paid))+0.000001)throw fail(409,'المبلغ يتجاوز المتبقي على الفاتورة / Amount exceeds invoice balance');}
async function paidTotal(db,id){return num((await db.query("SELECT COALESCE(SUM(amount),0) AS paid FROM receipts WHERE invoice_id=$1 AND status='issued' AND deleted_at IS NULL",[id])).rows[0]?.paid);}
async function refreshInvoice(db,invoice){const status=invoiceStatus(invoice,await paidTotal(db,invoice.id));await db.query('UPDATE invoices SET status=$1,updated_at=clock_timestamp() WHERE id=$2',[status,invoice.id]);return status;}
export async function issueDocument(pool,input,user,enabled){
 if(!enabled)throw fail(409,'الإصدار غير مفعّل / Issuing disabled');const kind=input?.kind;if(!canIssue(user,kind))throw fail(403,'Access denied');
 let id=Number(input.id),syncId=null;if(kind==='invoice'&&/^web:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input.id))){syncId=String(input.id).slice(4);id=null;}else if(!Number.isSafeInteger(id)||id<=0)throw fail(400,'Invalid document');
 const db=await pool.connect();try{
 await db.query('BEGIN READ WRITE');const account=(await db.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];if(!account?.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!canIssue(account,kind))throw fail(403,'Access denied');
 let record,invoice;
 if(kind==='invoice'){record=(await db.query("SELECT * FROM invoices WHERE deleted_at IS NULL AND (($1::integer IS NOT NULL AND id=$1) OR ($2::text IS NOT NULL AND to_jsonb(invoices)->>'sync_id'=$2)) FOR UPDATE",[id,syncId])).rows[0];invoice=record;}
 else{const initial=(await db.query('SELECT id,invoice_id FROM receipts WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!initial)throw fail(404,'Receipt not found');if(initial.invoice_id){invoice=(await db.query('SELECT * FROM invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[initial.invoice_id])).rows[0];if(!invoice)throw fail(409,'Invoice not found');}record=(await db.query('SELECT * FROM receipts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];if(record&&String(record.invoice_id||'')!==String(initial.invoice_id||''))throw fail(409,'تم تعديل السند؛ أعد المحاولة / Receipt changed; retry');}
 if(!record)throw fail(404,'Document not found');if(kind==='receipt')await assertReceipt(db,user,record);else assertRecord(user,record);if(record.status==='cancelled'||!['draft','issued','paid'].includes(record.status)||(kind==='receipt'&&record.status==='paid'))throw fail(409,'لا يمكن إصدار مستند ملغى / Document cannot be issued');
 if(input.number!==record[kind==='invoice'?'invoice_number':'receipt_number'])throw fail(409,'تغير المستند؛ حدّث الصفحة / Document changed; refresh');
 if(kind==='invoice'&&normalizeShipmentFullNumber(input.shipmentRef)!==normalizeShipmentFullNumber(record.shipment_ref))throw fail(409,'تغير رقم البيان؛ حدّث الصفحة / Declaration changed; refresh');
 if(record.status!=='draft'){await db.query('COMMIT');return {id:record.id,number:input.number,status:record.status,replayed:true};}
 let status;
 if(kind==='receipt'){validateReceiptIssue(record,invoice,invoice?await paidTotal(db,invoice.id):0);await db.query("UPDATE receipts SET status='issued' WHERE id=$1",[record.id]);status='issued';if(invoice)await refreshInvoice(db,invoice);}
 else{if(!(await db.query('SELECT id FROM invoice_items WHERE invoice_id=$1 LIMIT 1',[record.id])).rows.length)throw fail(409,'الفاتورة تحتاج بنودًا قبل الإصدار / Invoice needs items before issue');const paid=await paidTotal(db,record.id);if(num(record.advance_payment)+paid>gross(record)+0.000001)throw fail(409,'التحصيل يتجاوز قيمة الفاتورة / Payments exceed invoice total');status=await refreshInvoice(db,record);}
 await db.query('CREATE TABLE IF NOT EXISTS ledger_remote_issue_events (kind text NOT NULL,record_id integer NOT NULL,created_by integer NOT NULL,previous_state jsonb NOT NULL,result jsonb NOT NULL,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(kind,record_id))');
 const result={id:record.id,number:input.number,status,replayed:false};await db.query('INSERT INTO ledger_remote_issue_events(kind,record_id,created_by,previous_state,result) VALUES($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT(kind,record_id) DO NOTHING',[kind,record.id,user.id,JSON.stringify(record),JSON.stringify(result)]);await db.query('COMMIT');return result;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
