import {recordWhere} from './record-access.mjs';
import {canIssue} from './issue-document.mjs';
import {readFilters} from './list-query.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function trashAllowed(user,kind){const page=kind==='invoice'?'invoices':'receipts';return ['invoice','receipt'].includes(kind)&&canIssue(user,kind)&&(!user.remotePages||(user.remotePages.includes('trash')&&user.remotePages.includes(page)));}
export async function readTrash(pool,user,params){
 const kind=params.get('kind')||'invoice';if(!['invoice','receipt'].includes(kind))throw fail(400,'Invalid trash type');if(!trashAllowed(user,kind))throw fail(403,'Access denied');
 const f=readFilters(params),invoice=kind==='invoice',table=invoice?'invoices':'receipts',number=invoice?'invoice_number':'receipt_number';
 const values=[],bind=v=>{values.push(v);return '$'+values.length;},where=['t.deleted_at IS NOT NULL'];where.push(recordWhere(user,'t',bind,kind));
 if(f.q){const p=bind(f.q);where.push(`strpos(lower(concat_ws(' ',t.${number},c.name,${invoice?'t.invoice_number':'i.invoice_number'})),lower(${p}))>0`);}
 if(f.from)where.push(`t.deleted_at::date>=${bind(f.from)}::date`);if(f.to)where.push(`t.deleted_at::date<=${bind(f.to)}::date`);
 const limit=bind(f.pageSize),offset=bind(f.offset);
 const text=`WITH filtered AS (SELECT t.id,t.${number} AS number,c.name AS client_name,t.status,t.deleted_at,${invoice?'t.invoice_number':'i.invoice_number'} AS invoice_number,${invoice?`COALESCE((SELECT string_agg(r.receipt_number, ', ' ORDER BY r.id) FROM receipts r WHERE r.invoice_id=t.id AND ${recordWhere(user,'r',bind,'receipt')}),'')`:'NULL::text'} AS linked_receipts
 FROM ${table} t LEFT JOIN clients c ON c.id=t.client_id ${invoice?'':'LEFT JOIN invoices i ON i.id=t.invoice_id'}
 WHERE ${where.join(' AND ')}),paged AS (SELECT * FROM filtered ORDER BY deleted_at DESC,id DESC LIMIT ${limit} OFFSET ${offset})
 SELECT (SELECT count(*) FROM filtered) AS count,COALESCE((SELECT json_agg(p ORDER BY deleted_at DESC,id DESC) FROM paged p),'[]'::json) AS rows`;
 const result=(await pool.query(text,values)).rows[0],count=Number(result.count);return {kind,rows:result.rows,count,page:f.page,pages:Math.max(1,Math.ceil(count/f.pageSize)),pageSize:f.pageSize};
}
