import test from 'node:test';import assert from 'node:assert/strict';import{validateCompanySettings,saveCompanySettings}from'../company-settings.mjs';import{mkdtemp,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
test('company settings validate fields and restrict persistent save to administrator',async()=>{
 assert.deepEqual(validateCompanySettings({name_ar:'شركة',show_watermark:true,logo_height:70}),{name_ar:'شركة',show_watermark:true,logo_height:70});
 for(const input of [{unknown:'x'},{logo_base64:'data:image/svg+xml;base64,AA=='},{invoice_title_align:'bad'},{logo_height:0},{show_watermark:'true'}])assert.throws(()=>validateCompanySettings(input));
 await assert.rejects(saveCompanySettings({}, {role:'user'}),e=>e.status===403);
 const dir=await mkdtemp(join(tmpdir(),'company-settings-'));try{const path=pathToFileURL(join(dir,'print-settings.json'));await saveCompanySettings({name_en:'Ledger',stamp_base64:''},{role:'admin'},path);assert.equal(JSON.parse(await readFile(path,'utf8')).name_en,'Ledger');}finally{await rm(dir,{recursive:true,force:true});}
});
