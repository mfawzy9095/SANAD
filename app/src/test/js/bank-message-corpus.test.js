'use strict';
const assert=require('assert');
const P=require('../../main/assets/js/bank-message-core.js');

const recognized=[
  ['enbd-credit-grocery','تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36','purchase',13.50,'4021','credit_card','grocery'],
  ['enbd-transfer','عميلنا العزيز Mohamed Abdelrahman Fawzy، تم خصم AED 160.00 من حسابك 1801 لتحويل الأموال من خلال الخدمات المصرفية عبر الإنترنت.','outgoing_transfer',160,null,null,'externalTransfer'],
  ['enbd-credit-adidas','تمت عملية شراء في AED 180.00 ADIDAS,SHARJAH على البطاقة 4021 الائتمان المتوفر AED3,991.36','purchase',180,'4021','credit_card','shopping'],
  ['enbd-deposit','لقد تم ايداع AED 149.00 في رقم حسابك  012XXX50XXX01 OBP  TR REF EPHCOO2700ATPAUJ 7JL1Z6OIIWYH19CN6X5B.الرصيد المتوفر هو AED 161.52','deposit',149,null,null,'other'],
  ['enbd-salary','تم ايداع الراتب AED 9,000.00 في  حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66','salary',9000,null,null,'salary'],
  ['enbd-repayment-4021','تم خصم مبلغ AED 684.19 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021.','card_repayment',684.19,'4021',null,'other'],
  ['enbd-repayment-0308','تم خصم مبلغ AED 1,650.00 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية0308.','card_repayment',1650,'0308',null,'other'],
  ['enbd-debit-nmc','تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.','purchase',5.10,'3993','debit_card','health'],
  ['enbd-debit-tap','لقد تمّ تحويل مبلغ 100.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*Mohamed Abdelrahm. رصيدك الحالي هو AED 123.83.','purchase',100,'3993','debit_card','other'],
  ['ei-0308-mini-mart','عملية دفع ببطاقة الائتمان\nالمنتهية بالرقم: 0308\nلدى: FRESH CRAFT MINI MART, DUBAI\nالمبلغ: AED 2.50\nالتاريخ: 01/10/2026, 06:44\nالحد المتوفر: 457.04 AED','purchase',2.50,'0308','credit_card','grocery'],
  ['ei-0308-taxi','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: CITI TAXI, SHARJAH المبلغ: AED 17.50 التاريخ: 27/09/2026, 23:34 الحد المتوفر: 516.40 AED','purchase',17.50,'0308','credit_card','transport'],
  ['ei-0308-mandi-negative','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: WARSAN MANDI RESTAURAN, SHARJAH المبلغ: AED 39.00 التاريخ: 05/09/2026, 22:51 الحد المتوفر: -608.56 AED','purchase',39,'0308','credit_card','food'],
  ['ei-0308-pharmacy','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: AL THIQAH PHARMACY, SHARJAH المبلغ: AED 32.50 التاريخ: 31/07/2026, 21:07 الحد المتوفر: 55.81 AED','purchase',32.50,'0308','credit_card','health'],
  ['ei-0308-cafe','عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: MISBAH AL MANAKH CAFE, SHARJAH المبلغ: AED 10.50 التاريخ: 04/08/2026, 11:03 الحد المتوفر: 39.81 AED','purchase',10.50,'0308','credit_card','cafe'],
  ['du-person-transfer','Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed and the amount has been credited in the beneficiary account. TID: DIR7BQ7FZ3','outgoing_transfer',149,null,null,'externalTransfer'],
  ['du-wallet-deposit',"Hello Mohamed Abd, You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40, and the transaction ID is: DI24AS0MCM",'deposit',3500,null,null,'other'],
  ['du-card-platinum','Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 318.15 at Platinumlist. Your available balance is now AED 3,182.38 and your transaction ID is DG608YRM2C.','purchase',318.15,'7105','wallet_card','fun'],
  ['du-card-grocery','Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.','purchase',9.75,'7105','wallet_card','grocery'],
  ['du-withdrawal','You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: DG198RKJGT Available balance: AED 10.28','cash_withdrawal',100,null,null,'other'],
  ['du-card-contabo','Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 19.80 at CONTABO* HOLD ONLY. Your available balance is now AED 1.28 and your transaction ID is DF59845VHJ.','purchase',19.80,'7105','wallet_card','bills'],
  ['du-card-talabat','Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 29.01 at Talabat. Your available balance is now AED 21.08 and your transaction ID is DF4583P4L9.','purchase',29.01,'7105','wallet_card','other']
];

for(const [label,text,kind,amount,last4,cardType,cat] of recognized){
  const input={id:label,postedAt:Date.UTC(2026,9,1,10,0),text};
  if(label.startsWith('ei-')) input.title='Emirates Islamic';
  const p=P.parse(input);
  assert.strictEqual(p.recognized,true,label);
  assert.notStrictEqual(p.ignored,true,label);
  assert.strictEqual(p.kind,kind,label);
  assert.strictEqual(p.amount,amount,label);
  if(last4)assert.strictEqual(p.cardLast4,last4,label);
  if(cardType)assert.strictEqual(p.cardType,cardType,label);
  if(cat)assert.strictEqual(p.category,cat,label);
}
const neg=P.parse({title:'Emirates Islamic',text:recognized.find(x=>x[0]==='ei-0308-mandi-negative')[1]});
assert.strictEqual(neg.availableCredit,-608.56);
const sal=P.parse({text:recognized.find(x=>x[0]==='enbd-salary')[1]});
assert.strictEqual(sal.availableBalance,9001.66);
const dep=P.parse({text:recognized.find(x=>x[0]==='enbd-deposit')[1]});
assert.strictEqual(dep.availableBalance,161.52);
const du=P.parse({text:recognized.find(x=>x[0]==='du-card-grocery')[1]});
assert.strictEqual(du.transactionRef,'DG108RVT5U');
assert.strictEqual(du.availableBalance,0.53);

const ignored=[
  ['enbd-approval','يوجد لديك دفعة بطاقة تتطلب موافقتك. الرجاء تسجيل الدخول إلى تطبيق بنك الإمارات دبي الوطني والانتقال إلى قسم الأنشطة للتفويض.','authorization-pending'],
  ['enbd-reward','عميلنا MOHAMED ABDELRAHMAN FAWZY، تم استبدال NOL Payment كعملية 153.00 على بطاقة MC TITANIUM التي تنتهي بـ 4021 بنجاح.','rewards-redemption'],
  ['ei-statement','Credit Card Mini Statement Card Starting: 457828 Statement Date: 10/08/2026 Minimum Amount Due: AED 476.19 Amount to be paid to avoid charges: AED 3,509.97 Due Date: 04/09/2026 Please pay on or before due date to avoid commitment to donate amount.','card-statement'],
  ['ei-payment-ack','نود تأكيد استلام دفعة AED 433.00 عن البطاقة الائتمانية التي تبدأ بالرقم 457828 في تاريخ 15/07/2026. الحد المتوفر هو AED 664.35.','card-payment-ack'],
  ['ei-google-pay','عزيزنا المتعامل، تم تسجيل بطاقتك المنتهية بالرقم 0308 في تطبيق Google Pay. إذا لم تتقدم بهذا الطلب، يرجى الاتصال.','card-status'],
  ['du-declined-blocked','Your transaction of AED 140.33 at WWW.SHEIN.COM on your du Pay Card ending in 7105 was declined due to card blocked.','declined-transaction'],
  ['du-declined-balance','Hello Mohamed Abd, Your transaction of AED 40.53 at Talabat on your du Pay Card ending in 7105 has been declined due to insufficient Balance.','declined-transaction'],
  ['du-otp','0823 is your OTP Code. Please do not share OTP with anyone.','security-code'],
  ['du-suspended','Your du Pay Card ending in 7105 has been suspended from Google Pay.','card-status'],
  ['du-resumed','Your du Pay Card ending in 7105 has been resumed to Merchant.','card-status'],
  ['du-freeze','Hello Mohamed Abd, Your request to freeze the du Pay Card ending in 7105 has been successfully done.','card-status'],
  ['du-reactivated','Hello Mohamed Abd, Your du Pay Card ending in 7105 has been successfully reactivated.','card-status']
];
for(const [label,text,reason] of ignored){
  const p=P.parse({id:label,text});
  assert.strictEqual(p.recognized,false,label);
  assert.strictEqual(p.ignored,true,label);
  assert.strictEqual(p.reason,reason,label);
}

console.log('bank real-message corpus tests: PASS ('+(recognized.length+ignored.length)+' cases)');
