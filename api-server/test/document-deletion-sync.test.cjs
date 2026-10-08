const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');const {stripTypeScriptTypes}=require('node:module');const {randomUUID}=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../src');
function stripped(file){return stripTypeScriptTypes(fs.readFileSync(path.join(root,file),'utf8'),{mode:'strip'});}
function executable(file){return stripped(file).replace(/^import[\s\S]*?;\s*$/gm,'').replace(/\bexport\s+/g,'');}
function setup(){
 const db=new DatabaseSync(':memory:');let depth=0;
 const sqlite={name:':memory:',exec:s=>db.exec(s),prepare:s=>db.prepare(s),transaction:fn=>()=>{const key='sp'+depth++;db.exec('SAVEPOINT '+key);try{const result=fn();db.exec('RELEASE '+key);return result;}catch(e){db.exec('ROLLBACK TO '+key);db.exec('RELEASE '+key);throw e;}finally{depth--;}}};
 db.exec(`CREATE TABLE invoices(id INTEGER PRIMARY KEY,invoice_number TEXT NOT NULL,client_id INTEGER,issue_date TEXT,due_date TEXT,status TEXT,subtotal REAL,tax_rate REAL,tax_amount REAL,total REAL,notes TEXT,shipment_ref TEXT,bill_of_lading TEXT,package_count INTEGER,shipment_weight REAL,port_of_entry TEXT,importer_exporter_name TEXT,advance_payment REAL,created_by INTEGER,deleted_at INTEGER,created_at INTEGER,updated_at INTEGER,sync_id TEXT,created_source TEXT DEFAULT 'desktop');
 CREATE TABLE receipts(id INTEGER PRIMARY KEY,receipt_number TEXT,client_id INTEGER,invoice_id INTEGER,amount REAL,payment_method TEXT,status TEXT,notes TEXT,receipt_date TEXT,created_by INTEGER,deleted_at INTEGER,created_at INTEGER,sync_id TEXT,created_source TEXT DEFAULT 'desktop');
 CREATE TABLE invoice_items(id INTEGER PRIMARY KEY,invoice_id INTEGER,description TEXT,quantity REAL,unit_price REAL,total REAL);
 CREATE TABLE sync_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT,entity_id TEXT,operation TEXT,payload_json TEXT,status TEXT,retry_count INTEGER,last_error TEXT,synced_at INTEGER,created_at INTEGER,updated_at INTEGER);
 INSERT INTO invoices(id,invoice_number,client_id,issue_date,status,subtotal,total,advance_payment,created_by,created_at,updated_at) VALUES(1,'INV-2026-0001',7,'2026-10-08','issued',100,100,0,4,1000,1000);
 INSERT INTO receipts(id,receipt_number,client_id,invoice_id,amount,status,receipt_date,created_by,created_at) VALUES(2,'REC-2026-0001',7,1,30,'issued','2026-10-08',4,1000);
 INSERT INTO invoice_items(id,invoice_id,description,quantity,unit_price,total) VALUES(1,1,'Item',1,100,100);`);
 const context=vm.createContext({sqlite,ensureSyncQueueTable(){},randomUUID,console:{log(){},warn(){},error(){}},process,Date});vm.runInContext(executable('utils/invoice-payment-state.ts'),context);vm.runInContext(executable('utils/document-deletion-sync.ts'),context);
 return {db,sqlite,c:context,row:(kind,id)=>db.prepare('SELECT * FROM '+(kind==='invoice'?'invoices':'receipts')+' WHERE id=?').get(id),queue:()=>db.prepare('SELECT * FROM sync_queue ORDER BY id').all(),synced:()=>db.exec("UPDATE sync_queue SET status='synced'")};
}
function pg({missing=false,ambiguous=false,failUpdate=false,failEvent=false}={}){
 const calls=[];return {calls,async query(sql,values=[]){calls.push({sql,values});if(sql.includes('SELECT id,deleted_at FROM invoices'))return {rows:missing?[]:ambiguous?[{id:11},{id:12}]:[{id:11,deleted_at:null}]};if(sql.includes('SELECT id,invoice_id,deleted_at FROM receipts'))return {rows:missing?[]:ambiguous?[{id:22},{id:23}]:[{id:22,invoice_id:11,deleted_at:null}]};if(sql.startsWith('UPDATE')&&failUpdate)throw Error('network update failed');if(sql.startsWith('INSERT INTO ledger_document_sync_changes')&&failEvent)throw Error('event save failed');return {rows:[],rowCount:1};}};
}
test('all changed TypeScript modules parse without changing their existing imports',()=>{
 for(const file of ['utils/invoice-payment-state.ts','utils/sync-queue.ts','utils/document-deletion-sync.ts','utils/sync-worker.ts','utils/web-draft-sync.ts','routes/invoices.ts','routes/receipts.ts','routes/trash.ts']){const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:stripped(file),encoding:'utf8'});assert.equal(result.status,0,file+': '+result.stderr);}
});
for(const kind of ['invoice','receipt'])test(kind+' deletion atomically stores tombstone, queue and actor; protects stale pull',()=>{
 const f=setup(),id=kind==='invoice'?1:2;assert.equal(f.c.changeDocumentDeletion(kind,id,false,9),true);assert.ok(f.row(kind,id).deleted_at>0);assert.equal(f.queue().at(-1).operation,'delete');const payload=JSON.parse(f.queue().at(-1).payload_json);assert.equal(payload.userId,9);assert.equal(payload.document.id,id);assert.equal(payload.document.created_by,4);assert.equal(f.c.blocksDocumentPull(kind,payload.document,id,7,kind==='receipt'?1:null),true);
 f.synced();assert.equal(f.c.blocksDocumentPull(kind,{...payload.document,deleted_at:null},id,7,kind==='receipt'?1:null),true);
});
test('queue failure rolls back document change and registry',()=>{
 const f=setup();f.db.exec("CREATE TRIGGER fail_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT,'queue fail');END;");assert.throws(()=>f.c.changeDocumentDeletion('invoice',1),/queue fail/);assert.equal(f.row('invoice',1).deleted_at,null);assert.equal(f.queue().length,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ledger_document_deletion_state').get().n,0);
});
test('registry failure rolls back both the deletion and queued event',()=>{
 const f=setup();f.c.queueUntrackedDocumentDeletions();f.db.exec("CREATE TRIGGER fail_state BEFORE INSERT ON ledger_document_deletion_state BEGIN SELECT RAISE(ABORT,'state fail');END;");assert.throws(()=>f.c.changeDocumentDeletion('receipt',2),/state fail/);assert.equal(f.row('receipt',2).deleted_at,null);assert.equal(f.queue().length,0);
});
test('old unqueued local deletions are recovered once without duplication',()=>{
 const f=setup();f.db.exec('UPDATE invoices SET deleted_at=1234 WHERE id=1;UPDATE receipts SET deleted_at=1234 WHERE id=2;');f.c.queueUntrackedDocumentDeletions();assert.equal(f.queue().length,2);f.c.queueUntrackedDocumentDeletions();assert.equal(f.queue().length,2);assert.equal(JSON.parse(f.queue()[0].payload_json).document.deleted_at,1234);
});
for(const kind of ['invoice','receipt'])test(kind+' permanent deletion retains queue identity after row disappears',()=>{
 const f=setup(),id=kind==='invoice'?1:2;assert.throws(()=>f.c.permanentlyDeleteDocument(kind,id),/trash/);f.c.changeDocumentDeletion(kind,id);f.c.permanentlyDeleteDocument(kind,id);assert.equal(f.row(kind,id),undefined);f.synced();const d=f.c.currentDocumentDeletion(kind,id);assert.equal(d.operation,'delete');assert.equal(f.c.blocksDocumentPull(kind,d.document,null,7,kind==='receipt'?1:null),true);if(kind==='invoice')assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM invoice_items').get().n,0);
});
test('explicit local restore supersedes a pending deletion; stale pull is blocked until sent',()=>{
 const f=setup();f.c.changeDocumentDeletion('invoice',1);f.c.changeDocumentDeletion('invoice',1,true,9);assert.equal(f.row('invoice',1).deleted_at,null);assert.equal(f.c.currentDocumentDeletion('invoice',1).operation,'restore');assert.equal(f.c.blocksDocumentPull('invoice',{invoice_number:'INV-2026-0001',deleted_at:1000},1,7),true);f.synced();assert.equal(f.c.currentDocumentDeletion('invoice',1),null);assert.equal(f.c.blocksDocumentPull('invoice',{invoice_number:'INV-2026-0001',deleted_at:null},1,7),false);
});
test('explicit remote restore crosses devices only with its committed marker and no pending deletion',()=>{
 const f=setup();f.c.changeDocumentDeletion('receipt',2);const remote={receipt_number:'REC-2026-0001',amount:30,deleted_at:null};const marker={operation:'restore',change_id:randomUUID()};assert.equal(f.c.blocksDocumentPull('receipt',remote,2,7,1,marker),true);f.synced();assert.equal(f.c.blocksDocumentPull('receipt',remote,2,7,1,{operation:'delete',change_id:randomUUID()}),true);assert.equal(f.c.blocksDocumentPull('receipt',remote,2,7,1,marker),false);assert.equal(f.row('receipt',2).deleted_at,null);assert.equal(f.c.currentDocumentDeletion('receipt',2),null);
});
test('Web UUIDs and repeated receipt numbers cannot block a different accounting record',()=>{
 const f=setup();f.db.exec("UPDATE receipts SET sync_id='web-id',created_source='web' WHERE id=2");f.c.changeDocumentDeletion('receipt',2);f.synced();const own=f.c.currentDocumentDeletion('receipt',2).document;assert.equal(f.c.blocksDocumentPull('receipt',{...own,sync_id:'other-id'},null,7,1),false);
 const g=setup();g.c.changeDocumentDeletion('receipt',2);g.synced();const receipt=g.c.currentDocumentDeletion('receipt',2).document;assert.equal(g.c.blocksDocumentPull('receipt',{...receipt,amount:40},null,7,1),false);assert.equal(g.c.blocksDocumentPull('receipt',receipt,null,8,1),false);assert.equal(g.c.blocksDocumentPull('receipt',receipt,null,7,3),false);
});
for(const kind of ['invoice','receipt'])test(kind+' push tombstone only, keeps immutable identity and logs committed intent',async()=>{
 const f=setup(),id=kind==='invoice'?1:2;f.c.changeDocumentDeletion(kind,id);const online=pg();const result=await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion(kind,id),async()=>70);assert.equal(result.changed,true);const update=online.calls.find(q=>q.sql.startsWith('UPDATE '+(kind==='invoice'?'invoices':'receipts')+' SET deleted_at'));assert.ok(update.values[0] instanceof Date);assert.ok(!/invoice_number=|receipt_number=|created_by=|sync_id=/.test(update.sql));assert.ok(online.calls.some(q=>q.sql.startsWith('INSERT INTO ledger_document_sync_changes')));assert.equal(online.calls.at(-1).sql,'COMMIT');if(kind==='receipt')assert.ok(online.calls.some(q=>q.sql.includes("WHERE id=$1 AND deleted_at IS NULL AND status IN ('issued','paid')")));
});
test('explicit restore is the only path that clears Online deleted_at',async()=>{
 const f=setup();f.c.changeDocumentDeletion('invoice',1);f.c.changeDocumentDeletion('invoice',1,true);const online=pg();const result=await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70);assert.equal(result.restored,true);assert.equal(online.calls.find(q=>q.sql.startsWith('UPDATE invoices SET deleted_at')).values[0],null);
});
test('missing Online deletion is idempotent; missing restore is an error, never recreates documents',async()=>{
 const f=setup();f.c.changeDocumentDeletion('invoice',1);const online=pg({missing:true});assert.equal((await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70)).changed,false);assert.ok(!online.calls.some(q=>q.sql.startsWith('INSERT INTO invoices')));f.c.changeDocumentDeletion('invoice',1,true);await assert.rejects(f.c.pushDocumentDeletion(pg({missing:true}),f.c.currentDocumentDeletion('invoice',1),async()=>70),/not found/);
});
test('ambiguous identity and failed write/audit roll back and remain retryable',async()=>{
 for(const options of [{ambiguous:true},{failUpdate:true},{failEvent:true}]){const f=setup();f.c.changeDocumentDeletion('invoice',1);const online=pg(options);await assert.rejects(f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70));assert.equal(online.calls.at(-1).sql,'ROLLBACK');assert.equal(f.queue()[0].status,'pending');}
});
test('Web deletion binds UUID and number, and missing UUID fails instead of using local IDs',async()=>{
 const f=setup();f.db.exec("UPDATE invoices SET invoice_number='INV-W-2026-0001',created_source='web',sync_id='uuid' WHERE id=1");f.c.changeDocumentDeletion('invoice',1);const online=pg();await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70);const lookup=online.calls.find(q=>q.sql.includes('SELECT id,deleted_at FROM invoices'));assert.deepEqual(Array.from(lookup.values),['INV-W-2026-0001','uuid']);const change=f.c.currentDocumentDeletion('invoice',1);change.document.sync_id=null;await assert.rejects(f.c.pushDocumentDeletion(pg(),change,async()=>70),/IDENTITY_MISSING/);
});
test('ordinary pushes preserve an Online tombstone and skip invoice items',async()=>{
 const f=setup();f.c.createRequire=()=>()=>({Client:class{}});vm.runInContext(executable('utils/sync-worker.ts'),f.c);
 f.c.resolveOnlineUserId=async()=>4;f.c.resolveReceiptOnlineMapping=async()=>({onlineClientId:70,onlineInvoiceId:11});
 const online={calls:[],async query(sql,values){this.calls.push(sql);return {rowCount:1,rows:[{id:11,invoice_number:'INV-2026-0001',receipt_number:'REC-2026-0001',deleted_at:new Date(5000)}]};}};
 const invoice=f.c.getLocalInvoice('1'),receipt=f.c.getLocalReceipt('2');assert.equal(await f.c.pushInvoiceCreate(online,invoice,70,{autoRestoredCount:0}),false);assert.equal(f.row('invoice',1).deleted_at,5000);assert.equal(await f.c.pushReceipt(online,receipt,'update',{autoRestoredCount:0}),false);assert.equal(f.row('receipt',2).deleted_at,5000);assert.ok(!online.calls.some(sql=>sql.includes('deleted_at = NULL')));
});
function loadWorker(f){f.c.createRequire=()=>()=>({Client:class{}});vm.runInContext(executable('utils/sync-worker.ts'),f.c);f.c.resolveLocalUserIdFromOnline=async()=>4;}
test('Desktop invoice without declaration matches exact number; tombstone cannot return under a suffixed number',async()=>{
 const f=setup();loadWorker(f);f.c.changeDocumentDeletion('invoice',1);f.synced();const onlineRow={...f.row('invoice',1),id:11,deleted_at:null,updated_at:new Date()};const online={async query(sql){if(sql.includes('to_regclass'))return {rows:[{changes:null}]};return {rows:[onlineRow]};}};
 const result=await f.c.pullInvoicesFromOnline(online,new Map([[7,7]]));assert.equal(result.inserted,0);assert.equal(result.skipped,1);assert.equal(result.invoiceIdMap.get(11),1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n,1);assert.ok(f.row('invoice',1).deleted_at>0);
});
test('Desktop receipt pull respects a local deletion and its pending queue',async()=>{
 const f=setup();loadWorker(f);f.c.changeDocumentDeletion('receipt',2);const onlineRow={...f.row('receipt',2),id:22,client_id:70,invoice_id:11,deleted_at:null};const online={async query(sql){if(sql.includes('to_regclass'))return {rows:[{changes:null}]};return {rows:[onlineRow]};}};
 const result=await f.c.pullReceiptsFromOnline(online,new Map([[70,7]]),new Map([[11,1]]));assert.equal(result.updated,0);assert.equal(result.inserted,0);assert.equal(result.skipped,1);assert.ok(f.row('receipt',2).deleted_at>0);
});
test('Web pull cannot recreate a permanently deleted invoice, including its item rows',async()=>{
 const f=setup();Object.assign(f.c,{mkdirSync:fs.mkdirSync,dirname:path.dirname,join:path.join});vm.runInContext(executable('utils/web-draft-sync.ts'),f.c);
 f.db.exec("UPDATE invoices SET invoice_number='INV-W-2026-0001',created_source='web',sync_id='web-uuid' WHERE id=1");const onlineRow={...f.row('invoice',1),id:11,deleted_at:null};f.c.changeDocumentDeletion('invoice',1);f.c.permanentlyDeleteDocument('invoice',1);f.synced();
 const online={async query(sql){if(sql.includes('to_regclass'))return {rows:[{changes:null}]};if(sql.includes('FROM invoice_items'))return {rows:[{description:'Restored item',quantity:1,unit_price:100,total:100}]};return {rows:[onlineRow]};}};
 const result=await f.c.pullWebInvoices(online,new Map([[7,7]]),async()=>4);assert.equal(result.inserted,0);assert.equal(result.skipped,1);assert.equal(result.map.has(11),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM invoice_items').get().n,0);
});
test('worker sends deletion after permanent removal, marks success only after remote commit, and never syncs items',async()=>{
 const f=setup();loadWorker(f);f.db.exec("CREATE TABLE company_settings(id INTEGER,database_connection_string TEXT);INSERT INTO company_settings VALUES(1,'mock-online');");f.c.changeDocumentDeletion('receipt',2);f.c.changeDocumentDeletion('invoice',1);f.c.permanentlyDeleteDocument('invoice',1);const online=pg();online.end=async()=>{};
 f.c.createOnlineClient=async()=>online;f.c.syncTemplatesBeforeQueue=f.c.syncClientsBeforeQueue=f.c.syncUsersBeforeQueue=async()=>{};f.c.pushOnlineAttachmentMetadata=async()=>({processed:0});f.c.resolveOnlineClientIdForLocalClientId=async()=>70;
 const result=await f.c.unlockedSyncWorkerOnce();assert.equal(result.processedCount,3);assert.equal(result.lastError,null);assert.ok(f.queue().every(q=>q.status==='synced'));assert.ok(!online.calls.some(q=>q.sql.startsWith('INSERT INTO invoices')||q.sql.startsWith('INSERT INTO invoice_items')));assert.equal(f.row('invoice',1),undefined);
});
test('worker keeps failed deletions retryable and preserves pull protection on network failure',async()=>{
 const f=setup();loadWorker(f);f.db.exec("CREATE TABLE company_settings(id INTEGER,database_connection_string TEXT);INSERT INTO company_settings VALUES(1,'mock-online');");f.c.changeDocumentDeletion('invoice',1);const online=pg({failUpdate:true});online.end=async()=>{};f.c.createOnlineClient=async()=>online;f.c.syncTemplatesBeforeQueue=f.c.syncClientsBeforeQueue=f.c.syncUsersBeforeQueue=async()=>{};f.c.pushOnlineAttachmentMetadata=async()=>({processed:0});f.c.resolveOnlineClientIdForLocalClientId=async()=>70;
 const result=await f.c.unlockedSyncWorkerOnce();assert.equal(result.processedCount,0);assert.match(result.lastError,/network/);assert.equal(f.queue()[0].status,'failed');assert.ok(f.c.blocksDocumentPull('invoice',{invoice_number:'INV-2026-0001',deleted_at:null},1,7));
});

test('invoice cascade cancels all active linked receipts first and clears accounting atomically',()=>{
 const f=setup();f.db.exec("CREATE TABLE customer_ledger(id INTEGER,invoice_id INTEGER,receipt_id INTEGER);INSERT INTO customer_ledger VALUES(1,1,NULL),(2,1,2);INSERT INTO receipts(id,receipt_number,client_id,invoice_id,amount,status) VALUES(3,'REC-3',7,1,20,'draft'),(4,'REC-4',7,NULL,10,'issued');");
 f.c.changeDocumentDeletion('invoice',1,false,9);assert.equal(f.row('invoice',1).status,'cancelled');
 for(const id of [2,3]){assert.equal(f.row('receipt',id).status,'cancelled');assert.ok(f.row('receipt',id).deleted_at);}
 assert.equal(f.row('receipt',4).deleted_at,null);assert.equal(f.row('receipt',4).status,'issued');assert.deepEqual(f.queue().map(q=>q.entity_type),['receipt','receipt','invoice']);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM customer_ledger').get().n,0);
});
test('failure after receipt cancellation rolls back the entire invoice cascade and accounting',()=>{
 const f=setup();f.db.exec("CREATE TABLE customer_ledger(id INTEGER,invoice_id INTEGER,receipt_id INTEGER);INSERT INTO customer_ledger VALUES(1,1,2);CREATE TRIGGER fail_invoice BEFORE UPDATE OF deleted_at ON invoices BEGIN SELECT RAISE(ABORT,'invoice fail');END;");
 assert.throws(()=>f.c.changeDocumentDeletion('invoice',1),/invoice fail/);assert.equal(f.row('invoice',1).status,'issued');assert.equal(f.row('receipt',2).status,'issued');assert.equal(f.row('receipt',2).deleted_at,null);assert.equal(f.queue().length,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM customer_ledger').get().n,1);
});
test('draft deletion becomes cancelled, restore is draft and receipts remain in trash',()=>{
 const f=setup();f.db.exec("UPDATE invoices SET status='draft';UPDATE receipts SET status='draft';");f.c.changeDocumentDeletion('invoice',1);assert.equal(f.row('invoice',1).status,'cancelled');assert.throws(()=>f.c.changeDocumentDeletion('receipt',2,true),/RESTORE_INVOICE_FIRST/);f.c.changeDocumentDeletion('invoice',1,true);assert.equal(f.row('invoice',1).status,'draft');assert.ok(f.row('receipt',2).deleted_at);f.c.changeDocumentDeletion('receipt',2,true);assert.equal(f.row('receipt',2).status,'draft');
});
test('Online invoice cancellation covers linked receipts and rollback covers cascade failure',async()=>{
 const f=setup();f.c.changeDocumentDeletion('invoice',1);const online=pg();await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70);const cascade=online.calls.findIndex(q=>q.sql.startsWith('UPDATE receipts SET deleted_at'));const invoice=online.calls.findIndex(q=>q.sql.startsWith('UPDATE invoices SET deleted_at'));assert.ok(cascade>=0&&cascade<invoice);assert.equal(online.calls[invoice].values[2],'cancelled');
 const bad=pg();const query=bad.query.bind(bad);bad.query=async(sql,args)=>{if(sql.startsWith('UPDATE receipts SET deleted_at'))throw Error('cascade failed');return query(sql,args)};await assert.rejects(f.c.pushDocumentDeletion(bad,f.c.currentDocumentDeletion('invoice',1),async()=>70),/cascade failed/);assert.equal(bad.calls.at(-1).sql,'ROLLBACK');assert.ok(!bad.calls.some(q=>q.sql==='COMMIT'));
});
test('Online restore writes draft and never restores linked receipts implicitly',async()=>{
 const f=setup();f.c.changeDocumentDeletion('invoice',1);f.c.changeDocumentDeletion('invoice',1,true);const online=pg();await f.c.pushDocumentDeletion(online,f.c.currentDocumentDeletion('invoice',1),async()=>70);const update=online.calls.find(q=>q.sql.startsWith('UPDATE invoices SET deleted_at'));assert.equal(update.values[0],null);assert.equal(update.values[2],'draft');assert.ok(!online.calls.some(q=>q.sql.startsWith('UPDATE receipts SET deleted_at')));
});

test('pulling an Online cancellation clears local accounting and preserves cancelled status',()=>{
 const f=setup();f.db.exec("CREATE TABLE customer_ledger(id INTEGER,invoice_id INTEGER,receipt_id INTEGER);INSERT INTO customer_ledger VALUES(1,1,2);");assert.equal(f.c.blocksDocumentPull('receipt',{receipt_number:'REC-2026-0001',status:'cancelled',deleted_at:'2026-10-08T09:00:00Z'},2,7,1),true);assert.equal(f.row('receipt',2).status,'cancelled');assert.ok(f.row('receipt',2).deleted_at);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM customer_ledger').get().n,0);
});

test('receipt settlement queues paid status once; reversal queues issued status',()=>{
 const f=setup();f.db.exec("UPDATE receipts SET amount=100;");assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),true);assert.equal(f.row('invoice',1).status,'paid');assert.equal(f.queue()[0].entity_type,'invoice');assert.equal(JSON.parse(f.queue()[0].payload_json).status,'paid');assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),false);assert.equal(f.queue().length,1);f.db.exec("UPDATE receipts SET status='cancelled';");assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),true);assert.equal(f.row('invoice',1).status,'issued');assert.equal(JSON.parse(f.queue().at(-1).payload_json).status,'issued');
});
test('invoice payment status rolls back if queue insert fails',()=>{
 const f=setup();f.db.exec("UPDATE receipts SET amount=100;CREATE TRIGGER fail BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT,'queue rejected');END;");assert.throws(()=>f.c.refreshAndQueueInvoicePaymentStatus(1),/queue rejected/);assert.equal(f.row('invoice',1).status,'issued');assert.equal(f.row('invoice',1).updated_at,1000);
});
test('payment recalculation never issues drafts, revives cancelled/deleted invoices, or counts cancelled receipts',()=>{
 for(const status of ['draft','cancelled']){const f=setup();f.db.prepare('UPDATE invoices SET status=?').run(status);f.db.exec('UPDATE receipts SET amount=100;');assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),false);assert.equal(f.row('invoice',1).status,status);assert.equal(f.queue().length,0);}
 const f=setup();f.db.exec("UPDATE receipts SET amount=100,status='cancelled';");assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),false);f.db.exec("UPDATE receipts SET status='issued';UPDATE invoices SET deleted_at=100;");assert.equal(f.c.refreshAndQueueInvoicePaymentStatus(1),false);assert.equal(f.queue().length,0);
});
test('manual invoice edits enqueue status and surface queue failures',async()=>{
 const f=setup();f.c.console={log(){},error(){}};vm.runInContext(executable('utils/sync-queue.ts').replace(/type SyncEntityType[\s\S]*?export /,''),f.c);await f.c.enqueueSyncChange({entityType:'invoice',entityId:1,action:'update',payload:{status:'cancelled'},userId:9});assert.equal(f.queue().length,1);assert.equal(JSON.parse(f.queue()[0].payload_json).status,'cancelled');f.db.exec("CREATE TRIGGER fail BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT,'queue rejected');END;");await assert.rejects(f.c.enqueueSyncChange({entityType:'invoice',entityId:1,action:'update'}),/queue rejected/);
});
