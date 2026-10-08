let idleDeadline=0,idleInterval,idleActivityTimer,idleSending=false,idlePending=false,idleGeneration=0,idleLastSent=0;
let me,tab='invoices',language=preferredUiLanguage(),data=[],report,clients=[],request=0,truncated=false,pageNumber=1,totalPages=1,totalCount=0,searchTimer;
const $=s=>document.querySelector(s),labels={accounting:['الحسابات','Accounting'],dashboard:['لوحة التحكم','Dashboard'],settings:['الضبط','Settings'],appearance:['المظهر','Appearance'],users:['المستخدمون','Users'],invoices:['الفواتير','Invoices'],receipts:['سندات القبض','Receipts'],statement:['كشف الحساب','Statement'],clients:['العملاء','Clients'],templates:['البنود','Items']};
function setCurrentMonthDates(){const now=new Date();const year=now.getFullYear();const month=String(now.getMonth()+1).padStart(2,'0');const day=String(now.getDate()).padStart(2,'0');$('#from').value=year+'-'+month+'-01';$('#to').value=year+'-'+month+'-'+day;}
setCurrentMonthDates();
const t=(a,b)=>language==='ar'?a:b;
const translations={issued:['صادرة','Issued'],draft:['مسودة','Draft'],paid:['مدفوعة','Paid'],cancelled:['ملغاة','Cancelled'],invoice:['فاتورة','Invoice'],advance:['دفعة مقدمة','Advance payment'],receipt:['سند قبض','Receipt'],cash:['نقدًا','Cash'],bank_transfer:['تحويل بنكي','Bank transfer'],cheque:['شيك','Cheque']};
function el(tag,text){const e=document.createElement(tag);if(text!=null)e.textContent=latin(text);return e;}
const latin=v=>String(v).replace(/[٠-٩۰-۹]/g,c=>String((c.charCodeAt(0)>=0x6f0?c.charCodeAt(0)-0x6f0:c.charCodeAt(0)-0x660)));
const amount=v=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function translated(v){return translations[v]?.[language==='ar'?0:1]||v||'—';}
async function api(path,options){const r=await fetch('/api/'+path,options);const d=await r.json();if(!r.ok){const e=Error(d.message);e.status=r.status;throw e;}return d;}
function error(e){const routine=e.status===401&&/^Please sign in[.!]?$/i.test(e.message||'');if(!routine||me)showRemoteNotice(routine?t('انتهت الجلسة. سجّل الدخول مجددًا.','Your session expired. Sign in again.'):e.message,'error');if(e.status===401){stopIdleSession();request++;clearTimeout(searchTimer);setEditorBusy(false);finishRemoteEditor();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();data=[];report=null;clients=[];remoteMoneyHidden=true;document.body.classList.remove('printing-receipt','printing-invoice');$('#login').hidden=false;$('#workspace').hidden=true;$('#logout').hidden=true;$('#content').replaceChildren();me=null;closeSidebar();$('#menu-toggle').hidden=true;}}
let demoNoticeShown=false;
function notice(){if(me?.demo&&!demoNoticeShown){demoNoticeShown=true;showRemoteNotice(t('بيانات تجريبية فقط — لا يوجد اتصال بقاعدة Online','Demo data only — no Online connection'),'warning');}}
async function init(){updateUiLanguage();try{const firstLogin=!me;me=await api('me');if(firstLogin){remoteMoneyHidden=true;applyAmountVisibility();}startIdleSession(me.expiresAt);if(!me)return;$('#account-name').textContent=me.name||'';$('#account-avatar').textContent=(me.name||'L').trim().slice(0,1);$('#account-role').textContent=t('حساب Ledger Online','Ledger Online account');$('#login').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;await initializeRemotePreferences();notice();const nav=$('nav');nav.replaceChildren();for(const k of ['dashboard','invoices','receipts','accounting','statement','clients','templates','users','settings','appearance']){if(!me.access[k])continue;const b=el('button');b.type='button';b.append(navIcon(k),el('span',labels[k][language==='ar'?0:1]));b.onclick=()=>leaveRemoteEditor(()=>{tab=k;pageNumber=1;$('#search').value='';closeSidebar();load();});b.dataset.tab=k;nav.append(b);}if(!me.access[tab])tab=Object.keys(labels).find(k=>me.access[k]);if(me.access.statement){clients=(await api('statement-clients')).rows;const sel=$('#client'),current=sel.value;sel.replaceChildren();if(me.role!=='client'){const opt=el('option',t('جميع العملاء — ملخص عام','All clients — overall totals'));opt.value='';sel.append(opt);}for(const c of clients){const opt=el('option',c.name);opt.value=c.id;sel.append(opt);}if([...sel.options].some(o=>o.value===current))sel.value=current;}if(tab)await load();else $('#content').textContent=t('لا توجد صفحات متاحة لهذا الحساب','No accessible pages');if(window.remoteStartTrash&&me?.access.trash){window.remoteStartTrash=false;await window.openRemoteTrash();}}catch(e){error(e);$('#login').hidden=false;$('#workspace').hidden=true;$('#menu-toggle').hidden=true;closeSidebar();}}
async function load(){if(!me)return;const n=++request;updateShell();try{$('#pagination').hidden=false;$('#print').hidden=(tab==='invoices'&&!me.access.printInvoice)||(tab==='receipts'&&!me.access.printReceipt);$('#search').closest('label').hidden=false;if(tab==='accounting'){await loadAccounting(n);return;}if(['dashboard','settings','appearance','users'].includes(tab)){await loadRemotePage(n);return;}$('#refresh').disabled=true;$('#print').disabled=true;$('#new-draft').hidden=!((tab==='invoices'&&me.access.draftInvoice)||(tab==='receipts'&&me.access.draftReceipt));$('#client').hidden=tab!=='statement';$('#from').hidden=['clients','templates'].includes(tab);$('#to').hidden=$('#from').hidden;for(const b of $('nav').children)b.classList.toggle('active',b.dataset.tab===tab);const p=new URLSearchParams({page:pageNumber,pageSize:$('#page-size').value,q:$('#search').value,from:$('#from').value,to:$('#to').value});if(tab==='statement')p.set('clientId',$('#client').value);const result=await api(tab+'?'+p);if(n!==request)return;report=tab==='statement'?result:null;data=result.rows;pageNumber=result.page;totalPages=result.pages;totalCount=result.count;truncated=!!result.truncated;$('#prev').disabled=pageNumber<=1;$('#next').disabled=pageNumber>=totalPages;$('#page-label').textContent=t('صفحة ','Page ')+pageNumber+' / '+totalPages+' — '+totalCount+t(' سجل',' rows');notice();$('#status').textContent='';render();applyAmountVisibility();}catch(e){if(n===request){$('#content').replaceChildren();error(e);}}finally{if(n===request){$('#refresh').disabled=false;$('#print').disabled=!$('#content').querySelector('table');}}}
function render(){const columns={templates:[['item_code','الكود','Code'],['description','البند','Description'],['default_unit_price','السعر الافتراضي','Default price']],clients:[['id','الرقم','ID'],['name','الاسم','Name'],['phone','الهاتف','Phone'],['email','البريد','Email']],invoices:[['invoice_number','الفاتورة','Invoice'],['client_name','العميل','Client'],['issue_date','التاريخ','Date'],['shipment_ref','البيان','Declaration'],['bill_of_lading','البوليصة','Bill of lading'],['status','الحالة','Status'],['subtotal','قبل الضريبة','Subtotal'],['tax_amount','الضريبة','Tax'],['advance_payment','دفعة مقدمة','Advance']],receipts:[['receipt_number','السند','Receipt'],['client_name','العميل','Client'],['receipt_date','التاريخ','Date'],['status','الحالة','Status'],['amount','المبلغ','Amount'],['payment_method','طريقة الدفع','Payment method']],statement:[['date','التاريخ','Date'],['client_name','العميل','Client'],['number','المستند','Document'],['type','الحركة','Entry'],['debit','مدين','Debit'],['credit','دائن','Credit'],['balance','الرصيد','Balance']]};const rows=data;const root=$('#content');root.replaceChildren();updatePrintHeading();if(report){const cards=el('div');cards.className='cards';for(const [key,ar,en]of [['opening','الرصيد الافتتاحي','Opening balance'],['debit','الفواتير خلال الفترة','Period invoices'],['credit','المحصل خلال الفترة','Period collected'],['closing','الرصيد الختامي','Closing balance']]){const c=el('div',t(ar,en));c.className='card';const value=el('b',amount(report[key]));value.className='money-value';value.dataset.moneyValue=amount(report[key]);c.append(value);cards.append(c);}root.append(cards,el('p',t('الإجماليات تشمل كل الحركات ضمن العميل والفترة، ولا تتأثر ببحث الجدول. المسودات والملغاة مستبعدة؛ المحصل يشمل الدفعات المقدمة والسندات الصادرة.','Totals include all entries for the selected client and dates, regardless of table search. Drafts and cancelled invoices excluded; collected includes advances and issued receipts.')));}

const box=el('div');box.className='table';const table=el('table'),head=el('tr');if(tab==='templates')table.className='remote-items-table';for(const c of columns[tab])head.append(el('th',c[language==='ar'?1:2]));if(tab==='invoices'||tab==='receipts'){const th=el('th',t('إجراءات','Actions'));th.className='actions';head.append(th);}if((tab==='clients'&&me.access.createClient)||(tab==='templates'&&me.access.createTemplate)){const th=el('th',t('إجراءات','Actions'));th.className='actions';head.append(th);}const thead=el('thead');thead.append(head);table.append(thead);for(const r of rows){const tr=el('tr');for(const c of columns[tab]){let v=r[c[0]]??'—';if(tab==='templates'&&c[0]==='item_code'&&!/^\d+$/.test(String(v).trim()))v=r.id;if(['status','type','payment_method'].includes(c[0]))v=translated(v);if(['default_unit_price','subtotal','tax_amount','advance_payment','amount','debit','credit','balance'].includes(c[0]))v=amount(v);const cell=el('td');if(['default_unit_price','subtotal','tax_amount','advance_payment','amount','debit','credit','balance'].includes(c[0])){cell.classList.add('money-value');cell.dataset.moneyValue=latin(v);}if(tab==='invoices'&&c[0]==='invoice_number'&&(me.access.editInvoice||me.access.printInvoice)){const link=el('button',v);link.className='invoice-edit-link';link.onclick=()=>me.access.editInvoice?openInvoiceEditor(r.id):openStoredInvoice(r.id);cell.append(link);}else if(tab==='receipts'&&c[0]==='receipt_number'&&me.access.editReceipt){const link=el('button',v);link.type='button';link.className='invoice-edit-link';link.onclick=()=>openReceiptEditor(r.id);cell.append(link);}else cell.textContent=latin(v);tr.append(cell);}if(tab==='invoices'){const td=el('td');td.className='actions';const print=el('button',t('طباعة','Print'));print.onclick=()=>openStoredInvoice(r.id);if(me.access.printInvoice)td.append(print);if(r.status==='issued'&&me.access.payInvoice){const pay=el('button',t('دفع','Pay'));pay.type='button';pay.onclick=()=>openInvoicePayment(r.id);td.append(pay);}if(r.status==='draft'&&me.access.issueInvoice)td.append(issueButton(r,'invoice'));if(me.access.deleteInvoice){const remove=el('button',t('حذف','Delete'));remove.type='button';remove.onclick=()=>deleteStoredInvoice(r,remove);td.append(remove);}tr.append(td);}if(tab==='receipts'){const td=el('td');td.className='actions';const button=el('button',t('طباعة','Print'));button.type='button';button.onclick=()=>openReceiptPrint(r.id);if(me.access.printReceipt)td.append(button);if(r.status==='draft'&&me.access.issueReceipt)td.append(issueButton(r,'receipt'));if(me.access.deleteReceipt){const remove=el('button',t('حذف','Delete'));remove.type='button';remove.onclick=()=>deleteStoredReceipt(r,remove);td.append(remove);}tr.append(td);}if((tab==='clients'&&me.access.createClient)||(tab==='templates'&&me.access.createTemplate)){const td=el('td');td.className='actions';td.append(masterEditButton(r.id));tr.append(td);}table.append(tr);}box.append(table);if(!rows.length)box.append(el('p',t('لا توجد نتائج','No results')));root.append(box);applyAmountVisibility();orderTableActions();}
$('#login form').onsubmit=async e=>{e.preventDefault();const b=$('#login form button');b.disabled=true;try{const f=new FormData(e.target);const result=await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});e.target.reset();if(result.requiresOtp){showOtp(result);return;}await init();}catch(e){error(e);}finally{b.disabled=false;}};
$('#logout').onclick=()=>leaveRemoteEditor(async()=>{try{await api('logout',{method:'POST'});location.reload();}catch(e){error(e);}});
$('#lang').onclick=()=>{language=language==='ar'?'en':'ar';document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';updateUiLanguage();if(me){if(remoteEditor){remoteEditor.node._refreshLanguage?.();refreshDraftLabels();updateShell();}else init();}};
$('#refresh').onclick=load;
$('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{pageNumber=1;load();},350);};
for(const id of ['from','to','client','page-size'])$('#'+id).onchange=()=>{clearTimeout(searchTimer);pageNumber=1;load();};
$('#prev').onclick=()=>{if(pageNumber>1){pageNumber--;load();}};$('#next').onclick=()=>{if(pageNumber<totalPages){pageNumber++;load();}};
$('#clear').onclick=()=>{if(tab==='accounting')accountingFilters={clientId:'',driverName:'',unloadLocation:''};clearTimeout(searchTimer);$('#search').value='';defaultRemoteDates();pageNumber=1;load();};init();

let itemRequest=0;
async function showItems(invoice){const n=++itemRequest;const dialog=$('#items');$('#print-items').disabled=true;$('#items-title').textContent=latin(invoice.invoice_number)+' — '+latin(invoice.client_name||'');$('#items-content').textContent=t('جاري الجلب…','Loading…');dialog.showModal();try{const result=await api('invoice-items?invoiceId='+invoice.id);if(n!==itemRequest||!dialog.open)return;const table=el('table'),head=el('tr');for(const label of [t('البند','Description'),t('الكمية','Quantity'),t('السعر','Price'),t('الإجمالي','Total')])head.append(el('th',label));const thead=el('thead');thead.append(head);table.append(thead);for(const r of result.rows){const tr=el('tr');for(const v of [r.description,r.quantity,amount(r.unit_price),amount(r.total)])tr.append(el('td',v));table.append(tr);}const box=el('div');box.className='table';box.append(table);if(!result.rows.length)box.append(el('p',t('لا توجد بنود','No items')));if(result.truncated)box.append(el('p',t('أول 500 بند فقط','First 500 items only')));$('#items-content').replaceChildren(box);$('#print-items').disabled=false;}catch(e){$('#items-content').textContent=e.message;}}
$('#close-items').onclick=()=>{itemRequest++;$('#items').close();};

function updatePrintHeading(){const title=labels[tab]?.[language==='ar'?0:1]||'';const client=tab==='statement'?$('#client').selectedOptions[0]?.textContent||'':'';const range=[$('#from').value||t('البداية','Start'),$('#to').value||t('النهاية','End')].join(' → ');const heading=$('#print-heading');heading.replaceChildren(el('h1','Ledger Remote — '+title),el('p',client),el('p',t('الفترة: ','Period: ')+(['clients','templates'].includes(tab)?t('غير مطبّقة','Not applicable'):range)));heading.append(el('p',t('صفحة ','Page ')+pageNumber+' / '+totalPages+' — '+totalCount+t(' سجل',' rows')));if($('#search').value)heading.append(el('p',t('بحث: ','Search: ')+$('#search').value));if(truncated)heading.append(el('p',t('تنبيه: هذه طباعة صفحة واحدة من النتائج. إجماليات كشف الحساب تشمل جميع الحركات ضمن الفترة.','Partial copy: this prints one page of results. Statement totals cover all entries within the period.')));}
$('#print').onclick=()=>{if((tab==='invoices'&&!me.access.printInvoice)||(tab==='receipts'&&!me.access.printReceipt))return;updatePrintHeading();document.body.classList.remove('printing-items');window.print();};
$('#print-items').onclick=()=>{document.body.classList.add('printing-items');window.print();};
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-items'));

function navIcon(key){
 const paths={accounting:['M4 3h16v18H4z','M7 7h10','M7 12h3','M14 12h3','M7 17h3','M14 17h3'],dashboard:['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],settings:['M4 7h16','M4 17h16','M8 4v6','M16 14v6'],appearance:['M4 20h16','M12 3l7 14H5z'],users:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],invoices:['M6 3h9l3 3v15H6z','M14 3v5h4','M9 12h6','M9 16h6'],receipts:['M6 3h12v18l-3-2-3 2-3-2-3 2z','M9 8h6','M9 12h6'],statement:['M4 20h16','M7 16V9','M12 16V4','M17 16v-5'],clients:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M20 21v-2a4 4 0 0 0-3-3.87','M16 3a4 4 0 0 1 0 8'],templates:['M4 4h16v16H4z','M4 9h16','M9 9v11']};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 for(const d of paths[key]||paths.invoices){const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.append(p);}return svg;
}
function closeSidebar(){document.body.classList.remove('sidebar-open');$('#menu-toggle').setAttribute('aria-expanded','false');}
function updateShell(){
 document.getElementById('new-draft').textContent=tab==='receipts'?t('إنشاء سند قبض','Create receipt'):t('إنشاء فاتورة','Create invoice');
 if(!me)return;
 updateAmountVisibilityButton();
 updateMasterActions();
 $('#menu-toggle').hidden=false;
 $('#menu-toggle').setAttribute('aria-label',t('فتح القائمة','Open menu'));
 $('#sidebar-backdrop').setAttribute('aria-label',t('إغلاق القائمة','Close menu'));
 $('nav').setAttribute('aria-label',t('التنقل الرئيسي','Main navigation'));
 $('#nav-caption').textContent=t('القائمة الرئيسية','Main menu');
 $('#account-name').textContent=me.name||'';
 $('#account-avatar').textContent=(me.name||'L').trim().slice(0,1);
 $('#account-role').textContent=t('حساب Ledger Online','Ledger Online account');
 $('#page-title').textContent=labels[tab]?.[language==='ar'?0:1]||'';
 $('#page-icon').replaceChildren(navIcon(tab));
 const descriptions={accounting:['المصروفات وحالة السداد وصافي الدخل','Expenses, payment status and net income'],dashboard:['ملخص الأرصدة والتحصيل','Balances and collections overview'],settings:['إعدادات Ledger Remote','Ledger Remote settings'],appearance:['تنسيق الواجهة في هذا المتصفح','Appearance in this browser'],users:['عرض المستخدمين وضبط صفحات Remote','Users and Remote page access'],invoices:['عرض الفواتير ومتابعة حالتها','Invoices and their status'],receipts:['عرض سندات القبض والتحصيلات','Receipt vouchers and collections'],statement:['حركة العملاء والأرصدة','Customer transactions and balances'],clients:['بيانات العملاء ووسائل التواصل','Client details and contact information'],templates:['بنود الفواتير وأسعارها الافتراضية','Invoice items and default prices']};
 let description=descriptions[tab]?.[language==='ar'?0:1]||'';
 const dated=!['clients','templates','settings','appearance','users'].includes(tab);
 if(dated){const from=$('#from').value,to=$('#to').value;const display=x=>x.split('-').reverse().join('/');if(from&&to)description+=' '+t('من '+display(from)+' إلى '+display(to),'from '+display(from)+' to '+display(to));else if(from)description+=' '+t('من '+display(from),'from '+display(from));else if(to)description+=' '+t('حتى '+display(to),'through '+display(to));}
 $('#page-description').textContent=description;
 $('#from').closest('label').hidden=!dated;$('#to').closest('label').hidden=!dated;
 $('#search-label').textContent=t('بحث سريع','Quick search');$('#from-label').textContent=t('من تاريخ','From date');$('#to-label').textContent=t('إلى تاريخ','To date');
 for(const b of $('nav').children){b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');}
}
$('#menu-toggle').onclick=()=>{const open=document.body.classList.toggle('sidebar-open');$('#menu-toggle').setAttribute('aria-expanded',String(open));};
$('#sidebar-backdrop').onclick=closeSidebar;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});

// Only user input renews the idle deadline; data refreshes never renew it.
function stopIdleSession(){idleGeneration++;idleDeadline=0;clearInterval(idleInterval);clearTimeout(idleActivityTimer);idleActivityTimer=undefined;idleLastSent=0;idlePending=false;idleSending=false;document.querySelector('#session-countdown')?.remove();}
function startIdleSession(expiresAt){
 idleDeadline=Number(expiresAt);if(!Number.isFinite(idleDeadline))return;
 clearInterval(idleInterval);idleInterval=setInterval(checkIdleSession,1000);checkIdleSession();
}
function checkIdleSession(){
 if(!me||!idleDeadline)return;
 if(Date.now()>=idleDeadline){
  const message=t('انتهت الجلسة بعد 5 دقائق من عدم النشاط. سجّل الدخول مجددًا.','Signed out after 5 minutes of inactivity. Please sign in again.');
  fetch('/api/logout',{method:'POST'}).catch(()=>{});error(Object.assign(Error(message),{status:401}));return;
 }

}
function onRemoteActivity(event){
 if(!event.isTrusted||!me||!idleDeadline)return;
 // Check expiry before accepting input, including after a sleeping/background tab.
 checkIdleSession();if(!me)return;
 idleDeadline=Date.now()+300000;idlePending=true;checkIdleSession();
 if(!idleSending&&!idleActivityTimer)idleActivityTimer=setTimeout(sendIdleActivity,Math.max(0,1000-(Date.now()-idleLastSent)));
}
async function sendIdleActivity(){
 idleActivityTimer=undefined;if(!me||!idlePending)return;
 const generation=idleGeneration;idlePending=false;idleSending=true;idleLastSent=Date.now();
 try{const result=await api('session-activity',{method:'POST'});if(generation!==idleGeneration||!me)return;if(!idlePending)idleDeadline=Number(result.expiresAt);}
 catch(e){if(generation===idleGeneration){if(e.status===401)error(e);else {idleDeadline=Math.min(idleDeadline,idleLastSent+300000);}}}
 finally{if(generation===idleGeneration){idleSending=false;if(idlePending&&me)idleActivityTimer=setTimeout(sendIdleActivity,1000);}}
}
for(const name of ['pointerdown','pointermove','keydown','input','wheel','touchstart','scroll'])document.addEventListener(name,onRemoteActivity,{passive:true,capture:true});
window.addEventListener('focus',checkIdleSession);
document.addEventListener('visibilitychange',checkIdleSession);

async function deleteStoredInvoice(invoice,button){
 if(button.disabled)return;
 if(!confirm(t('سيتم تحويل الفاتورة وجميع سندات القبض المرتبطة بها إلى ملغاة ونقلها إلى سلة المحذوفات. هل تريد المتابعة؟','The invoice and all linked receipts will be cancelled and moved to trash. Continue?')))return;
 button.disabled=true;try{await api('invoice-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:invoice.id,number:invoice.invoice_number})});await load();showRemoteNotice(t('تم النقل إلى سلة المحذوفات.','Moved to trash.'));}catch(e){error(e);}finally{button.disabled=false;}
}

async function deleteStoredReceipt(receipt,button){
 if(button.disabled)return;if(!confirm(t('سيتم إلغاء السند ونقله إلى سلة المحذوفات وإعادة حساب رصيد الفاتورة المرتبطة. متابعة؟','Cancel this receipt, move it to trash and recalculate the linked invoice balance?')))return;
 button.disabled=true;try{await api('receipt-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:receipt.id,number:receipt.receipt_number})});await load();showRemoteNotice(t('تم نقل السند إلى سلة المحذوفات.','Receipt moved to trash.'));}catch(e){error(e);}finally{button.disabled=false;}
}


function orderTableActions(){
    for(const cell of document.querySelectorAll('#workspace td.actions')){
        const buttons=[...cell.querySelectorAll('button')];
        const print=buttons.find(b=>['طباعة','Print'].includes((b.getAttribute('aria-label')||b.textContent).trim()));
        const remove=buttons.find(b=>['حذف','Delete'].includes((b.getAttribute('aria-label')||b.textContent).trim()));
        if(!buttons.length)continue;
        const middle=buttons.filter(b=>b!==print&&b!==remove);

        const row=document.createElement('div');
        row.style.setProperty('display','grid','important');
        row.style.setProperty('grid-template-columns','32px 32px 32px','important');
        row.style.setProperty('gap','6px','important');
        row.style.direction=language==='ar'?'ltr':'rtl';

        const slots=[remove,print,middle];
        for(const item of slots){
            const slot=document.createElement('div');
            slot.style.display='flex';
            slot.style.gap='6px';
            slot.style.alignItems='center';
            slot.style.justifyContent='center';
            slot.style.direction=language==='ar'?'rtl':'ltr';
            for(const button of (Array.isArray(item)?item:[item]).filter(Boolean)){
                button.style.setProperty('order','0','important');
                button.style.setProperty('margin','0','important');
                const label=button.textContent.trim();
const icon=['حذف','Delete'].includes(label)?'🗑':
    ['طباعة','Print'].includes(label)?'🖨':
    ['دفع','Pay'].includes(label)?'💳':'✓';
button.title=label;
button.setAttribute('aria-label',label);
button.textContent='';
const deleting=icon==='🗑',printing=icon==='🖨',paying=icon==='💳';
const paths=deleting?
 ['M3 6h18','M9 6V3h6v3','M5 6l1 15h12l1-15','M10 10v7','M14 10v7']:
 printing?
 ['M6 9V3h12v6','M6 17H3V9h18v8h-3','M6 14h12v7H6z','M17 12h1']:
 paying?
 ['M3 5h18v14H3z','M3 9h18','M7 15h4']:
 ['M5 12l4 4L19 6'];
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
svg.setAttribute('viewBox','0 0 24 24');
svg.setAttribute('width','20');
svg.setAttribute('height','20');
svg.setAttribute('fill','none');
svg.setAttribute('stroke','currentColor');
svg.setAttribute('stroke-width','2.2');
svg.setAttribute('stroke-linecap','round');
svg.setAttribute('stroke-linejoin','round');
svg.setAttribute('aria-hidden','true');
for(const d of paths){
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    svg.append(path);
}
button.append(svg);
button.style.setProperty('display','inline-flex','important');
button.style.setProperty('align-items','center','important');
button.style.setProperty('justify-content','center','important');
button.style.setProperty('background',deleting?'#fff1f2':paying?'#ecfdf5':printing?'#f1f5f9':'#eff6ff','important');
button.style.setProperty('color',deleting?'#b91c1c':paying?'#047857':printing?'#334155':'#1d4ed8','important');
button.style.setProperty('border','1px solid '+(deleting?'#fecdd3':paying?'#a7f3d0':printing?'#cbd5e1':'#bfdbfe'),'important');
button.style.setProperty('width','24px','important');
button.style.setProperty('height','24px','important');
button.style.setProperty('padding','0','important');
button.style.setProperty('font-size','13px','important');
button.style.setProperty('min-width','0','important');
                slot.append(button);
            }
            row.append(slot);
        }
        cell.replaceChildren(row);
    }
}