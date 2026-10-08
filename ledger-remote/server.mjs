import {saveCompanySettings} from './company-settings.mjs';
import {saveSessionPrintSettings,sessionPrintSettings} from './session-print-settings.mjs';
import {createRemoteUser} from './user-create.mjs';
import {saveUserSignature} from './user-signature.mjs';
import {createOtpService} from './otp.mjs';
import {canViewAccounting,readAccounting,updateAccounting} from './accounting.mjs';
import {changeAdminPassword} from './user-password.mjs';
import {canAssignRepresentative,requireRecord,recordWhere,scopedReport} from './record-access.mjs';
import {changeUserRole} from './user-role.mjs';
import {actionAllowed,actionKeys} from './action-policy.mjs';
import {changeTrash} from './trash-actions.mjs';
import {readTrash,trashAllowed} from './trash.mjs';
import {readInvoicePayment,deleteInvoice,deleteReceipt,canDeleteInvoice} from './invoice-actions.mjs';
import {createSession,isSessionExpired,recordSessionActivity} from './session-policy.mjs';
import {issueDocument,canIssue} from './issue-document.mjs';
import {readSettings,saveSettings,pageAllowed} from './remote-settings.mjs';
import {dashboard,demoDashboard} from './dashboard.mjs';
import {readInvoiceEdit,updateInvoice} from './invoice-edit.mjs';
import {canCreateMaster,createMaster,readMaster} from './master-data.mjs';
import {readReceiptPrint} from './receipt-print.mjs';
import {readReceiptEdit,updateReceipt} from './receipt-edit.mjs';
import {readCompanyBrand} from './company-brand.mjs';
import http from 'node:http';
import {saveReadiness,saveInvoice,remoteSchemaReady,readRemoteInvoice} from './save-invoice.mjs';
import {printSettings} from './print-settings.mjs';
import {validateDraft,decimal} from './draft.mjs';
import {readFilters,listQuery,demoList} from './list-query.mjs';
import {demoReport,reportSql} from './report.mjs';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const port=Number(process.env.PORT||3080), host=process.env.HOST||'127.0.0.1';
const demo=!process.env.DATABASE_URL;
if(demo && host!=='127.0.0.1') throw Error('Demo must bind to localhost');
if(!demo && !process.env.APP_ORIGIN) throw Error('APP_ORIGIN is required');
let pool;
if(!demo){const {default:pg}=await import('pg');pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},options:'-c default_transaction_read_only=on -c statement_timeout=10000'});}
const otp=createOtpService();
const sessions=new Map(), attempts=new Map();
function signIn(res,user,otpVerified=false){const token=randomBytes(32).toString("hex");sessions.set(token,{...createSession(user),otpVerified});res.setHeader("Set-Cookie",`ledger_remote=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=300${process.env.APP_ORIGIN?.startsWith("https:")?"; Secure":""}`);return json(res,200,{ok:true});}
const fixture={clients:[{id:1,name:'عميل تجريبي',phone:'',email:''}],invoices:[{id:1,client_id:1,invoice_number:'INV-2026-0001',issue_date:'2026-10-06',status:'issued',subtotal:'1000',tax_amount:'0',advance_payment:'200',total:'1000'}],receipts:[{id:1,client_id:1,invoice_id:1,receipt_number:'REC-2026-0001',receipt_date:'2026-10-06',status:'issued',amount:'300',payment_method:'cash'}]};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
function perms(value){try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}}
function allowed(user,kind){if(user.remotePages&&!user.remotePages.includes(kind==='statement'?'statement':kind))return false;if(user.role==='admin')return true;if(user.role==='client')return user.client_id!=null && perms(user.client_view_permissions)[{invoices:'canViewInvoices',receipts:'canViewReceipts',statement:'canViewStatement',clients:'canViewSummary'}[kind]]===true;return ['user','manager','supervisor'].includes(user.role) && (kind!=='statement'||perms(user.permissions).canViewStatements===true);}
async function rows(kind,user,f){
if(demo){const fixtureRows=kind==='templates'?[{id:1,item_code:'001',description:'بند تجريبي',default_unit_price:'1000'}]:fixture[kind].map(r=>({...r,client_name:'عميل تجريبي'}));return demoList(fixtureRows,f);}
const query=listQuery(kind,user,f,kind==='invoices'&&await remoteSchemaReady(pool));return (await pool.query(query.text,query.values)).rows[0];}
function canDraft(user,kind){return (!user.remotePages||user.remotePages.includes(kind==='invoice'?'invoices':'receipts'))&&( user.role==='admin'||(['user','manager','supervisor'].includes(user.role)&&perms(user.permissions)[kind==='invoice'?'canEditInvoices':'canEditReceipts']===true));}
function pageResult(result,f){return {...result,count:Number(result.count),page:f.page,pageSize:f.pageSize,pages:Math.max(1,Math.ceil(Number(result.count)/f.pageSize)),truncated:Number(result.count)>result.rows.length,fetchedAt:new Date().toISOString()};}
async function masterBody(req,settings,user){const input=await body(req);if(!pageAllowed(settings,user,input.kind==='client'?'clients':'templates'))throw Object.assign(Error('Access denied'),{status:403});return input;}
async function body(req){if(Object.hasOwn(req,'remoteParsedBody'))return req.remoteParsedBody;let s='';for await(const c of req){s+=c;if(Buffer.byteLength(s)>(req.url==='/api/company-settings'?3200000:65536))throw Error('body');}return req.remoteParsedBody=JSON.parse(s);}
http.createServer(async(req,res)=>{try{
res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
const url=new URL(req.url,'http://localhost');const path=url.pathname;
if(req.method==='POST'){const origin=req.headers.origin;if(origin!==(process.env.APP_ORIGIN||`http://localhost:${port}`))return json(res,403,{message:'Invalid origin'});}
if(path==='/api/company-brand'&&req.method==='GET'){
const brand=await readCompanyBrand(pool,demo),brandToken=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ledger_remote='))?.slice(14),brandSession=sessions.get(brandToken);
if(!isSessionExpired(brandSession)&&brandSession.user.role==='admin'&&brandSession.printOverrides){const settings=brandSession.printOverrides;for(const key of ['name_ar','name_en','subtitle_ar','subtitle_en','tagline_ar','tagline_en'])if(Object.hasOwn(settings,key))brand[key]=settings[key];if(Object.hasOwn(settings,'logo_base64'))brand.logo=settings.logo_base64||null;}
return json(res,200,brand);}
if(path==='/api/otp-resend'&&req.method==='POST'){const input=await body(req);return json(res,200,await otp.resend(input.otpToken,req.socket.remoteAddress));}
if(path==='/api/otp-verify'&&req.method==='POST'){const input=await body(req);const verified=otp.verify(input.otpToken,input.code,req.socket.remoteAddress);if(demo)return signIn(res,verified,true);const found=await pool.query('SELECT id,username,password_hash,display_name,role,is_active,pending_approval,permissions,client_id,client_view_permissions FROM users WHERE id=$1',[verified.id]);const current=found.rows[0];if(!current||current.is_active!==true||current.pending_approval===true||current.password_hash!==verified.password_hash)return json(res,403,{message:'Account changed. Sign in again.'});return signIn(res,current,true);}
if(path==='/api/login'&&req.method==='POST'){
const ip=req.socket.remoteAddress;const now=Date.now();let rate=attempts.get(ip);if(!rate||rate.until<now){rate={count:0,until:now+600000};attempts.set(ip,rate);}if(++rate.count>10)return json(res,429,{message:'Too many attempts. Try again later.'});
const input=await body(req);let user;
if(demo){if(input.username==='demo'&&input.password==='demo')user={id:1,display_name:'Demo',role:'admin'};}
else {const found=await pool.query('SELECT id,username,password_hash,display_name,role,is_active,pending_approval,permissions,client_id,client_view_permissions,two_factor_email,two_factor_whatsapp,email,phone,whatsapp_api_key FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM($1)) LIMIT 2',[String(input.username||'')]);if(found.rows.length===1){const u=found.rows[0];const {compare}=await import('bcryptjs');if(u.is_active===true&&u.pending_approval!==true&&await compare(String(input.password||''),u.password_hash)){user=u;}}}
if(!user)return json(res,401,{message:'Invalid credentials or inactive account'});
const oldToken=(req.headers.cookie||"").split(";").map(s=>s.trim()).find(s=>s.startsWith("ledger_remote="))?.slice(14);sessions.delete(oldToken);res.setHeader("Set-Cookie","ledger_remote=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");return json(res,200,await otp.issue(user,ip));}

if(path.startsWith('/api/')){
const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ledger_remote='))?.slice(14);const session=sessions.get(token);if(isSessionExpired(session)){sessions.delete(token);res.setHeader('Set-Cookie','ledger_remote=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,401,{message:'Please sign in'});}
let user=session.user;if(!demo){const fresh=await pool.query('SELECT id,display_name,role,is_active,pending_approval,permissions,client_id,client_view_permissions,two_factor_email,two_factor_whatsapp,email,phone,whatsapp_api_key FROM users WHERE id=$1',[user.id]);user=fresh.rows[0];if(!user||user.is_active!==true||user.pending_approval||!session.otpVerified){sessions.delete(token);return json(res,401,{message:'Session revoked'});}}
const remoteSettings=await readSettings();if(user.role!=='admin'&&Object.hasOwn(remoteSettings.pageAccess,String(user.id)))user={...user,remotePages:remoteSettings.pageAccess[String(user.id)]};
const permitted=key=>actionAllowed(remoteSettings,user,key);
const fixedActions={'/api/accounting-update':'accountingEdit','/api/invoice-print':'invoicePrint','/api/receipt-print':'receiptPrint','/api/invoice-edit':'invoiceEdit','/api/invoice-update':'invoiceEdit','/api/receipt-edit':'receiptEdit','/api/receipt-update':'receiptEdit','/api/invoice-delete':'invoiceDelete','/api/receipt-delete':'receiptDelete','/api/invoice-payment':'invoicePay'};
let requiredAction=fixedActions[path];
if(req.method==='POST'&&['/api/document-issue','/api/trash-action','/api/draft-save'].includes(path)){const input=await body(req);const kind=input.kind;if(['invoice','receipt'].includes(kind)){requiredAction=kind+(path==='/api/document-issue'?'Issue':path==='/api/trash-action'?(input.action==='restore'?'Restore':'Purge'):'Create');if(path==='/api/draft-save'&&input.payNow){if(!permitted('invoicePay')||!permitted('receiptIssue'))return json(res,403,{message:'Access denied'});}}}
if(requiredAction&&!permitted(requiredAction))return json(res,403,{message:'Access denied'});
// Status changes must also respect issuing/cancellation permissions.
if(req.method==='POST'&&['/api/invoice-update','/api/receipt-update'].includes(path)){const input=await body(req);if(input.status!=null){const invoice=path==='/api/invoice-update';const old=invoice?await readInvoiceEdit(pool,input.id,user):await readReceiptEdit(pool,input.id,user);const record=old.invoice||old.record;if(record&&input.status!==record.status){const key=(invoice?'invoice':'receipt')+(input.status==='cancelled'?'Delete':'Issue');if(!permitted(key))return json(res,403,{message:'Access denied'});}}}
// Authorize document identities before any data or action is returned.
if(!demo){
 const getKinds={'/api/invoice-print':'invoice','/api/invoice-items':'invoice','/api/invoice-edit':'invoice','/api/invoice-payment':'invoice','/api/receipt-print':'receipt','/api/receipt-edit':'receipt'};
 if(req.method==='GET'&&getKinds[path])await requireRecord(pool,user,getKinds[path],url.searchParams.get(getKinds[path]==='invoice'?'invoiceId':'receiptId'));
 const postKinds={'/api/invoice-update':'invoice','/api/invoice-delete':'invoice','/api/receipt-update':'receipt','/api/receipt-delete':'receipt'};
 if(req.method==='POST'&&(postKinds[path]||['/api/document-issue','/api/trash-action','/api/draft-preview','/api/draft-save'].includes(path))){
  const input=await body(req),kind=postKinds[path]||input.kind;
  if(postKinds[path]||['/api/document-issue','/api/trash-action'].includes(path))await requireRecord(pool,user,kind,input.id);
  if(kind==='receipt'&&input.invoiceId)await requireRecord(pool,user,'invoice',input.invoiceId);
 }
}
const gatedPage=path.startsWith('/api/master-')?null:path.includes('receipt-')?'receipts':path.includes('invoice-')?'invoices':path==='/api/dashboard'?'dashboard':null;
if(gatedPage&&!pageAllowed(remoteSettings,user,gatedPage))return json(res,403,{message:'Access denied'});
if(path==='/api/session-activity'&&req.method==='POST'){if(!recordSessionActivity(session)){sessions.delete(token);return json(res,401,{message:'Please sign in'});}res.setHeader('Set-Cookie',`ledger_remote=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=300${process.env.APP_ORIGIN?.startsWith('https:')?'; Secure':''}`);return json(res,200,{expiresAt:session.expires});}
if(path==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','ledger_remote=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
if(path==='/api/remote-user-create'&&req.method==='POST'){if(demo)return json(res,409,{message:'Unavailable in demo'});return json(res,201,await createRemoteUser(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/remote-user-signature'&&req.method==='POST'){if(demo)return json(res,409,{message:'Unavailable in demo'});return json(res,200,await saveUserSignature(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/remote-admin-password'&&req.method==='POST'){if(demo)return json(res,409,{message:'Unavailable in demo'});const result=await changeAdminPassword(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1');for(const [key,value]of sessions)if(value.user.id===result.id)sessions.delete(key);return json(res,200,result);}
if(path==='/api/remote-user-role'&&req.method==='POST'){if(demo)return json(res,409,{message:'Unavailable in demo'});return json(res,200,await changeUserRole(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/remote-users'&&req.method==='GET'){
if(user.role!=='admin'||demo)return json(res,403,{message:'Access denied'});
return json(res,200,{rows:(await pool.query('SELECT id,username,display_name,role,is_active,permissions,receiver_signature_base64 FROM users ORDER BY id')).rows});}
if(path==='/api/company-settings'&&req.method==='POST'){
const input=await body(req);saveSessionPrintSettings(session,user,input);
const online=(await printSettings(pool,demo,true)).settings,existing=(await printSettings(pool,demo)).settings;
const fallback={...existing};let persisted=false;
for(const [key,value]of Object.entries(session.printOverrides))if(online[key]==null||online[key]===''){fallback[key]=value;persisted=true;}
if(persisted)await saveCompanySettings(fallback,user);
return json(res,200,{temporary:!persisted,localFallbackSaved:persisted});}
if(path==='/api/remote-settings'&&req.method==='GET')return json(res,200,user.role==='admin'?remoteSettings:{...remoteSettings,pageAccess:undefined,userActions:undefined,roleActions:undefined});
if(path==='/api/remote-settings'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Settings unavailable in demo'});
const input=await body(req);if(user.role!=='admin')return json(res,403,{message:'Access denied'});const admins=(await pool.query("SELECT id FROM users WHERE role='admin'")).rows;for(const admin of admins){const id=String(admin.id);for(const key of ['pageAccess','userActions'])if(JSON.stringify(input[key]?.[id]??null)!==JSON.stringify(remoteSettings[key]?.[id]??null))return json(res,403,{message:'Administrator permissions are fixed'});}return json(res,200,await saveSettings(input,user));}
if(path==='/api/document-issue'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Issuing unavailable in demo'});
const input=await body(req);if(!pageAllowed(remoteSettings,user,input.kind==='invoice'?'invoices':'receipts'))return json(res,403,{message:'Access denied'});
return json(res,200,await issueDocument(pool,input,user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/accounting'&&req.method==='GET'){if(!pageAllowed(remoteSettings,user,'accounting')||!canViewAccounting(user))return json(res,403,{message:'Access denied'});if(demo)return json(res,200,{count:0,rows:[],clients:[],drivers:[],locations:[],page:1,pageSize:10,pages:1,totalInvoices:0,payments:0,unpaidTransportation:0,unpaidLabor:0,unpaidOtherExpenses:0,netIncome:0,fetchedAt:new Date().toISOString()});return json(res,200,await readAccounting(pool,user,url.searchParams));}
if(path==='/api/accounting-update'&&req.method==='POST'){if(demo)return json(res,409,{message:'Saving unavailable in demo'});if(!pageAllowed(remoteSettings,user,'accounting')||!permitted('accountingEdit'))return json(res,403,{message:'Access denied'});return json(res,200,await updateAccounting(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/dashboard'&&req.method==='GET'){
if(!allowed({...user,remotePages:undefined},'statement')||!pageAllowed(remoteSettings,user,'dashboard'))return json(res,403,{message:'Access denied'});
const f=readFilters(url.searchParams);
return json(res,200,demo?demoDashboard(fixture,f.from,f.to):await dashboard(pool,user,f.from,f.to));}
if(path==='/api/save-status'&&req.method==='GET')return json(res,200,demo||(!canDraft(user,'invoice')&&!canDraft(user,'receipt'))?{enabled:false,message:'الحفظ غير متاح لهذا الحساب أو في التجربة.'}:await saveReadiness(pool,process.env.REMOTE_WRITE_ENABLED==='1'));
if(path.startsWith('/api/master-')){const kind=req.method==='GET'?url.searchParams.get('kind'):null;if(kind&&!pageAllowed(remoteSettings,user,kind==='client'?'clients':'templates'))return json(res,403,{message:'Access denied'});}
if(path==='/api/master-record'&&req.method==='GET'){
if(demo||process.env.REMOTE_WRITE_ENABLED!=='1')return json(res,409,{message:'Saving unavailable'});
return json(res,200,await readMaster(pool,url.searchParams.get('kind'),Number(url.searchParams.get('id')),user));}
if(path==='/api/master-update'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Saving unavailable in demo'});
return json(res,200,await createMaster(pool,await masterBody(req,remoteSettings,user),user,process.env.REMOTE_WRITE_ENABLED==='1',true));}
if(path==='/api/master-create'&&req.method==='POST'){
if(demo)return json(res,409,{message:'الحفظ غير متاح في التجربة / Saving unavailable in demo'});
return json(res,201,await createMaster(pool,await masterBody(req,remoteSettings,user),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/trash-action'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Trash unavailable in demo'});
return json(res,200,await changeTrash(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/invoice-payment'&&req.method==='GET'){
if(demo)return json(res,409,{message:'Payment unavailable in demo'});
if(!canDraft(user,'receipt'))return json(res,403,{message:'Access denied'});
return json(res,200,await readInvoicePayment(pool,url.searchParams.get('invoiceId'),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/invoice-delete'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Deleting unavailable in demo'});
if(!pageAllowed(remoteSettings,user,'receipts'))return json(res,403,{message:'Access denied'});
return json(res,200,await deleteInvoice(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/invoice-edit'&&req.method==='GET'){
if(demo||process.env.REMOTE_WRITE_ENABLED!=='1')return json(res,409,{message:'Editing unavailable'});
return json(res,200,await readInvoiceEdit(pool,url.searchParams.get('invoiceId'),user));}
if(path==='/api/invoice-update'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Editing unavailable in demo'});
return json(res,200,await updateInvoice(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/receipt-delete'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Deleting unavailable in demo'});
return json(res,200,await deleteReceipt(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/receipt-edit'&&req.method==='GET'){
if(demo)return json(res,409,{message:'Editing unavailable in demo'});
return json(res,200,await readReceiptEdit(pool,url.searchParams.get('receiptId'),user));}
if(path==='/api/receipt-update'&&req.method==='POST'){
if(demo)return json(res,409,{message:'Editing unavailable in demo'});
return json(res,200,await updateReceipt(pool,await body(req),user,process.env.REMOTE_WRITE_ENABLED==='1'));}
if(path==='/api/draft-save'&&req.method==='POST'){
const input=await body(req);if(!canDraft(user,input.kind))return json(res,403,{message:'Access denied'});
if(demo)return json(res,409,{message:'الحفظ غير متاح في التجربة.'});
const readiness=await saveReadiness(pool,process.env.REMOTE_WRITE_ENABLED==='1');if(!readiness.enabled)return json(res,409,{message:readiness.message});
return json(res,200,await saveInvoice(pool,input,user));}
if(path==='/api/draft-preview'&&req.method==='POST'){
const input=await body(req);if(!canDraft(user,input.kind))return json(res,403,{message:'Access denied'});
let result;try{result=validateDraft(input);}catch(e){return json(res,400,{message:e.message});}if(result.kind==='invoice'&&!canAssignRepresentative(user)&&result.salesManId!==null&&Number(result.salesManId)!==Number(user.id))return json(res,403,{message:'Cannot assign another representative'});
const found=demo?fixture.clients.filter(c=>c.id===result.clientId):(await pool.query('SELECT id,name FROM clients WHERE id=$1',[result.clientId])).rows;if(!found.length)return json(res,400,{message:'Client not found'});result.clientName=found[0].name;result.createdBy=user.id;result.salesManName=user.display_name;if(result.kind==='invoice'&&result.salesManId&&result.salesManId!==user.id){const representative=demo?null:(await pool.query("SELECT id,display_name FROM users WHERE id=$1 AND is_active=true AND COALESCE(pending_approval,false)=false AND role<>'client'",[result.salesManId])).rows[0];if(!representative)return json(res,400,{message:'المندوب غير متاح / Representative unavailable'});result.salesManName=representative.display_name;}
if(result.kind==='receipt'&&result.invoiceId){let invoice;if(demo){invoice=fixture.invoices.find(i=>i.id===result.invoiceId&&i.client_id===result.clientId);if(invoice)invoice={...invoice,remaining:'500.00'};}else invoice=(await pool.query(`SELECT i.id,i.invoice_number,i.client_id,i.status,GREATEST(0,CASE WHEN COALESCE(i.subtotal,0)+COALESCE(i.tax_amount,0)>0 THEN COALESCE(i.subtotal,0)+COALESCE(i.tax_amount,0) ELSE COALESCE(i.total,0)+COALESCE(i.advance_payment,0) END-COALESCE(i.advance_payment,0)-COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.invoice_id=i.id AND r.status='issued' AND r.deleted_at IS NULL),0)) AS remaining FROM invoices i WHERE i.id=$1 AND i.client_id=$2 AND i.deleted_at IS NULL`,[result.invoiceId,result.clientId])).rows[0];if(!invoice||!['issued','paid'].includes(invoice.status))return json(res,400,{message:'Invoice not available for this client'});if(decimal(result.amount)>decimal(invoice.remaining))return json(res,409,{message:'Receipt exceeds current outstanding balance'});result.invoiceNumber=invoice.invoice_number;result.currentOutstanding=String(invoice.remaining);}
return json(res,200,{draft:result,message:'Preview only. Nothing saved to Online.'});}
if(req.method!=='GET')return json(res,405,{message:'Read only'});
if(path==='/api/trash'){
if(demo)return json(res,409,{message:'Trash unavailable in demo'});
return json(res,200,await readTrash(pool,user,url.searchParams));}
if(path==='/api/me')return json(res,200,{name:user.display_name,role:user.role,demo,expiresAt:session.expires,actions:Object.fromEntries(actionKeys.map(key=>[key,permitted(key)])),access:{accounting:canViewAccounting(user)&&pageAllowed(remoteSettings,user,'accounting'),editAccounting:!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canViewAccounting(user)&&pageAllowed(remoteSettings,user,'accounting')&&permitted('accountingEdit'),printInvoice:permitted('invoicePrint')&&allowed(user,'invoices'),printReceipt:permitted('receiptPrint')&&allowed(user,'receipts'),trash:!demo&&(trashAllowed(user,'invoice')||trashAllowed(user,'receipt')),trashInvoices:!demo&&trashAllowed(user,'invoice'),trashReceipts:!demo&&trashAllowed(user,'receipt'),deleteReceipt:permitted('receiptDelete')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canDraft(user,'receipt'),payInvoice:permitted('invoicePay')&&permitted('receiptCreate')&&permitted('receiptIssue')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canDraft(user,'receipt')&&pageAllowed(remoteSettings,user,'invoices'),deleteInvoice:permitted('invoiceDelete')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canDeleteInvoice(user)&&pageAllowed(remoteSettings,user,'invoices')&&pageAllowed(remoteSettings,user,'receipts'),users:user.role==='admin'&&!demo,dashboard:allowed({...user,remotePages:undefined},'statement')&&pageAllowed(remoteSettings,user,'dashboard'),settings:user.role==='admin'&&!demo,appearance:pageAllowed(remoteSettings,user,'appearance'),issueInvoice:permitted('invoiceIssue')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canIssue(user,'invoice')&&pageAllowed(remoteSettings,user,'invoices'),issueReceipt:permitted('receiptIssue')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canIssue(user,'receipt')&&pageAllowed(remoteSettings,user,'receipts'),...Object.fromEntries(['clients','invoices','receipts','statement'].map(k=>[k,allowed(user,k)])),createClient:!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canCreateMaster(user)&&pageAllowed(remoteSettings,user,'clients'),createTemplate:!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canCreateMaster(user)&&pageAllowed(remoteSettings,user,'templates'),draftInvoice:permitted('invoiceCreate')&&canDraft(user,'invoice'),editInvoice:permitted('invoiceEdit')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canDraft(user,'invoice'),editReceipt:permitted('receiptEdit')&&!demo&&process.env.REMOTE_WRITE_ENABLED==='1'&&canDraft(user,'receipt'),draftReceipt:permitted('receiptCreate')&&canDraft(user,'receipt'),templates:user.role!=='client'&&allowed(user,'templates')}});
if(path==='/api/print-settings'){
if(!allowed(user,'invoices')&&!allowed(user,'receipts'))return json(res,403,{message:'Access denied'});
return json(res,200,sessionPrintSettings(await printSettings(pool,demo),session,user));}
if(path==='/api/receipt-print'){
if(!allowed(user,'receipts'))return json(res,403,{message:'Access denied'});
if(demo){const receipt=fixture.receipts.find(r=>String(r.id)===url.searchParams.get('receiptId'));if(!receipt)return json(res,404,{message:'Receipt not found'});return json(res,200,{receipt:{...receipt,client_name:'عميل تجريبي',invoice_number:'INV-2026-0001',receiver_name:'Demo'}});}
return json(res,200,await readReceiptPrint(pool,url.searchParams.get('receiptId'),user));}
if(path==='/api/invoice-print'){
if(!allowed(user,'invoices'))return json(res,403,{message:'Access denied'});
let requestedId=url.searchParams.get('invoiceId');if(!demo&&String(requestedId).startsWith('web:')){const canonical=(await pool.query("SELECT id FROM invoices WHERE to_jsonb(invoices)->>'sync_id'=$1 AND deleted_at IS NULL AND ($2::integer IS NULL OR client_id=$2) AND ($3::integer IS NULL OR created_by=$3)",[String(requestedId).slice(4),user.role==='client'?user.client_id:null,user.role==='user'?user.id:null])).rows[0];if(canonical)requestedId=canonical.id;else{if(!await remoteSchemaReady(pool))return json(res,404,{message:'Invoice not found'});return json(res,200,await readRemoteInvoice(pool,requestedId,user));}}
const id=Number(requestedId);if(!Number.isSafeInteger(id)||id<=0)return json(res,400,{message:'Invalid invoice'});
let invoice,items;if(demo){const r=fixture.invoices.find(i=>i.id===id);if(r){invoice={...r,client_name:'عميل تجريبي',sales_man_name:'Demo'};items=[{description:'بند تجريبي',quantity:'1',unit_price:'1000',total:'1000'}];}}
else {invoice=(await pool.query(`SELECT i.id,i.invoice_number,i.client_id,i.issue_date,i.due_date,i.status,i.subtotal,i.tax_rate,i.tax_amount,i.advance_payment,i.notes,i.shipment_ref,i.bill_of_lading,i.port_of_entry,i.package_count,i.shipment_weight,i.importer_exporter_name,c.name AS client_name,u.display_name AS sales_man_name,COALESCE(to_jsonb(u)->>'signature_base64',to_jsonb(u)->>'receiver_signature_base64') AS receiver_signature FROM invoices i LEFT JOIN clients c ON c.id=i.client_id LEFT JOIN users u ON u.id=i.created_by WHERE i.id=$1 AND i.deleted_at IS NULL AND ($2::integer IS NULL OR i.client_id=$2) AND ($3::integer IS NULL OR i.created_by=$3)`,[id,user.role==='client'?user.client_id:null,user.role==='user'?user.id:null])).rows[0];if(invoice)items=(await pool.query('SELECT description,quantity,unit_price,total FROM invoice_items WHERE invoice_id=$1 ORDER BY id',[id])).rows;}
if(!invoice)return json(res,404,{message:'Invoice not found'});return json(res,200,{invoice,items});}
if(path==='/api/draft-options'){
if(!canDraft(user,'invoice')&&!canDraft(user,'receipt'))return json(res,403,{message:'Access denied'});
if(demo)return json(res,200,{clients:fixture.clients,templates:[{description:'بند تجريبي',default_unit_price:'1000'}],invoices:fixture.invoices,salesmen:[{id:user.id,display_name:user.display_name}],currentUserId:user.id,canChangeRepresentative:canAssignRepresentative(user)});
const clients=(await pool.query('SELECT id,name FROM clients ORDER BY name,id')).rows;
const templates=canDraft(user,'invoice')?(await pool.query('SELECT id,description,default_unit_price FROM invoice_item_templates ORDER BY id')).rows:[];
const invoices=canDraft(user,'receipt')?(await pool.query(`SELECT id,client_id,invoice_number FROM invoices WHERE deleted_at IS NULL AND status IN ('issued','paid') AND ${recordWhere(user,'',v=>String(Number(v)))} ORDER BY issue_date DESC,id DESC`)).rows:[];
const salesmen=canDraft(user,'invoice')?(await pool.query("SELECT id,username,display_name FROM users WHERE is_active=true AND COALESCE(pending_approval,false)=false AND role<>'client' AND ($1::integer IS NULL OR id=$1) ORDER BY display_name,id",[canAssignRepresentative(user)?null:user.id])).rows:[];
return json(res,200,{clients,templates,invoices,salesmen,currentUserId:user.id,canChangeRepresentative:canAssignRepresentative(user)});}
if(path==='/api/invoice-items'){
if(!allowed(user,'invoices'))return json(res,403,{message:'Access denied'});
const id=Number(url.searchParams.get('invoiceId'));if(!Number.isSafeInteger(id)||id<=0)return json(res,400,{message:'Invalid invoice'});
let result;if(demo){if(id!==1)return json(res,404,{message:'Invoice not found'});result=[{id:1,description:'بند تجريبي',quantity:'1',unit_price:'1000',total:'1000'}];}
else {const invoice=await pool.query('SELECT id FROM invoices WHERE id=$1 AND deleted_at IS NULL AND ($2::integer IS NULL OR client_id=$2) AND ($3::integer IS NULL OR created_by=$3)',[id,user.role==='client'?user.client_id:null,user.role==='user'?user.id:null]);if(!invoice.rows.length)return json(res,404,{message:'Invoice not found'});result=(await pool.query('SELECT id,description,quantity,unit_price,total FROM invoice_items WHERE invoice_id=$1 ORDER BY id LIMIT 501',[id])).rows;}
return json(res,200,{rows:result.slice(0,500),truncated:result.length>500,fetchedAt:new Date().toISOString()});}
if(path==='/api/statement-clients'){
if(!allowed(user,'statement'))return json(res,403,{message:'Access denied'});
const result=demo?fixture.clients:(await pool.query('SELECT id,name FROM clients WHERE ($1::integer IS NULL OR id=$1) ORDER BY name,id',[user.role==='client'?user.client_id:null])).rows;return json(res,200,{rows:result});}
if(path==='/api/statement'){
if(!allowed(user,'statement'))return json(res,403,{message:'Access denied'});
const raw=url.searchParams.get('clientId')||'';let clientId=raw?Number(raw):null;
if(raw&&(!Number.isSafeInteger(clientId)||clientId<=0))return json(res,400,{message:'Invalid client'});
if(user.role==='client'){if(clientId&&clientId!==Number(user.client_id))return json(res,403,{message:'Access denied'});clientId=Number(user.client_id);}
const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
const valid=x=>!x||(/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x);
if(!valid(from)||!valid(to)||(from&&to&&from>to))return json(res,400,{message:'Invalid date range'});
const f=readFilters(url.searchParams);const result=demo?demoReport(fixture.invoices,fixture.receipts,clientId,from,to,f):(await pool.query(scopedReport(reportSql,user,[clientId,from,to,f.q,f.pageSize,f.offset]))).rows[0];
return json(res,200,pageResult(result,f));}
const kind=path.slice(5);if(!['clients','invoices','receipts','templates'].includes(kind))return json(res,404,{message:'Not found'});if(!allowed(user,kind)||(kind==='templates'&&user.role==='client'))return json(res,403,{message:'Access denied'});
const f=readFilters(url.searchParams);return json(res,200,pageResult(await rows(kind,user,f),f));}
if(req.method!=='GET')return json(res,405,{message:'Method not allowed'});
const assets={'/company-settings-ui.js':'company-settings-ui.js','/otp-ui.js':'otp-ui.js','/compact-ui.css':'compact-ui.css','/notifications.js':'notifications.js','/accounting-ui.js':'accounting-ui.js','/favicon.ico':'icons/ledger-remote.ico','/icons/ledger-remote.svg':'icons/ledger-remote.svg','/icons/ledger-remote-192.png':'icons/ledger-remote-192.png','/icons/ledger-remote-512.png':'icons/ledger-remote-512.png','/trash-ui.js':'trash-ui.js','/editor-pages.js':'editor-pages.js','/editor-pages.css':'editor-pages.css','/remote-pages.js':'remote-pages.js','/remote-pages.css':'remote-pages.css','/company-brand.js':'company-brand.js','/company-brand.css':'company-brand.css','/invoice-desktop.css':'invoice-desktop.css','/receipt-print-ui.js':'receipt-print-ui.js','/receipt-print.css':'receipt-print.css','/master-data-ui.js':'master-data-ui.js','/':'index.html','/app.js':'app.js','/ui-language.js':'ui-language.js','/style.css':'style.css','/draft-ui.js':'draft-ui.js','/invoice-ui.js':'invoice-ui.js'};if(!assets[path])return json(res,404,{message:'Not found'});res.setHeader('Content-Type',path.endsWith('.ico')?'image/x-icon':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(await readFile(new URL('./public/'+assets[path],import.meta.url)));
}catch(e){if([400,403,404,409,429,503].includes(e.status))return json(res,e.status,{message:e.message});if(['Invalid pagination','Search too long','Invalid date range'].includes(e.message))return json(res,400,{message:e.message});console.error('Request failed:',JSON.stringify({code:e.code||e.name,message:e.message,position:e.position}));json(res,500,{message:'Request failed. Check configuration and schema.'});}}).listen(port,host,()=>console.log(`Ledger Remote ${demo?'DEMO':process.env.REMOTE_WRITE_ENABLED==='1'?'ONLINE — REMOTE DRAFTS':'ONLINE READ ONLY'}: http://localhost:${port}`));
setInterval(()=>{const now=Date.now();for(const [k,v] of sessions)if(v.expires<now)sessions.delete(k);for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);},60000).unref();
