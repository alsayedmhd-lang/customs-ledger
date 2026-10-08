import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaster,canCreateMaster,createMaster,readMaster} from '../master-data.mjs';
const uuid='d2ebca3e-3b40-4f65-a48c-5dc14f2d2fe3';
const user={id:1,role:'admin'};
const input={kind:'client',requestId:uuid,name:' New client ',email:'USER@example.com'};
function fake(options={}){const state={account:{role:'admin',is_active:true},records:[],requests:new Map(),released:0,...options};let snapshot;const queries=[];return {state,queries,connect:async()=>({release(){state.released++;},async query(sql,v=[]){queries.push(sql);let rows=[];
 if(sql==='BEGIN READ WRITE')snapshot={records:structuredClone(state.records),requests:new Map(state.requests)};
 else if(sql==='ROLLBACK'){state.records=snapshot.records;state.requests=snapshot.requests;}
 else if(sql.startsWith('SELECT role'))rows=[state.account];
 else if(sql.startsWith('SELECT created_by'))rows=state.requests.has(v[0])?[state.requests.get(v[0])]:[];
 else if(sql.startsWith('SELECT id,'))rows=state.current?[state.current]:[];
 else if(sql.startsWith('UPDATE ')){state.records.push({id:v.at(-1),sql,values:v});rows=[{id:v.at(-1)}];}
 else if(sql.startsWith('SELECT id FROM'))rows=state.duplicate?[{id:9}]:[];
 else if(sql.startsWith('INSERT INTO ledger_remote_master_requests')){if(state.failLog)throw Error('log failure');state.requests.set(v[0],{created_by:v[1],request_hash:v[2],kind:v[3],record_id:v[4]});}
 else if(sql.startsWith('INSERT INTO')){const id=state.records.length+1;state.records.push({id,sql,values:v});rows=[{id}];}
 return {rows};}})};}
test('validation normalizes identity and accepts zero price',()=>{assert.equal(validateMaster(input).email,'user@example.com');assert.equal(validateMaster(input).name,'New client');assert.equal(validateMaster({kind:'template',requestId:uuid,description:'Item',defaultUnitPrice:'0'}).defaultUnitPrice,'0.00');});
test('invalid names, emails, UUIDs and prices rejected',()=>{for(const data of [{...input,name:''},{...input,email:'bad'},{...input,requestId:'bad'},{kind:'template',requestId:uuid,description:'Item',defaultUnitPrice:'-1'},{kind:'template',requestId:uuid,description:'Item',defaultUnitPrice:'1.001'}])assert.throws(()=>validateMaster(data),{status:400});});
test('client accounts and disabled saving denied before DB access',async()=>{assert.equal(canCreateMaster({role:'client'}),false);await assert.rejects(createMaster(null,input,{id:2,role:'client'},true),{status:403});await assert.rejects(createMaster(null,input,user,false),{status:409});});
test('client saved atomically and same request safely replayed',async()=>{const db=fake();assert.deepEqual(await createMaster(db,input,user,true),{id:1,kind:'client',replayed:false});assert.equal((await createMaster(db,input,user,true)).replayed,true);assert.equal(db.state.records.length,1);assert.equal(db.state.released,2);await assert.rejects(createMaster(db,{...input,name:'Different'},user,true),{status:409});});
test('template has independent immutable identity and exact price',async()=>{const db=fake();await createMaster(db,{kind:'template',requestId:uuid,description:'New item',defaultUnitPrice:'12.30'},user,true);assert.deepEqual(db.state.records[0].values,['New item','12.30','X-W-'+uuid]);});
test('duplicates and permissions revoked during save are rejected',async()=>{for(const opts of [{duplicate:true},{account:{role:'client',is_active:true}},{account:{role:'admin',is_active:false}}]){const db=fake(opts);await assert.rejects(createMaster(db,input,user,true),{status:opts.duplicate?409:403});assert.equal(db.state.records.length,0);assert.ok(db.queries.includes('ROLLBACK'));}});
test('failed request log rolls back record creation',async()=>{const db=fake({failLog:true});await assert.rejects(createMaster(db,input,user,true),/log failure/);assert.equal(db.state.records.length,0);assert.equal(db.state.requests.size,0);assert.equal(db.state.released,1);});

test('editing preserves template code, checks version and replays safely',async()=>{
 const row={id:7,description:'Old item',default_unit_price:'1.00',item_code:'X-stable'};
 const db=fake({current:row});const detail=await readMaster({query:async()=>({rows:[row]})},'template',7,user);
 const edit={kind:'template',requestId:uuid,id:7,version:detail.version,description:'New item',defaultUnitPrice:'2.00'};
 assert.equal((await createMaster(db,edit,user,true,true)).id,7);
 assert.deepEqual(db.state.records[0].values,['New item','2.00',7]);
 assert.equal(db.state.records[0].sql.includes('item_code'),false);
 assert.equal((await createMaster(db,edit,user,true,true)).replayed,true);
 const other=fake({current:{...row,description:'Someone else changed it'}});
 await assert.rejects(createMaster(other,edit,user,true,true),{status:409});assert.equal(other.state.records.length,0);
});
test('client edit updates existing ID and rejects missing record',async()=>{
 const row={id:5,name:'Old',email:null,phone:null,address:null,tax_id:null,notes:null};
 const detail=await readMaster({query:async()=>({rows:[row]})},'client',5,user);
 const edit={...input,id:5,version:detail.version};const db=fake({current:row});
 await createMaster(db,edit,user,true,true);assert.equal(db.state.records[0].values.at(-1),5);
 await assert.rejects(createMaster(fake(),edit,user,true,true),{status:404});
});
