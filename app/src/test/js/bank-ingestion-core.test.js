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

// Notification queue must be oldest-first before balance baselines are inferred.
{
  const rows=I.sortNotifications([{id:'b',postedAt:300},{id:'a',postedAt:100},{id:'c',postedAt:300}]);
  assert.deepStrictEqual(rows.map(x=>x.id),['a','b','c']);
}

// A custom wallet entered by the user routes a generic deposit by exact notification source name.
{
  const p=P.parse({id:'custom-wallet',postedAt:1800,title:'Acme Wallet',text:'Your account was credited AED 50.00. Available balance is AED 125.00'});
  const s={institutions:[{id:'acme',name:'Acme Wallet',country:'UAE',type:'wallet_provider'}],accounts:[{id:'aw',institutionId:'acme',country:'UAE',name:'Acme Wallet',type:'ewallet',currency:'AED',openingBalance:75,openingDebt:0,creditLimit:0,archived:false}],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.accountId,'aw');
}

// A custom wallet with no account yet can be created from a trusted package/name match plus reported balance.
{
  const p=P.parse({id:'custom-wallet-new',postedAt:1825,packageName:'com.acmewallet.app',text:'Your account was credited AED 50.00. Available balance is AED 125.00'});
  const s={institutions:[{id:'acme-new',name:'Acme Wallet',country:'UAE',type:'wallet_provider'}],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts.length,1);
  assert.strictEqual(plan.create.accounts[0].type,'ewallet');
  assert.strictEqual(plan.create.accounts[0].openingBalance,75);
}

// A custom bank can auto-discover a debit card and reconstruct its balance.
{
  const p=P.parse({id:'custom-debit',postedAt:1835,title:'Acme Bank',text:'Purchase AED 10.00 at TEST STORE using debit card ending 7777. Available balance is AED 90.00'});
  const s={institutions:[{id:'acme-debit-bank',name:'Acme Bank',country:'UAE',type:'bank'}],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts[0].type,'bank');
  assert.strictEqual(plan.create.accounts[0].openingBalance,100);
  assert.strictEqual(plan.create.instruments[0].type,'debit_card');
  assert.strictEqual(plan.create.instruments[0].last4,'7777');
}

// A custom bank entered by the user can auto-discover a new explicitly identified credit card.
{
  const p=P.parse({id:'custom-credit',postedAt:1850,title:'Acme Finance',text:'Purchase AED 20.00 at TEST STORE on your credit card ending 8888. Available credit AED 480.00'});
  const s={institutions:[{id:'acme-bank',name:'Acme Finance',country:'UAE',type:'bank'}],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts[0].type,'credit');
  assert.strictEqual(plan.create.instruments[0].last4,'8888');
  assert.ok(plan.create.accounts[0].name.includes('Acme Finance'));
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



// Historical re-import must never replace a newer reported wallet balance with an older observation.
{
  const s={institutions:[],accounts:[
    {id:'wallet-observed',country:'UAE',name:'Wallet',type:'ewallet',currency:'AED',openingBalance:8.50,observedBalance:0,observedBalanceAt:2000,archived:false}
  ],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const applied=I.applyPlan(s,{
    action:'auto-save',
    create:{institutions:[],accounts:[],instruments:[],beneficiaries:[]},
    transaction:null,
    observations:[{accountId:'wallet-observed',field:'observedBalance',value:8.50,at:1000}]
  });
  assert.strictEqual(applied,true);
  assert.strictEqual(s.accounts[0].observedBalance,0);
  assert.strictEqual(s.accounts[0].observedBalanceAt,2000);
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
  s.transactions.push({id:'old',type:'income',amount:9,currency:'AED',providerId:'du-pay',bankTransactionRef:'DG148RKIXI'});
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'duplicate');
  assert.strictEqual(plan.existingTransactionId,'old');
}

// A second incoming message for the same single known bank account must reuse it, never create a duplicate account.
{
  const s={institutions:[{id:'enbd-i',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd',type:'bank'}],accounts:[
    {id:'enbd-a',institutionId:'enbd-i',country:'UAE',name:'ENBD Account',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const parsed=P.parse({id:'salary-no-ref',postedAt:610000,title:'Emirates NBD',text:'Salary AED 9000.00 has been credited. Available balance AED 9100.00'});
  const plan=I.plan(parsed,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual((plan.create.accounts||[]).length,0);
  assert.strictEqual(plan.transaction.accountId,'enbd-a');
}

// Multiple same-source accounts with no exact ref must stay in review rather than auto-pick or create.
{
  const s={institutions:[{id:'enbd-i',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd',type:'bank'}],accounts:[
    {id:'a1',institutionId:'enbd-i',country:'UAE',name:'A1',type:'bank',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false},
    {id:'a2',institutionId:'enbd-i',country:'UAE',name:'A2',type:'bank',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[],transactions:[],beneficiaries:[]};
  const parsed=P.parse({id:'deposit-amb',postedAt:620000,title:'Emirates NBD',text:'AED 100.00 has been credited. Available balance AED 500.00'});
  const plan=I.plan(parsed,s,{uid});
  assert.strictEqual(plan.action,'review');
  assert.strictEqual(plan.reason,'ambiguous-existing-accounts');
  assert.strictEqual((plan.create.accounts||[]).length,0);
}

// Same transaction arriving once as a notification and once from SMS history must dedupe
// even when the native event ids differ and the message has no transaction reference.
{
  const base=P.parse({id:'notif-1',postedAt:700000,title:'ADCB',text:'Purchase AED 20.00 at TEST STORE using debit card ending 7777. Available balance is AED 80.00'});
  const s={institutions:[{id:'adcb-i',name:'ADCB',country:'UAE',bankRegistryId:'adcb'}],accounts:[
    {id:'adcb-a',institutionId:'adcb-i',country:'UAE',name:'ADCB',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[{id:'adcb-c',accountId:'adcb-a',institutionId:'adcb-i',country:'UAE',type:'debit_card',last4:'7777',archived:false}],transactions:[]};
  const first=I.plan(base,s,{uid});
  assert.strictEqual(first.action,'auto-save');
  I.applyPlan(s,first);
  const fromSms=P.parse({id:'sms-42',postedAt:700050,title:'ADCB',text:'Purchase AED 20.00 at TEST STORE using debit card ending 7777. Available balance is AED 80.00'});
  const duplicate=I.plan(fromSms,s,{uid});
  assert.strictEqual(duplicate.action,'duplicate');
  assert.strictEqual(s.transactions.length,1);
}

// Existing same-source card must never be auto-created a second time if routing is inconsistent.
{
  const p=P.parse({id:'card-conflict',postedAt:750000,title:'Emirates Islamic',text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: TEST STORE المبلغ: AED 2.50 التاريخ: 01/10/2026, 06:44 الحد المتوفر: 457.04 AED'});
  const s={institutions:[
    {id:'ei-old',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'},
    {id:'ei-dup',name:'Emirates Islamic Bank',country:'UAE',bankRegistryId:'emirates-islamic'}
  ],accounts:[{id:'ei-credit',institutionId:'ei-dup',country:'UAE',name:'EI Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}],
  paymentInstruments:[{id:'ei0308',accountId:'ei-credit',institutionId:'ei-dup',country:'UAE',type:'credit_card',last4:'0308',archived:false}],
  transactions:[],beneficiaries:[]};
  // Corrupt the instrument link enough to force discovery rather than exact routing,
  // but keep an equivalent source/card in state. The planner must review, never duplicate.
  s.paymentInstruments[0].accountId='missing-account';
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'review');
  assert.strictEqual(plan.reason,'existing-instrument-conflict');
  assert.strictEqual((plan.create.instruments||[]).length,0);
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

// A manual approval can teach an exact sender/template/card route for future ambiguous messages.
{
  const s={institutions:[
    {id:'i1',name:'Bank One',country:'UAE',type:'bank'},
    {id:'i2',name:'Bank Two',country:'UAE',type:'bank'}
  ],accounts:[
    {id:'a1',institutionId:'i1',country:'UAE',name:'Card One',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false},
    {id:'a2',institutionId:'i2',country:'UAE',name:'Card Two',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false}
  ],paymentInstruments:[
    {id:'c1',accountId:'a1',institutionId:'i1',country:'UAE',type:'credit_card',last4:'1234',archived:false},
    {id:'c2',accountId:'a2',institutionId:'i2',country:'UAE',type:'credit_card',last4:'1234',archived:false}
  ],transactions:[],beneficiaries:[],settings:{}};
  const first=P.parse({id:'learn-route-1',postedAt:800000,title:'MYSTERYBANK',text:'Purchase AED 20.00 at SHOP ONE on your credit card ending 1234'});
  const initial=I.plan(first,s,{uid});
  assert.strictEqual(initial.action,'review');
  const learned=I.learnFromApproval(s,first,{status:'routed',account:s.accounts[0],instrument:s.paymentInstruments[0],confidence:1},{uid,now:900000});
  assert.ok(learned);
  assert.strictEqual(s.settings.bankLearningRules.length,1);
  const next=P.parse({id:'learn-route-2',postedAt:900000,title:'MYSTERYBANK',text:'Purchase AED 35.00 at SHOP TWO on your credit card ending 1234'});
  assert.strictEqual(I.templateSignature(first),I.templateSignature(next));
  const planned=I.plan(next,s,{uid});
  assert.strictEqual(planned.action,'auto-save');
  assert.strictEqual(planned.reason,'learned-rule');
  assert.strictEqual(planned.transaction.accountId,'a1');
  assert.strictEqual(planned.transaction.instrumentId,'c1');
  const otherSender=P.parse({id:'learn-route-3',postedAt:910000,title:'OTHERBANK',text:'Purchase AED 35.00 at SHOP THREE on your credit card ending 1234'});
  assert.strictEqual(I.plan(otherSender,s,{uid}).action,'review');
}

// Learned first4-only rules must never cross-route a different card first4.
{
  const s={institutions:[{id:'ei',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[
    {id:'a4578',institutionId:'ei',country:'UAE',name:'Card 4578',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false},
    {id:'a5123',institutionId:'ei',country:'UAE',name:'Card 5123',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false}
  ],paymentInstruments:[
    {id:'c4578',accountId:'a4578',institutionId:'ei',country:'UAE',type:'credit_card',first4:'4578',last4:'0308',network:'other',archived:false},
    {id:'c5123',accountId:'a5123',institutionId:'ei',country:'UAE',type:'credit_card',first4:'5123',last4:'7105',network:'other',archived:false}
  ],transactions:[],beneficiaries:[],settings:{}};
  const first=P.parse({id:'learn-first4-1',postedAt:920000,title:'Emirates Islamic',text:'Purchase AED 20.00 at SHOP ONE on your credit card starting with 457828'});
  assert.strictEqual(first.cardFirst4,'4578');
  assert.strictEqual(first.cardLast4,null);
  const learned=I.learnFromApproval(s,first,{status:'routed',account:s.accounts[0],instrument:s.paymentInstruments[0],confidence:1},{uid,now:921000});
  assert.ok(learned);
  assert.strictEqual(learned.cardFirst4,'4578');
  const next=P.parse({id:'learn-first4-2',postedAt:930000,title:'Emirates Islamic',text:'Purchase AED 35.00 at SHOP TWO on your credit card starting with 512345'});
  assert.strictEqual(next.cardFirst4,'5123');
  assert.strictEqual(I.templateSignature(first),I.templateSignature(next));
  const planned=I.plan(next,s,{uid});
  assert.ok(planned.action!=='auto-save'||planned.transaction.instrumentId==='c5123');
}

// Manual correction routes are validated before they are allowed to teach the system.
{
  const s={institutions:[{id:'m',name:'Manual Bank',country:'UAE',type:'bank'}],accounts:[
    {id:'bank',institutionId:'m',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:500,openingDebt:0,creditLimit:0,archived:false},
    {id:'credit',institutionId:'m',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false},
    {id:'cash',institutionId:null,country:'UAE',name:'Cash',type:'cash',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[{id:'cc',accountId:'credit',institutionId:'m',country:'UAE',type:'credit_card',last4:'4321',archived:false}],transactions:[],settings:{}};
  const purchase=P.parse({id:'manual-p',postedAt:920000,title:'Manual Bank',text:'Purchase AED 20.00 at TEST on your credit card ending 4321'});
  const pr=I.routeFromManualChoice(purchase,s,{sourceType:'instrument',sourceId:'cc'});
  assert.strictEqual(pr.status,'routed');
  assert.strictEqual(pr.account.id,'credit');
  assert.strictEqual(I.routeFromManualChoice(purchase,s,{sourceType:'account',sourceId:'bank'}).reason,'manual-card-required');

  const withdrawal=Object.assign({},purchase,{kind:'cash_withdrawal',cardLast4:null});
  const wr=I.routeFromManualChoice(withdrawal,s,{sourceType:'account',sourceId:'bank',targetAccountId:'cash'});
  assert.strictEqual(wr.status,'routed');
  assert.strictEqual(wr.targetAccount.id,'cash');

  const repayment=Object.assign({},purchase,{kind:'card_repayment',cardLast4:'4321'});
  const rr=I.routeFromManualChoice(repayment,s,{sourceType:'account',sourceId:'bank',targetAccountId:'credit'});
  assert.strictEqual(rr.status,'routed');
  assert.strictEqual(rr.targetAccount.id,'credit');
}

// Rebinding an account to a different same-country institution must cascade to linked cards even with history.
{
  const s={institutions:[
    {id:'old-i',name:'Old Bank',country:'UAE',type:'bank'},
    {id:'new-i',name:'New Bank',country:'UAE',type:'bank'},
    {id:'eg-i',name:'Egypt Bank',country:'EGY',type:'bank'}
  ],accounts:[{id:'a',institutionId:'old-i',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:0,archived:false}],
  paymentInstruments:[
    {id:'d',accountId:'a',institutionId:'old-i',country:'UAE',type:'debit_card',last4:'1234',archived:false},
    {id:'w',accountId:'a',institutionId:'old-i',country:'UAE',type:'wallet_card',last4:'5678',archived:false}
  ],transactions:[{id:'t',type:'expense',accountId:'a',instrumentId:'d',amount:1,currency:'AED',created:1}],settings:{}};
  const out=I.rebindAccountInstitution(s,'a','new-i');
  assert.strictEqual(out.ok,true);
  assert.strictEqual(out.updatedInstruments,2);
  assert.strictEqual(s.accounts[0].institutionId,'new-i');
  assert.strictEqual(s.paymentInstruments[0].institutionId,'new-i');
  assert.strictEqual(s.paymentInstruments[1].institutionId,'new-i');
  const bad=I.rebindAccountInstitution(s,'a','eg-i');
  assert.strictEqual(bad.ok,false);
  assert.strictEqual(bad.reason,'institution-country-mismatch');
  assert.strictEqual(s.accounts[0].institutionId,'new-i');
}

// Learned bank routes must not survive an explicit institution relink to another bank.
{
  const s={institutions:[
    {id:'enbd',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'},
    {id:'adcb',name:'ADCB',country:'UAE',bankRegistryId:'adcb'}
  ],accounts:[
    {id:'a',institutionId:'enbd',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:0,archived:false,bankRefs:['1234']}
  ],paymentInstruments:[],transactions:[],beneficiaries:[],settings:{}};
  const first=P.parse({id:'learn-bank-relink-1',postedAt:940000,title:'Emirates NBD',text:'AED 100.00 credited to your account 1234. Available balance AED 200.00'});
  assert.strictEqual(first.bankId,'emirates-nbd');
  const learned=I.learnFromApproval(s,first,{status:'routed',account:s.accounts[0],confidence:1},{uid,now:941000});
  assert.ok(learned);
  assert.strictEqual(I.rebindAccountInstitution(s,'a','adcb').ok,true);
  const next=P.parse({id:'learn-bank-relink-2',postedAt:950000,title:'Emirates NBD',text:'AED 50.00 credited to your account 1234. Available balance AED 250.00'});
  const rule=I.matchLearnedRule(next,s);
  assert.ok(rule);
  assert.strictEqual(I.routeFromLearnedRule(next,s,rule),null);
}

// Duplicate bank accounts can be merged into the chosen canonical account without summing duplicate baselines.
{
  const s={institutions:[{id:'enbd1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'},{id:'enbd2',name:'ENBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'dup',institutionId:'enbd1',country:'UAE',name:'Duplicate',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false,bankRefs:['1801'],observedBalance:9100,observedBalanceAt:20},
    {id:'keep',institutionId:'enbd2',country:'UAE',name:'Current',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false,bankRefs:['012XXX50XXX01'],observedBalance:100,observedBalanceAt:10}
  ],paymentInstruments:[{id:'d1',accountId:'dup',institutionId:'enbd1',country:'UAE',type:'debit_card',last4:'3993',archived:false}],transactions:[
    {id:'salary',type:'income',accountId:'dup',amount:9000,walletAmount:9000,currency:'AED',fxRate:1,cat:'salary',note:'Salary',tags:[],date:'2026-10-01',created:1}
  ],recurring:[{id:'rr',type:'expense',accountId:'dup',amount:20,currency:'AED',active:true}],settings:{defaultAccountByCountry:{UAE:'dup'},primaryAccountByCountry:{UAE:'dup'},bankLearningRules:[{id:'lr',accountId:'dup'}]}};
  const out=I.mergeDuplicateAccount(s,'dup','keep');
  assert.strictEqual(out.ok,true);
  assert.strictEqual(s.accounts.length,1);
  assert.strictEqual(s.accounts[0].id,'keep');
  assert.strictEqual(s.accounts[0].openingBalance,100); // do not add duplicate baseline
  assert.deepStrictEqual(s.accounts[0].bankRefs.sort(),['012XXX50XXX01','1801'].sort());
  assert.strictEqual(s.accounts[0].observedBalance,9100);
  assert.strictEqual(s.transactions[0].accountId,'keep');
  assert.strictEqual(s.paymentInstruments[0].accountId,'keep');
  assert.strictEqual(s.recurring[0].accountId,'keep');
  assert.strictEqual(s.settings.defaultAccountByCountry.UAE,'keep');
  assert.strictEqual(s.settings.primaryAccountByCountry.UAE,'keep');
  assert.strictEqual(s.settings.bankLearningRules[0].accountId,'keep');
}

// If the chosen canonical account is empty, it may inherit the duplicate's baseline.
{
  const s={institutions:[{id:'p1',name:'du Pay',country:'UAE',providerRegistryId:'du-pay'}],accounts:[
    {id:'dup',institutionId:'p1',country:'UAE',name:'du Pay old',type:'ewallet',currency:'AED',openingBalance:40,openingDebt:0,creditLimit:0,archived:false},
    {id:'keep',institutionId:'p1',country:'UAE',name:'du Pay',type:'ewallet',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[],transactions:[],recurring:[],settings:{}};
  const out=I.mergeDuplicateAccount(s,'dup','keep');
  assert.strictEqual(out.ok,true);
  assert.strictEqual(s.accounts[0].openingBalance,40);
}

// Never collapse a real transfer between the two accounts into a self-transfer.
{
  const s={institutions:[{id:'b',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'a1',institutionId:'b',country:'UAE',name:'A1',type:'bank',currency:'AED',openingBalance:0,archived:false},
    {id:'a2',institutionId:'b',country:'UAE',name:'A2',type:'bank',currency:'AED',openingBalance:0,archived:false}
  ],paymentInstruments:[],transactions:[{id:'t',type:'transfer',fromAccountId:'a1',toAccountId:'a2',fromAmount:1,toAmount:1,fromCurrency:'AED',toCurrency:'AED'}],recurring:[],settings:{}};
  const out=I.mergeDuplicateAccount(s,'a1','a2');
  assert.strictEqual(out.ok,false);
  assert.strictEqual(out.reason,'direct-transfer-between-duplicates');
  assert.strictEqual(s.accounts.length,2);
}

// Duplicate credit cards can be merged without losing transaction history or learning rules.
{
  const s={institutions:[{id:'ei1',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'},{id:'ei2',name:'Emirates Islamic Bank',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[
    {id:'bad-a',institutionId:'ei1',country:'UAE',name:'Wrong 4578',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false,bankRefs:['4578']},
    {id:'good-a',institutionId:'ei2',country:'UAE',name:'Credit 0308',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[
    {id:'bad-c',accountId:'bad-a',institutionId:'ei1',country:'UAE',type:'credit_card',first4:null,last4:'4578',network:'visa',archived:false},
    {id:'good-c',accountId:'good-a',institutionId:'ei2',country:'UAE',type:'credit_card',first4:'4578',last4:'0308',network:'visa',archived:false}
  ],transactions:[
    {id:'bad-t',type:'expense',accountId:'bad-a',instrumentId:'bad-c',amount:10,walletAmount:10,currency:'AED',fxRate:1,cat:'other',note:'TEST',tags:[],date:'2026-10-01',created:1},
    {id:'repay',type:'transfer',fromAccountId:'src',fromAmount:20,fromCurrency:'AED',fromCountry:'UAE',toAccountId:'bad-a',toAmount:20,toCurrency:'AED',toCountry:'UAE',fxRate:1,fee:0,note:'',tags:[],date:'2026-10-01',created:2}
  ],recurring:[{id:'rr',type:'expense',accountId:'bad-a',instrumentId:'bad-c',amount:5,currency:'AED',active:true}],
  settings:{defaultInstrumentByCountry:{UAE:'bad-c'},bankLearningRules:[{id:'lr',instrumentId:'bad-c',accountId:'bad-a',targetAccountId:'bad-a'}]}};
  const out=I.mergeDuplicateInstrument(s,'bad-c','good-c');
  assert.strictEqual(out.ok,true);
  assert.strictEqual(out.removedAccount,true);
  assert.strictEqual(s.paymentInstruments.length,1);
  assert.strictEqual(s.accounts.some(a=>a.id==='bad-a'),false);
  assert.strictEqual(s.transactions[0].instrumentId,'good-c');
  assert.strictEqual(s.transactions[0].accountId,'good-a');
  assert.strictEqual(s.transactions[1].toAccountId,'good-a');
  assert.strictEqual(s.recurring[0].instrumentId,'good-c');
  assert.strictEqual(s.recurring[0].accountId,'good-a');
  assert.strictEqual(s.settings.defaultInstrumentByCountry.UAE,'good-c');
  assert.strictEqual(s.settings.bankLearningRules[0].instrumentId,'good-c');
  assert.strictEqual(s.settings.bankLearningRules[0].accountId,'good-a');
}

// Fully identified cards with cross-position digits are not duplicates.
{
  const s={institutions:[{id:'b',name:'Bank',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[
    {id:'a1',institutionId:'b',country:'UAE',name:'Card A',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false},
    {id:'a2',institutionId:'b',country:'UAE',name:'Card B',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false}
  ],paymentInstruments:[
    {id:'c1',accountId:'a1',institutionId:'b',country:'UAE',type:'credit_card',first4:'4578',last4:'0308',network:'visa',archived:false},
    {id:'c2',accountId:'a2',institutionId:'b',country:'UAE',type:'credit_card',first4:'9999',last4:'4578',network:'visa',archived:false}
  ],transactions:[],recurring:[],settings:{}};
  const out=I.mergeDuplicateInstrument(s,'c1','c2');
  assert.strictEqual(out.ok,false);
  assert.strictEqual(out.reason,'instrument-identity-mismatch');
  assert.strictEqual(s.paymentInstruments.length,2);
  assert.strictEqual(s.accounts.length,2);
}

// Dedicated credit merge preserves a source baseline when the canonical account is empty.
{
  const s={institutions:[{id:'ei',name:'Emirates Islamic',country:'UAE',bankRegistryId:'emirates-islamic'}],accounts:[
    {id:'bank',institutionId:'ei',country:'UAE',name:'Repayment',type:'bank',currency:'AED',openingBalance:1000,openingDebt:0,creditLimit:0,archived:false},
    {id:'dup-a',institutionId:'ei',country:'UAE',name:'Credit duplicate',type:'credit',currency:'AED',openingBalance:0,openingDebt:120,creditLimit:5000,defaultRepaymentAccountId:'bank',archived:false},
    {id:'keep-a',institutionId:'ei',country:'UAE',name:'Credit keep',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,defaultRepaymentAccountId:null,archived:false}
  ],paymentInstruments:[
    {id:'dup-c',accountId:'dup-a',institutionId:'ei',country:'UAE',type:'credit_card',first4:'4578',last4:'0308',network:'visa',archived:false},
    {id:'keep-c',accountId:'keep-a',institutionId:'ei',country:'UAE',type:'credit_card',first4:'4578',last4:'0308',network:'visa',archived:false}
  ],transactions:[
    {id:'t1',type:'expense',accountId:'dup-a',instrumentId:'dup-c',amount:25,walletAmount:25,currency:'AED',fxRate:1,cat:'other',note:'TEST',tags:[],date:'2026-10-01',created:1}
  ],recurring:[],settings:{}};
  const out=I.mergeDuplicateInstrument(s,'dup-c','keep-c');
  assert.strictEqual(out.ok,true);
  const keep=s.accounts.find(a=>a.id==='keep-a');
  assert.ok(keep);
  assert.strictEqual(keep.openingDebt,120);
  assert.strictEqual(keep.creditLimit,5000);
  assert.strictEqual(keep.defaultRepaymentAccountId,'bank');
  assert.strictEqual(s.accounts.some(a=>a.id==='dup-a'),false);
}

// Shared-balance card merge across different accounts must be rejected.
{
  for(const type of ['debit_card','wallet_card']){
    const accountType=type==='debit_card'?'bank':'ewallet';
    const s={institutions:[{id:'b',name:'Source',country:'UAE',type:accountType==='bank'?'bank':'wallet_provider'}],accounts:[
      {id:'a1',institutionId:'b',country:'UAE',name:'A1',type:accountType,currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false},
      {id:'a2',institutionId:'b',country:'UAE',name:'A2',type:accountType,currency:'AED',openingBalance:200,openingDebt:0,creditLimit:0,archived:false}
    ],paymentInstruments:[
      {id:'c1',accountId:'a1',institutionId:'b',country:'UAE',type,first4:'5123',last4:'7105',network:'mastercard',archived:false},
      {id:'c2',accountId:'a2',institutionId:'b',country:'UAE',type,first4:'5123',last4:'7105',network:'mastercard',archived:false}
    ],transactions:[
      {id:'t1',type:'expense',accountId:'a1',instrumentId:'c1',amount:10,walletAmount:10,currency:'AED',fxRate:1,cat:'other',note:'TEST',tags:[],date:'2026-10-01',created:1}
    ],recurring:[{id:'r1',type:'expense',accountId:'a1',instrumentId:'c1',active:true}],settings:{}};
    const out=I.mergeDuplicateInstrument(s,'c1','c2');
    assert.strictEqual(out.ok,false);
    assert.strictEqual(out.reason,'shared-card-account-mismatch');
    assert.strictEqual(s.paymentInstruments.length,2);
    assert.strictEqual(s.transactions[0].instrumentId,'c1');
    assert.strictEqual(s.transactions[0].accountId,'a1');
    assert.strictEqual(s.recurring[0].instrumentId,'c1');
    assert.strictEqual(s.recurring[0].accountId,'a1');
  }
}

// Dedicated credit and prepaid cards must never use shared-account rebind.
{
  for(const type of ['credit_card','prepaid_card']){
    const accountType=type==='credit_card'?'credit':'prepaid';
    const s={institutions:[{id:'b',name:'Bank',country:'UAE',type:'bank'}],accounts:[
      {id:'dedicated',institutionId:'b',country:'UAE',name:'Dedicated',type:accountType,currency:'AED',openingBalance:0,openingDebt:type==='credit_card'?100:0,creditLimit:type==='credit_card'?1000:0,archived:false},
      {id:'other',institutionId:'b',country:'UAE',name:'Other',type:'bank',currency:'AED',openingBalance:500,openingDebt:0,creditLimit:0,archived:false}
    ],paymentInstruments:[
      {id:'card',accountId:'dedicated',institutionId:'b',country:'UAE',type,first4:'4578',last4:'0308',network:'visa',archived:false}
    ],transactions:[
      {id:'t',type:'expense',accountId:'dedicated',instrumentId:'card',amount:10,walletAmount:10,currency:'AED',fxRate:1,cat:'other',note:'',tags:[],date:'2026-10-01',created:1}
    ],recurring:[],settings:{}};
    const out=I.rebindInstrumentAccount(s,'card','other');
    assert.strictEqual(out.ok,false);
    assert.strictEqual(out.reason,'instrument-rebind-unsupported');
    assert.strictEqual(s.paymentInstruments[0].accountId,'dedicated');
    assert.strictEqual(s.transactions[0].accountId,'dedicated');
  }
}

// A debit card may be relinked after history exists; only that card's own history moves.
{
  const s={institutions:[{id:'b',name:'Bank',country:'UAE',type:'bank'}],accounts:[
    {id:'old',institutionId:'b',country:'UAE',name:'Old',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false},
    {id:'new',institutionId:'b',country:'UAE',name:'New',type:'bank',currency:'AED',openingBalance:200,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[{id:'d1',accountId:'old',institutionId:'b',country:'UAE',type:'debit_card',last4:'1111',archived:false}],
  transactions:[{id:'t1',type:'expense',accountId:'old',instrumentId:'d1',amount:10,walletAmount:10,currency:'AED',fxRate:1,cat:'other',note:'',tags:[],date:'2026-10-01',created:1},
    {id:'t2',type:'expense',accountId:'old',instrumentId:null,amount:5,walletAmount:5,currency:'AED',fxRate:1,cat:'other',note:'',tags:[],date:'2026-10-01',created:2}],
  recurring:[{id:'r1',type:'expense',accountId:'old',instrumentId:'d1',active:true}],settings:{bankLearningRules:[{id:'lr',instrumentId:'d1',accountId:'old'}]}};
  const out=I.rebindInstrumentAccount(s,'d1','new');
  assert.strictEqual(out.ok,true);
  assert.strictEqual(out.movedTransactions,1);
  assert.strictEqual(s.paymentInstruments[0].accountId,'new');
  assert.strictEqual(s.transactions[0].accountId,'new');
  assert.strictEqual(s.transactions[1].accountId,'old');
  assert.strictEqual(s.recurring[0].accountId,'new');
  assert.strictEqual(s.settings.bankLearningRules[0].accountId,'new');
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

// Learned merchant rule overrides a built-in category after the user corrects it.
{
  const p=P.parse({id:'learn2',postedAt:8150,text:'تمت عملية شراء في AED 20.00 UNION COOP,DUBAI على البطاقة 4021 الائتمان المتوفر AED3,980.00'});
  const s={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'credit',institutionId:'i1',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:5000,archived:false}
  ],paymentInstruments:[{id:'c4021',accountId:'credit',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false}],
  transactions:[{id:'oldcat2',type:'expense',accountId:'credit',instrumentId:'c4021',amount:5,walletAmount:5,currency:'AED',fxRate:1,cat:'home',note:'UNION COOP,DUBAI',tags:[],date:'2026-09-01',created:2}]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.cat,'home');
}

// A prior user category correction overrides a later built-in merchant guess.
{
  const p=P.parse({id:'learn2',postedAt:8150,text:'تمت عملية شراء في AED 20.00 UNION COOP,DUBAI على البطاقة 4021 الائتمان المتوفر AED3,980.00'});
  const s={institutions:[{id:'i1',name:'Emirates NBD',country:'UAE',bankRegistryId:'emirates-nbd'}],accounts:[
    {id:'credit',institutionId:'i1',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:5000,archived:false}
  ],paymentInstruments:[{id:'c4021',accountId:'credit',institutionId:'i1',country:'UAE',type:'credit_card',last4:'4021',archived:false}],
  transactions:[{id:'oldcat2',type:'expense',accountId:'credit',instrumentId:'c4021',amount:5,walletAmount:5,currency:'AED',fxRate:1,cat:'home',note:'UNION COOP,DUBAI',tags:[],date:'2026-09-01',created:2}]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.cat,'home');
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

// Registered-bank generic messages can safely auto-discover when transaction + balance + instrument are explicit.
{
  const p=P.parse({id:'adcb-generic',postedAt:8300,title:'ADCB',text:'Purchase AED 10.00 at TEST STORE using debit card ending 7777. Available balance is AED 90.00'});
  const s=empty();
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(p.bankId,'adcb');
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.accounts[0].country,'UAE');
  assert.strictEqual(plan.create.instruments[0].last4,'7777');
}

// Egyptian issuer metadata routes an EGP account into Egypt. Currency alone does not locate a foreign purchase.
{
  const p=P.parse({id:'egy-generic',postedAt:8400,title:'BanK-AlAhly',text:'Purchase EGP 25.00 at TEST STORE using debit card ending 1234. Available balance is EGP 975.00'});
  const s=empty();
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(p.country,'EGY');
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.create.institutions[0].country,'EGY');
  assert.strictEqual(plan.create.accounts[0].country,'EGY');
  assert.strictEqual(plan.create.accounts[0].currency,'EGP');
}

// MAD exact-card traffic stays in Morocco even when another-country accounts exist.
{
  const p=P.parse({id:'mar-card',postedAt:8500,title:'My Morocco Bank',text:'Purchase MAD 20.00 at TEST STORE on your credit card ending 9090'});
  const s={institutions:[{id:'mar-inst',name:'My Morocco Bank',country:'MAR',type:'bank'}],accounts:[
    {id:'mar-credit',institutionId:'mar-inst',country:'MAR',name:'Morocco Credit',type:'credit',currency:'MAD',openingBalance:0,openingDebt:0,creditLimit:1000,archived:false},
    {id:'uae-other',institutionId:null,country:'UAE',name:'UAE',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[{id:'mar9090',accountId:'mar-credit',institutionId:'mar-inst',country:'MAR',type:'credit_card',last4:'9090',archived:false}],transactions:[],beneficiaries:[]};
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(p.country,'MAR');
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.accountId,'mar-credit');
}


// Overlapping historical import windows must stay idempotent even if the same
// SMS is surfaced with a different native queue id and a small timestamp skew.
{
  const text='Purchase AED 20.00 at TEST STORE using debit card ending 7777. Available balance is AED 80.00';
  const base=P.parse({id:'history-30d',postedAt:Date.UTC(2026,9,2,8,0,0),title:'ADCB',text});
  const s={institutions:[{id:'adcb-i2',name:'ADCB',country:'UAE',bankRegistryId:'adcb'}],accounts:[
    {id:'adcb-a2',institutionId:'adcb-i2',country:'UAE',name:'ADCB',type:'bank',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,archived:false}
  ],paymentInstruments:[{id:'adcb-c2',accountId:'adcb-a2',institutionId:'adcb-i2',country:'UAE',type:'debit_card',last4:'7777',archived:false}],transactions:[]};
  const first=I.plan(base,s,{uid});
  assert.strictEqual(first.action,'auto-save');
  I.applyPlan(s,first);
  const overlap=P.parse({id:'history-90d-different-native-id',postedAt:Date.UTC(2026,9,2,8,4,0),title:'ADCB',text});
  assert.strictEqual(I.plan(overlap,s,{uid}).action,'duplicate');
  const legitimateLater=P.parse({id:'later-repeat',postedAt:Date.UTC(2026,9,2,8,20,0),title:'ADCB',text});
  assert.notStrictEqual(I.plan(legitimateLater,s,{uid}).action,'duplicate');
}

console.log('bank ingestion core regression tests: PASS');

// Forensic regression: missing observations are unknown, including explicit null.
{
  const p=P.parse({id:'unknown-observation',postedAt:2000,title:'duPay',text:'Your request to transfer AED 149.00 to Test Recipient is successfully processed and the amount has been credited in the beneficiary account. TID: TESTREF123'});
  assert.strictEqual(p.availableBalance,null);
  assert.strictEqual(I.openingBalanceForObserved(p),null);
  const s=empty();
  s.institutions.push({id:'du',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'});
  s.accounts.push({id:'wallet',institutionId:'du',country:'UAE',type:'ewallet',currency:'AED',openingBalance:200,observedBalance:200,observedBalanceAt:1000});
  const plan=I.plan(p,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.deepStrictEqual(plan.observations,[]);
  I.applyPlan(s,plan);
  assert.strictEqual(s.accounts[0].observedBalance,200);
  assert.strictEqual(I.reconciliation(p,s,plan,()=>51),null);
  assert.strictEqual(I.openingBalanceForObserved({...p,availableBalance:0}),149);
}

// Time proximity alone never suppresses genuine repeated debits or distinct references.
{
  const s=empty();s.institutions.push({id:'source',bankRegistryId:'emirates-nbd',country:'UAE'});
  s.accounts.push({id:'credit',institutionId:'source',type:'credit',country:'UAE',currency:'AED',openingDebt:0});
  s.paymentInstruments.push({id:'card',institutionId:'source',accountId:'credit',last4:'4021',type:'credit_card'});
  const first=P.parse({id:'first',postedAt:1000000,text:'تمت عملية شراء في AED 32.00 TEST CAFE على البطاقة 4021 الائتمان المتوفر AED100.00'});
  I.applyPlan(s,I.plan(first,s,{uid}));
  const second=P.parse({id:'second',postedAt:1060000,text:'تمت عملية شراء في AED 32.00 TEST CAFE على البطاقة 4021 الائتمان المتوفر AED68.00'});
  assert.strictEqual(I.plan(second,s,{uid}).action,'auto-save');
  const replay={...first,eventId:'another-native-id',postedAt:1001900};
  assert.strictEqual(I.plan(replay,s,{uid}).action,'duplicate');
  const a={...first,eventId:'reference-a',transactionRef:'REF-A'};
  const b={...first,eventId:'reference-b',transactionRef:'REF-B',postedAt:1001000};
  s.transactions=[];I.applyPlan(s,I.plan(a,s,{uid}));
  assert.strictEqual(I.plan(b,s,{uid}).action,'auto-save');
}

// Explicit wallet balance messages establish a point-in-time baseline without inventing a transaction.
{
  const s=empty();
  const p=P.parse({id:'balance-only',title:'ET Cash',postedAt:2000000,text:'الرصيد المتاح بمحفظة اتصالات كاش 79.24 ج.م'});
  assert.strictEqual(p.kind,'balance_observation');assert.strictEqual(p.amount,null);
  const pl=I.plan(p,s,{uid});assert.strictEqual(pl.action,'observe');
  assert.strictEqual(I.applyPlan(s,pl),true);assert.strictEqual(s.transactions.length,0);
  assert.strictEqual(s.accounts[0].observedBalance,79.24);assert.strictEqual(s.accounts[0].country,'EGY');
  assert.strictEqual(I.plan(p,s,{uid}).action,'duplicate');
  assert.strictEqual(I.plan({...p,eventId:'older',postedAt:1990000,availableBalance:500},s,{uid}).action,'duplicate');
}

// A validated unique bank-account discovery route must survive final planning.
{
  const s=empty();s.institutions.push({id:'enbd',bankRegistryId:'emirates-nbd',country:'UAE',type:'bank'});
  s.accounts.push({id:'bank',institutionId:'enbd',type:'bank',country:'UAE',currency:'AED',openingBalance:0});
  s.accounts.push({id:'credit',institutionId:'enbd',type:'credit',country:'UAE',currency:'AED',openingDebt:0});
  const p=P.parse({id:'salary-new-ref',title:'EmiratesNBD',postedAt:5000000,text:'تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66'});
  assert.strictEqual(I.plan(p,s,{uid}).action,'auto-save');
  assert.strictEqual(I.plan(p,s,{uid}).transaction.accountId,'bank');
}
