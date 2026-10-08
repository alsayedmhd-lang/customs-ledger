import{randomUUID}from'node:crypto';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function validateNewUser(input){
 const username=String(input?.username||'').trim().toLowerCase(),name=String(input?.displayName||'').trim(),password=input?.password,role=input?.role;
 if(!/^[a-z0-9_.@-]{3,100}$/.test(username)||!name||name.length>150||typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72||!['supervisor','user','client'].includes(role))throw fail(400,'راجع الاسم واسم الدخول وكلمة السر والدور / Check name, username, password and role');
 const email=String(input.email||'').trim(),phone=String(input.phone||'').trim(),key=String(input.whatsappApiKey||'').trim();
 if(email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||phone.length>40||key.length>250)throw fail(400,'Invalid contact details');
 if(input.twoFactorEmail&&!email||input.twoFactorWhatsapp&&(!phone||!key))throw fail(400,'أكمل بيانات قناة OTP / Complete OTP channel details');
 const clientId=input.clientId?Number(input.clientId):null;
 if(role==='client'&&(!Number.isSafeInteger(clientId)||clientId<1))throw fail(400,'اختر العميل المرتبط / Select linked client');
 return {username,password_hash:password,display_name:name,role,is_active:input.isActive!==false,pending_approval:false,email:email||null,phone:phone||null,whatsapp_api_key:key||null,two_factor_email:input.twoFactorEmail===true,two_factor_whatsapp:input.twoFactorWhatsapp===true,client_id:role==='client'?clientId:null,permissions:JSON.stringify({}),client_view_permissions:JSON.stringify({})};
}
export async function createRemoteUser(pool,input,actor,enabled,hash=async password=>(await import('bcryptjs')).hash(password,12)){
 if(actor?.role!=='admin')throw fail(403,'Access denied');if(!enabled)throw fail(409,'Saving disabled');
 const values=validateNewUser(input);values.password_hash=await hash(values.password_hash);const db=await pool.connect();
 try{await db.query('BEGIN READ WRITE');await db.query('SELECT pg_advisory_xact_lock(709041,1)');
 const admin=(await db.query('SELECT role,is_active,pending_approval FROM users WHERE id=$1 FOR UPDATE',[actor.id])).rows[0];if(!admin||admin.role!=='admin'||admin.is_active!==true||admin.pending_approval)throw fail(403,'Access denied');
 if((await db.query('SELECT id FROM users WHERE LOWER(TRIM(username))=$1',[values.username])).rows.length)throw fail(409,'اسم الدخول مستخدم بالفعل / Username already exists');
 if(values.client_id&&!(await db.query('SELECT id FROM clients WHERE id=$1',[values.client_id])).rows.length)throw fail(400,'Client not found');
 const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users'")).rows.map(row=>row.column_name);
 const syncId=randomUUID();for(const key of ['sync_id','user_sync_id'])if(columns.includes(key))values[key]=syncId;
 const keys=Object.keys(values).filter(key=>columns.includes(key));
 const user=(await db.query('INSERT INTO users ('+keys.map(key=>'"'+key+'"').join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING id,username,display_name,role,is_active',keys.map(key=>values[key]))).rows[0];
 await db.query('COMMIT');return {user};
 }catch(e){await db.query('ROLLBACK');if(e.code==='23505')throw fail(409,'اسم الدخول مستخدم بالفعل / Username already exists');throw e;}finally{db.release();}
}
