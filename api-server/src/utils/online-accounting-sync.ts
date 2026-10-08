import { createHash } from 'node:crypto';
const money = ['payments','transportation','labor','other_expenses'];
const flags = ['transportation_paid','labor_paid','other_expenses_paid'];
const text = ['driver_name','unload_location'];
const fields = [...money,...text,...flags];
type Row = Record<string, any>;
export function accountingData(row: Row | null): Row | null {
  if (!row) return null;
  const data: Row = {};
  for (const key of money) {
    const value=Number(row[key]??0);
    if (!Number.isFinite(value)||value<0) throw Error('Invalid accounting amount');
    data[key]=value;
  }
  for (const key of text) data[key]=String(row[key]??'').trim()||null;
  for (const key of flags) {
    if (![true,false,0,1,'0','1','true','false',null,undefined].includes(row[key])) throw Error('Invalid accounting flag');
    data[key]=[true,1,'1','true'].includes(row[key]);
  }
  return data;
}
export function accountingFingerprint(row: Row | null): string {
  return createHash('sha256').update(JSON.stringify(accountingData(row))).digest('hex');
}
export function accountingDecision(local: Row|null, online: Row|null, baseline: Row|null, mode: string): string {
  const l=accountingFingerprint(local),r=accountingFingerprint(online);
  if(l===r) return 'equal';
  const push=mode!=='online-to-local',pull=mode!=='local-to-online';
  if(!baseline){
    const empty=accountingFingerprint({});
    if((!online||r===empty)&&local) return push?'push':'pending';
    if((!local||l===empty)&&online) return pull?'pull':'pending';
    return 'conflict';
  }
  const lc=l!==baseline.local_hash,rc=r!==baseline.online_hash;
  if(lc&&rc) return 'conflict';
  if(lc) return local?(push?'push':'pending'):'conflict';
  if(rc) return online?(pull?'pull':'pending'):'conflict';
  return 'conflict';
}
function setup(db: any){
 db.exec(`CREATE TABLE IF NOT EXISTS ledger_online_accounting_state(
  target_key TEXT NOT NULL,local_invoice_id INTEGER NOT NULL,online_invoice_id TEXT NOT NULL,
  local_hash TEXT NOT NULL,online_hash TEXT NOT NULL,updated_at INTEGER NOT NULL,
  PRIMARY KEY(target_key,local_invoice_id));
  CREATE TABLE IF NOT EXISTS ledger_online_accounting_backups(
  id INTEGER PRIMARY KEY AUTOINCREMENT,target_key TEXT NOT NULL,local_invoice_id INTEGER NOT NULL,
  direction TEXT NOT NULL,previous_json TEXT NOT NULL,created_at INTEGER NOT NULL);`);
}
export async function syncOnlineAccounting(db: any, client: any, mode: string, connectionString: string) {
 setup(db);
 const target=createHash('sha256').update(connectionString).digest('hex');
 const cols=(await client.query("SELECT attname AS name,format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid=to_regclass('public.invoice_accounting') AND attnum>0 AND NOT attisdropped")).rows;
 const types: Row=Object.fromEntries(cols.map((c:Row)=>[c.name,c.type]));
 if(['invoice_id',...fields].some(k=>!types[k])) throw Error('Online accounting table is not ready; no accounting values changed');
 const localInvoices=db.prepare(`SELECT i.id,i.invoice_number,i.issue_date,i.subtotal,c.name AS client_name FROM invoices i JOIN clients c ON c.id=i.client_id WHERE i.deleted_at IS NULL ORDER BY i.id`).all() as Row[];
 const result={pushed:0,pulled:0,equal:0,pending:0,unmapped:0,conflicts:[] as string[]};
 const localRows=(id:any)=>db.prepare('SELECT * FROM invoice_accounting WHERE invoice_id=?').all(id) as Row[];
 const saveState=(id:any,remote:any,l:Row|null,r:Row|null)=>db.prepare(`INSERT INTO ledger_online_accounting_state(target_key,local_invoice_id,online_invoice_id,local_hash,online_hash,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(target_key,local_invoice_id) DO UPDATE SET online_invoice_id=excluded.online_invoice_id,local_hash=excluded.local_hash,online_hash=excluded.online_hash,updated_at=excluded.updated_at`).run(target,id,String(remote),accountingFingerprint(l),accountingFingerprint(r),Date.now());
 for(const invoice of localInvoices){
  await client.query('BEGIN');
  try{
   await client.query("SET LOCAL lock_timeout='10s'");
   const matches=(await client.query(`SELECT i.id FROM invoices i JOIN clients c ON c.id=i.client_id WHERE i.invoice_number=$1 AND lower(trim(c.name))=lower(trim($2)) AND i.issue_date::text=$3 AND abs(COALESCE(i.subtotal,0)-$4::numeric)<0.005 AND i.deleted_at IS NULL ORDER BY i.id FOR UPDATE OF i`,[invoice.invoice_number,invoice.client_name,String(invoice.issue_date).slice(0,10),Number(invoice.subtotal||0)])).rows;
   if(matches.length!==1){result.unmapped++;await client.query('COMMIT');continue;}
   const onlineId=matches[0].id;
   const remoteRows=(await client.query('SELECT * FROM invoice_accounting WHERE invoice_id=$1 FOR UPDATE',[onlineId])).rows;
   const locals=localRows(invoice.id);
   if(locals.length>1||remoteRows.length>1){result.conflicts.push(invoice.invoice_number+' (duplicate accounting records)');await client.query('ROLLBACK');continue;}
   const local=locals[0]||null,online=remoteRows[0]||null;
   let state=db.prepare('SELECT * FROM ledger_online_accounting_state WHERE target_key=? AND local_invoice_id=?').get(target,invoice.id) as Row|null;
   if(state&&String(state.online_invoice_id)!==String(onlineId))state=null;
   const decision=accountingDecision(local,online,state,mode);
   if(decision==='conflict'){result.conflicts.push(invoice.invoice_number);await client.query('ROLLBACK');continue;}
   if(decision==='pending'){result.pending++;await client.query('COMMIT');continue;}
   if(decision==='push'){
    const values=fields.map(k=>flags.includes(k)&&types[k]!=='boolean'?(accountingData(local)![k]?1:0):accountingData(local)![k]);
    const keys=[...fields];
    if(types.updated_at&&/^timestamp/.test(types.updated_at)){keys.push('updated_at');values.push(new Date());}
    else if(types.updated_at&&/^(integer|bigint|numeric)/.test(types.updated_at)){keys.push('updated_at');values.push(Date.now());}
    // Keep the exact previous Online values before changing them.
    db.prepare('INSERT INTO ledger_online_accounting_backups(target_key,local_invoice_id,direction,previous_json,created_at) VALUES(?,?,?,?,?)').run(target,invoice.id,'push',JSON.stringify(online),Date.now());
    if(online){values.push(onlineId);await client.query(`UPDATE invoice_accounting SET ${keys.map((k,n)=>'"'+k+'"=$'+(n+1)).join(',')} WHERE invoice_id=$${values.length}`,values);}
    else{keys.push('invoice_id');values.push(onlineId);await client.query(`INSERT INTO invoice_accounting (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${values.map((_,n)=>'$'+(n+1)).join(',')})`,values);}
    await client.query('COMMIT');
    saveState(invoice.id,onlineId,local,local);result.pushed++;
   }else if(decision==='pull'){
    // Recheck SQLite inside its transaction: UI edits during network reads win.
    db.transaction(()=>{
     const latest=localRows(invoice.id);
     if(latest.length>1||accountingFingerprint(latest[0]||null)!==accountingFingerprint(local))throw Error('Desktop accounting changed during sync: '+invoice.invoice_number);
     const currentInvoice=db.prepare('SELECT subtotal,deleted_at FROM invoices WHERE id=?').get(invoice.id);
     if(!currentInvoice||currentInvoice.deleted_at!=null||Number(currentInvoice.subtotal)!==Number(invoice.subtotal))throw Error('Desktop invoice changed during sync');
     db.prepare('INSERT INTO ledger_online_accounting_backups(target_key,local_invoice_id,direction,previous_json,created_at) VALUES(?,?,?,?,?)').run(target,invoice.id,'pull',JSON.stringify(local),Date.now());
     const control=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='internal_sync_control'").get();
     const capture=control?db.prepare('SELECT capture_enabled FROM internal_sync_control WHERE id=1').get():null;
     if(capture)db.prepare('UPDATE internal_sync_control SET capture_enabled=0 WHERE id=1').run();
     try{
      const data=accountingData(online)!;const values=fields.map(k=>flags.includes(k)?(data[k]?1:0):data[k]);values.push(Date.now());
      if(local)db.prepare(`UPDATE invoice_accounting SET ${[...fields,'updated_at'].map(k=>'"'+k+'"=?').join(',')} WHERE invoice_id=?`).run(...values,invoice.id);
      else db.prepare(`INSERT INTO invoice_accounting(${['invoice_id',...fields,'updated_at'].map(k=>'"'+k+'"').join(',')}) VALUES(${Array(fields.length+2).fill('?').join(',')})`).run(invoice.id,...values);
      saveState(invoice.id,onlineId,online,online);
     }finally{if(capture)db.prepare('UPDATE internal_sync_control SET capture_enabled=? WHERE id=1').run(capture.capture_enabled);}
    })();
    await client.query('COMMIT');result.pulled++;
   }else{await client.query('COMMIT');saveState(invoice.id,onlineId,local,online);result.equal++;}
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
 }
 return result;
}
