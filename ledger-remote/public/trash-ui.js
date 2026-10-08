(() => {
 function addTrashNavigation(){
  const nav=document.querySelector('nav');if(!nav)return;
  let button=nav.querySelector('[data-remote-trash]');
  if(!me?.access.trash){button?.remove();return;}
  const title=t('سلة المحذوفات','Trash');
  if(!button){button=el('button');button.type='button';button.dataset.remoteTrash='true';button.append(navIcon('invoices'),el('span',title));button.onclick=()=>leaveRemoteEditor(()=>{closeSidebar();openRemoteTrash();});const following=[...nav.children].find(b=>['clients','templates','users','settings','appearance'].includes(b.dataset.tab));nav.insertBefore(button,following||null);}
  else if(button.lastElementChild.textContent!==title)button.lastElementChild.textContent=title;
 }
 async function openRemoteTrash(){
  const page=el('section');page.id='remote-trash-page';const heading=el('div');heading.className='editor-heading';const title=el('h2',t('سلة المحذوفات','Trash')),back=el('button',t('رجوع','Back'));back.type='button';back.onclick=()=>leaveRemoteEditor();heading.append(title,back);page.append(heading);
  page.append(el('p',t('المحذوفات المحفوظة في Online. الفترة أدناه تخص تاريخ الحذف.','Deleted records stored in Online. Dates below filter deletion dates.')));
  const form=el('form');form.className='tools';const kind=el('select');kind.setAttribute('aria-label',t('نوع المستند','Document type'));
  for(const [value,access,ar,en]of [['invoice','trashInvoices','الفواتير','Invoices'],['receipt','trashReceipts','سندات القبض','Receipts']])if(me.access[access]){const option=el('option',t(ar,en));option.value=value;kind.append(option);}
  const search=el('input');search.type='search';search.placeholder=t('رقم المستند أو العميل','Document number or client');search.maxLength=200;search.setAttribute('aria-label',search.placeholder);
  const from=el('input'),to=el('input');for(const input of [from,to])input.type='date';from.setAttribute('aria-label',t('الحذف من تاريخ','Deleted from'));to.setAttribute('aria-label',t('الحذف إلى تاريخ','Deleted to'));
  const refresh=el('button',t('تحديث','Refresh'));refresh.type='submit';const clear=el('button',t('مسح الفلاتر','Clear filters'));clear.type='button';
  form.append(kind,search,from,to,refresh,clear);page.append(form);
  const message=el('p');message.setAttribute('role','status');const content=el('div');content.className='table';const controls=el('div');controls.className='tools';const previous=el('button',t('السابق','Previous')),next=el('button',t('التالي','Next')),summary=el('span');previous.type=next.type='button';controls.append(previous,summary,next);page.append(message,content,controls);
  let pageNumber=1,generation=0;mountRemoteEditor(page);
  async function fetchTrash(){
   const n=++generation;refresh.disabled=previous.disabled=next.disabled=true;message.textContent=t('جاري الجلب…','Loading…');
   try{
    const result=await api('trash?'+new URLSearchParams({kind:kind.value,page:pageNumber,pageSize:25,q:search.value,from:from.value,to:to.value}));if(n!==generation||!page.isConnected)return;
    pageNumber=result.page;content.replaceChildren();const table=el('table'),head=el('thead'),row=el('tr');
    for(const title of [t('المستند','Document'),t('العميل','Client'),result.kind==='invoice'?t('السندات المرتبطة','Linked receipts'):t('الفاتورة المرتبطة','Linked invoice'),t('الحالة','Status'),t('تاريخ الحذف','Deleted at'),t('إجراءات','Actions')])row.append(el('th',title));head.append(row);table.append(head);
    const body=el('tbody');for(const record of result.rows){const tr=el('tr');const time=new Date(record.deleted_at);for(const value of [record.number,record.client_name||'—',result.kind==='receipt'?record.invoice_number||'—':record.linked_receipts||'—',translated(record.status),Number.isNaN(time.getTime())?String(record.deleted_at):time.toLocaleString('en-GB',{numberingSystem:'latn'})])tr.append(el('td',value));const actions=el('td');const restore=el('button',t('استعادة','Restore')),purge=el('button',t('حذف نهائي','Delete permanently'));restore.type=purge.type='button';for(const [button,action]of [[restore,'restore'],[purge,'purge']])button.onclick=async()=>{const prompt=action==='restore'?t('سيعود المستند مسودة. استعادة الفاتورة لا تستعيد سنداتها تلقائيًا. متابعة؟','Restore as draft? Restoring an invoice does not restore its receipts.'):t('حذف نهائي غير قابل للاستعادة من السلة. متابعة؟','Permanently delete? This cannot be restored from trash.');if(!confirm(prompt))return;restore.disabled=purge.disabled=true;try{await api('trash-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:result.kind,action,id:record.id,number:record.number})});await fetchTrash();}catch(e){showRemoteNotice(e.message,'error');if(e.status===401)error(e);}finally{restore.disabled=purge.disabled=false;}};const actionRow=el('div');actionRow.style.setProperty('display','flex','important');actionRow.style.setProperty('gap','12px','important');actionRow.style.flexWrap='nowrap';actionRow.style.direction=language==='ar'?'rtl':'ltr';if(me.actions?.[result.kind+'Restore']!==false)actionRow.append(restore);if(me.actions?.[result.kind+'Purge']!==false)actionRow.append(purge);actions.append(actionRow);tr.append(actions);body.append(tr);}table.append(body);content.append(table);
    if(!result.rows.length)content.append(el('p',t('لا توجد محذوفات ضمن الفلاتر الحالية.','No deleted records match these filters.')));
    summary.textContent=t('صفحة ','Page ')+result.page+' / '+result.pages+' — '+result.count+t(' سجل',' rows');previous.disabled=result.page<=1;next.disabled=result.page>=result.pages;message.textContent='';
   }catch(e){if(n===generation&&page.isConnected){content.replaceChildren();showRemoteNotice(e.message,'error');if(e.status===401)error(e);}}finally{if(n===generation)refresh.disabled=false;}
  }
  form.onsubmit=e=>{e.preventDefault();pageNumber=1;fetchTrash();};kind.onchange=()=>{pageNumber=1;fetchTrash();};clear.onclick=()=>{search.value=from.value=to.value='';pageNumber=1;fetchTrash();};previous.onclick=()=>{if(pageNumber>1){pageNumber--;fetchTrash();}};next.onclick=()=>{pageNumber++;fetchTrash();};await fetchTrash();
 }
 window.openRemoteTrash=openRemoteTrash;
 new MutationObserver(addTrashNavigation).observe(document.querySelector('nav'),{childList:true,subtree:true});addTrashNavigation();
})();
