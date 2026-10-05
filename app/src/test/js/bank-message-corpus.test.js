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

const recognized=[
  ['enbd-credit-grocery','تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36','purchase',13.50,'4021','credit_card','grocery'],
  ['enbd-transfer','عميلنا العزيز Test User Name، تم خصم AED 160.00 من حسابك 1801 لتحويل الأموال من خلال الخدمات المصرفية عبر الإنترنت.','outgoing_transfer',160,null,null,'externalTransfer'],
  ['enbd-credit-adidas','تمت عملية شراء في AED 180.00 ADIDAS,SHARJAH على البطاقة 4021 الائتمان المتوفر AED3,991.36','purchase',180,'4021','credit_card','shopping'],
  ['enbd-deposit','لقد تم ايداع AED 149.00 في رقم حسابك  012XXX50XXX01 OBP  TR REF EPHCOO2700ATPAUJ 7JL1Z6OIIWYH19CN6X5B.الرصيد المتوفر هو AED 161.52','deposit',149,null,null,'other'],
  ['enbd-salary','تم ايداع الراتب AED 9,000.00 في  حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66','salary',9000,null,null,'salary'],
  ['enbd-repayment-4021','تم خصم مبلغ AED 684.19 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021.','card_repayment',684.19,'4021',null,'other'],
  ['enbd-repayment-0308','تم خصم مبلغ AED 1,650.00 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية0308.','card_repayment',1650,'0308',null,'other'],
  ['enbd-debit-nmc','تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.','purchase',5.10,'3993','debit_card','health'],
  ['enbd-debit-tap','لقد تمّ تحويل مبلغ 100.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*Test User Name. رصيدك الحالي هو AED 123.83.','outgoing_transfer',100,'3993','debit_card','externalTransfer'],
  ['ei-0308-mini-mart','عملية دفع ببطاقة الائتمان\nالمنتهية بالرقم: 0308\nلدى: FRESH CRAFT MINI MART, DUBAI\nالمبلغ: AED 2.50\nالتاريخ: 01/10/2026, 06:44\nالحد المتوفر: 457.04 AED','purchase',2.50,'0308','credit_card','grocery'],
  ['ei-0308-taxi','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: CITI TAXI, SHARJAH المبلغ: AED 17.50 التاريخ: 27/09/2026, 23:34 الحد المتوفر: 516.40 AED','purchase',17.50,'0308','credit_card','transport'],
  ['ei-0308-mandi-negative','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: WARSAN MANDI RESTAURAN, SHARJAH المبلغ: AED 39.00 التاريخ: 05/09/2026, 22:51 الحد المتوفر: -608.56 AED','purchase',39,'0308','credit_card','food'],
  ['ei-0308-pharmacy','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: AL THIQAH PHARMACY, SHARJAH المبلغ: AED 32.50 التاريخ: 31/07/2026, 21:07 الحد المتوفر: 55.81 AED','purchase',32.50,'0308','credit_card','health'],
  ['ei-0308-cafe','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: MISBAH AL MANAKH CAFE, SHARJAH المبلغ: AED 10.50 التاريخ: 04/08/2026, 11:03 الحد المتوفر: 39.81 AED','purchase',10.50,'0308','credit_card','cafe'],
  ['du-person-transfer','Your request to transfer AED 149.00 to Test User Name is successfully processed and the amount has been credited in the beneficiary account. TID: DIR7BQ7FZ3','outgoing_transfer',149,null,null,'externalTransfer'],
  ['du-wallet-deposit',"Hello Test User, You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40, and the transaction ID is: DI24AS0MCM",'deposit',3500,null,null,'other'],
  ['du-card-platinum','Hello Test User, Your du Pay Card ending in 7105 has been used for AED 318.15 at Platinumlist. Your available balance is now AED 3,182.38 and your transaction ID is DG608YRM2C.','purchase',318.15,'7105','wallet_card','fun'],
  ['du-card-grocery','Hello Test User, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.','purchase',9.75,'7105','wallet_card','grocery'],
  ['du-withdrawal','You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: DG198RKJGT Available balance: AED 10.28','cash_withdrawal',100,null,null,'other'],
  ['du-card-contabo','Hello Test User, Your du Pay Card ending in 7105 has been used for AED 19.80 at CONTABO* HOLD ONLY. Your available balance is now AED 1.28 and your transaction ID is DF59845VHJ.','purchase',19.80,'7105','wallet_card','bills'],
  ['du-card-talabat','Hello Test User, Your du Pay Card ending in 7105 has been used for AED 29.01 at Talabat. Your available balance is now AED 21.08 and your transaction ID is DF4583P4L9.','purchase',29.01,'7105','wallet_card','food']
];

for(const [label,text,kind,amount,last4,cardType,cat] of recognized){
  const input={id:label,postedAt:Date.UTC(2026,9,1,10,0),text};
  if(label.startsWith('ei-')) input.title='Emirates Islamic';
  const p=fixtureParse(input);
  assert.strictEqual(p.recognized,true,label);
  assert.strictEqual(p.ignored,false,label);
  assert.strictEqual(p.kind,kind,label);
  assert.strictEqual(p.amount,amount,label);
  if(last4)assert.strictEqual(p.cardLast4,last4,label);
  if(cardType)assert.strictEqual(p.cardType,cardType,label);
  if(cat)assert.strictEqual(p.category,cat,label);
}
const neg=fixtureParse({title:'Emirates Islamic',text:recognized.find(x=>x[0]==='ei-0308-mandi-negative')[1]});
assert.strictEqual(neg.availableCredit,-608.56);
const sal=fixtureParse({text:recognized.find(x=>x[0]==='enbd-salary')[1]});
assert.strictEqual(sal.availableBalance,9001.66);
const dep=fixtureParse({text:recognized.find(x=>x[0]==='enbd-deposit')[1]});
assert.strictEqual(dep.availableBalance,161.52);
const du=fixtureParse({text:recognized.find(x=>x[0]==='du-card-grocery')[1]});
assert.strictEqual(du.transactionRef,'DG108RVT5U');
assert.strictEqual(du.availableBalance,0.53);

const ignored=[
  ['enbd-approval','يوجد لديك دفعة بطاقة تتطلب موافقتك. الرجاء تسجيل الدخول إلى تطبيق بنك الإمارات دبي الوطني والانتقال إلى قسم الأنشطة للتفويض.','authorization-pending'],
  ['enbd-reward','عميلنا TEST USER NAME، تم استبدال NOL Payment كعملية 153.00 على بطاقة MC TITANIUM التي تنتهي بـ 4021 بنجاح.','rewards-redemption'],
  ['ei-statement','Credit Card Mini Statement Card Starting: 457828 Statement Date: 10/08/2026 Minimum Amount Due: AED 476.19 Amount to be paid to avoid charges: AED 3,509.97 Due Date: 04/09/2026 Please pay on or before due date to avoid commitment to donate amount.','card-statement'],
  ['ei-payment-ack','نود تأكيد استلام دفعة AED 433.00 عن البطاقة الائتمانية التي تبدأ بالرقم 457828 في تاريخ 15/07/2026. الحد المتوفر هو AED 664.35.','card-payment-ack'],
  ['ei-google-pay','عزيزنا المتعامل، تم تسجيل بطاقتك المنتهية بالرقم 0308 في تطبيق Google Pay. إذا لم تتقدم بهذا الطلب، يرجى الاتصال.','card-status'],
  ['du-declined-blocked','Your transaction of AED 140.33 at WWW.SHEIN.COM on your du Pay Card ending in 7105 was declined due to card blocked.','declined-transaction'],
  ['du-declined-balance','Hello Test User, Your transaction of AED 40.53 at Talabat on your du Pay Card ending in 7105 has been declined due to insufficient Balance.','declined-transaction'],
  ['du-otp','0823 is your OTP Code. Please do not share OTP with anyone.','security-code'],
  ['du-suspended','Your du Pay Card ending in 7105 has been suspended from Google Pay.','card-status'],
  ['du-resumed','Your du Pay Card ending in 7105 has been resumed to Merchant.','card-status'],
  ['du-freeze','Hello Test User, Your request to freeze the du Pay Card ending in 7105 has been successfully done.','card-status'],
  ['du-reactivated','Hello Test User, Your du Pay Card ending in 7105 has been successfully reactivated.','card-status']
];
for(const [label,text,reason] of ignored){
  const p=fixtureParse({id:label,text});
  assert.strictEqual(p.recognized,false,label);
  assert.strictEqual(p.ignored,true,label);
  assert.strictEqual(p.reason,reason,label);
}

console.log('bank real-message corpus tests: PASS ('+(recognized.length+ignored.length)+' cases)');

// Regional and international evidence: issuer, spending currency and reported credit are separate.
for(const [title,text,kind,amount,currency] of [
 ['eandmoney','AED 10.00 added to your e& money using your card. Your updated balance is AED 10.35 Transaction ID: TEST349889064','deposit',10,'AED'],
 ['ET Cash','تم إيداع مبلغ 1800.00 ج.م إلى محفظتك. رصيد محفظتك الحالى 1800.00 ج.م','deposit',1800,'EGP'],
 ['e& money','تم شحن 200.00ج.م لرقمك 01000000000 من محفظة e& money. رصيد محفظتك الحالي 344.24ج.م','mobile_recharge',200,'EGP'],
 ['E& Cash','تم تحويل مبلغ 2600.00 ج.م الى رقم 01000000000 بنجاح. رسوم التحويل 13.00 جنيه رصيد محفظتك الحالى 64.24','outgoing_transfer',2600,'EGP'],
 ['BanK-AlAhly','تم خصم MAD 20 من بطاقة الائتمان رقم 4093 عند GLOVO يوم 04-28 الساعة 03:09 المتاح 19476.4 جم والمتبقي من حد الاستخدام الشهري بالعملة الأجنبية بما يعادل 23285.43 جم','purchase',20,'MAD'],
 ['FABMISR','Your Card ** 9061 was debited with USD 15 at TEST STORE on 15/06/26 15:53. Available limit is EGP 4026 and international limit is USD 80.14.','purchase',15,'USD'],
 ['Bank NXT','EGP3 000.00 has been credited to your card ending with **5658.','card_payment_received',3000,'EGP'],
 ['EmiratesNBD','لقد تم إعادة مبلغ عملية شراء بقيمة USD 1.00 منفذ لدى [اسم التاجر] بواسطة بطاقة الائتمان الخاصة بك التي تنتهي أرقامها بـ 4021 إلى حساب بطاقتك. الحد المتوفر هو AED 3574.53.','refund',1,'USD']
]){
 const p=fixtureParse({title,text,postedAt:1790859037991});
 assert.strictEqual(p.recognized,true,title);assert.strictEqual(p.kind,kind,title);assert.strictEqual(p.amount,amount,title);assert.strictEqual(p.currency,currency,title);
 if(['BanK-AlAhly','FABMISR','Bank NXT'].includes(title))assert.strictEqual(p.country,'EGY');
 if(title==='FABMISR'){assert.strictEqual(p.availableCredit,4026);assert.strictEqual(p.availableCreditCurrency,'EGP');assert.strictEqual(p.availableBalance,null);}
 if(title==='EmiratesNBD'){assert.strictEqual(p.country,'UAE');assert.strictEqual(p.availableCredit,3574.53);assert.strictEqual(p.availableCreditCurrency,'AED');}
 if(title==='E& Cash')assert.strictEqual(p.fee,13);
}
const gold=fixtureParse({title:'eandmoney',text:'Hey! You’ve just sold 0.0351 gm of gold. Your transaction ID is 81283 and you have 1.0E-4 gm balance remaining.'});
assert.strictEqual(gold.kind,'investment_sale');assert.strictEqual(gold.amount,null);

// ATM terminal numbers may be adjacent to ATM. A cash debit is not consumption.
{
 const M=require('../../main/assets/js/bank-message-core');
 for(const terminal of ['NBE ATM987','NBE ATM 987','NBE ATM-987']){
  const p=M.parse({id:'atm-terminal-'+terminal,title:'BanK-AlAhly',text:`تم خصم 350.00EGP من بطاقة الخصم المباشر رقم 8234 عند ${terminal} يوم 23/04 الساعه 16:47 المتاح 486.81 جم للمزيد اتصل ب 19623`,postedAt:1682261238844});
  assert.equal(p.kind,'cash_withdrawal',terminal+' must not be a purchase');
 }
}

{
 const M=require('../../main/assets/js/bank-message-core'),I=require('../../main/assets/js/bank-ingestion-core');
 const state={institutions:[{id:'nbe',bankRegistryId:'nbe-egypt',country:'EGY'}],accounts:[{id:'bank',institutionId:'nbe',type:'bank',currency:'EGP',country:'EGY',openingBalance:1000},{id:'cash',type:'cash',currency:'EGP',country:'EGY',openingBalance:0}],paymentInstruments:[{id:'debit',accountId:'bank',institutionId:'nbe',type:'debit_card',last4:'8234'}],transactions:[]};
 const p=M.parse({id:'atm-route',title:'BanK-AlAhly',text:'تم خصم 350.00EGP من بطاقة الخصم المباشر رقم 8234 عند NBE ATM987 يوم 23/04 الساعه 16:47 المتاح 650.00 جم للمزيد اتصل ب 19623',postedAt:1682261238844});
 const plan=I.plan(p,state);
 assert.equal(plan.action,'auto-save','Known debit source and one cash destination must route');
 assert.equal(plan.transaction.type,'transfer');assert.equal(plan.transaction.fromAccountId,'bank');assert.equal(plan.transaction.toAccountId,'cash');
 I.applyPlan(state,plan);
 const F=require('../../main/assets/js/finance-core');assert.equal(F.accountBalance(state,'bank'),650);assert.equal(F.accountBalance(state,'cash'),350);
 assert.equal(I.plan(p,state).action,'duplicate');
 const unresolved={...state,transactions:[],accounts:state.accounts.filter(a=>a.id!=='cash')};
 assert.equal(I.plan(p,unresolved).action,'review');
}
{
 const M=require('../../main/assets/js/bank-message-core');
 const e={title:'BanK-AlAhly',postedAt:1764672720000,text:'تم إضافة تحويل لحظي لحسابكم المنتهي ب 7771 بمبلغ 650.00 ج.م يوم 01/12/2025 الساعة 10:52. الرقم المرجعي SYNTH1234'};
 const p=M.parse(e);assert.equal(p.transactionDate,'2025-12-01','Egypt bank day/month contract must extract a valid explicit date');assert.notEqual(p.reviewReason,'invalid-operation-date');
 assert.equal(M.parse({...e,text:e.text.replace('01/12/2025','31/02/2025')}).reviewReason,'invalid-operation-date');
}
{
 const M=require('../../main/assets/js/bank-message-core'),I=require('../../main/assets/js/bank-ingestion-core');
 for(const merchant of ['E AND MONEY,Abu Dhabi','e& money,Dubai','du Pay']){
  const p=M.parse({id:'wallet-merchant-'+merchant,title:'EmiratesNBD',postedAt:1791010000000,text:`تمت عملية شراء في AED 63.25 ${merchant} على البطاقة 8234 الائتمان المتوفر AED 1000.00`});
  assert.equal(p.reviewReason,'wallet-funding-purpose-unconfirmed','card acquisition wording does not prove consumption');
  assert.equal(I.plan(p,{institutions:[],accounts:[],paymentInstruments:[],transactions:[]}).action,'review');
 }
 const ordinary=M.parse({title:'EmiratesNBD',text:'تمت عملية شراء في AED 63.25 DU Google Payment,Dubai على البطاقة 8234 الائتمان المتوفر AED 1000.00'});assert.equal(ordinary.kind,'purchase');assert.equal(ordinary.reviewReason,undefined);
}
