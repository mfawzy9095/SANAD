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
  assert.strictEqual(plan.reason,'existing-source-required');
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

console.log('bank ingestion core regression tests: PASS');
