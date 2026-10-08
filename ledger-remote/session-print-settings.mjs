import{validateCompanySettings}from'./company-settings.mjs';
export function saveSessionPrintSettings(session,user,input){
 if(user?.role!=='admin')throw Object.assign(Error('Access denied'),{status:403});
 session.printOverrides=validateCompanySettings(input);return {temporary:true};
}
export function sessionPrintSettings(result,session,user){
 if(user?.role!=='admin'||!session?.printOverrides)return result;
 return {...result,settings:{...result.settings,...session.printOverrides},origin:'Session',configured:true,temporary:true};
}
