'use strict';
const assert=require('assert');
const M=require('../../main/assets/js/bank-message-core');
const I=require('../../main/assets/js/bank-ingestion-core');
const cases=[
 ['refund-bill','Your bill payment AED 25.00 was refunded to debit card ending 4321.','refund',true],
 ['salary-payment','Salary credited AED 7000.00 to account XX5678. Payment is successful.','salary',true],
 ['invoice','Your bill has been issued. Total due: 162.75 AED.','bill_notice',false],
 ['invoice-ar','تم إصدار فاتورة بقيمة 162.75 AED يرجى السداد','bill_notice',false],
 ['payment','Your payment is successful. Total paid: 162.75 AED.','bill_payment',true],
 ['payment-ar','تم سداد الفاتورة بنجاح بمبلغ AED 162.75','bill_payment',true],
 ['nol','تم خصم مبلغ AED 45.00 من بطاقتك لتعبئة محفظتك الإلكترونية في حساب نول الخاص بك','wallet_topup',false],
 ['refund-request','Your refund request for AED 45.00 has been received.','refund_request',false],
 ['refund-complete','Refunded AED 45.00 to your debit card ending 4321','refund',true],
 ['deposit','تم إيداع مبلغ AED 45.00 في حسابك XX5678','deposit',true]
];
let understood=0;
for(const [id,text,kind,completed] of cases){
 const p=M.parse({id,sender:'EmiratesNBD',postedAt:1791288000000,text});
 assert.equal(p.recognized,true,id);assert.equal(p.kind,kind,id);understood++;
 assert.equal(p.executionStatus==='completed',completed,id);
 if(!completed){assert.equal(I.plan(p,{accounts:[],paymentInstruments:[],institutions:[],transactions:[]}).action,'review',id);assert.equal(M.buildTransaction(p,{status:'routed',account:{id:'a',type:'bank',currency:'AED'}}).ok,false,id);}
}
for(const text of ['Your payment is not successful. Total paid: 162.75 AED.','Your payment was not completed. Total paid: 162.75 AED.','لم يتم سداد الفاتورة بمبلغ AED 162.75'])assert.notEqual(M.parse({sender:'EmiratesNBD',text}).executionStatus,'completed');
const p=M.parse({sender:'EmiratesNBD',text:'Available balance AED 950.00. Your payment is successful. Total paid: 162.75 AED.'});
assert.equal(p.amount,162.75,'available balance is not paid amount');
console.log(JSON.stringify({suite:'payment-context',understood,total:cases.length}));
// Declared independent acceptance slice: known routes, both positive and negative controls.
const state={institutions:[{id:'b',bankRegistryId:'emirates-nbd',country:'UAE'}],accounts:[{id:'a',type:'bank',institutionId:'b',currency:'AED',country:'UAE',bankRefs:['XX5678']}],paymentInstruments:[{id:'c',type:'debit_card',accountId:'a',institutionId:'b',last4:'4321',country:'UAE'}],transactions:[]};
const acceptance=[
 ['Purchase AED 20.00 at Synthetic Store using debit card ending 4321','auto-save'],
 ['Your payment is successful. Total paid: 162.75 AED. Using debit card ending 4321','auto-save'],
 ['Salary credited AED 7000.00 to account XX5678','auto-save'],
 ['Purchase EUR 20.00 at Synthetic Store using debit card ending 4321','review'],
 ['تم إصدار فاتورة بقيمة 162.75 AED يرجى السداد','review'],
 ['Your refund request for AED 45.00 has been received.','review'],
 ['تم خصم مبلغ AED 45.00 لتعبئة محفظتك الإلكترونية في حساب نول','review'],
 ['تم إيداع مبلغ AED 45.00 في حسابك XX5678','review'],
 ['Your payment is not successful. Total paid: 162.75 AED. Using debit card ending 4321','not-posted']
];
let posted=0,review=0,wrongPosting=0,recognized=0;
for(const [text,expected] of acceptance){const p=M.parse({sender:'EmiratesNBD',id:'acceptance-'+recognized,postedAt:1791288000000,text});const plan=I.plan(p,state);if(p.recognized)recognized++;if(plan.action==='auto-save'){posted++;if(expected!=='auto-save')wrongPosting++;}if(plan.action==='review')review++;if(expected==='not-posted')assert.notEqual(plan.action,'auto-save');else assert.equal(plan.action,expected,text);}
assert.equal(wrongPosting,0);
console.log(JSON.stringify({suite:'declared-acceptance-slice',total:acceptance.length,recognized,posted,review,wrongPosting,wrongPostingRate:wrongPosting/acceptance.length,recognitionCoverage:recognized/acceptance.length,reviewRate:review/acceptance.length}));
