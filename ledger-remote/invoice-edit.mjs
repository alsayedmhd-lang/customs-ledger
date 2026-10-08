import {canAssignRepresentative,assertRecord,recordWhere,requireRecord} from './record-access.mjs';
import {normalizeShipmentFullNumber,allocateDeclarationNumber} from './declaration-numbering.mjs';
export {getShipmentBase} from './declaration-numbering.mjs';
import {createHash} from 'node:crypto';
import {validateDraft,decimal} from './draft.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function canEditInvoice(user){let permissions={};try{permissions=typeof user?.permissions==='string'?JSON.parse(user.permissions):user?.permissions||{};}catch{}return user?.role==='admin'||(['manager','user','supervisor'].includes(user?.role)&&permissions.canEditInvoices===true);}
const version=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
function identity(id){if(typeof id==='string'&&id.startsWith('web:')){const uuid=id.slice(4);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid))throw fail(400,'Invalid invoice identity');return {sql:"to_jsonb(i)->>'sync_id'=$1",value:uuid.toLowerCase()};}const number=Number(id);if(!Number.isSafeInteger(number)||number<=0)throw fail(400,'Invalid invoice identity');return {sql:'i.id=$1',value:number};}
async function readRow(db,id,lock=false){const key=identity(id);return (await db.query(`SELECT i.*,c.name AS client_name,u.display_name AS sales_man_name,
 COALESCE((SELECT json_agg(line ORDER BY line.id) FROM (SELECT ii.id,ii.description,ii.quantity,ii.unit_price,ii.total FROM invoice_items ii WHERE ii.invoice_id=i.id) line),'[]'::json) AS edit_items,
 COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.invoice_id=i.id AND r.status='issued' AND r.deleted_at IS NULL),0) AS edit_paid,
 (SELECT COUNT(*) FROM receipts r WHERE r.invoice_id=i.id AND r.status<>'cancelled' AND r.deleted_at IS NULL) AS edit_receipts
 FROM invoices i LEFT JOIN clients c ON c.id=i.client_id LEFT JOIN users u ON u.id=i.created_by
 WHERE ${key.sql} AND i.deleted_at IS NULL${lock?' FOR UPDATE OF i':''}`,[key.value])).rows[0];}
export async function readInvoiceEdit(pool,id,user){if(!canEditInvoice(user))throw fail(403,'Access denied');const row=await readRow(pool,id);if(!row)throw fail(404,'Invoice not found');assertRecord(user,row);if(row.status==='cancelled')throw fail(409,'لا يمكن تعديل فاتورة ملغاة / Cancelled invoice cannot be edited');const {edit_items,edit_paid,edit_receipts,...invoice}=row;return {invoice,items:edit_items,version:version(row)};}
export async function updateInvoice(pool,input,user,enabled){
 if(!enabled)throw fail(409,'الحفظ غير مفعّل / Saving disabled');if(!canEditInvoice(user))throw fail(403,'Access denied');
 const key=identity(input?.id);if(typeof input?.version!=='string'||!/^[a-f0-9]{64}$/.test(input.version))throw fail(400,'Invalid edit identity');
 let d;try{d=validateDraft({...input,kind:'invoice'});}catch(e){throw fail(400,e.message);}d.syncId=d.syncId.toLowerCase();
 const hash=createHash('sha256').update(JSON.stringify({id:key.value,version:input.version,originalShipmentRef:normalizeShipmentFullNumber(input.originalShipmentRef),d,userId:user.id})).digest('hex');const db=await pool.connect();
 try{
  await db.query('BEGIN READ WRITE');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['ledger-invoice-edit:'+d.syncId]);
  const account=(await db.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];if(!account?.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!canEditInvoice(account))throw fail(403,'Access denied');
  await db.query('CREATE TABLE IF NOT EXISTS ledger_remote_invoice_edit_requests (request_id uuid PRIMARY KEY,created_by integer NOT NULL,request_hash text NOT NULL,invoice_id integer NOT NULL,result jsonb NOT NULL,previous_state jsonb NOT NULL,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const prior=(await db.query('SELECT created_by,request_hash,result FROM ledger_remote_invoice_edit_requests WHERE request_id=$1',[d.syncId])).rows[0];if(prior){if(Number(prior.created_by)!==Number(user.id)||prior.request_hash!==hash)throw fail(409,'Request conflict');await db.query('COMMIT');return {...prior.result,replayed:true};}
  const current=await readRow(db,input.id,true);if(!current)throw fail(404,'Invoice not found');assertRecord(user,current);if(version(current)!==input.version)throw fail(409,'تم تغيير الفاتورة أو تحصيلاتها؛ أغلق النموذج وافتحه مجددًا / Invoice or receipts changed; reopen editor');
  if(normalizeShipmentFullNumber(input.originalShipmentRef)!==normalizeShipmentFullNumber(current.shipment_ref))throw fail(409,'رقم البيان الكامل مع الزيادات لا يطابق الفاتورة الأصلية / Original full declaration reference does not match');
  if(normalizeShipmentFullNumber(current.shipment_ref)){
   const matches=(await db.query("SELECT id FROM invoices WHERE lower(regexp_replace(trim(COALESCE(shipment_ref,'')), '\\s+', '', 'g'))=$1 AND deleted_at IS NULL",[normalizeShipmentFullNumber(current.shipment_ref)])).rows;
   if(matches.length!==1||Number(matches[0].id)!==Number(current.id))throw fail(409,'رقم البيان الكامل غير فريد؛ لا يمكن تحديد الفاتورة بأمان / Full declaration reference is ambiguous');
  }
  if(!['draft','issued','paid'].includes(current.status))throw fail(409,'لا يمكن تعديل حالة الفاتورة الحالية / Invoice status cannot be edited');
  if(!(await db.query('SELECT id FROM clients WHERE id=$1 FOR SHARE',[d.clientId])).rows.length)throw fail(400,'Client not found');
  if(Number(current.client_id)!==d.clientId&&Number(current.edit_receipts)>0)throw fail(409,'لا يمكن تغيير العميل مع وجود سندات مرتبطة / Cannot change client while receipts are linked');
  const paid=decimal(current.edit_paid);if(decimal(d.advancePayment)+paid>decimal(d.grossTotal))throw fail(409,'الإجمالي الجديد أقل من الدفعة المقدمة والتحصيلات / New total is below advance and collected receipts');
  const requested=d.requestedStatus||current.status;
  if(requested!==current.status&&['draft','cancelled'].includes(requested)&&Number(current.edit_receipts)>0)throw fail(409,'لا يمكن تحويل فاتورة مرتبطة بسندات إلى مسودة أو ملغاة / Linked receipts prevent this status change');
  if(requested==='cancelled'&&decimal(d.advancePayment)>0n)throw fail(409,'لا يمكن إلغاء فاتورة لها دفعة مقدمة / Advance payment prevents cancellation');
  const settled=decimal(d.advancePayment)+paid>=decimal(d.grossTotal);
  if(requested==='paid'&&d.requestedStatus==='paid'&&!settled)throw fail(409,'لا يمكن اختيار مدفوعة قبل اكتمال التحصيل / Invoice is not fully paid');
  const status=['draft','cancelled'].includes(requested)?requested:settled?'paid':'issued';
  if(!canAssignRepresentative(user)&&d.salesManId!==null&&Number(d.salesManId)!==Number(user.id))throw fail(403,'Cannot assign another representative');const salesManId=d.salesManId??current.created_by;
  if(d.salesManId!==null&&Number(d.salesManId)!==Number(current.created_by)&&!(await db.query("SELECT id FROM users WHERE id=$1 AND is_active=true AND COALESCE(pending_approval,false)=false AND role<>'client' FOR SHARE",[salesManId])).rows.length)throw fail(400,'المندوب غير متاح / Representative unavailable');
  const shipmentRef=normalizeShipmentFullNumber(d.shipmentRef)!==normalizeShipmentFullNumber(current.shipment_ref)?await allocateDeclarationNumber(db,d.shipmentRef,Number(current.id)):String(d.shipmentRef||'').trim()||null;
  await db.query(`UPDATE invoices SET client_id=$1,issue_date=$2,due_date=$3,subtotal=$4,tax_rate=$5,tax_amount=$6,total=$7,notes=$8,shipment_ref=$9,bill_of_lading=$10,package_count=$11,shipment_weight=$12,port_of_entry=$13,importer_exporter_name=$14,advance_payment=$15,status=$16,created_by=$18,updated_at=clock_timestamp() WHERE id=$17`,[d.clientId,d.date,d.dueDate||null,d.subtotal,d.taxRate,d.taxAmount,d.remaining,d.notes,shipmentRef,d.billOfLading||null,d.packageCount,d.shipmentWeight,d.portOfEntry||null,d.importerExporterName||null,d.advancePayment,status,current.id,salesManId]);
  await db.query('DELETE FROM invoice_items WHERE invoice_id=$1',[current.id]);for(const item of d.items)await db.query('INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5)',[current.id,item.description,item.quantity,item.unitPrice,item.total]);
  const result={id:Number(current.id),number:current.invoice_number,status,shipmentRef};await db.query('INSERT INTO ledger_remote_invoice_edit_requests(request_id,created_by,request_hash,invoice_id,result,previous_state) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[d.syncId,user.id,hash,current.id,JSON.stringify(result),JSON.stringify(current)]);await db.query('COMMIT');return {...result,replayed:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
