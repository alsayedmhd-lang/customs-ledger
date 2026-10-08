async function renderCompanySettings(root){
 const details=el('details');details.open=true;details.className='company-settings-panel';details.append(el('summary',t('بيانات الشركة والطباعة','Company and print settings')));root.append(details);
 try{
 const result=await api('print-settings');const values={...result.settings},form=el('form');form.className='company-settings-form';details.append(form);
 const groups=[
 ['بيانات الشركة','Company details',[['name_ar','اسم الشركة بالعربية','Company name (Arabic)'],['name_en','اسم الشركة بالإنجليزية','Company name (English)'],['subtitle_ar','العنوان الفرعي بالعربية','Subtitle (Arabic)'],['subtitle_en','العنوان الفرعي بالإنجليزية','Subtitle (English)'],['tagline_ar','الوصف بالعربية','Tagline (Arabic)'],['tagline_en','الوصف بالإنجليزية','Tagline (English)'],['email','البريد','Email'],['phone','الهاتف','Phone'],['address','العنوان','Address'],['po_box','صندوق البريد','PO box'],['website','الموقع الإلكتروني','Website'],['cr_number','السجل التجاري','Commercial registration'],['tax_number','الرقم الضريبي','Tax number'],['footer_text','تذييل الطباعة','Print footer']]],
 ['الصور والتوقيعات','Images and signatures',[['logo_base64','الشعار','Logo'],['stamp_base64','الختم','Stamp'],['watermark_base64','الخلفية المائية','Watermark'],['accountant_signature_base64','توقيع المحاسب','Accountant signature'],['receiver_signature_base64','توقيع المستلم الافتراضي','Default receiver signature']]],
 ['بيانات الطباعة','Print details',[
 ['invoice_cash_title_ar','عنوان الفاتورة النقدية بالعربية','Cash invoice title (Arabic)'],['invoice_cash_title_en','عنوان الفاتورة النقدية بالإنجليزية','Cash invoice title (English)'],['invoice_credit_title_ar','عنوان الفاتورة الآجلة بالعربية','Credit invoice title (Arabic)'],['invoice_credit_title_en','عنوان الفاتورة الآجلة بالإنجليزية','Credit invoice title (English)'],['invoice_subtitle_ar','عنوان فرعي للفاتورة بالعربية','Invoice subtitle (Arabic)'],['invoice_subtitle_en','عنوان فرعي للفاتورة بالإنجليزية','Invoice subtitle (English)'],['receipt_title_ar','عنوان السند بالعربية','Receipt title (Arabic)'],['receipt_title_en','عنوان السند بالإنجليزية','Receipt title (English)'],['receipt_subtitle_ar','عنوان فرعي للسند بالعربية','Receipt subtitle (Arabic)'],['receipt_subtitle_en','عنوان فرعي للسند بالإنجليزية','Receipt subtitle (English)'],
 ...['invoice','receipt'].flatMap(prefix=>[['title_font_size','حجم العنوان','Title size'],['title_en_font_size','حجم العنوان الإنجليزي','English title size'],['subtitle_font_size','حجم العنوان الفرعي','Subtitle size'],['title_visible','إظهار العنوان','Show title'],['title_bold','عنوان عريض','Bold title'],['title_align','محاذاة العنوان','Title alignment']].map(([key,ar,en])=>[prefix+'_'+key,(prefix==='invoice'?'الفاتورة — ':'السند — ')+ar,(prefix==='invoice'?'Invoice — ':'Receipt — ')+en])),
 ['logo_height','ارتفاع الشعار','Logo height'],['show_watermark','إظهار الخلفية المائية','Show watermark'],['show_stamp_on_invoices','الختم في الفواتير','Stamp on invoices'],['show_stamp_on_receipts','الختم في السندات','Stamp on receipts'],['show_accountant_signature','إظهار توقيع المحاسب','Show accountant signature'],['show_receiver_signature','إظهار توقيع المستلم','Show receiver signature']
 ]]];
 const save=el('button',t('حفظ بيانات الشركة والطباعة','Save company and print settings'));save.type='submit';let uploads=0;
 for(const [ar,en,fields]of groups){
 const group=el('details');group.open=groups[0][0]===ar;group.append(el('summary',t(ar,en)));const grid=el('div');grid.className='company-settings-grid';group.append(grid);form.append(group);
 for(const [key,ar,en]of fields){
 const label=el('label',t(ar,en));grid.append(label);
 if(key.endsWith('_base64')){
 const preview=el('img');preview.alt=t(ar,en);preview.hidden=!values[key];if(values[key])preview.src=values[key];
 const input=el('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
 const remove=el('button',t('إزالة','Remove'));remove.type='button';remove.onclick=()=>{values[key]='';preview.hidden=true;preview.removeAttribute('src');input.value='';};
 input.onchange=async()=>{const file=input.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){showRemoteNotice(t('اختر صورة حتى 5 MB.','Choose an image up to 5 MB.'),'error');return;}uploads++;save.disabled=true;try{const image=await createImageBitmap(file),scale=Math.min(1,1000/image.width,600/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();const value=canvas.toDataURL('image/png');if(value.length>600000)throw Error(t('الصورة كبيرة؛ اختر صورة أصغر.','Image too large; choose a smaller image.'));values[key]=value;preview.src=value;preview.hidden=false;}catch(e){showRemoteNotice(e.message,'error');}finally{uploads--;save.disabled=uploads>0;}};label.append(preview,input,remove);
 }else{
 let input;const bool=key.startsWith('show_')||key.endsWith('_visible')||key.endsWith('_bold'),number=key.includes('font_size')||key==='logo_height';
 if(key.endsWith('_align')){input=el('select');for(const [v,a,e]of [['left','يسار','Left'],['center','وسط','Center'],['right','يمين','Right']]){const option=el('option',t(a,e));option.value=v;input.append(option);}input.value=values[key]||'center';}
 else{input=el('input');input.type=bool?'checkbox':number?'number':'text';if(bool)input.checked=values[key]===true;else{input.value=values[key]??'';if(number){input.min=6;input.max=300;}else input.maxLength=2000;}}
 input.onchange=()=>{values[key]=bool?input.checked:number?Number(input.value):input.value;};label.append(input);
 }
 }
 }
 save.textContent=t('تطبيق الإعدادات','Apply settings');form.append(save,el('p',t('الحقول الفارغة في Online تستخدم إعدادات محلية محفوظة. تعديل الحقول الموجودة في Online مؤقت للجلسة فقط.','Empty Online fields use saved local settings. Changes to populated Online fields apply only for this session.')));
 form.onsubmit=async event=>{event.preventDefault();if(uploads)return;save.disabled=true;try{await api('company-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});location.reload();}catch(e){showRemoteNotice(e.message,'error');}finally{save.disabled=false;}};

 }catch(e){showRemoteNotice(e.message,'error');}
}
