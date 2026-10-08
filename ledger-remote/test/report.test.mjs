import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoReport} from '../report.mjs';
test('statement separates opening and period; ignores drafts and cancelled invoices',()=>{
const inv=[{client_id:1,issue_date:'2026-01-01',invoice_number:'old',status:'issued',subtotal:100,tax_amount:10,advance_payment:20},{client_id:1,issue_date:'2026-02-01',invoice_number:'new',status:'paid',subtotal:200,tax_amount:0,advance_payment:50},...['draft','cancelled'].map(status=>({client_id:1,issue_date:'2026-02-01',status,subtotal:900,advance_payment:900})),{client_id:2,issue_date:'2026-02-01',status:'issued',subtotal:800}];
const receipts=[{client_id:1,receipt_date:'2026-01-15',status:'issued',amount:30},{client_id:1,receipt_date:'2026-02-10',status:'issued',amount:40},{client_id:1,receipt_date:'2026-02-10',status:'draft',amount:999}];
const r=demoReport(inv,receipts,1,'2026-02-01','2026-02-28');assert.equal(r.opening,60);assert.equal(r.debit,200);assert.equal(r.credit,90);assert.equal(r.closing,170);assert.deepEqual(r.rows.map(x=>x.type),['invoice','advance','receipt']);assert.equal(r.rows.at(-1).balance,170);
});
test('totals cover every row despite display cap',()=>{const r=demoReport(Array.from({length:700},(_,i)=>({client_id:1,issue_date:'2026-01-01',invoice_number:String(i),status:'issued',subtotal:1})),[],1);assert.equal(r.rows.length,500);assert.equal(r.count,700);assert.equal(r.debit,700);assert.equal(r.closing,700);assert.equal(r.truncated,true);});
