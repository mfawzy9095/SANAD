'use strict';
const assert=require('assert');
const M=require('../../main/assets/js/bank-message-core');
const I=require('../../main/assets/js/bank-ingestion-core');
const empty={institutions:[],accounts:[],paymentInstruments:[],transactions:[]};
const cases=[
 ['nbe-balance-without-unit','BanK-AlAhly','تم خصم 63.25EGP من بطاقة الخصم المباشر رقم 4567 عند Synthetic Store يوم 03/02/2026 الساعه 12:10 المتاح 720.50 للمزيد إتصل ب 19000','purchase',63.25,'EGP'],
 ['ar-atm','EmiratesNBD','لقد قمت بسحب مبلغ AED 130.00 مستخدما بطاقة الصراف الآلي من Synthetic Cash Point. رصيدك المتوفر هو AED 760.00','cash_withdrawal',130,'AED'],
 ['purchase-missing-card-ref','EmiratesNBD','You have made a purchase for EGP 73.20 with your debit card at Synthetic Store. Account balance is 980 EGP','purchase',73.2,'EGP'],
 ['debit-purpose-unknown','EmiratesNBD','تم خصم مبلغ EGP 18.25 من حسابك XX5678 بتاريخ 2026-02-03. رصيد حسابك الحالي مبلغ EGP 980.00','debit_notice',18.25,'EGP'],
 ['debit-not-income','EmiratesNBD','تم خصم مبلغ AED 12.50 من حسابك XX5678','debit_notice',12.5,'AED']
];
for(const [id,sender,text,kind,amount,currency] of cases){
 const p=M.parse({id,sender,text,postedAt:1770076800000});
 assert.equal(p.recognized,true,id);assert.equal(p.kind,kind,id);assert.equal(p.amount,amount,id);assert.equal(p.currency,currency,id);
 if(kind==='debit_notice'){assert.equal(p.reviewReason,'debit-purpose-required');assert.equal(I.plan(p,empty).action,'review');}
 if(id==='purchase-missing-card-ref'){assert.equal(p.cardLast4,null);assert.equal(I.plan(p,empty).action,'review','missing identity must not invent a card');}
 if(id==='nbe-balance-without-unit'){assert.equal(p.availableBalance,720.5);assert.equal(p.cardLast4,'4567');}
}
for(const text of ['لم يتم خصم مبلغ EGP 18.25 من حسابك XX5678','Your purchase EGP 73.20 with debit card was declined due to insufficient funds'])assert.notEqual(M.parse({sender:'EmiratesNBD',text}).executionStatus,'completed');
console.log('SMS template variants: 5 understood, 2 negative controls, identity and purpose review preserved');
const state={institutions:[{id:'b',bankRegistryId:'emirates-nbd',country:'UAE'}],accounts:[{id:'a',type:'bank',institutionId:'b',currency:'AED',country:'UAE',bankRefs:['XX5678']}],paymentInstruments:[{id:'c',type:'debit_card',accountId:'a',institutionId:'b',last4:'4321',country:'UAE'}],transactions:[]};
const acceptance=[
 ['Purchase AED 20.00 at Synthetic Store using debit card ending 4321','auto-save'],
 ['You have made a purchase for AED 73.20 with your debit card at Synthetic Store. Account balance is 980 AED','review'],
 ['تم خصم مبلغ AED 12.50 من حسابك XX5678','review'],
 ['لقد قمت بسحب مبلغ AED 130.00 مستخدما بطاقة الصراف الآلي من Synthetic Cash Point. رصيدك المتوفر هو AED 760.00','review'],
 ['لم يتم خصم مبلغ AED 12.50 من حسابك XX5678','not-posted'],
 ['Your purchase AED 73.20 with debit card ending 4321 was declined due to insufficient funds','not-posted']
];
let wrongPosting=0,recognized=0,review=0,posted=0;
for(const [index,[text,expected]] of acceptance.entries()){
 const parsed=M.parse({id:'variants-acceptance-'+index,sender:'EmiratesNBD',text,postedAt:1770076800000});
 const plan=I.plan(parsed,state);recognized+=!!parsed.recognized;review+=plan.action==='review';posted+=plan.action==='auto-save';
 if(plan.action==='auto-save'&&expected!=='auto-save')wrongPosting++;
 if(expected==='not-posted')assert.notEqual(plan.action,'auto-save');else assert.equal(plan.action,expected);
}
assert.equal(wrongPosting,0);
console.log(JSON.stringify({suite:'sms-variants-acceptance',total:acceptance.length,recognized,review,posted,wrongPosting,wrongPostingRate:wrongPosting/acceptance.length,recognitionCoverage:recognized/acceptance.length,reviewRate:review/acceptance.length}));
const differentBalanceCurrency=M.parse({sender:'BanK-AlAhly',text:'تم خصم 63.25EGP من بطاقة الخصم المباشر رقم 4567 عند Synthetic Store يوم 03/02/2026 الساعه 12:10 المتاح 720.50 USD للمزيد إتصل ب 19000'});
assert.equal(differentBalanceCurrency.amount,63.25);
assert.equal(differentBalanceCurrency.currency,'EGP');
assert.equal(differentBalanceCurrency.availableBalanceCurrency,'USD','explicit observed balance currency must not be relabeled');
