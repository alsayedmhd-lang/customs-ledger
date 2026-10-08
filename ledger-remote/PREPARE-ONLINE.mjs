import {publishDraft} from './publish-draft.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},connectionTimeoutMillis:5000});
try{await client.connect();
 const backup=new URL('./update-backups/online-before-web-sync-'+new Date().toISOString().replace(/[:.]/g,'-')+'/',import.meta.url);
 await mkdir(backup,{recursive:true});
 for(const table of ['invoices','invoice_items','receipts','ledger_remote_invoice_drafts','ledger_remote_counters','ledger_remote_receipt_drafts']) {
  const found=(await client.query('SELECT to_regclass($1) AS name',['public.'+table])).rows[0];
  if(found?.name)await writeFile(new URL(table+'.json',backup),JSON.stringify((await client.query(`SELECT row_to_json(t) AS row FROM ${table} t`)).rows.map(r=>r.row)));
 }
 console.log('Online records backed up locally before preparation.');
 await client.query(await readFile(new URL('./remote-schema.sql',import.meta.url),'utf8'));await client.query('BEGIN');
 for(const row of (await client.query('SELECT payload FROM ledger_remote_invoice_drafts ORDER BY created_at')).rows){
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['ledger-web:'+row.payload.syncId]);
  await publishDraft(client,row.payload);
 }
 await client.query('COMMIT');
 console.log('Online draft sync prepared. Existing Remote invoices published once. Desktop sync required.');}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
