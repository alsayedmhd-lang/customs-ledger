import {createHash} from 'node:crypto';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function canCreateMaster(user){return !!user&&['admin','manager','user','supervisor'].includes(user.role);}
function text(value,max,required=false){if(value!=null&&typeof value!=='string')throw fail(400,'قيمة نصية غير صحيحة / Invalid text');const s=(value||'').trim();if(s.length>max||(required&&!s))throw fail(400,'تحقق من الحقول المطلوبة وطول النص / Check required fields and text length');return s;}
export function validateMaster(input){
 if(!input||!['client','template'].includes(input.kind))throw fail(400,'نوع غير صحيح / Invalid kind');
 if(typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId))throw fail(400,'هوية طلب غير صحيحة / Invalid request ID');
 const base={kind:input.kind,requestId:input.requestId.toLowerCase()};
 if(input.kind==='client'){
  const d={...base,name:text(input.name,200,true),email:text(input.email,254).toLowerCase(),phone:text(input.phone,50),address:text(input.address,1000),taxId:text(input.taxId,100),notes:text(input.notes,2000)};
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))throw fail(400,'البريد الإلكتروني غير صحيح / Invalid email');return d;
 }
 const price=String(input.defaultUnitPrice??'0').trim();if(!/^\d{1,10}(\.\d{1,2})?$/.test(price)||Number(price)>9999999999.99)throw fail(400,'السعر يجب أن يكون موجبًا أو صفرًا وبمنزلتين عشريتين / Invalid price');
 return {...base,description:text(input.description,500,true),defaultUnitPrice:Number(price).toFixed(2)};
}
const recordVersion=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
async function readRecord(db,kind,id,lock=false){
 const query=kind==='client'?'SELECT id,name,email,phone,address,tax_id,notes FROM clients WHERE id=$1':'SELECT id,description,default_unit_price,item_code FROM invoice_item_templates WHERE id=$1';
 const row=(await db.query(query+(lock?' FOR UPDATE':''),[id])).rows[0];if(!row)throw fail(404,'السجل غير موجود / Record not found');return row;
}
export async function readMaster(pool,kind,id,user){
 if(!canCreateMaster(user))throw fail(403,'Access denied');
 if(!['client','template'].includes(kind)||!Number.isSafeInteger(id)||id<=0)throw fail(400,'Invalid record');
 const row=await readRecord(pool,kind,id);return {record:row,version:recordVersion(row)};
}
export async function createMaster(pool,input,user,enabled,editing=false){
 if(!enabled)throw fail(409,'الحفظ غير مفعّل / Saving is disabled');
 if(!canCreateMaster(user))throw fail(403,'لا توجد صلاحية للإضافة / Access denied');
 const d=validateMaster(input);
 if(editing){input={...input,id:typeof input.id==='string'&&/^[1-9][0-9]*$/.test(input.id)?Number(input.id):input.id};if(!Number.isSafeInteger(input.id)||input.id<=0||typeof input.version!=='string'||! /^[a-f0-9]{64}$/.test(input.version))throw fail(400,'هوية التعديل غير صحيحة / Invalid edit identity');d.id=input.id;d.version=input.version;}
 const operation=d.kind+(editing?'-update':'');const hash=createHash('sha256').update(JSON.stringify({...d,createdBy:user.id})).digest('hex');const db=await pool.connect();
 try{
  await db.query('BEGIN READ WRITE');
  // Serialize Remote creations and first-time request table preparation.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('ledger-remote-master-create',0))");
  const account=(await db.query('SELECT role,is_active,pending_approval,two_factor_email,two_factor_whatsapp FROM users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
  if(!canCreateMaster(account)||!account.is_active||account.pending_approval||account.two_factor_email||account.two_factor_whatsapp)throw fail(403,'لا توجد صلاحية للإضافة / Access denied');
  await db.query('CREATE TABLE IF NOT EXISTS ledger_remote_master_requests (request_id uuid PRIMARY KEY,created_by integer NOT NULL,request_hash text NOT NULL,kind text NOT NULL,record_id integer NOT NULL,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const prior=(await db.query('SELECT created_by,request_hash,kind,record_id FROM ledger_remote_master_requests WHERE request_id=$1',[d.requestId])).rows[0];
  if(prior){if(Number(prior.created_by)!==Number(user.id)||prior.request_hash!==hash||prior.kind!==operation)throw fail(409,'الطلب السابق يحمل بيانات مختلفة؛ افتح نموذجًا جديدًا / Request conflict');await db.query('COMMIT');return {id:prior.record_id,kind:d.kind,replayed:true};}
  let record;
  if(editing){const current=await readRecord(db,d.kind,d.id,true);if(recordVersion(current)!==d.version)throw fail(409,'تم تغيير السجل؛ أغلق النموذج وافتحه مجددًا / Record changed; reopen the editor');}
  if(d.kind==='client'){
   const duplicate=(await db.query(`SELECT id FROM clients WHERE id<>$5 AND (LOWER(BTRIM(name))=LOWER(BTRIM($1)) OR ($2<>'' AND LOWER(BTRIM(COALESCE(email,'')))=$2) OR ($3<>'' AND regexp_replace(COALESCE(phone,''),'[^0-9+]','','g')=$3) OR ($4<>'' AND LOWER(BTRIM(COALESCE(tax_id,'')))=LOWER($4))) LIMIT 1`,[d.name,d.email,d.phone.replace(/[^\d+]/g,''),d.taxId,editing?d.id:0])).rows[0];
   if(duplicate)throw fail(409,'يوجد عميل بنفس الاسم أو بيانات الهوية؛ استخدم العميل الموجود / Client already exists');
   if(editing)record=(await db.query('UPDATE clients SET name=$1,email=$2,phone=$3,address=$4,tax_id=$5,notes=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$7 RETURNING id',[d.name,d.email||null,d.phone||null,d.address||null,d.taxId||null,d.notes||null,d.id])).rows[0];
   else record=(await db.query('INSERT INTO clients(name,email,phone,address,tax_id,notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',[d.name,d.email||null,d.phone||null,d.address||null,d.taxId||null,d.notes||null])).rows[0];
  }else{
   await db.query("ALTER TABLE invoice_item_templates ADD COLUMN IF NOT EXISTS updated_at timestamp");
   const duplicate=(await db.query("SELECT id FROM invoice_item_templates WHERE id<>$2 AND LOWER(regexp_replace(BTRIM(description),'\\s+',' ','g'))=LOWER(regexp_replace(BTRIM($1),'\\s+',' ','g')) LIMIT 1",[d.description,editing?d.id:0])).rows[0];
   if(duplicate)throw fail(409,'يوجد بند بنفس الوصف؛ استخدم البند الموجود / Item already exists');
   if(editing)record=(await db.query('UPDATE invoice_item_templates SET description=$1,default_unit_price=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id',[d.description,d.defaultUnitPrice,d.id])).rows[0];
   else record=(await db.query('INSERT INTO invoice_item_templates(description,default_unit_price,item_code,created_at,updated_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',[d.description,d.defaultUnitPrice,'X-W-'+d.requestId])).rows[0];
  }
  await db.query('INSERT INTO ledger_remote_master_requests(request_id,created_by,request_hash,kind,record_id) VALUES($1,$2,$3,$4,$5)',[d.requestId,user.id,hash,operation,record.id]);
  await db.query('COMMIT');return {id:record.id,kind:d.kind,replayed:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
