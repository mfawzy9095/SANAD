'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Finance=require('../../main/assets/js/finance-core.js');
const RepairCore=require('../../main/assets/js/schema-repair-core.js');
const SchemaCore=require('../../main/assets/js/schema-core.js');
const StateCore=require('../../main/assets/js/state-core.js');
const Message=require('../../main/assets/js/bank-message-core.js');
// Synthetic legacy fixtures now include source metadata: production never infers it from body.
function fixtureParse(input){
 const e={...input};
 if(!e.title&&!e.sender&&!e.packageName){
  if(/du pay|TID:/i.test(e.text||''))e.sender='duPay';
  else if(/تمت عملية شراء في|تم ايداع الراتب|تم إيداع الراتب|تم خصم(?: مبلغ)?|تم تحويل مبلغ|تمت عملية شراء بقيمة|لقد تم.*(?:تحويل|ايداع)|تم ايداع AED/.test(e.text||''))e.sender='EmiratesNBD';
 }
 return Message.parse(e);
}
const Ingest=require('../../main/assets/js/bank-ingestion-core.js');

const ACCOUNT_TYPES=[
  {id:'bank',asset:true},{id:'cash',asset:true},{id:'ewallet',asset:true},
  {id:'prepaid',asset:true},{id:'credit',asset:false},{id:'debt',asset:false},{id:'other',asset:true}
];
const INSTRUMENT_TYPES=[
  {id:'debit_card'},{id:'credit_card'},{id:'prepaid_card'},{id:'wallet_card'}
];
const SUPPORTED_TX_TYPES=['expense','income','transfer','external_transfer','adjustment'];
const CURRENCIES={EGP:{},AED:{},USD:{},EUR:{},SAR:{},MAD:{},GBP:{}};
const COUNTRIES={UAE:{},EGY:{},MAR:{},OTHER:{}};
const DEFAULT_CATS={
  expense:[
    {id:'food',n:'طعام',i:'🍔',c:'#f97316'},
    {id:'transport',n:'مواصلات',i:'🚗',c:'#38bdf8'},
    {id:'bills',n:'فواتير',i:'🧾',c:'#a78bfa'},
    {id:'shopping',n:'تسوق',i:'🛍️',c:'#f472b6'},
    {id:'health',n:'صحة',i:'💊',c:'#34d399'},
    {id:'fun',n:'ترفيه',i:'🎮',c:'#fbbf24'},
    {id:'home',n:'منزل',i:'🏠',c:'#fb7185'},
    {id:'cafe',n:'مقهى',i:'☕',c:'#a16207'},
    {id:'grocery',n:'بقالة',i:'🛒',c:'#65a30d'},
    {id:'transferFee',n:'رسوم تحويل',i:'🏦',c:'#E65100'},
    {id:'externalTransfer',n:'تحويل لشخص',i:'👤',c:'#D32F2F'},
    {id:'debtInterest',n:'فوائد',i:'📈',c:'#C62828'},
    {id:'other',n:'أخرى',i:'📌',c:'#94a3b8'}
  ],
  income:[{id:'salary',n:'راتب',i:'💰',c:'#22c55e'},{id:'other',n:'أخرى',i:'📌',c:'#94a3b8'}]
};
const deepClone=v=>JSON.parse(JSON.stringify(v));
const accountTypeInfo=id=>ACCOUNT_TYPES.find(x=>x.id===id)||ACCOUNT_TYPES[ACCOUNT_TYPES.length-1];
const isAssetAccount=a=>!!(a&&accountTypeInfo(a.type).asset===true);
const isFiniteNumberLike=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const repair=RepairCore.createSchemaRepairCore({financeCore:Finance,now:()=>Date.UTC(2026,9,1)});
const Schema=SchemaCore.createSchema({
  schemaVersion:16,deepClone,defaultCats:DEFAULT_CATS,currencies:CURRENCIES,countries:COUNTRIES,
  accountTypes:ACCOUNT_TYPES,instrumentTypes:INSTRUMENT_TYPES,supportedTxTypes:SUPPORTED_TX_TYPES,
  accountTypeInfo,isAssetAccount,isFiniteNumberLike,isValidIsoDate:StateCore.isValidIsoDate,
  isoToday:()=> '2026-10-01',schemaRepair:repair
});

let seq=0;
const uid=p=>String(p||'id')+'_'+(++seq);
function empty(){
  return Schema.migrate({
    schemaVersion:16,institutions:[],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[],
    categories:deepClone(DEFAULT_CATS),tags:[],recurring:[],settings:{}
  });
}
function strictOk(state,label){
  assert.deepStrictEqual(Schema.validateStateStrict(state),[],label);
}
function process(text,input,state){
  const parsed=fixtureParse(Object.assign({postedAt:Date.UTC(2026,9,1,10,0),text},input||{}));
  assert.strictEqual(parsed.recognized,true,'parse failed');
  const plan=Ingest.plan(parsed,state,{uid});
  assert.strictEqual(plan.action,'auto-save','not auto-save: '+plan.reason);
  assert.strictEqual(Ingest.applyPlan(state,plan),true);
  strictOk(state,'strict validation after ingest');
  return {parsed,plan};
}

(function duPayPurchaseAutoDiscoveryBalancesExactly(){
  const s=empty();
  const {plan}=process(
    'Hello Test User, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.',
    {id:'du-purchase'},s
  );
  assert.strictEqual(s.institutions.length,1);
  assert.strictEqual(s.institutions[0].providerRegistryId,'du-pay');
  assert.strictEqual(s.accounts.length,1);
  assert.strictEqual(s.accounts[0].type,'ewallet');
  assert.strictEqual(s.paymentInstruments.length,1);
  assert.strictEqual(s.paymentInstruments[0].type,'wallet_card');
  assert.strictEqual(s.paymentInstruments[0].last4,'7105');
  assert.strictEqual(s.transactions.length,1);
  assert.strictEqual(s.transactions[0].cat,'grocery');
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),null);
  assert.strictEqual(Finance.accountMovement(s,s.accounts[0].id),-9.75);
  assert.strictEqual(Finance.accountBalancePresentation(s,s.accounts[0].id).observed,0.53);
  const rec=Ingest.reconciliation(plan.transaction?fixtureParse({id:'du-purchase',postedAt:Date.UTC(2026,9,1,10,0),text:'Hello Test User, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.'}):null,s,plan,(st,id)=>Finance.accountBalance(st,id));
  assert.strictEqual(rec,null);
})();

(function enbdSalaryAutoCreatesExactOpeningBaseline(){
  const s=empty();
  process(
    'تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66',
    {id:'salary'},s
  );
  assert.strictEqual(s.accounts.length,1);
  assert.strictEqual(s.accounts[0].type,'bank');
  assert.deepStrictEqual(s.accounts[0].bankRefs,['012XXX50XXX01']);
  assert.strictEqual(s.accounts[0].openingBalance,0);
  assert.strictEqual(s.transactions[0].type,'income');
  assert.strictEqual(s.transactions[0].cat,'salary');
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),null);
  assert.strictEqual(Finance.accountMovement(s,s.accounts[0].id),9000);
  assert.strictEqual(Finance.accountBalancePresentation(s,s.accounts[0].id).observed,9001.66);
})();

(function enbdDebitPurchaseDiscoversBankAndCard(){
  const s=empty();
  process(
    'تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 2,684.31.',
    {id:'debit'},s
  );
  assert.strictEqual(s.accounts.length,1);
  assert.strictEqual(s.accounts[0].type,'bank');
  assert.strictEqual(s.paymentInstruments[0].type,'debit_card');
  assert.strictEqual(s.paymentInstruments[0].last4,'3993');
  assert.strictEqual(s.transactions[0].cat,'health');
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),null);
  assert.strictEqual(Finance.accountMovement(s,s.accounts[0].id),-5.1);
  assert.strictEqual(Finance.accountBalancePresentation(s,s.accounts[0].id).observed,2684.31);
})();

(function arabicCreditDiscoveryIsStrictButDoesNotInventLimit(){
  const s=empty();
  process(
    'عملية دفع ببطاقة الائتمان\nالمنتهية بالرقم: 0308\nلدى: FRESH CRAFT MINI MART, DUBAI\nالمبلغ: AED 2.50\nالتاريخ: 01/10/2026, 06:44\nالحد المتوفر: 457.04 AED',
    {id:'credit',title:'Emirates Islamic'},s
  );
  const a=s.accounts[0];
  assert.strictEqual(a.type,'credit');
  assert.strictEqual(a.creditLimit,0);
  assert.strictEqual(a.baselinePartial,true);
  assert.strictEqual(a.observedAvailableCredit,457.04);
  assert.strictEqual(Finance.accountDebt(s,a.id),null);assert.strictEqual(Finance.accountMovement(s,a.id),-2.5);
})();

(function withdrawalBecomesInternalTransferWhenUniqueCashExists(){
  const s=empty();
  s.institutions.push({id:'dui',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'});
  s.accounts.push(
    {id:'wallet',institutionId:'dui',country:'UAE',name:'du Pay Wallet',type:'ewallet',currency:'AED',openingBalance:110.28,openingDebt:0,creditLimit:0,archived:false},
    {id:'cash',institutionId:null,country:'UAE',name:'Cash',type:'cash',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  );
  strictOk(s,'pre withdrawal');
  process(
    'You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: DG198RKJGT Available balance: AED 10.28',
    {id:'withdraw'},s
  );
  const t=s.transactions[0];
  assert.strictEqual(t.type,'transfer');
  assert.strictEqual(t.fromAccountId,'wallet');
  assert.strictEqual(t.toAccountId,'cash');
  assert.strictEqual(Finance.accountBalance(s,'wallet'),10.28);
  assert.strictEqual(Finance.accountBalance(s,'cash'),100);
})();

(function duPayPersonTransferCreatesBeneficiaryAndValidLedger(){
  const s=empty();
  s.institutions.push({id:'dui2',name:'du Pay',country:'UAE',type:'wallet_provider',providerRegistryId:'du-pay'});
  s.accounts.push({id:'wallet2',institutionId:'dui2',country:'UAE',name:'du Pay Wallet',type:'ewallet',currency:'AED',openingBalance:500,openingDebt:0,creditLimit:0,archived:false});
  strictOk(s,'pre person transfer');
  const p=fixtureParse({id:'person-ledger',postedAt:Date.UTC(2026,9,1),text:'Your request to transfer AED 149.00 to Test User Name is successfully processed and the amount has been credited in the beneficiary account. TID: PERSONLEDGER1'});
  assert.strictEqual(Ingest.plan(p,s,{uid}).reason,'outgoing-destination-unconfirmed');
  const built=Message.buildTransaction(p,Ingest.routeFromManualChoice(p,s,{sourceType:'account',sourceId:'wallet2'}),{uid,confirmedOutgoingDestination:'external'});assert.strictEqual(built.ok,true);
  s.transactions.push(built.transaction);strictOk(s,'explicit external destination');
  assert.strictEqual(s.beneficiaries.length,0);
  assert.strictEqual(s.transactions[0].type,'external_transfer');
  assert.strictEqual(s.transactions[0].economicOrigin.kind,'external-destination');
  assert.strictEqual(Finance.accountBalance(s,'wallet2'),351);
})();

(function refundToKnownCreditCardReducesDebt(){
  const s=empty();
  s.institutions.push({id:'nbd-ref',name:'Emirates NBD',country:'UAE',type:'bank',bankRegistryId:'emirates-nbd'});
  s.accounts.push(
    {id:'bank-ref',institutionId:'nbd-ref',country:'UAE',name:'Bank',type:'bank',currency:'AED',openingBalance:1000,openingDebt:0,creditLimit:0,archived:false},
    {id:'credit-ref',institutionId:'nbd-ref',country:'UAE',name:'Credit',type:'credit',currency:'AED',openingBalance:0,openingDebt:100,creditLimit:5000,archived:false}
  );
  s.paymentInstruments.push({id:'card-ref',accountId:'credit-ref',institutionId:'nbd-ref',country:'UAE',type:'credit_card',last4:'4021',archived:false});
  strictOk(s,'pre refund');
  const parsed=fixtureParse({id:'refund1',postedAt:Date.UTC(2026,9,1,12,0),title:'Emirates NBD',text:'Refund AED 25.00 to credit card 4021'});
  assert.strictEqual(parsed.kind,'refund');
  const plan=Ingest.plan(parsed,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.accountId,'credit-ref');
  Ingest.applyPlan(s,plan);
  strictOk(s,'post refund');
  assert.strictEqual(Finance.accountDebt(s,'credit-ref'),75);
})();

(function customWalletEnteredByUserRoutesGenericDeposit(){
  const s=empty();
  s.institutions.push({id:'acme',name:'Acme Wallet',country:'UAE',type:'wallet_provider'});
  s.accounts.push({id:'acme-wallet',institutionId:'acme',country:'UAE',name:'Acme Wallet',type:'ewallet',currency:'AED',openingBalance:75,openingDebt:0,creditLimit:0,archived:false});
  strictOk(s,'custom wallet before ingest');
  const parsed=fixtureParse({postedAt:Date.UTC(2026,9,1,10,0),text:'Your account was credited AED 50.00. Available balance is AED 125.00',id:'acme-dep',title:'Acme Wallet'});
  assert.strictEqual(Ingest.plan(parsed,s).reason,'incoming-origin-unconfirmed');
  const built=Message.buildTransaction(parsed,Ingest.routeFromManualChoice(parsed,s,{sourceType:'account',sourceId:'acme-wallet'}),{uid,confirmedIncomingOrigin:'external-income'});
  assert.strictEqual(built.ok,true);s.transactions.push(built.transaction);strictOk(s,'confirmed external income');
  assert.strictEqual(s.transactions.length,1);
  assert.strictEqual(s.transactions[0].accountId,'acme-wallet');
  assert.strictEqual(Finance.accountBalance(s,'acme-wallet'),125);
})();

(function customDebitCardAutoDiscoveryKeepsObservedBalance(){
  const s=empty();
  s.institutions.push({id:'acme-bank',name:'Acme Bank',country:'UAE',type:'bank'});
  strictOk(s,'custom debit before ingest');
  process('Purchase AED 10.00 at TEST STORE using debit card ending 7777. Available balance is AED 90.00',{id:'acme-debit',title:'Acme Bank'},s);
  assert.strictEqual(s.accounts.length,1);
  assert.strictEqual(s.accounts[0].type,'bank');
  assert.strictEqual(s.accounts[0].openingBalance,0);
  assert.strictEqual(s.paymentInstruments[0].type,'debit_card');
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),null);
  assert.strictEqual(Finance.accountMovement(s,s.accounts[0].id),-10);
  assert.strictEqual(Finance.accountBalancePresentation(s,s.accounts[0].id).observed,90);
})();

(function transactionReferencePreventsDuplicate(){
  const s=empty();
  const text="Hello Test User, You've received AED 9.00 to your du Pay wallet. Your available balance is now AED 110.28, and the transaction ID is: DG148RKIXI";
  s.institutions.push({id:'du-inst',providerRegistryId:'du-pay',type:'wallet_provider',name:'du Pay',country:'UAE'});
  s.accounts.push({id:'du-wallet',institutionId:'du-inst',type:'ewallet',country:'UAE',currency:'AED',name:'du Pay',openingBalance:101.28,openingDebt:0,creditLimit:0,archived:false});
  const parsed=fixtureParse({text,id:'dep1',postedAt:Date.UTC(2026,9,1,10,0)});
  assert.strictEqual(Ingest.plan(parsed,s).reason,'incoming-origin-unconfirmed');
  const built=Message.buildTransaction(parsed,Message.resolveRoute(parsed,s),{uid,confirmedIncomingOrigin:'external-income'});
  assert.strictEqual(built.ok,true);s.transactions.push(built.transaction);strictOk(s,'manual confirmed income');
  assert.strictEqual(Finance.accountBalance(s,'du-wallet'),110.28);
  const first={plan:{transaction:built.transaction}};
  const parsedAgain=fixtureParse({id:'dep2',postedAt:Date.UTC(2026,9,1,10,1),text});
  const second=Ingest.plan(parsedAgain,s,{uid});
  assert.strictEqual(second.action,'duplicate');
  assert.strictEqual(second.existingTransactionId,first.plan.transaction.id);
  assert.strictEqual(s.transactions.length,1);
})();


(function creditCardEditorUsesItsOwnRegistrySelection(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(html.includes("bankRegistryPickerHtml(cardSelectedBankRegistryId,'cardBankRegistry')"),'credit card editor must use cardSelectedBankRegistryId');
  assert.ok(!html.includes("bankRegistryPickerHtml(selectedBankRegistryId,'cardBankRegistry')"),'credit card editor must not reference the account-editor variable');
})();


(function walletCardsRemainVisibleAndEditable(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(
    html.includes("i.type === 'credit_card' || i.type === 'debit_card' || i.type === 'prepaid_card' || i.type === 'wallet_card'"),
    'accounts view must include wallet_card instruments'
  );
})();


(function accountTilesPreferCurrentReportedBalance(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(html.includes('accountBalancePresentation(accountId){ return FinanceCore.accountBalancePresentation(S, accountId); }'),'finance facade must expose reported balance presentation');
  assert.ok(html.includes('const balanceView = !isLiab ? Finance.accountBalancePresentation(a.id) : null;'),'account tiles must consume reported balance presentation');
  assert.ok(html.includes('const balanceView = !isCredit ? Finance.accountBalancePresentation(acc.id) : null;'),'card tiles must consume linked account reported balance presentation');
  assert.ok(html.includes('الرصيد المحسوب في SANAD'),'mismatched reported balance must be explained in the UI');
})();


(function merchantFieldSurvivesUiLifecycle(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(html.includes('id="merchantIn"'),'transaction editor must expose a merchant field');
  assert.ok(html.includes("merchantName: t.merchantName || ''"),'transaction edit must preserve merchantName');
  assert.ok(html.includes("merchantName: (f.merchantName || '').trim()"),'transaction save must persist merchantName');
  assert.ok(html.includes("(t.merchantName||'').toLowerCase().includes(q)"),'transaction search must include merchantName');
  assert.ok(html.includes("rows.push(['التاجر', t.merchantName])"),'transaction details must show merchantName');
})();


(function homeHeroPrefersCurrentReportedBalance(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(
    html.includes('const heroBalanceView = !isLiabilityAccount(defaultAcc) ? Finance.accountBalancePresentation(defaultAcc.id) : null;'),
    'home hero must inspect the latest reported balance for asset accounts'
  );
  assert.ok(
    html.includes('const bal = heroBalanceView ? heroBalanceView.display : Finance.accountBalance(defaultAcc.id);'),
    'home hero must display a current bank/wallet observation when it is newer'
  );
})();


(function quickAmountRevealRequiresDeviceAuthAndResets(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(html.includes('let sessionAmountsRevealed=false;'),'quick reveal must be session-only');
  assert.ok(html.includes('function amountsMasked(){return !!(S.settings.hideAmounts&&!sessionAmountsRevealed);}'),'persistent hideAmounts must remain the source of truth');
  assert.ok(html.includes('data-sanad-act="amount-visibility"'),'home hero must expose the quick privacy eye');
  assert.ok(html.includes("const ok=await SanadSecurity.authorize(SanadI18n.lang==='en'?'Reveal amounts':'إظهار المبالغ');"),'revealing hidden amounts must require device authentication');
  assert.ok(html.includes("if(a==='amount-visibility')return SanadAmountPrivacy.toggle();"),'privacy eye must be wired to the authenticated toggle');
  assert.ok(html.includes('window.sanadAppBackgrounded=function(ts){try{SanadAmountPrivacy.onBackground();}catch(_){}'), 'backgrounding must revoke the temporary reveal');
})();


(function accountCardsUseInstitutionLogos(){
  const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
  assert.ok(html.includes('function institutionLogoHtml(inst,size=34,fallbackIcon='),'accounts need a shared institution-logo renderer');
  assert.ok(html.includes('institutionLogoHtml(inst,32,defaultAcc.icon)'),'home hero must use the bank/wallet logo');
  assert.ok(html.includes('institutionLogoHtml(inst,32,a.icon)'),'account tiles must use the bank/wallet logo');
  assert.ok(html.includes('institutionLogoHtml(cardInstitution,32,inst.icon || tInfo.icon)'),'card tiles must use their institution logo');
})();

console.log('bank ingestion schema integration tests: PASS');

(function manuallyConfirmedFeesKeepSchema16MoneyInvariant(){
 const s=empty();
 process('Hello Test User, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 90.25 and your transaction ID is VALIDATION1. Fee AED 0.00, VAT AED 0.00.',{id:'fee-setup'},s);
 const parsed=fixtureParse({id:'fee-confirmed',title:'duPay',postedAt:Date.UTC(2026,9,1,11),text:'Hello Test User, Your du Pay Card ending in 7105 has been used for AED 10.00 at TEST STORE. Your available balance is now AED 78.15 and your transaction ID is VALIDATION2. Fee AED 2.00, VAT AED 0.10.'});
 const route=Ingest.routeFromManualChoice(parsed,s,{sourceType:'instrument',sourceId:s.paymentInstruments[0].id});
 assert.strictEqual(Message.buildTransaction(parsed,route,{uid}).reason,'fee-confirmation-required');
 const built=Message.buildTransaction(parsed,route,{uid,confirmedFee:2.1});assert.strictEqual(built.ok,true,JSON.stringify({built,parsed,route}));
 s.transactions.push(built.transaction);strictOk(s,'gross confirmed fee follows same-currency amount invariant');
 assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),null);
  assert.strictEqual(Finance.accountMovement(s,s.accounts[0].id),-21.85);
  assert.strictEqual(Finance.accountBalancePresentation(s,s.accounts[0].id).observed,90.25);
})();
