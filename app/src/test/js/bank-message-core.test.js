'use strict';
const assert=require('assert');
const P=require('../../main/assets/js/bank-message-core.js');
const samples=[
['credit purchase','تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36','purchase',13.50,'4021'],
['online transfer','عميلنا العزيز Mohamed Abdelrahman Fawzy، تم خصم AED 160.00 من حسابك 1801 لتحويل الأموال من خلال الخدمات المصرفية عبر الإنترنت.','outgoing_transfer',160,null],
['deposit','لقد تم ايداع AED 149.00 في رقم حسابك  012XXX50XXX01 OBP  TR REF EPHCOO2700ATPAUJ 7JL1Z6OIIWYH19CN6X5B.الرصيد المتوفر هو AED 161.52','deposit',149,null],
['salary','تم ايداع الراتب AED 9,000.00 في  حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66','salary',9000,null],
['repayment','تم خصم مبلغ AED 684.19 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021.','card_repayment',684.19,'4021'],
['debit purchase','تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.','purchase',5.10,'3993'],
['debit merchant','لقد تمّ تحويل مبلغ 100.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*Mohamed Abdelrahm. رصيدك الحالي هو AED 123.83.','purchase',100,'3993']
];
for(const [label,text,kind,amt,last4] of samples){
  const p=P.parse({id:label,postedAt:1,text});
  assert.strictEqual(p.recognized,true,label);assert.strictEqual(p.bankId,'emirates-nbd',label);assert.strictEqual(p.kind,kind,label);assert.strictEqual(p.amount,amt,label);if(last4)assert.strictEqual(p.cardLast4,last4,label);
}
assert.strictEqual(P.parse({text:'يوجد لديك دفعة بطاقة تتطلب موافقتك. الرجاء تسجيل الدخول إلى تطبيق بنك الإمارات دبي الوطني والانتقال إلى قسم الأنشطة للتفويض.'}).reason,'authorization-pending');
assert.strictEqual(P.parse({text:'عميلنا MOHAMED ABDELRAHMAN FAWZY، تم استبدال NOL Payment كعملية 153.00 على بطاقة MC TITANIUM التي تنتهي بـ 4021 بنجاح.'}).reason,'rewards-redemption');
const state={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[{id:'bank',country:'UAE',currency:'AED',type:'bank',institutionId:'i1',bankRefs:['1801','012XXX50XXX01'],archived:false},{id:'credit',country:'UAE',currency:'AED',type:'credit',institutionId:'i1',archived:false}],paymentInstruments:[{id:'c4021',accountId:'credit',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false},{id:'d3993',accountId:'bank',institutionId:'i1',country:'UAE',type:'debit_card',last4:'3993',archived:false}]};
const purchase=P.parse({id:'e1',postedAt:1000,text:samples[0][1]}),purchaseRoute=P.resolveRoute(purchase,state);
assert.strictEqual(purchaseRoute.status,'routed');assert.strictEqual(purchaseRoute.account.id,'credit');assert.strictEqual(purchaseRoute.instrument.id,'c4021');
const tx=P.buildTransaction(purchase,purchaseRoute,{date:'2026-10-01',uid:()=> 't1'});
assert.strictEqual(tx.ok,true);assert.strictEqual(tx.transaction.type,'expense');assert.strictEqual(tx.transaction.accountId,'credit');assert.strictEqual(tx.transaction.instrumentId,'c4021');assert.strictEqual(tx.transaction.cat,'grocery');
const salary=P.parse({id:'e2',postedAt:1000,text:samples[3][1]}),salaryRoute=P.resolveRoute(salary,state);
assert.strictEqual(salaryRoute.account.id,'bank');assert.strictEqual(P.buildTransaction(salary,salaryRoute,{date:'2026-10-01',uid:()=> 't2'}).transaction.cat,'salary');
const repay=P.parse({id:'e3',postedAt:1000,text:samples[4][1]}),rr=P.resolveRoute(repay,state);
assert.strictEqual(rr.fromAccount.id,'bank');assert.strictEqual(rr.targetAccount.id,'credit');
const rtx=P.buildTransaction(repay,rr,{date:'2026-10-01',uid:()=> 't3'});
assert.strictEqual(rtx.transaction.type,'transfer');assert.strictEqual(rtx.transaction.fromAccountId,'bank');assert.strictEqual(rtx.transaction.toAccountId,'credit');
const out=P.parse({id:'e4',postedAt:1000,text:samples[1][1]}),or=P.resolveRoute(out,state);
assert.strictEqual(or.status,'routed');assert.strictEqual(or.fromAccount.id,'bank');
const otx=P.buildTransaction(out,or,{date:'2026-10-01',uid:()=> 't4'});
assert.strictEqual(otx.ok,true);assert.strictEqual(otx.transaction.type,'external_transfer');assert.strictEqual(otx.transaction.fromAccountId,'bank');assert.strictEqual(otx.transaction.fromAmount,160);
assert.ok(P.dedupeKey(out).startsWith('event:e4|'));
console.log('bank message parser regression tests: PASS');
