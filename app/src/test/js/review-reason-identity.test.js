'use strict';
const assert=require('assert'),P=require('../../main/assets/js/bank-message-core'),I=require('../../main/assets/js/bank-ingestion-core');
const state={institutions:[{id:'provider',type:'wallet_provider',providerRegistryId:'du-pay',country:'UAE',name:'du Pay'}],accounts:[{id:'wallet',institutionId:'provider',type:'ewallet',currency:'AED',country:'UAE'}],paymentInstruments:[{id:'card',accountId:'wallet',institutionId:'provider',type:'wallet_card',last4:'8765',country:'UAE'}],transactions:[]};
for(const [fee,vat,totalFee] of [[1.5,.08,'1.58'],[.4,.02,'0.42'],[.8,.04,'0.84']]){
 const p={recognized:true,providerId:'du-pay',kind:'purchase',cardType:'wallet_card',cardLast4:'8765',country:'UAE',currency:'AED',amount:75,fee,vat,confidence:.99,postedAt:1791288000000};
 const route=P.resolveRoute(p,state);assert.equal(route.account.id,'wallet');assert.equal(route.instrument.id,'card');
 const plan=I.plan(p,state);assert.equal(plan.action,'review');assert.equal(plan.reason,'fee-review-required','fees do not constitute an identity conflict');assert.equal(plan.create,undefined,'no new account or card draft');
 const manual=I.routeFromManualChoice(p,state,{sourceType:'instrument',sourceId:'card'});
 const b=P.buildTransaction(p,manual,{confirmedFee:totalFee,uid:()=> 't'});assert(b.ok);assert.equal(b.transaction.bankPrincipalAmount,75);
}
const bill=P.parse({sender:'1122',text:'Your latest bill is AED 160.00 and is due next week.'});
assert.equal(bill.kind,'bill_notice');assert.equal(I.plan(bill,state).reason,'bill-not-payment','nonfinancial meaning is independent of account identity');assert.equal(I.plan(bill,state).action,'review');
const paid=P.parse({sender:'1122',text:'Your payment is successful. Total paid: 160.00 AED.'});assert.equal(paid.kind,'bill_payment');assert.equal(I.plan(paid,state).reason,'source-not-identified','understanding a payment does not trust its source');
console.log('Review separates known instrument fees, unpaid bill meaning and untrusted payment source: PASS');
