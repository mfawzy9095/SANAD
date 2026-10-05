'use strict';
const assert=require('assert');
const I=require('../../main/assets/js/bank-ingestion-core.js');
const P=require('../../main/assets/js/bank-message-core.js');
function fixture(){
 const s={institutions:[{id:'institution',bankRegistryId:'emirates-nbd',country:'UAE'}],
  accounts:[{id:'asset',institutionId:'institution',country:'UAE',type:'bank',currency:'AED',bankRefs:['1234567890'],openingBalance:0,openingBalanceKnown:true}],
  transactions:[],paymentInstruments:[]};
 const p={recognized:true,bankId:'emirates-nbd',providerId:null,eventId:'evidence-one',
  kind:'salary',direction:'credit',amount:7500,currency:'AED',country:'UAE',
  accountRef:'1234567890',accountSuffix:'7890',transactionRef:'SYNTHETIC123456',
  postedAt:Date.UTC(2026,8,1),executionStatus:'completed',confidence:0.99,
  raw:'Synthetic salary confirmation',fee:0,vat:0,category:'salary'};
 const built=P.buildTransaction(p,P.resolveRoute(p,s),{uid:()=> 'existing'});
 assert.strictEqual(built.ok,true);s.transactions.push(built.transaction);
 return {p,s};
}
{
 const {p,s}=fixture(),original=JSON.stringify(s);
 assert.strictEqual(I.plan(p,s).action,'duplicate');
 assert.strictEqual(I.plan({...p,eventId:'other-channel',postedAt:p.postedAt+6000},s).action,'duplicate');
 const later={...p,eventId:'next-month',postedAt:Date.UTC(2026,9,1)};
 assert.strictEqual(I.duplicateOf(later,s),null);
 assert.strictEqual(I.plan(later,s).action,'review','a reused reference must not suppress a new month');
 const refund={...p,eventId:'refund',kind:'refund',category:'other',postedAt:p.postedAt+1000};
 assert.strictEqual(I.duplicateOf(refund,s),null);
 assert.strictEqual(I.plan(refund,s).action,'review','refund is not the same financial event as salary');
 assert.strictEqual(I.plan({...p,eventId:'different-principal',amount:7600},s).action,'review');
 assert.strictEqual(I.plan({...later,transactionRef:'NEWREF123456'},s).action,'auto-save');
 assert.strictEqual(JSON.stringify(s),original,'planning cannot rewrite the original posting');
 s.transactions[0].amount=7400;s.transactions[0].walletAmount=7400;
 assert.strictEqual(I.plan(p,s).action,'duplicate','same evidence must not re-create an edited posting');
}
console.log('Reference semantics, scope and corrected-evidence replay: PASS');

{
 const {p,s}=fixture();
 delete s.transactions[0].created;
 delete s.transactions[0].smsReceivedAt;
 assert.strictEqual(I.plan({...p,eventId:'other-evidence'},s).action,'review','a timeless reference cannot prove duplicate identity');
}

{
 const {p,s}=fixture();
 p.postedAt=Date.UTC(2026,10,1);p.transactionDate='2026-09-01';
 const built=P.buildTransaction(p,P.resolveRoute(p,s),{uid:()=> 'delayed-existing'});
 s.transactions=[built.transaction];
 const later={...p,eventId:'another-delayed-month',postedAt:p.postedAt+6000,transactionDate:'2026-10-01'};
 assert.strictEqual(I.duplicateOf(later,s),null,'close arrival times cannot override different operation dates');
 assert.strictEqual(I.plan(later,s).action,'review');
 assert.strictEqual(I.plan({...p,eventId:'other-delayed-channel',postedAt:p.postedAt+6000},s).action,'duplicate');
}
