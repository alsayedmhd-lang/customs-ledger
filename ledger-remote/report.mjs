export function money(value){return Number(value||0);}
export function demoReport(invoices,receipts,clientId,from='',to='',f={page:1,pageSize:500,offset:0,q:''}){
const events=[];for(const i of invoices){if(clientId&&i.client_id!==clientId||!['issued','paid'].includes(i.status))continue;const gross=money(i.subtotal)+money(i.tax_amount);events.push({client_id:i.client_id,date:i.issue_date,number:i.invoice_number,type:'invoice',debit:gross>0?gross:money(i.total)+money(i.advance_payment),credit:0});if(money(i.advance_payment))events.push({client_id:i.client_id,date:i.issue_date,number:i.invoice_number,type:'advance',debit:0,credit:money(i.advance_payment)});}for(const r of receipts){if(clientId&&r.client_id!==clientId||r.status!=='issued')continue;events.push({client_id:r.client_id,date:r.receipt_date,number:r.receipt_number,type:'receipt',debit:0,credit:money(r.amount)});}const opening=events.filter(e=>from&&e.date<from).reduce((s,e)=>s+e.debit-e.credit,0);const filtered=events.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to)).sort((a,b)=>a.date.localeCompare(b.date)||({invoice:0,advance:1,receipt:2}[a.type]-{invoice:0,advance:1,receipt:2}[b.type]));let balance=opening;const rows=filtered.map(e=>({...e,balance:balance+=e.debit-e.credit}));const debit=filtered.reduce((s,e)=>s+e.debit,0),credit=filtered.reduce((s,e)=>s+e.credit,0);const matches=rows.filter(r=>!f.q||Object.values(r).join(' ').toLowerCase().includes(f.q.toLowerCase()));return {opening,debit,credit,closing:opening+debit-credit,fullCount:rows.length,count:matches.length,rows:matches.slice(f.offset,f.offset+f.pageSize),truncated:matches.length>f.pageSize};}
export const reportSql=`WITH events AS (
 SELECT i.client_id,i.issue_date AS date,i.invoice_number AS number,'invoice' AS type,0 AS rank,i.id,
 CASE WHEN COALESCE(i.subtotal,0)+COALESCE(i.tax_amount,0)>0 THEN COALESCE(i.subtotal,0)+COALESCE(i.tax_amount,0) ELSE COALESCE(i.total,0)+COALESCE(i.advance_payment,0) END AS debit,0::numeric AS credit
 FROM invoices i WHERE i.deleted_at IS NULL AND i.status IN ('issued','paid') AND ($1::integer IS NULL OR i.client_id=$1)
 UNION ALL SELECT i.client_id,i.issue_date,i.invoice_number,'advance',1,i.id,0::numeric,COALESCE(i.advance_payment,0)
 FROM invoices i WHERE i.deleted_at IS NULL AND i.status IN ('issued','paid') AND COALESCE(i.advance_payment,0)<>0 AND ($1::integer IS NULL OR i.client_id=$1)
 UNION ALL SELECT r.client_id,r.receipt_date,r.receipt_number,'receipt',2,r.id,0::numeric,r.amount
 FROM receipts r WHERE r.deleted_at IS NULL AND r.status='issued' AND ($1::integer IS NULL OR r.client_id=$1)
), opening AS (SELECT COALESCE(SUM(debit-credit),0) AS amount FROM events WHERE $2::text<>'' AND date<$2), period AS (
 SELECT * FROM events WHERE ($2::text='' OR date>=$2) AND ($3::text='' OR date<=$3)
), detailed AS (
 SELECT e.*,c.name AS client_name,(SELECT amount FROM opening)+SUM(e.debit-e.credit) OVER (ORDER BY e.date,e.rank,e.id,e.client_id ROWS UNBOUNDED PRECEDING) AS balance
 FROM period e LEFT JOIN clients c ON c.id=e.client_id
)
SELECT (SELECT amount FROM opening) AS opening,COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit,
(SELECT amount FROM opening)+COALESCE(SUM(debit-credit),0) AS closing,COUNT(*) AS "fullCount",(SELECT count(*) FROM detailed WHERE $4::text='' OR strpos(lower(concat_ws(' ',number,type,client_name)),lower($4))>0) AS count,
COALESCE((SELECT json_agg(x) FROM (SELECT * FROM detailed WHERE $4::text='' OR strpos(lower(concat_ws(' ',number,type,client_name)),lower($4))>0 ORDER BY date,rank,id,client_id LIMIT $5 OFFSET $6) x),'[]'::json) AS rows FROM period`;
