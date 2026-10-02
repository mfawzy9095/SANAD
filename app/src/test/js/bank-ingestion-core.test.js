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

// Currency decides the country bucket: EGP routes/creates in Egypt, not UAE.
{
  const p=P.parse({id:'egy-generic',postedAt:8400,title:'Banque Misr',text:'Purchase EGP 25.00 at TEST STORE using debit card ending 1234. Available balance is EGP 975.00'});
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

console.log('bank ingestion core regression tests: PASS');
