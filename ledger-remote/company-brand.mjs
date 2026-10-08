import {readFile} from 'node:fs/promises';
export async function readCompanyBrand(pool,demo){
 let settings;
 if(!demo){const table=(await pool.query("SELECT to_regclass('company_settings') AS table_name")).rows[0];if(table?.table_name)settings=(await pool.query("SELECT to_jsonb(c)->>'logo_base64' AS logo_base64,to_jsonb(c)->>'name_ar' AS name_ar,to_jsonb(c)->>'name_en' AS name_en,to_jsonb(c)->>'subtitle_ar' AS subtitle_ar,to_jsonb(c)->>'subtitle_en' AS subtitle_en,to_jsonb(c)->>'tagline_ar' AS tagline_ar,to_jsonb(c)->>'tagline_en' AS tagline_en FROM company_settings c ORDER BY id LIMIT 1")).rows[0];}
 let local;try{local=JSON.parse(await readFile(new URL('./print-settings.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}

 const fields=['logo_base64','name_ar','name_en','subtitle_ar','subtitle_en','tagline_ar','tagline_en'];const result={};for(const key of fields){const value=settings?.[key]||local?.[key];result[key]=typeof value==='string'?value:null;}
 const logo=result.logo_base64;delete result.logo_base64;return {...result,logo:typeof logo==='string'&&logo.length<=7000000&&/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(logo)?logo:null};
}
