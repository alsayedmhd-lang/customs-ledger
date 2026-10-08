import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync}from'node:fs';
test('floating notices suppress routine login, retain errors, use safe text and dismiss',()=>{
 const node={hidden:false,dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},replaceChildren(){this.children=[];},append(...items){this.children=items;},addEventListener(){}};let timer;
 const context={document:{documentElement:{lang:'ar'},getElementById:()=>node,createElement:()=>({setAttribute(){}})},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){},Date};vm.createContext(context);vm.runInContext(readFileSync(new URL('../public/notifications.js',import.meta.url),'utf8'),context);
 vm.runInContext("showRemoteNotice('Please sign in','error')",context);assert.equal(node.hidden,true);
 vm.runInContext("showRemoteNotice('<img src=x onerror=alert(1)>','error')",context);assert.equal(node.hidden,false);assert.equal(node.children[0].textContent,'<img src=x onerror=alert(1)>');assert.equal(node.attrs.role,'alert');assert.equal(node.dataset.kind,'error');node.children[1].onclick();assert.equal(node.hidden,true);
 vm.runInContext("showRemoteNotice('Saved')",context);assert.equal(node.dataset.kind,'success');timer();assert.equal(node.hidden,true);
});
