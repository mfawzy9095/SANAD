'use strict';
const assert=require('assert'),M=require('../../main/assets/js/bank-message-core'),I=require('../../main/assets/js/bank-ingestion-core');
for(const [currency,accountCurrency,country] of [['MAD','AED','UAE'],['EUR','AED','UAE'],['USD','AED','UAE'],['USD','EGP','EGY']]){
 const state={institutions:[{id:'b',bankRegistryId:'emirates-nbd',country}],accounts:[{id:'a',institutionId:'b',type:'credit',country,currency:accountCurrency}],paymentInstruments:[{id:'c',accountId:'a',institutionId:'b',type:'credit_card',last4:'4321'}],transactions:[]};
 const p={recognized:true,bankId:'emirates-nbd',country,kind:'purchase',currency,amount:12.34,cardLast4:'4321',cardType:'credit_card',confidence:0.99,postedAt:1791288000000,eventId:'synthetic-fx'};
 const r=M.resolveRoute(p,state);assert.equal(r.status,'routed');assert.equal(r.instrument.id,'c');
 assert.equal(I.plan(p,state).reason,'fx-review-required');assert.equal(state.accounts.length,1);
 const manual=I.routeFromManualChoice(p,state,{sourceType:'instrument',sourceId:'c'});assert.equal(manual.status,'routed');
 assert.equal(M.buildTransaction(p,r).ok,false,'no invented settlement');
 const b=M.buildTransaction(p,r,{confirmedSettlementAmount:'65.43',confirmedFee:'1.20'});assert.equal(b.ok,true);
 assert.equal(b.transaction.amount,12.34);assert.equal(b.transaction.currency,currency);assert.equal(b.transaction.walletAmount,66.63);
 assert.equal(b.transaction.bankPrincipalAmount,65.43);assert.equal(b.transaction.bankFeeEvidence.currency,accountCurrency);
 assert.equal(b.transaction.bankSettlementEvidence.amount,65.43);
 assert.equal(M.buildTransaction(p,r,{confirmedSettlementAmount:'65.431'}).ok,false);
 assert.equal(I.routeFromManualChoice({...p,cardLast4:'9999'},state,{sourceType:'instrument',sourceId:'c'}).status,'needs-review');
}
console.log('FX identity, confirmed settlement, separate fee and no guessing: PASS');
