const fail=(status,message)=>Object.assign(Error(message),{status});
export const canAssignRepresentative=user=>['admin','supervisor','manager'].includes(user?.role);
const positive=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
export function recordScope(user){
 if(['admin','supervisor','manager'].includes(user?.role))return {all:true};
 if(user?.role==='user'&&positive(user.id))return {column:'created_by',value:Number(user.id)};
 if(user?.role==='client'&&positive(user.client_id))return {column:'client_id',value:Number(user.client_id)};
 return {denied:true};
}
export function receiptOwnerSql(alias,parameter){const prefix=alias?alias+'.':'';return `(${prefix}created_by=${parameter} OR EXISTS (SELECT 1 FROM invoices receipt_parent WHERE receipt_parent.id=${prefix}invoice_id AND receipt_parent.created_by=${parameter}))`;}
export function recordWhere(user,alias,bind,kind='invoice'){const scope=recordScope(user);if(scope.all)return 'TRUE';if(scope.denied)return 'FALSE';const parameter=bind(scope.value);return kind==='receipt'&&user.role==='user'?receiptOwnerSql(alias,parameter):`${alias?alias+'.':''}${scope.column}=${parameter}`;}
export async function assertReceipt(db,user,row){
 if(user?.role!=='user'||Number(row?.created_by)===Number(user.id)){assertRecord(user,row);return;}
 if(row?.invoice_id){const parent=(await db.query('SELECT created_by FROM invoices WHERE id=$1',[row.invoice_id])).rows[0];if(parent&&Number(parent.created_by)===Number(user.id))return;}
 throw fail(404,'Document not found');
}
export function assertRecord(user,row){const scope=recordScope(user);if(!row||scope.denied||(!scope.all&&Number(row[scope.column])!==scope.value))throw fail(404,'Document not found');}
export async function requireRecord(pool,user,kind,id){
 if(recordScope(user).all)return;
 if(!['invoice','receipt'].includes(kind))throw fail(400,'Invalid document');
 const table=kind==='invoice'?'invoices':'receipts';let row;
 if(kind==='invoice'&&String(id).startsWith('web:')){
  const uuid=String(id).slice(4);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid))throw fail(400,'Invalid invoice');
  row=(await pool.query("SELECT created_by,client_id FROM invoices WHERE to_jsonb(invoices)->>'sync_id'=$1",[uuid.toLowerCase()])).rows[0];
  if(!row){const ready=(await pool.query("SELECT to_regclass('public.ledger_remote_invoice_drafts') AS drafts")).rows[0];if(ready?.drafts)row=(await pool.query("SELECT COALESCE(NULLIF(payload->>'salesManId','')::integer,created_by) AS created_by,client_id FROM ledger_remote_invoice_drafts WHERE sync_id=$1",[uuid.toLowerCase()])).rows[0];}
 }else{if(!positive(id))throw fail(400,'Invalid document');row=(await pool.query(`SELECT created_by,client_id${kind==='receipt'?',invoice_id':''} FROM ${table} WHERE id=$1`,[Number(id)])).rows[0];}
 if(kind==='receipt')await assertReceipt(pool,user,row);else assertRecord(user,row);
}
export function scopedReport(sql,user,values){const scope=recordScope(user);if(scope.all||user?.role==='client'&&!scope.denied)return {text:sql,values};const predicate=scope.denied?'FALSE':`${scope.column}=$${values.length+1}`;return {text:sql.replaceAll('i.deleted_at IS NULL',`i.deleted_at IS NULL AND ${scope.denied?'FALSE':'i.'+predicate}`).replaceAll('r.deleted_at IS NULL',`r.deleted_at IS NULL AND ${scope.denied?'FALSE':receiptOwnerSql('r','$'+(values.length+1))}`),values:scope.denied?values:[...values,scope.value]};}
