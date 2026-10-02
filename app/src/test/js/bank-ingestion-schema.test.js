'use strict';

const assert=require('assert');
const Finance=require('../../main/assets/js/finance-core.js');
const RepairCore=require('../../main/assets/js/schema-repair-core.js');
const SchemaCore=require('../../main/assets/js/schema-core.js');
const StateCore=require('../../main/assets/js/state-core.js');
const Message=require('../../main/assets/js/bank-message-core.js');
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
  const parsed=Message.parse(Object.assign({postedAt:Date.UTC(2026,9,1,10,0),text},input||{}));
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
    'Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.',
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
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),0.53);
  const rec=Ingest.reconciliation(plan.transaction?Message.parse({id:'du-purchase',postedAt:Date.UTC(2026,9,1,10,0),text:'Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 9.75 at FRESH CRAFT MINI MART. Your available balance is now AED 0.53 and your transaction ID is DG108RVT5U. Fee AED 0.00, VAT AED 0.00.'}):null,s,plan,(st,id)=>Finance.accountBalance(st,id));
  assert.ok(rec&&rec.matched);
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
  assert.strictEqual(s.accounts[0].openingBalance,1.66);
  assert.strictEqual(s.transactions[0].type,'income');
  assert.strictEqual(s.transactions[0].cat,'salary');
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),9001.66);
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
  assert.strictEqual(Finance.accountBalance(s,s.accounts[0].id),2684.31);
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
  assert.strictEqual(Finance.accountDebt(s,a.id),2.50);
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
  process(
    'Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed and the amount has been credited in the beneficiary account. TID: PERSONLEDGER1',
    {id:'person-ledger'},s
  );
  assert.strictEqual(s.beneficiaries.length,1);
  assert.strictEqual(s.beneficiaries[0].name,'Mohamed Abdelrahman Fawzy');
  assert.strictEqual(s.transactions[0].type,'external_transfer');
  assert.strictEqual(s.transactions[0].beneficiaryId,s.beneficiaries[0].id);
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
  const parsed=Message.parse({id:'refund1',postedAt:Date.UTC(2026,9,1,12,0),title:'Emirates NBD',text:'Refund AED 25.00 to credit card 4021'});
  assert.strictEqual(parsed.kind,'refund');
  const plan=Ingest.plan(parsed,s,{uid});
  assert.strictEqual(plan.action,'auto-save');
  assert.strictEqual(plan.transaction.accountId,'credit-ref');
  Ingest.applyPlan(s,plan);
  strictOk(s,'post refund');
  assert.strictEqual(Finance.accountDebt(s,'credit-ref'),75);
})();

(function transactionReferencePreventsDuplicate(){
  const s=empty();
  const text="Hello Mohamed Abd, You've received AED 9.00 to your du Pay wallet. Your available balance is now AED 110.28, and the transaction ID is: DG148RKIXI";
  const first=process(text,{id:'dep1'},s);
  const parsedAgain=Message.parse({id:'dep2',postedAt:Date.UTC(2026,9,1,10,1),text});
  const second=Ingest.plan(parsedAgain,s,{uid});
  assert.strictEqual(second.action,'duplicate');
  assert.strictEqual(second.existingTransactionId,first.plan.transaction.id);
  assert.strictEqual(s.transactions.length,1);
})();

console.log('bank ingestion schema integration tests: PASS');
