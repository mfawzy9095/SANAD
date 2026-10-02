'use strict';
const assert=require('assert');
const I=require('../../main/assets/js/bank-ingestion-core.js');
const P=require('../../main/assets/js/bank-message-core.js');

let seq=0;const uid=p=>p+(++seq);
const empty=()=>({institutions:[],accounts:[],paymentInstruments:[],transactions:[]});

// Existing exact credit card routes and auto-saves.
{
  const p=P.parse({id:'n1',postedAt:1000,text:'تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36'});
  p.cardType='credit_card';
  const s={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[{id:'a1',institutionId:'i1',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:5000,archived:false}],paymentInstruments:[{id:'c1',accountId:'a1',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false}],transactions:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.reason,'exact-route');
  assert.strictEqual(plan.transaction.accountId,'a1');
}

// Any already-registered card can auto-route by exact last4 even without a bank adapter.
{
  const p=P.parse({id:'generic1',postedAt:1500,text:'Purchase AED 20.00 at FRESH CRAFT MINI MART on your card ending 9999'});
  assert.strictEqual(p.confidence,0.72);
  assert.strictEqual(p.category,'grocery');
  const s={institutions:[{id:'custom',name:'My Bank',country:'UAE'}],accounts:[{id:'a9999',institutionId:'custom',country:'UAE',name:'My card',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false}],paymentInstruments:[{id:'c9999',accountId:'a9999',institutionId:'custom',country:'UAE',type:'credit_card',last4:'9999',archived:false}],transactions:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.reason,'exact-route');
  assert.strictEqual(plan.transaction.instrumentId,'c9999');
}

// New credit card can be discovered without inventing a credit limit.
{
  const p=P.parse({id:'n2',postedAt:2000,title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: FRESH CRAFT MINI MART, DUBAI المبلغ: AED 2.50 التاريخ: 01/10/2026, 06:44 الحد المتوفر: 457.04 AED'});
  p.cardType='credit_card';
  const s=empty();
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.reason,'safe-auto-discovery');
  assert.strictEqual(plan.create.institutions[0].bankRegistryId,'emirates-islamic');
  assert.strictEqual(plan.create.accounts[0].type,'credit');
  assert.strictEqual(plan.create.accounts[0].creditLimit,0);
  assert.strictEqual(plan.create.accounts[0].observedAvailableCredit,457.04);
  assert.strictEqual(plan.create.instruments[0].type,'credit_card');
  assert.strictEqual(plan.create.instruments[0].last4,'0308');
}


// A new debit card on a known bank account creates only the missing instrument.
{
  const p=P.parse({id:'n3',postedAt:2500,text:'تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.'});
  const s={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[{id:'bank1',institutionId:'i1',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:2689.41,openingDebt:0,creditLimit:0,archived:false}],paymentInstruments:[],transactions:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts.length,0);
  assert.strictEqual(plan.create.instruments.length,1);
  assert.strictEqual(plan.create.instruments[0].accountId,'bank1');
  assert.strictEqual(plan.create.instruments[0].type,'debit_card');
}

// du Pay purchase creates an ewallet + wallet_card using the observed post-transaction balance.
{
  const p=P.parse({id:'d1',postedAt:3000,text:'Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.'});
  p.cardType='wallet_card';
  const s=empty();
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.institutions[0].providerRegistryId,'du-pay');
  assert.strictEqual(plan.create.accounts[0].type,'ewallet');
  assert.strictEqual(plan.create.accounts[0].openingBalance,10.28);
  assert.strictEqual(plan.create.instruments[0].type,'wallet_card');
  I.applyPlan(s,plan);
  assert.strictEqual(s.transactions.length,1);
  assert.strictEqual(s.accounts[0].observedBalance,0.53);
}

// du Pay deposit creates a wallet baseline so the resulting ledger equals the bank-reported balance.
{
  const p=P.parse({id:'d2',postedAt:4000,text:"Hello Mohamed Abd, You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40, and the transaction ID is: DI24AS0MCM"});
  const s=empty();
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts[0].openingBalance,0.40);
}

// A new outgoing transfer with no observed balance is not allowed to invent a source balance.
{
  const p=P.parse({id:'d3',postedAt:5000,text:'Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed and the amount has been credited in the beneficiary account. TID: DIR7BQ7FZ3'});
  const plan=I.plan(p,empty(),{uid});
  assert.strictEqual(plan.action,'review');
  assert.strictEqual(plan.reason,'transfer-source-not-found');
}

// An exact account reference can safely route a generic credit/deposit message.
{
  const p=P.parse({id:'generic2',postedAt:5500,text:'Your account 1234 was credited AED 50.00'});
  assert.strictEqual(p.kind,'deposit');
  const s={institutions:[{id:'custom2',name:'Another Bank',country:'UAE'}],accounts:[{id:'bank1234',institutionId:'custom2',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,bankRefs:['1234'],archived:false}],paymentInstruments:[],transactions:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.accountId,'bank1234');
}

// Unknown source cannot auto-create a financial account/card.
{
  const p={recognized:true,confidence:0.99,kind:'purchase',direction:'debit',amount:20,currency:'AED',cardLast4:'9999',cardType:'credit_card',postedAt:6000,eventId:'x'};
  const plan=I.plan(p,empty(),{uid});
  assert.strictEqual(plan.action,'review');
  assert.strictEqual(plan.reason,'source-not-identified');
}

// Dedupe on transaction reference is deterministic.
{
  const p=P.parse({id:'d4',postedAt:7000,text:"Hello Mohamed Abd, You've received AED 9.00 to your du Pay wallet. Your available balance is now AED 110.28, and the transaction ID is: DG148RKIXI"});
  const s=empty();
  s.transactions.push({id:'old',bankTransactionRef:'DG148RKIXI'});
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'duplicate');
  assert.strictEqual(plan.existingTransactionId,'old');
}

// Multiple same-bank asset accounts without an exact account/card match must never auto-create/link a new debit card.
{
  const p=P.parse({id:'amb1',postedAt:8000,text:'تمت عملية شراء بقيمة AED 5.10 لدى TEST SHOP باستخدام بطاقة خصم تنتهي أرقامها بـ 5555. الرصيد المتوفر هو AED 100.00.'});
  const s={institutions:[{id:'nbd',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'a1',institutionId:'nbd',country:'UAE',name:'A1',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false},
    {id:'a2',institutionId:'nbd',country:'UAE',name:'A2',type:'bank',currency:'AED',openingBalance:200,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[],transactions:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'review');
  assert.strictEqual(plan.reason,'ambiguous-existing-accounts');
}

// User category choices become a local merchant rule for later auto-imports.
{
  const p=P.parse({id:'learn1',postedAt:8100,text:'تمت عملية شراء في AED 12.00 MY SPECIAL SHOP على البطاقة 4021 الائتمان المتوفر AED4,000.00'});
  const s={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'credit',institutionId:'i1',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:5000,archived:false}
  ],paymentInstruments:[{id:'c4021',accountId:'credit',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false}],
  transactions:[{id:'oldcat',type:'expense',accountId:'credit',instrumentId:'c4021',amount:5,walletAmount:5,currency:'AED',fxRate:1,cat:'shopping',note:'MY SPECIAL SHOP',tags:[],date:'2026-09-01',created:1}]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.cat,'shopping');
}

// Named person transfers automatically link/create a beneficiary, without duplicating the same name.
{
  const p=P.parse({id:'person1',postedAt:8200,text:'Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed and the amount has been credited in the beneficiary account. TID: PERSONREF1'});
  const s={institutions:[{id:'dui',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'}],accounts:[
    {id:'w',institutionId:'dui',country:'UAE',name:'du Pay Wallet',type:'ewallet',currency:'AED',openingBalance:500,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.beneficiaries.length,1);
  assert.strictEqual(plan.create.beneficiaries[0].name,'Mohamed Abdelrahman Fawzy');
  assert.strictEqual(plan.transaction.beneficiaryId,plan.create.beneficiaries[0].id);
  I.applyPlan(s,plan);
  assert.strictEqual(s.beneficiaries.length,1);
}

console.log('bank ingestion core regression tests: PASS');
