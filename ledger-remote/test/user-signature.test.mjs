import test from 'node:test';import assert from 'node:assert/strict';import {validateSignature,saveUserSignature}from '../user-signature.mjs';
test('signature rejects active content and oversized images; only administrator can save in write mode',async()=>{
 assert.deepEqual(validateSignature({id:2,signature:''}),{id:2,signature:''});
 for(const signature of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJj', 'data:image/png;base64,'+'A'.repeat(50001)])assert.throws(()=>validateSignature({id:2,signature}));
 const pool={connect(){throw Error('must not connect');}};
 await assert.rejects(saveUserSignature(pool,{id:2,signature:''},{role:'user'},true),e=>e.status===403);
 await assert.rejects(saveUserSignature(pool,{id:2,signature:''},{role:'admin'},false),e=>e.status===409);
});
