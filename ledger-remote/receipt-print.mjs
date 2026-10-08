import {assertRecord,recordWhere,requireRecord} from './record-access.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export async function readReceiptPrint(pool,requestedId,user){
 const id=Number(requestedId);if(!/^[1-9][0-9]*$/.test(String(requestedId))||!Number.isSafeInteger(id))throw fail(400,'رقم سند غير صحيح / Invalid receipt');
 if(user.role==='client'&&(!user.client_id||!Number.isSafeInteger(Number(user.client_id))))throw fail(403,'Access denied');
 const result=await pool.query(`SELECT r.id,r.receipt_number,r.receipt_date,r.amount,r.payment_method,r.status,r.notes,
 c.name AS client_name,i.invoice_number,u.display_name AS receiver_name,
 COALESCE(NULLIF(to_jsonb(u)->>'receiver_signature_base64',''),NULLIF(to_jsonb(u)->>'signature_base64','')) AS receiver_signature
 FROM receipts r LEFT JOIN clients c ON c.id=r.client_id
 LEFT JOIN invoices i ON i.id=r.invoice_id LEFT JOIN users u ON u.id=r.created_by
 WHERE r.id=$1 AND r.deleted_at IS NULL AND ($2::integer IS NULL OR r.client_id=$2) AND ($3::integer IS NULL OR r.created_by=$3 OR EXISTS (SELECT 1 FROM invoices receipt_parent WHERE receipt_parent.id=r.invoice_id AND receipt_parent.created_by=$3))`,[id,user.role==='client'?Number(user.client_id):null,user.role==='user'?user.id:null]);
 if(!result.rows[0])throw fail(404,'السند غير موجود / Receipt not found');return {receipt:result.rows[0]};
}
