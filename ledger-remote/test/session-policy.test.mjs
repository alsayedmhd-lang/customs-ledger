import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,isSessionExpired,recordSessionActivity} from '../session-policy.mjs';
test('session expires after five idle minutes, including the exact boundary',()=>{
 const session=createSession({id:1},1000);assert.equal(session.expires,301000);
 assert.equal(isSessionExpired(session,300999),false);assert.equal(isSessionExpired(session,301000),true);
 assert.equal(recordSessionActivity(session,301000),false);assert.equal(session.expires,301000);
});
test('user activity renews deadline, passive reads do not, expired sessions cannot revive',()=>{
 const session=createSession({id:1},1000);assert.equal(recordSessionActivity(session,200000),true);
 assert.equal(session.expires,500000);assert.equal(isSessionExpired(session,400000),false);
 assert.equal(session.expires,500000);assert.equal(recordSessionActivity(session,500001),false);
 assert.equal(isSessionExpired(undefined,1),true);
});
