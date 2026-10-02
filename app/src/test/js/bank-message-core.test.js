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

const eiPurchase=P.parse({id:'ei1',postedAt:Date.UTC(2026,9,1,3,0),title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان\nالمنتهية بالرقم: 0308\nلدى: FRESH CRAFT MINI MART, DUBAI\nالمبلغ: AED 2.50\nالتاريخ: 01/10/2026, 06:44\nالحد المتوفر: 457.04 AED'});
assert.strictEqual(eiPurchase.recognized,true);assert.strictEqual(eiPurchase.bankId,'emirates-islamic');assert.strictEqual(eiPurchase.kind,'purchase');assert.strictEqual(eiPurchase.cardLast4,'0308');assert.strictEqual(eiPurchase.amount,2.5);assert.strictEqual(eiPurchase.transactionDate,'2026-10-01');assert.strictEqual(eiPurchase.availableCredit,457.04);assert.strictEqual(eiPurchase.category,'grocery');assert.strictEqual(eiPurchase.cardType,'credit_card');
const eiNegative=P.parse({id:'ei2',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: WARSAN MANDI RESTAURAN, SHARJAH المبلغ: AED 39.00 التاريخ: 05/09/2026, 22:51 الحد المتوفر: -608.56 AED'});
assert.strictEqual(eiNegative.availableCredit,-608.56);assert.strictEqual(eiNegative.category,'food');
const eiTaxi=P.parse({id:'ei3',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: CITI TAXI, SHARJAH المبلغ: AED 17.50 التاريخ: 27/09/2026, 23:34 الحد المتوفر: 516.40 AED'});
assert.strictEqual(eiTaxi.category,'transport');
const eiCafe=P.parse({id:'ei4',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: MISBAH AL MANAKH CAFE, SHARJAH المبلغ: AED 10.50 التاريخ: 04/08/2026, 11:03 الحد المتوفر: 39.81 AED'});
assert.strictEqual(eiCafe.category,'cafe');
assert.strictEqual(P.parse({text:'Credit Card Mini Statement Card Starting: 457828 Statement Date: 10/08/2026 Minimum Amount Due: AED 476.19 Amount to be paid to avoid charges: AED 3,509.97 Due Date: 04/09/2026'}).reason,'card-statement');
assert.strictEqual(P.parse({text:'نود تأكيد استلام دفعة AED 433.00 عن البطاقة الائتمانية التي تبدأ بالرقم 457828 في تاريخ 15/07/2026. الحد المتوفر هو AED 664.35.'}).reason,'card-payment-ack');
assert.strictEqual(P.parse({text:'عزيزنا المتعامل، تم تسجيل بطاقتك المنتهية بالرقم 0308 في تطبيق Google Pay.'}).reason,'card-status');
const eiState={institutions:[{id:'ei',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[{id:'ei-credit',country:'UAE',currency:'AED',type:'credit',institutionId:'ei',archived:false}],paymentInstruments:[{id:'ei0308',accountId:'ei-credit',institutionId:'ei',country:'UAE',type:'credit_card',last4:'0308',archived:false}]};
const eiRoute=P.resolveRoute(eiPurchase,eiState);assert.strictEqual(eiRoute.status,'routed');assert.strictEqual(eiRoute.account.id,'ei-credit');
const eiTx=P.buildTransaction(eiPurchase,eiRoute,{uid:()=> 'tei'});assert.strictEqual(eiTx.transaction.date,'2026-10-01');assert.strictEqual(eiTx.transaction.instrumentId,'ei0308');

const duTransfer=P.parse({id:'du1',postedAt:1000,text:'Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed and the amount has been credited in the beneficiary account. TID: DIR7BQ7FZ3'});
assert.strictEqual(duTransfer.providerId,'du-pay');assert.strictEqual(duTransfer.kind,'outgoing_transfer');assert.strictEqual(duTransfer.amount,149);assert.strictEqual(duTransfer.transactionRef,'DIR7BQ7FZ3');assert.strictEqual(duTransfer.beneficiaryName,'Mohamed Abdelrahman Fawzy');
const duDeposit=P.parse({id:'du2',postedAt:2000,text:"Hello Mohamed Abd, You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40, and the transaction ID is: DI24AS0MCM"});
assert.strictEqual(duDeposit.providerId,'du-pay');assert.strictEqual(duDeposit.kind,'deposit');assert.strictEqual(duDeposit.amount,3500);assert.strictEqual(duDeposit.availableBalance,3500.40);assert.strictEqual(duDeposit.transactionRef,'DI24AS0MCM');
const duPurchase=P.parse({id:'du3',postedAt:3000,text:'Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.'});
assert.strictEqual(duPurchase.providerId,'du-pay');assert.strictEqual(duPurchase.kind,'purchase');assert.strictEqual(duPurchase.cardLast4,'7105');assert.strictEqual(duPurchase.amount,9.75);assert.strictEqual(duPurchase.transactionRef,'DG108RVT5U');assert.strictEqual(duPurchase.category,'grocery');assert.strictEqual(duPurchase.fee,0);assert.strictEqual(duPurchase.vat,0);assert.strictEqual(duPurchase.cardType,'wallet_card');
const duWithdrawal=P.parse({id:'du4',postedAt:4000,text:'You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: DG198RKJGT Available balance: AED 10.28'});
assert.strictEqual(duWithdrawal.kind,'cash_withdrawal');assert.strictEqual(duWithdrawal.transactionRef,'DG198RKJGT');
assert.strictEqual(P.parse({text:'Your transaction of AED 40.53 at Talabat on your du Pay Card ending in 7105 was declined due to insufficient Balance.'}).reason,'declined-transaction');
assert.strictEqual(P.parse({text:'0823 is your OTP Code. Please do not share OTP with anyone.'}).reason,'security-code');
assert.strictEqual(P.parse({text:'Your du Pay Card ending in 7105 has been suspended from Google Pay.'}).reason,'card-status');
const duState={institutions:[{id:'dui',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'}],accounts:[{id:'du-wallet',name:'du Pay Wallet',country:'UAE',currency:'AED',type:'ewallet',institutionId:'dui',archived:false},{id:'cash',name:'Cash',country:'UAE',currency:'AED',type:'cash',institutionId:null,archived:false}],paymentInstruments:[{id:'du7105',accountId:'du-wallet',institutionId:'dui',country:'UAE',type:'wallet_card',last4:'7105',archived:false}]};
const duPurchaseRoute=P.resolveRoute(duPurchase,duState);assert.strictEqual(duPurchaseRoute.status,'routed');assert.strictEqual(duPurchaseRoute.account.id,'du-wallet');assert.strictEqual(duPurchaseRoute.instrument.id,'du7105');
const duPurchaseTx=P.buildTransaction(duPurchase,duPurchaseRoute,{date:'2026-10-01',uid:()=> 'tdu1'});assert.strictEqual(duPurchaseTx.ok,true);assert.strictEqual(duPurchaseTx.transaction.providerId,'du-pay');assert.strictEqual(duPurchaseTx.transaction.bankTransactionRef,'DG108RVT5U');assert.ok(P.dedupeKey(duPurchase).startsWith('ref:DG108RVT5U|'));
const duDepositRoute=P.resolveRoute(duDeposit,duState);assert.strictEqual(duDepositRoute.status,'routed');assert.strictEqual(duDepositRoute.account.id,'du-wallet');
const duTransferRoute=P.resolveRoute(duTransfer,duState);assert.strictEqual(duTransferRoute.status,'routed');assert.strictEqual(duTransferRoute.fromAccount.id,'du-wallet');
const duTransferTx=P.buildTransaction(duTransfer,duTransferRoute,{date:'2026-10-01',uid:()=> 'tdu2'});assert.strictEqual(duTransferTx.transaction.type,'external_transfer');assert.ok(duTransferTx.transaction.note.includes('Mohamed Abdelrahman Fawzy'));
const duWithdrawalRoute=P.resolveRoute(duWithdrawal,duState);assert.strictEqual(duWithdrawalRoute.status,'routed');assert.strictEqual(duWithdrawalRoute.targetAccount.id,'cash');const duWithdrawalTx=P.buildTransaction(duWithdrawal,duWithdrawalRoute,{date:'2026-10-01',uid:()=> 'tdu3'});assert.strictEqual(duWithdrawalTx.ok,true);assert.strictEqual(duWithdrawalTx.transaction.type,'transfer');assert.strictEqual(duWithdrawalTx.transaction.toAccountId,'cash');
const duLegacyState={institutions:[],accounts:[{id:'du-old',name:'du Pay',country:'UAE',currency:'AED',type:'ewallet',institutionId:null,archived:false}],paymentInstruments:[]};
assert.strictEqual(P.resolveRoute(duDeposit,duLegacyState).account.id,'du-old');

const genericKnown=P.parse({id:'g1',title:'My Bank Alerts',text:'Purchase AED 20.00 at FRESH CRAFT MINI MART on your card ending 9999'});
assert.strictEqual(genericKnown.recognized,true);
assert.strictEqual(genericKnown.kind,'purchase');
assert.strictEqual(genericKnown.cardLast4,'9999');
assert.strictEqual(genericKnown.merchant,'FRESH CRAFT MINI MART');
assert.strictEqual(genericKnown.category,'grocery');
assert.strictEqual(genericKnown.confidence,0.72);
assert.strictEqual(genericKnown.sourceHint,'My Bank Alerts');
const genericTransfer=P.parse({id:'g2',title:'Acme Wallet',text:'Transfer AED 75.00 to Ahmed Ali was successful. Available balance is AED 25.00'});
assert.strictEqual(genericTransfer.kind,'outgoing_transfer');
assert.strictEqual(genericTransfer.beneficiaryName,'Ahmed Ali');
assert.strictEqual(genericTransfer.availableBalance,25);

const pkgBank=P.parse({id:'pkg1',postedAt:9000,packageName:'com.emiratesnbd.android',text:'Purchase AED 10.00 with card 4021 at TEST MERCHANT'});
assert.strictEqual(pkgBank.bankId,'emirates-nbd');
const pkgWallet=P.parse({id:'pkg2',postedAt:9001,packageName:'ae.dupay.app',text:'Your du Pay Card ending in 7105 has been used for AED 2.00 at TEST. Your available balance is now AED 8.00 and your transaction ID is PKGTEST1.'});
assert.strictEqual(pkgWallet.providerId,'du-pay');

console.log('bank message parser regression tests: PASS');
