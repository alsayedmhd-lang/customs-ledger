let masterDialog,masterForm,masterKind,masterRequestId,masterResult,masterSave,masterClose,masterOpen,masterEditing;
function updateMasterActions(){
 if(!masterOpen){masterOpen=document.createElement('button');masterOpen.type='button';masterOpen.id='new-master';document.querySelector('.tools').append(masterOpen);masterOpen.onclick=()=>openMasterEditor();}
 masterOpen.hidden=!((tab==='clients'&&me.access.createClient)||(tab==='templates'&&me.access.createTemplate));
 masterOpen.textContent=tab==='clients'?t('إنشاء عميل','Create client'):t('إنشاء بند','Create item');
}
function masterField(key,ar,en,type='text',required=false,max=200){
 const label=el('label',t(ar,en));const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.name=key;input.required=required;input.maxLength=max;input.style.width='100%';if(type==='number'){input.min='0';input.max='9999999999.99';input.step='0.01';input.value='0';}label.append(input);masterForm.append(label);
}
async function openMasterEditor(id=null){const current=tab;
 masterKind=tab==='clients'?'client':'template';masterRequestId=remoteUuid();masterEditing=null;
 if(id!=null){try{masterEditing=await api('master-record?kind='+masterKind+'&id='+encodeURIComponent(id));}catch(e){error(e);return;}}
 if(current!==tab)return;if(!masterDialog){masterDialog=document.createElement('section');masterDialog.id='master-dialog';}
 masterDialog.replaceChildren();masterClose=el('button',t('رجوع','Back'));masterClose.type='button';masterClose.onclick=()=>leaveRemoteEditor();
 masterDialog.append(masterClose,el('h2',masterEditing?(masterKind==='client'?t('تعديل العميل','Edit client'):t('تعديل البند','Edit item')):(masterKind==='client'?t('إنشاء عميل','Create client'):t('إنشاء بند','Create item'))));
 masterForm=document.createElement('form');masterDialog.append(masterForm);
 if(masterKind==='client'){masterField('name','اسم العميل','Client name','text',true);masterField('phone','الهاتف','Phone','tel',false,50);masterField('email','البريد الإلكتروني','Email','email',false,254);masterField('taxId','الرقم الضريبي','Tax ID','text',false,100);masterField('address','العنوان','Address','textarea',false,1000);masterField('notes','ملاحظات','Notes','textarea',false,2000);}
 else{masterField('description','وصف البند','Item description','text',true,500);masterField('defaultUnitPrice','السعر الافتراضي','Default price','number',true);}
 if(masterEditing){const row=masterEditing.record;for(const field of masterForm.elements){const key=field.name==='taxId'?'tax_id':field.name==='defaultUnitPrice'?'default_unit_price':field.name;field.value=row[key]??'';}}
 masterSave=el('button',t('حفظ','Save'));masterSave.type='submit';masterForm.append(masterSave);masterResult=el('p');masterResult.setAttribute('role','status');masterDialog.append(masterResult);
 masterForm.onsubmit=async event=>{event.preventDefault();if(masterSave.disabled)return;masterSave.disabled=true;masterClose.disabled=true;setEditorBusy(true);masterResult.textContent=t('جاري الحفظ…','Saving…');let saved=false,fieldStates=[];try{const input={...Object.fromEntries(new FormData(masterForm)),kind:masterKind,requestId:masterRequestId};if(masterEditing){input.id=Number(masterEditing.record.id);input.version=masterEditing.version;}fieldStates=[...masterForm.elements].map(field=>[field,field.disabled]);for(const [field]of fieldStates)field.disabled=true;await api(masterEditing?'master-update':'master-create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});saved=true;masterResult.textContent=t('تم الحفظ في Online بنجاح.','Saved Online successfully.');for(const field of masterForm.elements)field.disabled=true;$('#search').value='';pageNumber=1;setEditorBusy(false);finishRemoteEditor();await init();}catch(e){masterResult.textContent=e.message;}finally{setEditorBusy(false);masterClose.disabled=false;if(!saved){for(const [field,disabled]of fieldStates)field.disabled=disabled;masterSave.disabled=false;}}};
 masterForm.oninput=editorChanged;masterForm.className='editor-card editor-grid';mountRemoteEditor(masterDialog);
}

function masterEditButton(id){const button=el('button',t('تعديل','Edit'));button.type='button';button.onclick=()=>openMasterEditor(id);return button;}
