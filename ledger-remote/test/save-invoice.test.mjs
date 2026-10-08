import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveInvoice,saveReadiness,readRemoteInvoice} from '../save-invoice.mjs';
import {listQuery,readFilters} from '../list-query.mjs';
const input={kind:'invoice',syncId:'46fc7e57-0d92-4ca3-9359-50c7cabc22d3',clientId:7,date:'2026-10-06',taxRate:'5',advancePayment:'10',shipmentRef:'5AI51043287420',billOfLading:'157-58554020',portOfEntry:'Air Port',packageCount:25,shipmentWeight:'337',importerExporterName:'Importer',items:[{description:'Clearance',quantity:'2',unitPrice:'100'}]};
function connection({denied=false,failInsert=false,existing=null,representative=null}={}){
 const calls=[];let saved;
 const client={release(){calls.push(['release']);},async query(sql,values=[]){calls.push([sql,values]);
 if(sql.startsWith('SELECT role'))return {rows:[{role:denied?'client':'admin',is_active:true,pending_approval:false,display_name:'Salesman'}]};
 if(sql.startsWith('SELECT created_by'))return {rows:existing?[existing]:[]};
 if(sql.startsWith('SELECT id,display_name FROM users'))return {rows:representative?[representative]:[]};
 if(sql.startsWith('SELECT id,name'))return {rows:[{id:7,name:'Customer'}]};
 if(sql.startsWith('INSERT INTO ledger_remote_counters'))return {rows:[{last_number:'1'}]};
 if(sql.startsWith('INSERT INTO invoices')||sql.startsWith('INSERT INTO receipts'))return {rows:[{id:51}]};
 if(sql.startsWith('INSERT INTO ledger_remote_invoice_drafts')){if(failInsert)throw Error('connection failure');saved={invoice_number:values[1],created_by:values[3],request_hash:values[4],payload:JSON.parse(values[5])};}
 return {rows:[]};}};
 return {pool:{connect:async()=>client},calls,get saved(){return saved;}};
}
test('Remote saves full shipment/items as draft, with independent number and atomic Online publication',async()=>{
 const c=connection();const result=await saveInvoice(c.pool,input,{id:3,role:'admin'});
 assert.equal(result.draft.number,'INV-W-2026-0001');assert.equal(result.draft.remaining,'200.00');assert.equal(result.draft.status,'draft');assert.equal(result.draft.syncedToDesktop,false);assert.equal(result.draft.salesManName,'Salesman');
 assert.equal(c.saved.payload.portOfEntry,'Air Port');assert.equal(c.saved.payload.packageCount,25);assert.equal(c.saved.payload.shipmentWeight,'337');assert.equal(c.saved.payload.items.length,1);
 assert.ok(c.calls.some(([sql])=>sql.startsWith('INSERT INTO invoices')));assert.ok(c.calls.some(([sql])=>sql.startsWith('INSERT INTO invoice_items')));assert.ok(!c.calls.some(([sql])=>/\b(UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE)\s+company_settings\b/i.test(sql)));
 assert.equal(c.calls.at(-2)[0],'COMMIT');assert.equal(c.calls.at(-1)[0],'release');
});
test('retry of same UUID returns same saved draft without allocating a second number',async()=>{
 const first=connection();await saveInvoice(first.pool,input,{id:3,role:'admin'});const retry=connection({existing:first.saved});const result=await saveInvoice(retry.pool,input,{id:3,role:'admin'});assert.equal(result.replayed,true);assert.equal(result.draft.number,'INV-W-2026-0001');assert.ok(!retry.calls.some(([s])=>s.startsWith('INSERT INTO ledger_remote_counters')));
 const changed=connection({existing:first.saved});await assert.rejects(saveInvoice(changed.pool,{...input,advancePayment:'20'},{id:3,role:'admin'}),e=>e.status===409);assert.ok(changed.calls.some(([s])=>s==='ROLLBACK'));
});
test('failed save rolls back, revoked permission cannot write, editing existing invoice cannot save',async()=>{
 const failed=connection({failInsert:true});await assert.rejects(saveInvoice(failed.pool,input,{id:3,role:'admin'}),/connection failure/);assert.ok(failed.calls.some(([s])=>s==='ROLLBACK'));assert.ok(!failed.calls.some(([s])=>s==='COMMIT'));
 const denied=connection({denied:true});await assert.rejects(saveInvoice(denied.pool,input,{id:3,role:'admin'}),e=>e.status===403);assert.ok(!denied.calls.some(([s])=>s.startsWith('INSERT')));
 await assert.rejects(saveInvoice(connection().pool,{...input,originalInvoiceId:12},{id:3,role:'admin'}),e=>e.status===400);
});
test('saving is gated and Remote read respects client scope; mixed list is searched/paged in SQL',async()=>{
 assert.equal((await saveReadiness(null,false)).enabled,false);
 assert.equal((await saveReadiness({query:async()=>({rows:[{drafts:null,counters:null}]})},true)).enabled,false);
 assert.equal((await saveReadiness({query:async()=>({rows:[{drafts:'drafts',counters:'counters',receipts:'receipts',sync_ready:true}]})},true)).enabled,true);
 const c=connection();await saveInvoice(c.pool,input,{id:3,role:'admin'});let scope;
 const result=await readRemoteInvoice({query:async(sql,values)=>{scope=values;return {rows:[{payload:c.saved.payload,client_id:7,created_by:3}]};}},'web:'+input.syncId,{role:'client',client_id:7});assert.equal(scope[1],7);assert.equal(result.invoice.package_count,25);assert.equal(result.items[0].unit_price,'100.00');
 await assert.rejects(readRemoteInvoice({query:async()=>({rows:[]})},'web:'+input.syncId,{role:'client',client_id:9}),e=>e.status===404);
 const query=listQuery('invoices',{role:'client',client_id:7},readFilters(new URLSearchParams('q=INV-W&pageSize=10')),true);assert.ok(query.text.includes('UNION ALL'));assert.ok(query.text.includes('ledger_remote_invoice_drafts'));assert.ok(query.values.includes('INV-W'));assert.ok(query.values.includes(7));
});

test('new draft stores selected representative in synced invoice and actual creator in Remote audit',async()=>{
 const c=connection({representative:{id:9,display_name:'Selected'}});const result=await saveInvoice(c.pool,{...input,salesManId:9,status:'draft'},{id:3,role:'admin'});assert.equal(result.draft.salesManName,'Selected');assert.equal(c.saved.created_by,3);assert.equal(c.saved.payload.createdBy,3);
 const published=c.calls.find(([sql])=>sql.startsWith('INSERT INTO invoices'));assert.equal(published[1][16],9);
 const bad=connection();await assert.rejects(saveInvoice(bad.pool,{...input,salesManId:9},{id:3,role:'admin'}),{status:400});assert.ok(!bad.calls.some(([sql])=>sql.startsWith('INSERT INTO invoices')));
 await assert.rejects(saveInvoice(null,{...input,status:'issued'},{id:3,role:'admin'}),{status:400});
});
