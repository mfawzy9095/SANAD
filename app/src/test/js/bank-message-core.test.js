'use strict';
const assert=require('assert');
const P=require('../../main/assets/js/bank-message-core.js');
// Synthetic legacy fixtures now include source metadata: production never infers it from body.
function fixtureParse(input){
 const e={...input};
 if(!e.title&&!e.sender&&!e.packageName){
  if(/du pay|TID:/i.test(e.text||''))e.sender='duPay';
  else if(/تمت عملية شراء في|تم ايداع الراتب|تم إيداع الراتب|تم خصم(?: مبلغ)?|تم تحويل مبلغ|تمت عملية شراء بقيمة|لقد تم.*(?:تحويل|ايداع)|تم ايداع AED/.test(e.text||''))e.sender='EmiratesNBD';
 }
 return P.parse(e);
}
const samples=[
['credit purchase','تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36','purchase',13.50,'4021'],
['online transfer','عميلنا العزيز Test User Name، تم خصم AED 160.00 من حسابك 1801 لتحويل الأموال من خلال الخدمات المصرفية عبر الإنترنت.','outgoing_transfer',160,null],
['deposit','لقد تم ايداع AED 149.00 في رقم حسابك  012XXX50XXX01 OBP  TR REF EPHCOO2700ATPAUJ 7JL1Z6OIIWYH19CN6X5B.الرصيد المتوفر هو AED 161.52','deposit',149,null],
['salary','تم ايداع الراتب AED 9,000.00 في  حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66','salary',9000,null],
['repayment','تم خصم مبلغ AED 684.19 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021.','card_repayment',684.19,'4021'],
['debit purchase','تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.','purchase',5.10,'3993'],
['debit merchant','لقد تمّ تحويل مبلغ 100.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*Test User Name. رصيدك الحالي هو AED 123.83.','outgoing_transfer',100,'3993']
];
for(const [label,text,kind,amt,last4] of samples){
  const p=fixtureParse({id:label,postedAt:1,text});
  assert.strictEqual(p.recognized,true,label);assert.strictEqual(p.bankId,'emirates-nbd',label);assert.strictEqual(p.kind,kind,label);assert.strictEqual(p.amount,amt,label);if(last4)assert.strictEqual(p.cardLast4,last4,label);
}
assert.strictEqual(fixtureParse({text:'يوجد لديك دفعة بطاقة تتطلب موافقتك. الرجاء تسجيل الدخول إلى تطبيق بنك الإمارات دبي الوطني والانتقال إلى قسم الأنشطة للتفويض.'}).reason,'authorization-pending');
assert.strictEqual(fixtureParse({text:'عميلنا TEST USER NAME، تم استبدال NOL Payment كعملية 153.00 على بطاقة MC TITANIUM التي تنتهي بـ 4021 بنجاح.'}).reason,'rewards-redemption');
const state={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[{id:'bank',country:'UAE',currency:'AED',type:'bank',institutionId:'i1',bankRefs:['1801','012XXX50XXX01'],archived:false},{id:'credit',country:'UAE',currency:'AED',type:'credit',institutionId:'i1',archived:false}],paymentInstruments:[{id:'c4021',accountId:'credit',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false},{id:'d3993',accountId:'bank',institutionId:'i1',country:'UAE',type:'debit_card',last4:'3993',archived:false}]};
const purchase=fixtureParse({id:'e1',postedAt:1000,text:samples[0][1]}),purchaseRoute=P.resolveRoute(purchase,state);
assert.strictEqual(purchaseRoute.status,'routed');assert.strictEqual(purchaseRoute.account.id,'credit');assert.strictEqual(purchaseRoute.instrument.id,'c4021');
const tx=P.buildTransaction(purchase,purchaseRoute,{date:'2026-10-01',uid:()=> 't1'});
assert.strictEqual(tx.ok,true);assert.strictEqual(tx.transaction.type,'expense');assert.strictEqual(tx.transaction.accountId,'credit');assert.strictEqual(tx.transaction.instrumentId,'c4021');assert.strictEqual(tx.transaction.cat,'grocery');
const salary=fixtureParse({id:'e2',postedAt:1000,text:samples[3][1]}),salaryRoute=P.resolveRoute(salary,state);
assert.strictEqual(salaryRoute.account.id,'bank');assert.strictEqual(P.buildTransaction(salary,salaryRoute,{date:'2026-10-01',uid:()=> 't2'}).transaction.cat,'salary');
const repay=fixtureParse({id:'e3',postedAt:1000,text:samples[4][1]}),rr=P.resolveRoute(repay,state);
assert.strictEqual(rr.fromAccount.id,'bank');assert.strictEqual(rr.targetAccount.id,'credit');
const rtx=P.buildTransaction(repay,rr,{date:'2026-10-01',uid:()=> 't3'});
assert.strictEqual(rtx.transaction.type,'transfer');assert.strictEqual(rtx.transaction.fromAccountId,'bank');assert.strictEqual(rtx.transaction.toAccountId,'credit');
const out=fixtureParse({id:'e4',postedAt:1000,text:samples[1][1]}),or=P.resolveRoute(out,state);
assert.strictEqual(or.status,'routed');assert.strictEqual(or.fromAccount.id,'bank');
const otx=P.buildTransaction(out,or,{date:'2026-10-01',uid:()=> 't4',confirmedOutgoingDestination:'external'});
assert.strictEqual(otx.ok,true);assert.strictEqual(otx.transaction.type,'external_transfer');assert.strictEqual(otx.transaction.fromAccountId,'bank');assert.strictEqual(otx.transaction.fromAmount,160);
assert.ok(P.dedupeKey(out).startsWith('event:e4|'));

const eiPurchase=fixtureParse({id:'ei1',postedAt:Date.UTC(2026,9,1,3,0),title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان\nالمنتهية بالرقم: 0308\nلدى: FRESH CRAFT MINI MART, DUBAI\nالمبلغ: AED 2.50\nالتاريخ: 01/10/2026, 06:44\nالحد المتوفر: 457.04 AED'});
assert.strictEqual(eiPurchase.recognized,true);assert.strictEqual(eiPurchase.bankId,'emirates-islamic');assert.strictEqual(eiPurchase.kind,'purchase');assert.strictEqual(eiPurchase.cardLast4,'0308');assert.strictEqual(eiPurchase.amount,2.5);assert.strictEqual(eiPurchase.transactionDate,'2026-10-01');assert.strictEqual(eiPurchase.availableCredit,457.04);assert.strictEqual(eiPurchase.category,'grocery');assert.strictEqual(eiPurchase.cardType,'credit_card');
const eiNegative=fixtureParse({id:'ei2',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: WARSAN MANDI RESTAURAN, SHARJAH المبلغ: AED 39.00 التاريخ: 05/09/2026, 22:51 الحد المتوفر: -608.56 AED'});
assert.strictEqual(eiNegative.availableCredit,-608.56);assert.strictEqual(eiNegative.category,'food');
const eiTaxi=fixtureParse({id:'ei3',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: CITI TAXI, SHARJAH المبلغ: AED 17.50 التاريخ: 27/09/2026, 23:34 الحد المتوفر: 516.40 AED'});
assert.strictEqual(eiTaxi.category,'transport');
const eiCafe=fixtureParse({id:'ei4',title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: MISBAH AL MANAKH CAFE, SHARJAH المبلغ: AED 10.50 التاريخ: 04/08/2026, 11:03 الحد المتوفر: 39.81 AED'});
assert.strictEqual(eiCafe.category,'cafe');
assert.strictEqual(fixtureParse({text:'Credit Card Mini Statement Card Starting: 457828 Statement Date: 10/08/2026 Minimum Amount Due: AED 476.19 Amount to be paid to avoid charges: AED 3,509.97 Due Date: 04/09/2026'}).reason,'card-statement');
assert.strictEqual(fixtureParse({text:'نود تأكيد استلام دفعة AED 433.00 عن البطاقة الائتمانية التي تبدأ بالرقم 457828 في تاريخ 15/07/2026. الحد المتوفر هو AED 664.35.'}).reason,'card-payment-ack');
assert.strictEqual(fixtureParse({text:'عزيزنا المتعامل، تم تسجيل بطاقتك المنتهية بالرقم 0308 في تطبيق Google Pay.'}).reason,'card-status');
const eiState={institutions:[{id:'ei',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[{id:'ei-credit',country:'UAE',currency:'AED',type:'credit',institutionId:'ei',archived:false}],paymentInstruments:[{id:'ei0308',accountId:'ei-credit',institutionId:'ei',country:'UAE',type:'credit_card',last4:'0308',archived:false}]};
const eiRoute=P.resolveRoute(eiPurchase,eiState);assert.strictEqual(eiRoute.status,'routed');assert.strictEqual(eiRoute.account.id,'ei-credit');
const eiTx=P.buildTransaction(eiPurchase,eiRoute,{uid:()=> 'tei'});assert.strictEqual(eiTx.transaction.date,'2026-10-01');assert.strictEqual(eiTx.transaction.instrumentId,'ei0308');

const duTransfer=fixtureParse({id:'du1',postedAt:1000,text:'Your request to transfer AED 149.00 to Test User Name is successfully processed and the amount has been credited in the beneficiary account. TID: DIR7BQ7FZ3'});
assert.strictEqual(duTransfer.providerId,'du-pay');assert.strictEqual(duTransfer.kind,'outgoing_transfer');assert.strictEqual(duTransfer.amount,149);assert.strictEqual(duTransfer.transactionRef,'DIR7BQ7FZ3');assert.strictEqual(duTransfer.beneficiaryName,'Test User Name');
const duDeposit=fixtureParse({id:'du2',postedAt:2000,text:"Hello Test User, You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40, and the transaction ID is: DI24AS0MCM"});
assert.strictEqual(duDeposit.providerId,'du-pay');assert.strictEqual(duDeposit.kind,'deposit');assert.strictEqual(duDeposit.amount,3500);assert.strictEqual(duDeposit.availableBalance,3500.40);assert.strictEqual(duDeposit.transactionRef,'DI24AS0MCM');
const duPurchase=fixtureParse({id:'du3',postedAt:3000,text:'Hello Test User, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.'});
assert.strictEqual(duPurchase.providerId,'du-pay');assert.strictEqual(duPurchase.kind,'purchase');assert.strictEqual(duPurchase.cardLast4,'7105');assert.strictEqual(duPurchase.amount,9.75);assert.strictEqual(duPurchase.transactionRef,'DG108RVT5U');assert.strictEqual(duPurchase.category,'grocery');assert.strictEqual(duPurchase.fee,0);assert.strictEqual(duPurchase.vat,0);assert.strictEqual(duPurchase.cardType,'wallet_card');
const duWithdrawal=fixtureParse({id:'du4',postedAt:4000,text:'You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: DG198RKJGT Available balance: AED 10.28'});
assert.strictEqual(duWithdrawal.kind,'cash_withdrawal');assert.strictEqual(duWithdrawal.transactionRef,'DG198RKJGT');
const duHyphen=fixtureParse({id:'du-hyphen',postedAt:4100,text:'Your request to transfer AED 10.00 to Test Person is successfully processed and the amount has been credited in the beneficiary account. TID: SEQ-TRANSFER-1'});
assert.strictEqual(duHyphen.transactionRef,'SEQ-TRANSFER-1');
assert.strictEqual(fixtureParse({text:'Your transaction of AED 40.53 at Talabat on your du Pay Card ending in 7105 was declined due to insufficient Balance.'}).reason,'declined-transaction');
assert.strictEqual(fixtureParse({text:'0823 is your OTP Code. Please do not share OTP with anyone.'}).reason,'security-code');
assert.strictEqual(fixtureParse({text:'Your du Pay Card ending in 7105 has been suspended from Google Pay.'}).reason,'card-status');
const duState={institutions:[{id:'dui',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'}],accounts:[{id:'du-wallet',name:'du Pay Wallet',country:'UAE',currency:'AED',type:'ewallet',institutionId:'dui',archived:false},{id:'cash',name:'Cash',country:'UAE',currency:'AED',type:'cash',institutionId:null,archived:false}],paymentInstruments:[{id:'du7105',accountId:'du-wallet',institutionId:'dui',country:'UAE',type:'wallet_card',last4:'7105',archived:false}]};
const duPurchaseRoute=P.resolveRoute(duPurchase,duState);assert.strictEqual(duPurchaseRoute.status,'routed');assert.strictEqual(duPurchaseRoute.account.id,'du-wallet');assert.strictEqual(duPurchaseRoute.instrument.id,'du7105');
const duPurchaseTx=P.buildTransaction(duPurchase,duPurchaseRoute,{date:'2026-10-01',uid:()=> 'tdu1'});assert.strictEqual(duPurchaseTx.ok,true);assert.strictEqual(duPurchaseTx.transaction.providerId,'du-pay');assert.strictEqual(duPurchaseTx.transaction.bankTransactionRef,'DG108RVT5U');assert.ok(P.dedupeKey(duPurchase).startsWith('ref:DG108RVT5U|'));
const duDepositRoute=P.resolveRoute(duDeposit,duState);assert.strictEqual(duDepositRoute.status,'routed');assert.strictEqual(duDepositRoute.account.id,'du-wallet');
const duTransferRoute=P.resolveRoute(duTransfer,duState);assert.strictEqual(duTransferRoute.status,'routed');assert.strictEqual(duTransferRoute.fromAccount.id,'du-wallet');
const duTransferTx=P.buildTransaction(duTransfer,duTransferRoute,{date:'2026-10-01',uid:()=> 'tdu2',confirmedOutgoingDestination:'external'});assert.strictEqual(duTransferTx.transaction.type,'external_transfer');assert.ok(duTransferTx.transaction.note.includes('Test User Name'));
const duWithdrawalRoute=P.resolveRoute(duWithdrawal,duState);assert.strictEqual(duWithdrawalRoute.status,'routed');assert.strictEqual(duWithdrawalRoute.targetAccount.id,'cash');const duWithdrawalTx=P.buildTransaction(duWithdrawal,duWithdrawalRoute,{date:'2026-10-01',uid:()=> 'tdu3'});assert.strictEqual(duWithdrawalTx.ok,true);assert.strictEqual(duWithdrawalTx.transaction.type,'transfer');assert.strictEqual(duWithdrawalTx.transaction.toAccountId,'cash');
const duLegacyState={institutions:[],accounts:[{id:'du-old',name:'du Pay',country:'UAE',currency:'AED',type:'ewallet',institutionId:null,archived:false}],paymentInstruments:[]};
assert.strictEqual(P.resolveRoute(duDeposit,duLegacyState).account.id,'du-old');

const genericKnown=fixtureParse({id:'g1',title:'My Bank Alerts',text:'Purchase AED 20.00 at FRESH CRAFT MINI MART on your card ending 9999'});
assert.strictEqual(genericKnown.recognized,true);
assert.strictEqual(genericKnown.kind,'purchase');
assert.strictEqual(genericKnown.cardLast4,'9999');
assert.strictEqual(genericKnown.merchant,'FRESH CRAFT MINI MART');
assert.strictEqual(genericKnown.category,'grocery');
assert.strictEqual(genericKnown.confidence,0.72);
assert.strictEqual(genericKnown.sourceHint,'My Bank Alerts');
const genericTransfer=fixtureParse({id:'g2',title:'Acme Wallet',text:'Transfer AED 75.00 to Ahmed Ali was successful. Available balance is AED 25.00'});
assert.strictEqual(genericTransfer.kind,'outgoing_transfer');
assert.strictEqual(genericTransfer.beneficiaryName,'Ahmed Ali');
assert.strictEqual(genericTransfer.availableBalance,25);
assert.strictEqual(genericTransfer.accountRef,null);
const packageHint=fixtureParse({id:'g3',packageName:'com.acmewallet.app',text:'Your account was credited AED 10.00. Available balance is AED 20.00'});
assert.strictEqual(packageHint.ignored,false);
assert.ok(packageHint.sourceHint.includes('com.acmewallet.app'));
assert.strictEqual(packageHint.accountRef,null);
const genericRef=fixtureParse({id:'g4',title:'Acme Bank',text:'Purchase AED 12.00 at TEST STORE on your credit card ending 8888. Transaction ID: TX-ABCD-1234 Date: 02/10/2026'});
assert.strictEqual(genericRef.transactionRef,'TX-ABCD-1234');
assert.strictEqual(genericRef.transactionDate,'2026-10-02');
const ownTransfer=fixtureParse({id:'g5',title:'Acme Bank',text:'Transfer AED 100.00 from account 1111 to account 2222 was successful. Transaction ID: OWN-XFER-1'});
assert.strictEqual(ownTransfer.kind,'internal_transfer');
assert.strictEqual(ownTransfer.fromAccountRef,'1111');
assert.strictEqual(ownTransfer.toAccountRef,'2222');
assert.strictEqual(ownTransfer.transactionRef,'OWN-XFER-1');

const pkgBank=fixtureParse({id:'pkg1',postedAt:9000,packageName:'com.emiratesnbd.android',text:'Purchase AED 10.00 with card 4021 at TEST MERCHANT'});
assert.strictEqual(pkgBank.bankId,'emirates-nbd');
const pkgWallet=fixtureParse({id:'pkg2',postedAt:9001,packageName:'ae.dupay.app',text:'Your du Pay Card ending in 7105 has been used for AED 2.00 at TEST. Your available balance is now AED 8.00 and your transaction ID is PKGTEST1.'});
assert.strictEqual(pkgWallet.providerId,'du-pay');

assert.strictEqual(P.countryForCurrency('AED'),'UAE');
assert.strictEqual(P.countryForCurrency('EGP'),'EGY');
assert.strictEqual(P.countryForCurrency('MAD'),'MAR');
// The two Emirates NBD legal issuers share a brand: never infer the Egyptian
// bank from purchase currency, including an EGP-denominated UAE card charge.
const nbdRegistry=require('../../main/assets/js/uae-bank-registry-core.js');
assert.equal(nbdRegistry.get('emirates-nbd').country||'UAE','UAE');
assert.equal(nbdRegistry.get('emirates-nbd-egypt').country,'EGY');
assert(nbdRegistry.listAll().some(b=>b.id==='emirates-nbd-egypt'));
const sharedNbd=fixtureParse({id:'uae-egp',postedAt:Date.UTC(2026,8,8),title:'EmiratesNBD',text:'Purchase EGP 20.00 at SYNTHETIC SHOP using debit card ending 3993'});
assert.equal(sharedNbd.recognized,true);
assert.equal(sharedNbd.bankId,'emirates-nbd');
assert.equal(sharedNbd.country,'UAE');
assert.equal(sharedNbd.reviewReason,'issuer-jurisdiction-unconfirmed');
const egyptNbd=fixtureParse({id:'egypt-egp',postedAt:Date.UTC(2026,8,8),title:'Emirates NBD Egypt',text:'Purchase EGP 20.00 at SYNTHETIC SHOP using debit card ending 3993'});
assert.equal(egyptNbd.recognized,true);
assert.equal(egyptNbd.bankId,'emirates-nbd-egypt');
assert.equal(egyptNbd.country,'EGY');
assert.notEqual(egyptNbd.reviewReason,'issuer-jurisdiction-unconfirmed');
assert.strictEqual(fixtureParse({text:'Your account 1234 was credited EGP 50.00'}).country,'EGY');
assert.strictEqual(fixtureParse({text:'Purchase MAD 20.00 at TEST STORE on your credit card ending 9999'}).country,'MAR');

const maskedVisa=fixtureParse({id:'masked-visa',postedAt:Date.UTC(2026,9,2),title:'Test Bank',text:'Purchase AED 10.00 at TEST STORE using Visa credit card 4578 XXXX XXXX 0308'});
assert.strictEqual(maskedVisa.cardFirst4,'4578');
assert.strictEqual(maskedVisa.cardLast4,'0308');
assert.strictEqual(maskedVisa.cardNetwork,'visa');

const startOnly=fixtureParse({id:'start-only',postedAt:Date.UTC(2026,9,2),title:'Test Bank',text:'Purchase AED 12.00 at TEST STORE using your Mastercard credit card starting with 457828'});
assert.strictEqual(startOnly.cardFirst4,'4578');
assert.strictEqual(startOnly.cardLast4,null);
assert.strictEqual(startOnly.cardNetwork,'mastercard');

const incomingPerson=fixtureParse({id:'incoming-person',postedAt:Date.UTC(2026,9,2),title:'Emirates NBD',text:'AED 250.00 was transferred from Ahmed Ali to your account 012XXX50XXX01. Available balance AED 1250.00'});
assert.strictEqual(incomingPerson.kind,'incoming_transfer');
assert.strictEqual(incomingPerson.direction,'credit');
assert.strictEqual(incomingPerson.merchant,'Ahmed Ali');

const incomingArabic=fixtureParse({id:'incoming-ar',postedAt:Date.UTC(2026,9,2),title:'Emirates NBD',text:'تم تحويل AED 300.00 من أحمد علي إلى حسابك 012XXX50XXX01 الرصيد المتوفر AED 1550.00'});
assert.strictEqual(incomingArabic.kind,'incoming_transfer');
assert.strictEqual(incomingArabic.direction,'credit');

const outgoingPerson=fixtureParse({id:'outgoing-person',postedAt:Date.UTC(2026,9,2),title:'Emirates NBD',text:'Transferred AED 100.00 to Ahmed Ali. Available balance AED 900.00'});
assert.strictEqual(outgoingPerson.kind,'outgoing_transfer');
assert.strictEqual(outgoingPerson.direction,'debit');

const eiPromo=fixtureParse({id:'promo-ei-4578',postedAt:Date.UTC(2026,9,2),title:'Emirates Islamic',text:"Pay abroad and receive 10% cashback, up to AED 100 cashback, on travel or online international purchases with your new Emirates Islamic Visa Credit Card starting with 457828. All you have to do is make 3 purchases or more by 11/10/2026. SMS 'ACT10' to 4451 to enroll and avail the offer. Know more, visit www.emiratesislamic.ae/eiecashback T&Cs Apply. To opt out, visit www.emiratesislamic.ae/optout"});
assert.strictEqual(eiPromo.ignored,true);
assert.strictEqual(eiPromo.reason,'marketing-offer');
assert.strictEqual(eiPromo.recognized,false);

const realCashback=fixtureParse({id:'cashback-real',postedAt:Date.UTC(2026,9,2),title:'ADCB',text:'Cashback AED 12.50 has been credited to your account 1234. Available balance AED 200.00'});
assert.notStrictEqual(realCashback&&realCashback.reason,'marketing-offer');


const taptapSaloua=fixtureParse({id:'taptap-saloua',postedAt:Date.UTC(2026,9,2),title:'Emirates NBD',text:'لقد تمّ تحويل مبلغ 1,068.70AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*ExampleRecipient. رصيدك الحالي هو AED 7,932.96.'});
assert.strictEqual(taptapSaloua.recognized,true);
assert.strictEqual(taptapSaloua.bankId,'emirates-nbd');
assert.strictEqual(taptapSaloua.kind,'outgoing_transfer');
assert.strictEqual(taptapSaloua.direction,'debit');
assert.strictEqual(taptapSaloua.amount,1068.70);
assert.strictEqual(taptapSaloua.currency,'AED');
assert.strictEqual(taptapSaloua.cardLast4,'3993');
assert.strictEqual(taptapSaloua.cardType,'debit_card');
assert.strictEqual(taptapSaloua.beneficiaryName,'Example Recipient');
assert.strictEqual(taptapSaloua.availableBalance,7932.96);
const taptapRoute=P.resolveRoute(taptapSaloua,state);
assert.strictEqual(taptapRoute.status,'routed');
assert.strictEqual(taptapRoute.fromAccount.id,'bank');
assert.strictEqual(taptapRoute.instrument.id,'d3993');
const taptapTx=P.buildTransaction(taptapSaloua,taptapRoute,{date:'2026-10-02',uid:()=> 'ttaptap',confirmedOutgoingDestination:'external'});
assert.strictEqual(taptapTx.ok,true);
assert.strictEqual(taptapTx.transaction.type,'external_transfer');
assert.strictEqual(taptapTx.transaction.fromAccountId,'bank');
assert.strictEqual(taptapTx.transaction.instrumentId,'d3993');
assert.ok(taptapTx.transaction.note.includes('Example Recipient'));


const genericRemittanceCases=[
  {
    id:'remit-taptap-any-user',
    merchant:'TAPT*AhmedAli',
    channel:'Taptap Send',
    beneficiary:'Ahmed Ali'
  },
  {
    id:'remit-al-ansari-no-beneficiary',
    merchant:'AL ANSARI EXCHANGE',
    channel:'Al Ansari Exchange',
    beneficiary:null
  },
  {
    id:'remit-remitly-any-user',
    merchant:'REMITLY*SaraHassan',
    channel:'Remitly',
    beneficiary:'Sara Hassan'
  },
  {
    id:'remit-unknown-channel',
    merchant:'NEW MONEY SERVICE',
    channel:'NEW MONEY SERVICE',
    beneficiary:null
  }
];
for(const c of genericRemittanceCases){
  const p=fixtureParse({id:c.id,postedAt:Date.UTC(2026,9,2,9,0),title:'Emirates NBD',text:'لقد تمّ تحويل مبلغ 50.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى '+c.merchant+'. رصيدك الحالي هو AED 500.00.'});
  assert.strictEqual(p.kind,'outgoing_transfer',c.id);
  assert.strictEqual(p.category,'externalTransfer',c.id);
  assert.strictEqual(p.cardLast4,'3993',c.id);
  assert.strictEqual(p.transferChannel,c.channel,c.id);
  assert.strictEqual(p.beneficiaryName,c.beneficiary,c.id);
}


const merchantParsed=fixtureParse({id:'merchant-carrefour',postedAt:Date.UTC(2026,9,2,10,0),title:'ADCB',text:'Purchase AED 42.00 at Carrefour Market using debit card ending 7777. Available balance is AED 100.00'});
const merchantState={institutions:[{id:'mi',name:'ADCB',country:'UAE',bankRegistryId:'adcb'}],accounts:[{id:'ma',institutionId:'mi',country:'UAE',name:'ADCB',type:'bank',currency:'AED',openingBalance:142,archived:false}],paymentInstruments:[{id:'mc',accountId:'ma',institutionId:'mi',country:'UAE',type:'debit_card',last4:'7777',archived:false}]};
const merchantRoute=P.resolveRoute(merchantParsed,merchantState);
const merchantTx=P.buildTransaction(merchantParsed,merchantRoute,{date:'2026-10-02',uid:()=> 'merchant-tx'});
assert.strictEqual(merchantTx.ok,true);
assert.strictEqual(merchantTx.transaction.merchantName,'Carrefour Market');
assert.strictEqual(merchantTx.transaction.cat,'grocery');

console.log('bank message parser regression tests: PASS');

// Source metadata beats merchant keywords; body alone cannot identify a generic issuer.
for(const [title,expectedBank,expectedProvider] of [['EI SMS','emirates-islamic',null],['duPay',null,'du-pay']]){
  const p=fixtureParse({title,text:'Purchase AED 32.00 at CITI TAXI using card ending 0308'});
  assert.strictEqual(p.bankId,expectedBank);
  assert.strictEqual(p.providerId,expectedProvider);
}
assert.strictEqual(fixtureParse({text:'Purchase AED 32.00 at CITI TAXI using card ending 0308'}).bankId,null);
assert.strictEqual(fixtureParse({title:'EmiratesNBD',text:'*Convert now* Pay as low as AED 32.31 per month for the purchase of AED 1124.50 at TEST STORE with credit card ending 4021 via clicking https://example.invalid'}).ignored,true);
const arRefund=fixtureParse({title:'EmiratesNBD',text:'لقد تم إعادة مبلغ عملية شراء بقيمة AED 38.00 منفذ لدى TEST STORE بواسطة بطاقة الخصم المنتهية أرقامها بـ 3993 إلى حساب بطاقتك. الرصيد المتوفر هو 5685.54 AED.'});
assert.strictEqual(arRefund.kind,'refund');assert.strictEqual(arRefund.amount,38);assert.strictEqual(arRefund.availableBalance,5685.54);
const beforeCurrency=fixtureParse({title:'EmiratesNBD',text:'لقد تمّ تحويل مبلغ AED 500.00 باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*TestRecipient. رصيدك الحالي هو AED 4135.57.'});
assert.strictEqual(beforeCurrency.kind,'outgoing_transfer');assert.strictEqual(beforeCurrency.amount,500);assert.strictEqual(beforeCurrency.transferChannel,'Taptap Send');

// Manual approval must not erase fee evidence or evaluate exemption formulas.
{
 const F=require('../../main/assets/js/finance-core.js');
 const p={recognized:true,kind:'outgoing_transfer',currency:'AED',country:'UAE',amount:100,postedAt:1790859000000,fee:2,vat:0.1,feeFormula:'1% subject to exemptions',raw:'transfer with fees'};
 const route={status:'routed',fromAccount:{id:'fee-source',country:'UAE',currency:'AED',type:'bank',openingBalance:200}};
 assert.strictEqual(P.buildTransaction(p,route,{}).reason,'fee-confirmation-required');
 for(const fee of [-1,NaN,Infinity])assert.strictEqual(P.buildTransaction(p,route,{confirmedFee:fee,confirmedOutgoingDestination:'external'}).ok,false);
 const built=P.buildTransaction(p,route,{confirmedFee:2.1,confirmedOutgoingDestination:'external'});
 assert.strictEqual(built.ok,true);assert.strictEqual(built.transaction.fee,2.1);
 assert.strictEqual(F.accountBalance({accounts:[route.fromAccount],transactions:[built.transaction]},'fee-source'),97.9);
 assert.strictEqual(P.buildTransaction(p,route,{confirmedFee:0,confirmedOutgoingDestination:'external'}).transaction.fee,0);
 const purchase=P.buildTransaction({...p,kind:'purchase',merchant:'TEST'}, {status:'routed',account:route.fromAccount}, {confirmedFee:2.1,confirmedOutgoingDestination:'external'});
 assert.strictEqual(purchase.transaction.bankPrincipalAmount,100);assert.strictEqual(purchase.transaction.amount,102.1);assert.strictEqual(purchase.transaction.walletAmount,102.1);
 const incoming=P.buildTransaction({...p,kind:'incoming_transfer'}, {status:'routed',account:route.fromAccount},{confirmedFee:2.1,confirmedIncomingOrigin:'external-income'});
 assert.strictEqual(incoming.reason,'fee-direction-review-required');
}
