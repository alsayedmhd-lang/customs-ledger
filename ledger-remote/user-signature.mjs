const fail=(status,message)=>Object.assign(Error(message),{status});
export function validateSignature(input){
 const id=Number(input?.id),signature=input?.signature;
 if(!Number.isSafeInteger(id)||id<1||typeof signature!=='string')throw fail(400,'Invalid signature');
 if(signature!==''&&(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signature)||signature.length>50000||!Buffer.from(signature.split(',')[1],'base64').subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))))throw fail(400,'صورة التوقيع غير صالحة / Invalid signature image');
 return {id,signature};
}
export async function saveUserSignature(pool,input,actor,enabled){
 if(actor?.role!=='admin')throw fail(403,'Access denied');if(!enabled)throw fail(409,'Saving disabled');
 const {id,signature}=validateSignature(input),db=await pool.connect();
 try{
 await db.query('BEGIN READ WRITE');
 const fresh=(await db.query('SELECT id,role,is_active,pending_approval FROM users WHERE id=$1 FOR UPDATE',[actor.id])).rows[0];
 if(!fresh||fresh.role!=='admin'||fresh.is_active!==true||fresh.pending_approval)throw fail(403,'Access denied');
 const target=(await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!target)throw fail(404,'User not found');
 await db.query('UPDATE users SET receiver_signature_base64=$1 WHERE id=$2',[signature||null,id]);
 await db.query('COMMIT');return {id,saved:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
