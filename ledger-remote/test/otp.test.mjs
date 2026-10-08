import test from 'node:test';import assert from 'node:assert/strict';import {createOtpService}from '../otp.mjs';
test('OTP requires delivery, expires, binds IP, limits attempts and is single use',async()=>{
 let code,time=1000;const service=createOtpService(async(u,c)=>{code=c;},()=>time);
 const user={id:1};let result=await service.issue(user,'ip');assert.equal(result.code,undefined);assert.throws(()=>service.verify(result.otpToken,code,'other'));
 assert.throws(()=>service.verify(result.otpToken,'000000','ip'));assert.equal(service.verify(result.otpToken,code,'ip'),user);assert.throws(()=>service.verify(result.otpToken,code,'ip'));
 result=await service.issue(user,'ip');await assert.rejects(service.resend(result.otpToken,'ip'));time+=60001;const old=code;await service.resend(result.otpToken,'ip');assert.equal(service.verify(result.otpToken,code,'ip'),user);
 result=await service.issue(user,'ip');for(let i=0;i<5;i++)assert.throws(()=>service.verify(result.otpToken,'000000','ip'));assert.throws(()=>service.verify(result.otpToken,code,'ip'));
 result=await service.issue(user,'ip');time+=300001;assert.throws(()=>service.verify(result.otpToken,code,'ip'));
 await assert.rejects(createOtpService(async()=>{throw Error('delivery failed');}).issue(user,'ip'));
});
test('visible fallback is returned only when delivery is unavailable, and rotates on resend',async()=>{
 let time=1000;const service=createOtpService(async()=>{throw Object.assign(Error('unavailable'),{status:503});},()=>time);
 const result=await service.issue({id:2},'ip');assert.match(result.visibleCode,/^\d{6}$/);
 time+=60001;const resent=await service.resend(result.otpToken,'ip');assert.match(resent.visibleCode,/^\d{6}$/);assert.equal(service.verify(result.otpToken,resent.visibleCode,'ip').id,2);
});
