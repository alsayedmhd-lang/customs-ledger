function preferredUiLanguage(){try{return localStorage.getItem('ledger-remote-language')==='en'?'en':'ar';}catch{return 'ar';}}
function uiText(text){const labels={
'حذف / Remove':['حذف','Remove'],'اختيار بند / Choose item':['اختيار بند','Choose item'],'بدون ربط بفاتورة / Unlinked':['بدون ربط بفاتورة','Unlinked'],'اختر العميل / Select client':['اختر العميل','Select client'],
'وصف البند / Description':['وصف البند','Description'],'تحضير فاتورة مسودة / Invoice draft':['إنشاء فاتورة','Create invoice'],'تحضير سند قبض مسودة / Receipt draft':['إنشاء سند قبض','Create receipt'],
'العميل / Client':['العميل','Client'],'التاريخ / Date':['التاريخ','Date'],'قبل الضريبة / Subtotal':['قبل الضريبة','Subtotal'],'الضريبة / Tax':['الضريبة','Tax'],'الإجمالي / Gross':['الإجمالي','Gross total'],'دفعة مقدمة / Advance':['دفعة مقدمة','Advance payment'],'المتبقي / Remaining':['المتبقي','Remaining'],'المبلغ / Amount':['المبلغ','Amount'],'الفاتورة / Invoice':['الفاتورة','Invoice']};
const pair=labels[text];return pair?pair[language==='ar'?0:1]:text;}
function updateUiLanguage(){
 if(typeof otpLanguage==='function')otpLanguage();
 const index=language==='ar'?0:1;
 const buttons={logout:['تسجيل الخروج','Logout'],'new-draft':tab==='receipts'?['إنشاء سند قبض','Create receipt']:['إنشاء فاتورة','Create invoice'],print:['طباعة','Print'],refresh:['تحديث','Refresh'],prev:['السابق','Previous'],next:['التالي','Next'],clear:['مسح الفلاتر','Clear filters'],'close-items':['إغلاق','Close'],'print-items':['طباعة البنود','Print items'],'close-draft':['رجوع','Back'],'add-line':['إضافة بند','Add item'],'preview-draft':['معاينة','Preview'],'print-draft':['معاينة طباعة الفاتورة','Invoice print preview'],'save-draft':['حفظ','Save'],'export-draft':['تصدير المعاينة','Export preview'],'close-invoice':['إغلاق','Close'],'print-invoice':['طباعة / PDF','Print / PDF']};
 for(const [id,pair]of Object.entries(buttons)){const node=document.getElementById(id);if(node)node.textContent=pair[index];}
 document.querySelector('#login form button').textContent=['دخول','Sign in'][index];
 document.querySelector('#login h1').textContent=['الدخول','Sign in'][index];
 document.querySelector('#login p').textContent='';document.querySelector('#login p').hidden=true;
 document.querySelector('#login small')?.remove();
 const fields={username:['المستخدم','Username'],password:['كلمة المرور','Password'],'draft-client':['العميل','Client'],'draft-date':['تاريخ الإصدار','Issue date'],'draft-status':['الحالة','Status'],'draft-salesman':['المندوب','Salesman'],'draft-importer':['اسم المستورد / المصدر','Importer / exporter'],'draft-port':['المنفذ','Port'],'draft-packages':['عدد الطرود','Packages'],'draft-weight':['الوزن Kg','Weight Kg'],'draft-due':['تاريخ الاستحقاق','Due date'],'draft-shipment':['البيان','Declaration'],'draft-bill':['البوليصة','Bill of lading'],'draft-tax':['الضريبة %','Tax %'],'draft-advance':['دفعة مقدمة','Advance payment'],'draft-invoice':['الفاتورة','Invoice'],'draft-amount':['المبلغ','Amount'],'draft-payment':['طريقة الدفع','Payment method'],'draft-notes':['ملاحظات','Notes'],'invoice-stamp':['الختم','Stamp'],'invoice-signatures':['التوقيعات','Signatures']};
 for(const [key,pair] of Object.entries(fields)){
  const node=document.getElementById(key)||document.querySelector(`#login [name="${key}"]`);const label=node?.closest('label');if(!label)continue;
  for(const child of [...label.childNodes])if(child.nodeType===3)child.remove();
  label.insertBefore(document.createTextNode(pair[index]+' '),label.firstChild);
 }
 document.getElementById('search').placeholder=['بحث','Search'][index];
 document.getElementById('from').setAttribute('aria-label',['من تاريخ','From date'][index]);document.getElementById('to').setAttribute('aria-label',['إلى تاريخ','To date'][index]);
 document.getElementById('page-size').setAttribute('aria-label',['عدد السجلات في الصفحة','Rows per page'][index]);
 const payments={cash:['نقدًا','Cash'],bank_transfer:['تحويل بنكي','Bank transfer'],cheque:['شيك','Cheque']};
 for(const option of document.getElementById('draft-payment').options)option.textContent=payments[option.value][index];
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.getElementById('lang').textContent=language==='ar'?'English':'العربية';
 try{localStorage.setItem('ledger-remote-language',language);}catch{}
}

function remoteUuid(){
 const source=globalThis.crypto;
 if(typeof source?.randomUUID==='function')return source.randomUUID();
 if(typeof source?.getRandomValues!=='function')throw Error('المتصفح لا يدعم توليد هوية آمنة / Secure random generation is unavailable');
 const bytes=new Uint8Array(16);source.getRandomValues(bytes);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
