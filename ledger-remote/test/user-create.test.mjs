import test from 'node:test';import assert from 'node:assert/strict';import{validateNewUser,createRemoteUser}from'../user-create.mjs';
test('new users validate credentials, client binding and OTP channels; creation restricted to admin/write mode',async()=>{
 const input={username:' Test.User ',displayName:'Test',password:'password123',role:'user'};
 const value=validateNewUser(input);assert.equal(value.username,'test.user');assert.equal(value.permissions,'{}');assert.equal(value.pending_approval,false);
 for(const change of [{role:'admin'},{password:'123'},{username:'x'},{role:'client'},{twoFactorEmail:true},{twoFactorWhatsapp:true}])assert.throws(()=>validateNewUser({...input,...change}));
 assert.equal(validateNewUser({...input,role:'client',clientId:2}).client_id,2);
 const pool={connect(){throw Error('must not connect');}};
 await assert.rejects(createRemoteUser(pool,input,{role:'user'},true),e=>e.status===403);
 await assert.rejects(createRemoteUser(pool,input,{role:'admin'},false),e=>e.status===409);
});
