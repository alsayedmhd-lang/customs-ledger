import test from 'node:test';import assert from 'node:assert/strict';import{printSettings}from'../print-settings.mjs';import{readCompanyBrand}from'../company-brand.mjs';import{readFileSync}from'node:fs';
test('company and print settings read Online without local overrides; Remote save is denied',async()=>{
 const pool={async query(sql){if(sql.includes('information_schema'))return{rows:[{column_name:'name_en'},{column_name:'logo_base64'}]};if(sql.includes('to_regclass'))return{rows:[{table_name:'company_settings'}]};return{rows:[{name_en:'Online company',logo_base64:null}]};}};
 assert.equal((await printSettings(pool,false)).settings.name_en,'Online company');assert.equal((await readCompanyBrand(pool,false)).name_en,'Online company');

 assert.match(readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),/saveSessionPrintSettings\(session,user/);
});
