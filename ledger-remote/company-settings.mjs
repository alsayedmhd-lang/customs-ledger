import {printKeys}from './print-settings.mjs';import{writeFile,rename,unlink}from'node:fs/promises';import{randomUUID}from'node:crypto';
const fail=message=>Object.assign(Error(message),{status:400});
export function validateCompanySettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Invalid settings');
 const result={};
 for(const [key,value]of Object.entries(input)){
 if(!printKeys.includes(key))throw fail('Unknown setting');
 if(key.endsWith('_base64')){
 if(value!==''&&(typeof value!=='string'||value.length>600000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)||!Buffer.from(value.split(',')[1],'base64').subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))))throw fail('Invalid image');result[key]=value;
 }else if(key.startsWith('show_')||key.endsWith('_visible')||key.endsWith('_bold')){if(typeof value!=='boolean')throw fail('Invalid switch');result[key]=value;
 }else if(key.includes('font_size')||['logo_size','logo_height'].includes(key)){if(!Number.isFinite(Number(value))||Number(value)<6||Number(value)>300)throw fail('Invalid size');result[key]=Number(value);
 }else if(key.endsWith('_align')){if(!['left','center','right'].includes(value))throw fail('Invalid alignment');result[key]=value;
 }else{if(typeof value!=='string'||value.length>2000)throw fail('Invalid text');result[key]=value;}
 }return result;
}
export async function saveCompanySettings(input,user,path=new URL('./print-settings.json',import.meta.url)){
 if(user?.role!=='admin')throw Object.assign(Error('Access denied'),{status:403});
 const value=validateCompanySettings(input),temp=new URL('./company-settings-'+randomUUID()+'.tmp',path);
 try{await writeFile(temp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}
 return {settings:value};
}
