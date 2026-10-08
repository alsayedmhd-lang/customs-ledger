import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync}from'node:fs';
const source=readFileSync(new URL('../public/draft-ui.js',import.meta.url),'utf8');
function setup(){
 const select=()=>({options:[],disabled:false,value:'',replaceChildren(){this.options=[];},append(option){this.options.push(option);},prepend(option){this.options.unshift(option);}});
 const nodes={'#draft-salesman':select(),'#draft-status':select()};
 const context=vm.createContext({dq:id=>nodes[id],el:(tag,text)=>({value:'',textContent:text}),t:(ar,en)=>ar,translated:value=>'ar:'+value,editingInvoice:null,editingReceipt:null,draftOptions:{canChangeRepresentative:true,currentUserId:1,salesmen:[{id:1,display_name:'One'},{id:2,display_name:'Two'}]}});
 vm.runInContext(source.slice(source.indexOf('function configureInvoiceChoices(')),context);return {nodes,context};
}
test('invoice editor has native selects populated with users/statuses and existing selected values',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.match(html,/<select id="draft-salesman" required>/);assert.match(html,/<select id="draft-status">/);
 const {nodes,context}=setup();context.editingInvoice={created_by:2,status:'issued'};context.configureInvoiceChoices(context.editingInvoice,'invoice');assert.equal(nodes['#draft-salesman'].value,'2');assert.equal(nodes['#draft-salesman'].disabled,false);assert.equal(nodes['#draft-status'].value,'issued');assert.deepEqual(Array.from(nodes['#draft-status'].options,o=>o.value),['draft','issued','paid','cancelled']);assert.equal(nodes['#draft-status'].disabled,false);
 context.editingInvoice={created_by:8,status:'paid',sales_man_name:'Historical'};context.configureInvoiceChoices(context.editingInvoice,'invoice');assert.equal(nodes['#draft-salesman'].value,'8');assert.ok(nodes['#draft-salesman'].options.some(o=>o.textContent==='Historical'));
});
test('new/copy invoice defaults to current user and draft; hidden invoice representative does not block receipt form',()=>{
 const {nodes,context}=setup();context.configureInvoiceChoices({created_by:2,status:'issued'},'invoice');assert.equal(nodes['#draft-salesman'].value,'1');assert.deepEqual(Array.from(nodes['#draft-status'].options,o=>o.value),['draft']);
 // Copy/new records do not carry the saved status into their selector.
 context.configureInvoiceChoices(null,'invoice');assert.equal(nodes['#draft-status'].value,'draft');assert.deepEqual(Array.from(nodes['#draft-status'].options,o=>o.value),['draft']);
 context.editingReceipt={status:'issued'};context.configureInvoiceChoices(context.editingReceipt,'receipt');assert.equal(nodes['#draft-salesman'].disabled,true);assert.equal(nodes['#draft-status'].disabled,false);assert.deepEqual(Array.from(nodes['#draft-status'].options,o=>o.value),['draft','issued','cancelled']);
 context.configureInvoiceChoices(null,'invoice');assert.equal(nodes['#draft-salesman'].disabled,false);assert.equal(nodes['#draft-status'].disabled,false);
});
test('ordinary user representative selector is disabled for new and saved invoices',()=>{
 const {nodes,context}=setup();context.draftOptions.canChangeRepresentative=false;
 context.configureInvoiceChoices(null,'invoice');assert.equal(nodes['#draft-salesman'].disabled,true);assert.equal(nodes['#draft-salesman'].value,'1');
 context.editingInvoice={created_by:1,status:'issued'};context.configureInvoiceChoices(context.editingInvoice,'invoice');assert.equal(nodes['#draft-salesman'].disabled,true);
});
