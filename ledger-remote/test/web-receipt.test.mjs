import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveInvoice} from '../save-invoice.mjs';
import {publishDraft} from '../publish-draft.mjs';
const input={kind:'receipt',syncId:'76fc7e57-0d92-4ca3-9359-50c7cabc22d3',clientId:7,date:'2026-10-07',amount:'50',invoiceId:12,paymentMethod:'cash'};
function fake({remaining='100',permission=true,collision=false}={}){
 const calls=[];const client={release(){},query:async(sql,values=[])=>{calls.push([sql,values]);
 if(sql.startsWith('SELECT role'))return {rows:[{role:'manager',permissions:{canEditReceipts:permission},is_active:true,display_name:'Creator'}]};
 if(sql.startsWith('SELECT id,name'))return {rows:[{id:7,name:'Client'}]};
 if(sql.startsWith('INSERT INTO ledger_remote_counters'))return {rows:[{last_number:1}]};
 if(sql.startsWith('SELECT id,sync_id'))return {rows:collision?[{id:8,sync_id:'another-uuid',number:'REC-W-2026-0001'}]:[]};
 if(sql.startsWith('SELECT id,invoice_number,status'))return {rows:[{id:12,invoice_number:'INV-2026-0001',status:'issued',remaining}]};
 if(sql.startsWith('INSERT INTO receipts'))return {rows:[{id:44}]};
 return {rows:[]};}};
 return {calls,client,pool:{connect:async()=>client}};
}
test('receipt has independent Web counter, correct source and draft status',async()=>{
 const f=fake();const result=await saveInvoice(f.pool,input,{id:3,role:'admin'});
 assert.equal(result.draft.number,'REC-W-2026-0001');assert.equal(result.draft.status,'draft');assert.equal(result.draft.source,'web');assert.equal(result.draft.onlineId,44);
 assert.equal(f.calls.find(([s])=>s.startsWith('INSERT INTO ledger_remote_counters'))[1][0],'receipt');
 assert.ok(f.calls.find(([s])=>s.startsWith('INSERT INTO ledger_remote_receipt_drafts')));assert.equal(f.calls.at(-1)[0],'COMMIT');
});
test('overpayment and receipt permission denial roll back without a receipt',async()=>{
 for(const options of [{remaining:'10'},{permission:false}]) {const f=fake(options);await assert.rejects(saveInvoice(f.pool,input,{id:3,role:'admin'}));assert.ok(f.calls.some(([s])=>s==='ROLLBACK'));assert.ok(!f.calls.some(([s])=>s.startsWith('INSERT INTO receipts')));}
});
test('publication retries use UUID and reject a number owned by another identity',async()=>{
 const draft={...input,number:'REC-W-2026-0001'};const f=fake({collision:true});await assert.rejects(publishDraft(f.client,draft),e=>e.status===409);
 const id=await publishDraft({query:async()=>({rows:[{id:44,sync_id:input.syncId,number:draft.number}]})},draft);assert.equal(id,44);
});
