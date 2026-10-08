import test from 'node:test';
import assert from 'node:assert/strict';
import {recordScope,recordWhere,assertRecord,requireRecord,scopedReport,canAssignRepresentative} from '../record-access.mjs';
import {listQuery,readFilters} from '../list-query.mjs';
import {reportSql} from '../report.mjs';
import {readInvoiceEdit,updateInvoice} from '../invoice-edit.mjs';
import {readReceiptEdit} from '../receipt-edit.mjs';
import {saveInvoice} from '../save-invoice.mjs';
import {readRemoteInvoice} from '../save-invoice.mjs';
const user={id:8,role:'user',permissions:{canEditInvoices:true,canEditReceipts:true}};
const f=readFilters(new URLSearchParams('q=test&pageSize=10'));
test('staff records use IDs, managers see all and unlinked clients fail closed',()=>{
 for(const role of ['admin','supervisor','manager']){assert.deepEqual(recordScope({role}),{all:true});assert.equal(canAssignRepresentative({role}),true);}
 assert.equal(canAssignRepresentative(user),false);assert.equal(canAssignRepresentative({role:'client'}),false);
 assertRecord(user,{created_by:8});assert.throws(()=>assertRecord(user,{created_by:9}),{status:404});assert.throws(()=>assertRecord(user,{created_by:null}),{status:404});
 assertRecord({role:'client',client_id:4},{client_id:4});assert.throws(()=>assertRecord({role:'client',client_id:4},{client_id:5}),{status:404});
 assert.equal(recordWhere({role:'client'},'t',String),'FALSE');
});
test('invoice and receipt lists filter BEFORE count, search and pagination, including assigned Web draft owners',()=>{
 for(const kind of ['invoices','receipts']){const q=listQuery(kind,user,f,kind==='invoices');assert.match(q.text,/t.created_by=\$1/);assert.equal(q.values[0],8);assert.ok(q.text.indexOf('t.created_by=$1')<q.text.indexOf('LIMIT'));}
 const q=listQuery('invoices',user,f,true);assert.match(q.text,/id::text AS id,created_by/);assert.match(q.text,/payload->>'salesManId'/);
 for(const role of ['admin','supervisor'])assert.ok(!listQuery('receipts',{role},f).text.includes('t.created_by='));
 assert.equal(listQuery('invoices',{role:'client',client_id:4},f).values[0],4);
});
test('statement financial events, advances and opening balance are scoped by assigned user',()=>{
 const q=scopedReport(reportSql,user,[null,'2026-10-01','2026-10-08','',20,0]);assert.equal(q.values.at(-1),8);assert.equal((q.text.match(/i.created_by=\$7/g)||[]).length,2);assert.match(q.text,/r.created_by=\$7/);
 assert.equal(scopedReport(reportSql,{role:'admin'},[]).text,reportSql);
});
test('direct IDs for invoices and receipts reject foreign owners; privileged roles do not need a lookup',async()=>{
 for(const kind of ['invoice','receipt']){await assert.rejects(requireRecord({query:async()=>({rows:[{created_by:9,client_id:4}]})},user,kind,2),{status:404});await requireRecord({query:async()=>({rows:[{created_by:8,client_id:4}]})},user,kind,2);}
 await requireRecord(null,{role:'supervisor'},'invoice',2);
 await assert.rejects(requireRecord({query:async()=>({rows:[{created_by:8,client_id:5}]})},{role:'client',client_id:4},'receipt',2),{status:404});
});
test('Web draft access follows representative instead of administrator who created it',async()=>{
 const id='web:46fc7e57-0d92-4ca3-9359-50c7cabc22d3';const calls=[];
 const pool={query:async(sql)=>{calls.push(sql);return {rows:sql.includes('FROM invoices')?[]:sql.includes('to_regclass')?[{drafts:true}]:[{created_by:8,client_id:4}]};}};
 await requireRecord(pool,user,'invoice',id);assert.ok(calls.some(s=>s.includes("payload->>'salesManId'")));
 await assert.rejects(readRemoteInvoice({query:async()=>({rows:[{payload:{},created_by:9,client_id:4}]})},id,user),{status:404});
});
test('edit readers reject foreign invoices and receipts despite edit permission',async()=>{
 await assert.rejects(readInvoiceEdit({query:async()=>({rows:[{id:2,created_by:9,status:'draft'}]})},2,user),{status:404});
 await assert.rejects(readReceiptEdit({query:async()=>({rows:[{id:2,created_by:9}]})},2,user),{status:404});
});
test('ordinary user cannot choose another representative on new invoice',async()=>{
 const input={kind:'invoice',salesManId:9,syncId:'46fc7e57-0d92-4ca3-9359-50c7cabc22d3',clientId:4,date:'2026-10-08',taxRate:0,advancePayment:0,items:[{description:'Service',quantity:1,unitPrice:100}]};
 await assert.rejects(saveInvoice(null,input,user),{status:403});
});
test('trash list and linked receipt names are limited to current user',async()=>{
 const {readTrash}=await import('../trash.mjs');let sql,values;await readTrash({query:async(q,v)=>{sql=q;values=v;return {rows:[{count:0,rows:[]}]};}},user,new URLSearchParams('kind=invoice'));
 assert.match(sql,/t.created_by=\$1/);assert.match(sql,/r.created_by=\$4/);assert.deepEqual(values,[8,100,0,8]);
});
