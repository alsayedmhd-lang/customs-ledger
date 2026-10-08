import test from 'node:test';import assert from 'node:assert/strict';
import {assertReceipt,requireRecord,recordWhere} from '../record-access.mjs';
import {readInvoicePayment} from '../invoice-actions.mjs';
import {readReceiptEdit} from '../receipt-edit.mjs';
import {dashboard} from '../dashboard.mjs';
const user={id:8,role:'user',permissions:{canEditReceipts:true,canEditInvoices:true}};
const foreignReceipt={id:4,created_by:1,invoice_id:2,client_id:3};
const parentDb=owner=>({query:async()=>({rows:[{created_by:owner}]})});
test('user can access own receipts or receipts linked to their assigned invoices',async()=>{
 await assertReceipt(null,user,{created_by:8});await assertReceipt(parentDb(8),user,foreignReceipt);
 await assert.rejects(assertReceipt(parentDb(9),user,foreignReceipt),{status:404});
 await assert.rejects(assertReceipt(null,user,{created_by:1,invoice_id:null}),{status:404});
 await assert.rejects(assertReceipt({query:async()=>({rows:[]})},user,foreignReceipt),{status:404});
});
test('direct receipt URL follows invoice owner; client still follows client account',async()=>{
 const db={query:async(sql)=>({rows:[sql.includes('FROM receipts')?foreignReceipt:{created_by:8}]})};
 await requireRecord(db,user,'receipt',4);
 await assert.rejects(requireRecord(db,{role:'client',client_id:9},'receipt',4),{status:404});
 await requireRecord(db,{role:'client',client_id:3},'receipt',4);
});
test('pay invoice opens a linked receipt created by admin and edit reader accepts it',async()=>{
 const invoice={id:2,created_by:8,client_id:3,status:'issued'};
 const db={query:async(sql)=>({rows:sql.startsWith('SELECT * FROM invoices')?[invoice]:sql.startsWith('SELECT created_by FROM invoices')?[{created_by:8}]:[foreignReceipt]})};
 assert.deepEqual(await readInvoicePayment(db,2,user,true),{existingReceiptId:4});
 assert.equal((await readReceiptEdit(db,4,user)).record.id,4);
});
test('receipt SQL uses one owner parameter and EXISTS so several receipts are not duplicated',()=>{
 const args=[];const clause=recordWhere(user,'r',v=>{args.push(v);return '$1'},'receipt');assert.deepEqual(args,[8]);assert.match(clause,/r.created_by=\$1 OR EXISTS/);assert.match(clause,/receipt_parent.id=r.invoice_id/);
 const clients=[];assert.equal(recordWhere({role:'client',client_id:3},'r',v=>{clients.push(v);return '$1'},'receipt'),'r.client_id=$1');assert.deepEqual(clients,[3]);
});
test('dashboard totals and receipt counts include receipts on assigned invoices',async()=>{
 const calls=[];const db={release(){},query:async(sql,v)=>{calls.push({sql,v});return {rows:[{}]};}};
 await dashboard({connect:async()=>db},user,'2026-10-01','2026-10-08');
 assert.match(calls[1].sql,/receipt_parent.id=r.invoice_id/);assert.match(calls[2].sql,/receipt_parent.id=receipts.invoice_id/);assert.equal(calls[2].v.at(-1),8);
});
