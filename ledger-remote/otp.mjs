import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest();
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export async function sendOtp(user,code){
 let sent=false;
 if(user.two_factor_whatsapp&&user.phone&&user.whatsapp_api_key){
  const url=new URL('https://api.callmebot.com/whatsapp.php');
  url.search=new URLSearchParams({phone:user.phone.replace(/[\s+-]/g,''),text:`Ledger Remote\nرمز التحقق / Verification code: ${code}\nصالح لمدة 5 دقائق / Valid for 5 minutes`,apikey:user.whatsapp_api_key});
  try{sent=(await fetch(url,{signal:AbortSignal.timeout(15000)})).ok;}catch{}
 }
 if(user.two_factor_email&&user.email&&process.env.BREVO_API_KEY&&process.env.SMTP_FROM){
  try{const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','api-key':process.env.BREVO_API_KEY},body:JSON.stringify({sender:{name:'Ledger Remote',email:process.env.SMTP_FROM},to:[{email:user.email}],subject:'Ledger Remote — رمز التحقق / Verification code',textContent:`رمز التحقق / Verification code: ${code}\nصالح لمدة 5 دقائق / Valid for 5 minutes`})});sent=response.ok||sent;}catch{}
 }
 if(!sent)throw failure('تعذر إرسال الرمز. راجع إعدادات البريد أو واتساب. / Unable to send code. Check email or WhatsApp settings.',503);
}
export function createOtpService(deliver=sendOtp,now=Date.now){
 const pending=new Map();
 function get(token){const entry=pending.get(String(token||''));if(!entry||entry.expires<=now()){pending.delete(token);throw failure('انتهت جلسة التحقق. سجّل الدخول مجددًا. / Verification expired. Sign in again.',400);}return entry;}
 async function issue(user,ip){
  for(const [key,value]of pending)if(value.expires<=now()||value.user.id===user.id)pending.delete(key);
  if(pending.size>=1000)throw failure('حاول لاحقًا / Try again later',429);
  const token=randomBytes(32).toString('hex'),code=String(randomInt(100000,1000000));
  let visibleCode;try{await deliver(user,code);}catch(error){if(error.status!==503)throw error;visibleCode=code;}pending.set(token,{user,ip,digest:hash(code),expires:now()+300000,sentAt:now(),attempts:0,busy:false,resends:0});
  return {requiresOtp:true,otpToken:token,expiresAt:now()+300000,...(visibleCode?{visibleCode}:{})};
 }
 async function resend(token,ip){
  const entry=get(token);if(entry.ip!==ip)throw failure('جلسة غير صالحة / Invalid verification session',400);
  if(entry.busy||now()-entry.sentAt<60000||entry.resends>=3)throw failure('انتظر دقيقة قبل إعادة الإرسال / Wait one minute before resending',429);
  entry.busy=true;
  try{const code=String(randomInt(100000,1000000));let visibleCode;try{await deliver(entry.user,code);}catch(error){if(error.status!==503)throw error;visibleCode=code;}entry.digest=hash(code);entry.sentAt=now();entry.resends++;return {ok:true,expiresAt:entry.expires,...(visibleCode?{visibleCode}:{})};}finally{entry.busy=false;}
 }
 function verify(token,code,ip){
  const entry=get(token);if(entry.ip!==ip||entry.busy)throw failure('جلسة غير صالحة / Invalid verification session',400);
  if(++entry.attempts>5){pending.delete(token);throw failure('محاولات كثيرة. سجّل الدخول مجددًا. / Too many attempts. Sign in again.',429);}
  if(!/^\d{6}$/.test(String(code))||!timingSafeEqual(entry.digest,hash(String(code)))){if(entry.attempts>=5)pending.delete(token);throw failure('رمز التحقق غير صحيح / Incorrect verification code',400);}
  pending.delete(token);return entry.user;
 }
 return {issue,resend,verify};
}
