import {canAssignRepresentative,assertRecord,recordWhere,requireRecord} from './record-access.mjs';
import {completePayment} from './invoice-actions.mjs';
import {allocateDeclarationNumber} from './declaration-numbering.mjs';
import {publishDraft} from './publish-draft.mjs';
import {createHash} from 'node:crypto';
import {validateDraft} from './draft.mjs';
const failure=(status,message)=>Object.assign(Error(message),{status});
export async function remoteSchemaReady(pool){const row=(await pool.query("SELECT to_regclass('public.ledger_remote_invoice_drafts') AS drafts,to_regclass('public.ledger_remote_counters') AS counters")).rows[0];return !!(row?.drafts&&row?.counters);}
export async function saveReadiness(pool,enabled){
 if(!enabled)return {enabled:false,message:'الحفظ غير مفعّل. جهّز حفظ Remote أولًا.'};
 if(!await remoteSchemaReady(pool))return {enabled:false,message:'لم يتم تجهيز جدول مسودات Remote.'};
 const ready=(await pool.query("SELECT to_regclass('public.ledger_remote_receipt_drafts') AS receipts, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='created_source') AS sync_ready")).rows[0];
 if(!ready?.receipts||!ready?.sync_ready)return {enabled:false,message:'شغّل تجهيز المزامنة أولًا.'};
 return {enabled:true,message:'تُحفظ المسودة Online وتصل إلى Desktop عند المزامنة.'};
}
export async function saveInvoice(pool,input,user){
 let draft;try{draft=validateDraft(input);}catch(e){throw failure(400,e.message);}

 if(!canAssignRepresentative(user)&&draft.kind==='invoice'&&draft.salesManId!==null&&Number(draft.salesManId)!==Number(user.id))throw failure(403,'Cannot assign another representative');
 if(input.originalInvoiceId)throw failure(400,'Editing saved invoices is preview only');
 if(draft.kind==='invoice'&&draft.requestedStatus&&draft.requestedStatus!=='draft')throw failure(400,'الفاتورة الجديدة تُحفظ مسودة؛ أصدرها بعد الحفظ / Save new invoice as draft before issuing');
 if(input.payNow!=null&&typeof input.payNow!=='boolean')throw failure(400,'Invalid payment mode');
 if(input.payNow===true){if(draft.kind!=='receipt'||!draft.invoiceId)throw failure(400,'Payment needs a linked invoice');draft.payNow=true;}
 draft.syncId=draft.syncId.toLowerCase();
 const requestHash=createHash('sha256').update(JSON.stringify({...draft,createdBy:user.id})).digest('hex');
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ WRITE');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['ledger-web:'+draft.syncId]);
  const account=(await client.query('SELECT role,permissions,is_active,pending_approval,two_factor_email,two_factor_whatsapp,display_name FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
  let permissions={};try{permissions=typeof account?.permissions==='string'?JSON.parse(account.permissions):account?.permissions||{};}catch{}
  if(!account||!account.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp||!(account.role==='admin'||(['user','manager','supervisor'].includes(account.role)&&permissions[draft.kind==='invoice'?'canEditInvoices':'canEditReceipts']===true)))throw failure(403,'Access denied');
  if(draft.kind==='receipt'&&draft.invoiceId)await requireRecord(client,user,'invoice',draft.invoiceId);
  const draftTable=draft.kind==='invoice'?'ledger_remote_invoice_drafts':'ledger_remote_receipt_drafts';
  const existing=(await client.query(`SELECT created_by,request_hash,payload FROM ${draftTable} WHERE sync_id=$1`,[draft.syncId])).rows[0];
  if(existing){if(Number(existing.created_by)!==Number(user.id)||existing.request_hash!==requestHash)throw failure(409,'هوية الطلب مستخدمة ببيانات مختلفة؛ افتح مسودة جديدة.');if(!draft.payNow)await publishDraft(client,existing.payload);await client.query('COMMIT');return {draft:{...existing.payload,status:existing.payload.payNow?'issued':existing.payload.status,syncReady:true},replayed:true};}
  const customer=(await client.query('SELECT id,name FROM clients WHERE id=$1 FOR SHARE',[draft.clientId])).rows[0];if(!customer)throw failure(400,'Client not found');
  if(draft.kind==='invoice')draft.shipmentRef=await allocateDeclarationNumber(client,draft.shipmentRef)||'';
  const year=Number(draft.date.slice(0,4));
  const counter=(await client.query('INSERT INTO ledger_remote_counters(kind,year,last_number) VALUES($1,$2,1) ON CONFLICT(kind,year) DO UPDATE SET last_number=ledger_remote_counters.last_number+1 RETURNING last_number',[draft.kind,year])).rows[0];
  const number=`${draft.kind==='invoice'?'INV':'REC'}-W-${year}-`+String(counter.last_number).padStart(4,'0');
  let salesManName=account.display_name;if(draft.kind==='invoice'&&draft.salesManId!==null&&Number(draft.salesManId)!==Number(user.id)){const representative=(await client.query("SELECT id,display_name FROM users WHERE id=$1 AND is_active=true AND COALESCE(pending_approval,false)=false AND role<>'client' FOR SHARE",[draft.salesManId])).rows[0];if(!representative)throw failure(400,'المندوب غير متاح / Representative unavailable');salesManName=representative.display_name;}
  const saved={...draft,registered:true,number,clientName:customer.name,createdBy:user.id,salesManName,storage:'online',syncReady:true,syncedToDesktop:false};
  if(draft.payNow){
   await client.query('SELECT id FROM invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[draft.invoiceId]);
   if((await client.query("SELECT id FROM receipts WHERE invoice_id=$1 AND deleted_at IS NULL AND status IN ('draft','issued') LIMIT 1",[draft.invoiceId])).rows.length)throw failure(409,'يوجد سند مرتبط بالفعل؛ افتح الدفع مجددًا لتحديثه / A linked receipt exists; reopen payment to update it');
  }
  saved.onlineId=await publishDraft(client,saved);
  if(draft.payNow)await completePayment(client,saved);
  const numberColumn=draft.kind==='invoice'?'invoice_number':'receipt_number';
  await client.query(`INSERT INTO ${draftTable}(sync_id,${numberColumn},client_id,created_by,request_hash,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[draft.syncId,number,draft.clientId,user.id,requestHash,JSON.stringify(saved)]);
  await client.query('COMMIT');return {draft:{...saved,status:saved.payNow?'issued':saved.status},replayed:false};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
export async function readRemoteInvoice(pool,id,user){
 const uuid=String(id).slice(4);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid))throw failure(400,'Invalid invoice');
 const row=(await pool.query("SELECT payload,client_id,COALESCE(NULLIF(payload->>'salesManId','')::integer,created_by) AS created_by FROM ledger_remote_invoice_drafts WHERE sync_id=$1 AND ($2::integer IS NULL OR client_id=$2)",[uuid,user.role==='client'?user.client_id:null])).rows[0];
 if(!row)throw failure(404,'Invoice not found');assertRecord(user,row);
 const d=row.payload;
 return {invoice:{id:'web:'+d.syncId,invoice_number:d.number,client_id:d.clientId,client_name:d.clientName,issue_date:d.date,due_date:d.dueDate,status:'draft',subtotal:d.subtotal,tax_rate:d.taxRate,tax_amount:d.taxAmount,total:d.remaining,advance_payment:d.advancePayment,notes:d.notes,shipment_ref:d.shipmentRef,bill_of_lading:d.billOfLading,package_count:d.packageCount,shipment_weight:d.shipmentWeight,port_of_entry:d.portOfEntry,importer_exporter_name:d.importerExporterName,sales_man_name:d.salesManName,created_source:'web'},items:d.items.map(i=>({description:i.description,quantity:i.quantity,unit_price:i.unitPrice,total:i.total}))};
}
