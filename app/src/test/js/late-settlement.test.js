'use strict';
const assert=require('assert/strict');
const M=require('../../main/assets/js/bank-message-core');
const I=require('../../main/assets/js/bank-ingestion-core');
const F=require('../../main/assets/js/finance-core');
const R=require('../../main/assets/js/report-core');
const clone=x=>JSON.parse(JSON.stringify(x));
const state={institutions:[{id:'b',bankRegistryId:'emirates-nbd',country:'UAE'}],accounts:[{id:'a',institutionId:'b',type:'bank',country:'UAE',currency:'AED',openingBalance:1000,openingBalanceKnown:true}],paymentInstruments:[{id:'c',accountId:'a',institutionId:'b',type:'debit_card',last4:'4321'}],transactions:[],settings:{}};
const original=M.parse({id:'original',sender:'EmiratesNBD',text:'Purchase EUR 23.45 at Synthetic Store using debit card ending 4321. Transaction reference FXTEST01',postedAt:1791288000000});
state.transactions=[M.buildTransaction(original,M.resolveRoute(original,state),{allowPendingSettlement:true,uid:()=> 'purchase-1'}).transaction];
const text='Purchase settlement completed. Original purchase: EUR 23.45. Original reference: FXTEST01. Purchase date: 2026-10-06. Settled amount excluding fees: AED 94.25. Total fees: AED 1.25. Debit card ending 4321.';
const parse=(body=text,id='settlement')=>M.parse({id,sender:'EmiratesNBD',text:body,postedAt:1791547200000});
const parsed=parse();assert.equal(parsed.kind,'purchase_settlement');
assert.equal(parsed.originalPurchaseAmount,23.45);assert.equal(parsed.currency,'AED');assert.equal(parsed.amount,94.25);
const before=clone(state),plan=I.plan(parsed,state);
assert.equal(plan.action,'auto-save');assert.equal(plan.replacesTransactionId,'purchase-1');assert.deepEqual(state,before);
assert.equal(I.applyPlan(state,plan),true);assert.equal(state.transactions.length,1);assert.equal(state.transactions[0].id,'purchase-1');
assert.equal(state.transactions[0].amount,23.45);assert.equal(state.transactions[0].currency,'EUR');assert.equal(state.transactions[0].walletAmount,95.5);
assert.equal(F.validateMoneyChanges(state,before),null);assert.equal(F.accountBalance(state,'a'),904.5);
assert.equal(R.buildReportDataset(state,{country:'UAE',period:'month',month:'2026-10'}).pendingSettlementCount,0);
assert.equal(I.plan(parsed,state).action,'duplicate');assert.equal(I.plan(parse(text,'notification-copy'),state).action,'duplicate');
assert.equal(I.applyPlan(state,plan),false,'stale plan must not append or overwrite');
for(const [from,to] of [['Settled amount excluding fees:','Settled amount:'],['FXTEST01','DIFFERENT'],['2026-10-06','2026-10-05'],['EUR 23.45','EUR 23.46'],['4321','9876'],['Total fees: AED 1.25.',''],['Total fees: AED 1.25.','Total fees: USD 1.25.']]){
 const candidate=parse(text.replace(from,to));assert.equal(I.plan(candidate,before).action,'review');assert.deepEqual(state.transactions.length,1);
}
// Composite evidence cannot choose the first identity/date/reference and ignore the rest.
for(const suffix of [
 ' Original reference: OTHERREF.',
 ' مرجع الشراء: OTHERREF.',
 ' Purchase date: 2026-10-05.',
 ' تاريخ الشراء: 2026-10-05.',
 ' Debit card ending 9876.',
 ' بطاقة الخصم المنتهية بالرقم 9876.'
]){
 const candidate=parse(text+suffix,'composite');
 assert.equal(I.plan(candidate,before).action,'review','ambiguous settlement: '+suffix);
 assert.deepEqual(before.transactions[0].settlementStatus,'pending');
}
for(const label of ['Cardholder ID 4321.','Debit card issued in 4321.','Debit card ending 43210.']){
 assert.equal(I.plan(parse(text.replace('Debit card ending 4321.',label)),before).action,'review','a nearby number is not a card suffix: '+label);
}
const unknown=M.parse({id:'unknown',sender:'1122',text,postedAt:1791547200000});assert.equal(I.plan(unknown,before).action,'review');
assert.equal(M.parse({sender:'EmiratesNBD',text:text.replace('completed','pending')}).ignored,true);
assert.equal(I.plan(parsed,{...before,transactions:[]}).action,'review','settlement before purchase is retained for review');
const ambiguous=clone(before);ambiguous.transactions.push({...clone(ambiguous.transactions[0]),id:'other'});assert.equal(I.plan(parsed,ambiguous).action,'review');
const manual=clone(before);manual.transactions[0]=I.settlePendingPurchase(manual,{transactionId:'purchase-1',amount:90,fee:0,confirmed:true}).transaction;
assert.equal(I.plan(parsed,manual).action,'review');assert.equal(manual.transactions[0].walletAmount,90,'user settlement must not be silently replaced');
const ar=parse('تمت تسوية الشراء. الشراء الأصلي: EUR 23.45. مرجع الشراء: FXTEST01. تاريخ الشراء: 2026-10-06. مبلغ التسوية بدون الرسوم: AED 94.25. إجمالي الرسوم: AED 1.25. بطاقة الخصم المنتهية بالرقم 4321.','arabic');
assert.equal(ar.kind,'purchase_settlement');assert.equal(I.plan(ar,before).action,'auto-save');
console.log('Late settlement: strong original identity, same event, exact separate fees, cross-channel repeat, order, ambiguity and user correction protection');
(async()=>{
 const Mutation=require('../../main/assets/js/mutation-core');let live=clone(before),disk=clone(before),fail=true;
 const service=Mutation.createMutationService({canWrite:()=>true,snapshotState:()=>clone(live),loadState:s=>{live=clone(s);},fingerprint:JSON.stringify,validateChanges:F.validateMoneyChanges,writeSafetySnapshot:async()=>({ok:true}),verifiedWrite:async s=>{if(fail)throw Object.assign(Error('disk full'),{name:'QuotaExceededError'});disk=clone(s);return {ok:true};},tryRestore:async s=>{disk=clone(s);return true;}});
 const save=()=>service.run(()=>I.applyPlan(live,I.plan(parsed,live)));
 assert.equal((await save()).ok,false);assert.deepEqual(live,before);assert.deepEqual(disk,before);
 fail=false;assert.equal((await save()).ok,true);assert.equal(disk.transactions.length,1);assert.equal(disk.transactions[0].bankSettlementAudit.length,1);assert.equal(F.accountBalance(disk,'a'),904.5);
 console.log('Automatic settlement durable save failure, rollback and retry: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
