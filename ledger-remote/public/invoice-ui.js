let invoicePrintData,invoicePrintSettings,invoicePrintDraft=false;
const iq=s=>document.querySelector(s);
const inode=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=latin(text);return e;};
const on=v=>v!==false&&v!==0&&v!=='0';
const dimension=(v,defaultValue,min,max)=>Number.isFinite(Number(v))&&v!=null?Math.min(max,Math.max(min,Number(v))):defaultValue;
function safeImage(value){return typeof value==='string'&&/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value)?value:null;}
function imageNode(value,cls){const src=safeImage(value);if(!src)return null;const img=inode('img');img.src=src;img.alt='';img.className=cls||'';return img;}
async function openStoredInvoice(id){const current=tab;try{const {invoice:r,items}=await api('invoice-print?invoiceId='+id);if(current!==tab)return;await openInvoicePrint({number:r.invoice_number,clientName:r.client_name,date:r.issue_date,dueDate:r.due_date,status:r.status,salesManName:r.sales_man_name,receiverSignature:r.receiver_signature,portOfEntry:r.port_of_entry,shipmentRef:r.shipment_ref,billOfLading:r.bill_of_lading,packageCount:r.package_count,shipmentWeight:r.shipment_weight,importerExporterName:r.importer_exporter_name,notes:r.notes,subtotal:r.subtotal,taxRate:r.tax_rate,taxAmount:r.tax_amount,advancePayment:r.advance_payment,remaining:(Number(r.subtotal||0)+Number(r.tax_amount||0)-Number(r.advance_payment||0)).toFixed(2),items:items.map(i=>({description:i.description,quantity:i.quantity,unitPrice:i.unit_price,total:i.total}))},r.status==='draft');}catch(e){error(e);}}
async function openInvoicePrint(invoice,draft){const current=tab;try{const result=await api('print-settings');if(current!==tab)return;invoicePrintData=invoice;invoicePrintSettings=result.settings;invoicePrintDraft=draft;iq('#invoice-print-notice').textContent=result.configured?'':t('لا توجد إعدادات شركة — انقل إعدادات Desktop أولًا','No company settings — export Desktop print settings first');iq('#print-invoice').disabled=true;ensureInvoicePrintControls();renderInvoicePrint();mountRemoteEditor(iq('#invoice-dialog'));fitPrintPreview(iq('#invoice-dialog'),iq('#invoice-paper'));await Promise.all([...iq('#invoice-paper').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));iq('#print-invoice').disabled=false;fitPrintPreview(iq('#invoice-dialog'),iq('#invoice-paper'));}catch(e){if(remoteEditor?.node.id==='draft-dialog')showRemoteNotice(e.message,'error');else error(e);}}
function renderInvoicePrint(){const i=invoicePrintData,s=invoicePrintSettings,root=iq('#invoice-paper');if(!i)return;root.replaceChildren();root.dir='rtl';const content=inode('div');content.className='invoice-body';
if(on(s.show_watermark)){const wm=imageNode(s.watermark_base64||s.logo_base64,'invoice-watermark');if(wm)root.append(wm);}
const head=inode('div');head.className='invoice-letterhead';head.dir='ltr';const en=inode('div');for(const [tag,key]of [['h2','name_en'],['strong','subtitle_en'],['p','tagline_en']])en.append(inode(tag,s[key]||''));en.append(inode('p',[s.phone,s.po_box,s.address].filter(Boolean).join(' · ')),inode('p',[s.cr_number?'CR: '+s.cr_number:'',s.tax_number?'Tax: '+s.tax_number:''].filter(Boolean).join(' · ')));
const middle=inode('div');middle.className='invoice-logo';const logo=imageNode(s.logo_base64);if(logo){logo.style.height=dimension(s.logo_size,45,20,160)+'px';logo.style.transform='translateY('+dimension(s.logo_height,0,-40,40)+'px)';middle.append(logo);}const ar=inode('div');ar.dir='rtl';for(const [tag,key]of [['h2','name_ar'],['strong','subtitle_ar'],['p','tagline_ar']])ar.append(inode(tag,s[key]||''));ar.append(inode('p',[s.address,s.po_box,s.phone].filter(Boolean).join(' · ')),inode('p',[s.cr_number?'س.ت: '+s.cr_number:'',s.tax_number?'ضريبي: '+s.tax_number:''].filter(Boolean).join(' · ')));head.append(en,middle,ar);content.append(head);
const meta=inode('div');meta.className='invoice-meta';meta.dir='ltr';const num=inode('div');num.className='invoice-number';num.append(inode('small','Invoice No'),inode('h2',i.number||'غير محفوظة / UNSAVED'));if(i.number)num.append(code128(i.number));const title=inode('div');title.className='invoice-title';if(on(s.invoice_title_visible)){const nameAr=inode('h2',s.invoice_credit_title_ar||'فاتورة نقدًا / على الحساب');nameAr.style.fontSize=dimension(s.invoice_title_font_size,25,12,40)+'px';nameAr.style.fontWeight=on(s.invoice_title_bold)?'bold':'normal';const nameEn=inode('strong',s.invoice_credit_title_en||'Cash / Credit Invoice');nameEn.style.fontSize=dimension(s.invoice_title_en_font_size,14,8,25)+'px';title.style.textAlign=['left','right','center'].includes(s.invoice_title_align)?s.invoice_title_align:'center';title.append(nameAr,nameEn);for(const key of ['invoice_subtitle_ar','invoice_subtitle_en'])if(s[key]){const sub=inode('p',s[key]);sub.style.fontSize=dimension(s.invoice_subtitle_font_size,12,8,25)+'px';title.append(sub);}}meta.append(num,title);content.append(meta);
const grid=inode('div');grid.className='invoice-info';grid.dir='ltr';for(const [label,value]of [['Customer / العميل',i.clientName],['Inv. Date',i.date],['Sales Man / المندوب',i.salesManName],['B.L / M AWB',i.billOfLading],['منفذ الدخول / Port',i.portOfEntry],['Weight / الوزن',i.shipmentWeight!=null?i.shipmentWeight+' Kg':'—'],['Pec No / عدد الطرود',i.packageCount!=null?i.packageCount+' Pec':'—'],['BAIAN No / رقم البيان',i.shipmentRef],['IMP / EXP',i.importerExporterName]]){const cell=inode('div');cell.append(inode('small',label),inode('strong',value||'—'));if(label==='IMP / EXP'&&i.dueDate)cell.append(inode('small','Due Date: '+i.dueDate));grid.append(cell);}const bar=inode('div');if(i.shipmentRef)bar.append(code128(i.shipmentRef));grid.append(bar);content.append(grid);
const table=inode('table');table.className='invoice-lines';const thead=inode('thead'),tr=inode('tr');for(const text of ['#','Description / الوصف','الكمية','سعر الوحدة','Total Amount'])tr.append(inode('th',text));thead.append(tr);table.append(thead);const tbody=inode('tbody');i.items.forEach((r,index)=>{const row=inode('tr');for(const val of [index+1,r.description,r.quantity,amount(r.unitPrice),amount(r.total)])row.append(inode('td',val));tbody.append(row);});table.append(tbody);content.append(table);
const totals=inode('div');totals.className='invoice-totals';for(const [label,value]of [['إجمالي الفاتورة / Invoice Amount',i.subtotal],...(Number(i.taxRate)>0?[[`ضريبة / Tax (${i.taxRate}%)`,i.taxAmount]]:[]),...(Number(i.advancePayment)>0?[['الدفعة المقدمة / Advance Payment','- '+amount(i.advancePayment)]]:[]),['الإجمالي الكلي / Grand Total',i.remaining]]){const row=inode('div');row.append(inode('span',label),inode('b',typeof value==='string'&&value.startsWith('- ')?value:amount(value)));totals.append(row);}totals.lastElementChild.className='grand-total';totals.append(inode('p','الإجمالي كتابةً: '+invoiceAmountWords(i.remaining,'ar')),inode('p','Amount Total: '+invoiceAmountWords(i.remaining,'en')));content.append(totals);if(i.notes)content.append(inode('p','ملاحظات / Notes: '+i.notes));
const signatures=inode('div');signatures.className='invoice-signatures';signatures.dir='ltr';for(const [arLabel,enLabel,key,visible]of [['توقيع المحاسب','Accountant','accountant_signature_base64',s.show_accountant_signature],['الختم','Stamp','stamp_base64',s.show_stamp_on_invoices],['توقيع المستلم','Received By','receiver_signature_base64',s.show_receiver_signature]]){const box=inode('div');const show=key==='stamp_base64'?iq('#invoice-stamp').checked:iq('#invoice-signatures').checked;const img=show&&on(visible)?imageNode(key==='receiver_signature_base64'?(i.receiverSignature||s[key]):s[key],key==='stamp_base64'?'official-stamp':'signature-image'):null;if(img){if(key==='stamp_base64'&&iq('#invoice-stamp-accountant').checked)signatures.firstElementChild.append(img);else box.append(img);}if(key!=='stamp_base64')box.append(inode('p',arLabel),inode('small',enLabel));signatures.append(box);}content.append(signatures);
const foot=inode('footer');foot.className='invoice-footer';foot.append(inode('div',[s.email,[s.name_ar,s.name_en].filter(Boolean).join(' - '),[s.po_box,s.address,s.phone].filter(Boolean).join(' · ')].filter(Boolean).join(' | ')));if(s.footer_text)foot.append(inode('p',s.footer_text));foot.append(inode('small','طبعت في / Printed: '+new Date().toLocaleString('en-GB',{numberingSystem:'latn'})+' — '+(i.number||'UNSAVED DRAFT')));content.append(foot);root.append(content);}
iq('#invoice-stamp').onchange=refreshInvoicePrint;iq('#invoice-signatures').onchange=refreshInvoicePrint;iq('#close-invoice').onclick=()=>leaveRemoteEditor();
iq('#print-invoice').onclick=()=>{document.body.classList.remove('printing-items');document.body.classList.add('printing-invoice');const style=inode('style');style.id='invoice-page-style';style.textContent='@page{size:A4 portrait;margin:8mm}';document.head.append(style);window.print();};
window.addEventListener('afterprint',()=>{document.body.classList.remove('printing-invoice');iq('#invoice-page-style')?.remove();});

const code128Widths=["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];
function code128(text){if(!/^[ -~]+$/.test(text)||text.length>100)return inode('span',text);const codes=[104,...[...text].map(c=>c.charCodeAt(0)-32)];codes.push(codes.reduce((sum,c,index)=>sum+(index?c*index:c),0)%103,106);const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');let x=10;for(const code of codes){const pattern=code128Widths[code];for(let n=0;n<pattern.length;n++){const width=Number(pattern[n]);if(n%2===0){const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',x);rect.setAttribute('y',0);rect.setAttribute('width',width);rect.setAttribute('height',30);svg.append(rect);}x+=width;}}svg.setAttribute('viewBox','0 0 '+(x+10)+' 42');svg.classList.add('invoice-barcode');const label=document.createElementNS(ns,'text');label.textContent=text;label.setAttribute('x',(x+10)/2);label.setAttribute('y',40);label.setAttribute('text-anchor','middle');label.setAttribute('font-size','8');svg.append(label);return svg;}

const engOnes = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const engTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigitsEn(n) {
  if (n === 0) return "";

  const h = Math.floor(n / 100);
  const r = n % 100;
  const t = Math.floor(r / 10);
  const o = r % 10;
  const parts = [];

  if (h > 0) parts.push(engOnes[h] + " Hundred");
  if (r < 20 && r > 0) {
    parts.push(engOnes[r]);
  } else {
    if (t > 0) parts.push(engTens[t]);
    if (o > 0) parts.push(engOnes[o]);
  }

  return parts.join(" ");
}

function numberToEnglishWords(amount) {
  const total = Math.round(amount);
  if (total === 0) return "Zero Qatari Riyals Only";

  const billions = Math.floor(total / 1_000_000_000);
  const millions = Math.floor((total % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((total % 1_000_000) / 1_000);
  const remainder = total % 1_000;

  const parts = [];
  if (billions > 0) parts.push(threeDigitsEn(billions) + " Billion");
  if (millions > 0) parts.push(threeDigitsEn(millions) + " Million");
  if (thousands > 0) parts.push(threeDigitsEn(thousands) + " Thousand");
  if (remainder > 0) parts.push(threeDigitsEn(remainder));

  return parts.join(" ") + " Qatari Riyals Only";
}

// ── Number to Arabic words ────────────────────────────────────────────────────
const ones = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function threeDigits(n) {
  if (n === 0) return "";

  const h = Math.floor(n / 100);
  const r = n % 100;
  const t = Math.floor(r / 10);
  const o = r % 10;
  const parts = [];

  if (h > 0) parts.push(hundreds[h]);
  if (r < 20 && r > 0) {
    parts.push(ones[r]);
  } else {
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(ones[o]);
  }

  return parts.join(" و");
}

function numberToArabicWords(amount) {
  const total = Math.round(amount);
  if (total === 0) return "صفر ريال قطري فقط";

  const billions = Math.floor(total / 1_000_000_000);
  const millions = Math.floor((total % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((total % 1_000_000) / 1_000);
  const remainder = total % 1_000;

  const parts = [];

  if (billions === 1) parts.push("مليار");
  else if (billions === 2) parts.push("ملياران");
  else if (billions > 2) parts.push(threeDigits(billions) + " مليارات");

  if (millions === 1) parts.push("مليون");
  else if (millions === 2) parts.push("مليونان");
  else if (millions > 2) parts.push(threeDigits(millions) + " ملايين");

  if (thousands === 1) parts.push("ألف");
  else if (thousands === 2) parts.push("ألفان");
  else if (thousands > 2 && thousands < 11) parts.push(threeDigits(thousands) + " آلاف");
  else if (thousands >= 11) parts.push(threeDigits(thousands) + " ألف");

  if (remainder > 0) parts.push(threeDigits(remainder));

  return "ريال قطري " + parts.join(" و") + " فقط لا غير";
}


function invoiceAmountWords(value,lang){const cents=Math.round(Number(value||0)*100),whole=Math.floor(cents/100),fraction=cents%100;const words=lang==='ar'?numberToArabicWords(whole):numberToEnglishWords(whole);return fraction?(lang==='ar'?words.replace(/ فقط لا غير$| فقط$/,'')+' و '+fraction+' درهم فقط لا غير':words.replace(/ Only$/,'')+' and '+fraction+' Dirhams Only'):words;}

let invoiceRenderGeneration=0;
async function refreshInvoicePrint(){const n=++invoiceRenderGeneration;iq('#print-invoice').disabled=true;ensureInvoicePrintControls();renderInvoicePrint();await Promise.all([...iq('#invoice-paper').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));if(n===invoiceRenderGeneration)iq('#print-invoice').disabled=false;fitPrintPreview(iq('#invoice-dialog'),iq('#invoice-paper'));}
function ensureInvoicePrintControls(){
 const controls=iq('.invoice-controls');let move=iq('#invoice-stamp-accountant');if(!move){const label=inode('label');move=inode('input');move.type='checkbox';move.id='invoice-stamp-accountant';move.onchange=refreshInvoicePrint;label.append(move);controls.insertBefore(label,iq('#invoice-print-notice'));}
 for(const [id,ar,en]of [['invoice-stamp','إظهار الختم','Show stamp'],['invoice-signatures','إظهار التوقيعات','Show signatures'],['invoice-stamp-accountant','الختم فوق المحاسب','Stamp over accountant']]){const box=iq('#'+id),label=box.closest('label');for(const node of [...label.childNodes])if(node!==box)node.remove();label.append(document.createTextNode(' '+t(ar,en)));}
 move.disabled=!iq('#invoice-stamp').checked;
}
