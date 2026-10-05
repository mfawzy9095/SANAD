'use strict';
const assert=require('assert');
const Finance=require('../../main/assets/js/finance-core.js');
const RepairCore=require('../../main/assets/js/schema-repair-core.js');
const SchemaCore=require('../../main/assets/js/schema-core.js');
const StateCore=require('../../main/assets/js/state-core.js');

const ACCOUNT_TYPES=[
  {id:'bank',asset:true},{id:'cash',asset:true},{id:'ewallet',asset:true},
  {id:'prepaid',asset:true},{id:'credit',asset:false},{id:'debt',asset:false},{id:'other',asset:true}
];
const INSTRUMENT_TYPES=[{id:'debit_card'},{id:'credit_card'},{id:'prepaid_card'},{id:'wallet_card'}];
const SUPPORTED_TX_TYPES=['expense','income','transfer','external_transfer','adjustment'];
const CURRENCIES={EGP:{},AED:{},USD:{},EUR:{},SAR:{},MAD:{}};
const COUNTRIES={UAE:{},EGY:{},MAR:{},OTHER:{}};
const DEFAULT_CATS={
  expense:[{id:'other',n:'أخرى',i:'📌',c:'#999'}],
  income:[{id:'other',n:'أخرى',i:'📌',c:'#999'}]
};
const deepClone=v=>JSON.parse(JSON.stringify(v));
const accountTypeInfo=id=>ACCOUNT_TYPES.find(x=>x.id===id)||ACCOUNT_TYPES[ACCOUNT_TYPES.length-1];
const isAssetAccount=a=>!!(a&&accountTypeInfo(a.type).asset===true);
const isFiniteNumberLike=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const repair=RepairCore.createSchemaRepairCore({financeCore:Finance,now:()=>1000});

const Schema=SchemaCore.createSchema({
  schemaVersion:16,
  deepClone,
  defaultCats:DEFAULT_CATS,
  currencies:CURRENCIES,
  countries:COUNTRIES,
  accountTypes:ACCOUNT_TYPES,
  instrumentTypes:INSTRUMENT_TYPES,
  supportedTxTypes:SUPPORTED_TX_TYPES,
  accountTypeInfo,
  isAssetAccount,
  isFiniteNumberLike,
  isValidIsoDate:StateCore.isValidIsoDate,
  isoToday:()=> '2026-10-01',
  schemaRepair:repair
});

function emptyState(){
  return {
    schemaVersion:16,
    institutions:[],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[],
    categories:deepClone(DEFAULT_CATS),tags:[],recurring:[],settings:{}
  };
}

(function canonicalMigration(){
  const m=Schema.migrate(emptyState());
  assert.strictEqual(m.schemaVersion,16);
  assert.ok(m.settings.defaultAccountByCountry);
  assert.ok(m.categories.expense.some(c=>c.id==='transferFee'));
  assert.deepStrictEqual(Schema.validateStateStrict(m),[]);
})();

(function v85WalletMigration(){
  const legacy={
    wallets:[{id:'w1',type:'cash',name:'Cash',country:'UAE',currency:'AED',openingBalance:100}],
    transactions:[{
      id:'t1',type:'expense',walletId:'w1',amount:10,currency:'AED',walletAmount:10,fxRate:1,
      cat:'other',date:'2026-10-01',tags:[]
    }],
    categories:deepClone(DEFAULT_CATS),
    tags:[],recurring:[],settings:{}
  };
  assert.deepStrictEqual(Schema.validateForImport(legacy),[]);
  const m=Schema.migrate(legacy);
  assert.strictEqual(m.accounts.length,1);
  assert.strictEqual(m.accounts[0].id,'w1');
  assert.strictEqual(m.accounts[0].type,'cash');
  assert.strictEqual(m.transactions[0].accountId,'w1');
  assert.strictEqual('walletId' in m.transactions[0],false);
})();

(function duplicateAccountRejected(){
  const s=Schema.migrate(emptyState());
  s.accounts=[
    {id:'a',type:'bank',country:'UAE',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false},
    {id:'a',type:'bank',country:'UAE',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}
  ];
  const errors=Schema.validateStateStrict(s);
  assert.ok(errors.some(x=>x.includes('معرّف حساب مكرر')));
})();

(function walletCardRequiresEwallet(){
  const s=Schema.migrate(emptyState());
  s.accounts=[{id:'w',type:'ewallet',country:'UAE',currency:'AED',openingBalance:10,openingDebt:0,creditLimit:0,archived:false}];
  s.paymentInstruments=[{id:'wc',type:'wallet_card',accountId:'w',country:'UAE',last4:'7105',archived:false}];
  assert.deepStrictEqual(Schema.validateStateStrict(s),[]);
  s.accounts[0].type='bank';
  assert.ok(Schema.validateStateStrict(s).some(x=>x.includes('بطاقة wallet مرتبطة بحساب غير ewallet')));
})();

(function prepaidNegativeRejected(){
  const s=Schema.migrate(emptyState());
  s.accounts=[{id:'p',type:'prepaid',country:'UAE',currency:'AED',openingBalance:0,openingDebt:0,creditLimit:0,archived:false}];
  s.transactions=[{
    id:'t1',type:'expense',accountId:'p',amount:10,walletAmount:10,currency:'AED',fxRate:1,
    cat:'other',date:'2026-10-01',tags:[],created:1
  }];
  const errors=Schema.validateStateStrict(s);
  assert.ok(errors.some(x=>x.includes('رصيد prepaid سالب')));
})();

(function invalidInput(){
  assert.strictEqual(Schema.migrate(null),null);
})();

console.log('schema-core regression tests: PASS');

(function bankBaselineValidationAndRestore(){
  const s=Schema.migrate(emptyState());
  s.accounts.push({id:'timeline',type:'bank',country:'UAE',currency:'AED',openingBalance:100,openingDebt:0,creditLimit:0,bankBalanceBaseline:{at:2000,balance:100}});
  assert.deepStrictEqual(Schema.validateStateStrict(s),[]);
  assert.deepStrictEqual(Schema.migrate(s).accounts[0].bankBalanceBaseline,{at:2000,balance:100});
  s.accounts[0].bankBalanceBaseline.balance=null;
  assert.ok(Schema.validateStateStrict(s).some(x=>x.includes('نقطة رصيد البنك')));
})();

// Runtime backup adapters must preserve Schema's receiver (migration and prepaid validation use this).
{
 const fs=require('fs'),path=require('path'),vm=require('vm'),Backup=require('../../main/assets/js/backup-core');
 const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
 const a=html.indexOf('  prepare(data){',html.indexOf('const SanadFullBackup'));
 const b=html.indexOf('  async importData(',a);
 const fixture=Schema.migrate({schemaVersion:16,accounts:[],transactions:[],settings:{}});
 const ctx={BackupCore:Backup,stateFingerprint:StateCore.stateFingerprint,Schema,Date,Object};vm.createContext(ctx);
 const runtime=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 const full=Backup.makeFullBackup({state:fixture,fingerprint:StateCore.stateFingerprint});
 const restored=runtime.prepare(full).migrated;
 assert.strictEqual(StateCore.stateFingerprint(restored),StateCore.stateFingerprint(fixture));
 assert(!html.includes('migrate:Schema.migrate,'),'finance/full imports must preserve the receiver');
 console.log('Runtime full-backup export/restore with real Schema migration: PASS');
}
{
 const fullState=Schema.migrate({schemaVersion:16,accounts:[],transactions:[],settings:{lastFx:{USD_AED:{rate:1.5,source:'user-entry',recordedAt:1000}}}});
 assert.deepStrictEqual(Schema.validateStateStrict(fullState),[],'declared rate provenance must persist');
 const Backup=require('../../main/assets/js/backup-core');const envelope=Backup.makeFullBackup({state:fullState,fingerprint:StateCore.stateFingerprint});
 const restored=Schema.migrate(envelope.finance);assert.deepStrictEqual(restored.settings.lastFx,fullState.settings.lastFx);assert.strictEqual(Finance.suggestRate('USD','AED',restored.settings.lastFx),1.5);
 fullState.settings.lastFx.USD_AED.source='unverified';assert(Schema.validateStateStrict(fullState).some(e=>e.includes('سعر صرف')));
 const missing=Schema.migrate({schemaVersion:16,accounts:[{id:'missing',type:'bank',country:'UAE',currency:'AED',name:'Missing',archived:false}],transactions:[],settings:{}});assert.strictEqual(missing.accounts[0].openingBalanceKnown,false);assert.strictEqual(Finance.accountBalance(missing,'missing'),null);
 const unsupported=Schema.migrate({schemaVersion:16,accounts:[{id:'unsupported',type:'bank',country:'UAE',currency:'JPY',name:'JPY',openingBalance:10,archived:false}],transactions:[],settings:{}});assert.strictEqual(unsupported.accounts[0].currency,'JPY');assert(Schema.validateStateStrict(unsupported).some(e=>e.includes('عملة')));
 console.log('Rate provenance round-trip and unknown currency/opening preservation: PASS');
}

(function documentedFxRoundTrip(){
  const s=Schema.migrate(emptyState());
  s.settings.lastFx={
    USD_AED:{rate:1.5,source:'user-entry',recordedAt:1000},
    AED_USD:{rate:1/1.5,source:'user-entry',recordedAt:1000},
    EUR_AED:4 // Legacy data stays recoverable; runtime does not trust an unsourced suggestion.
  };
  assert.deepStrictEqual(Schema.validateStateStrict(s),[]);
  const restored=Schema.migrate(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(Schema.validateStateStrict(restored),[]);
  assert.deepStrictEqual(restored.settings.lastFx,s.settings.lastFx);
  for(const invalid of [
    {rate:1.5,recordedAt:1000},
    {rate:1.5,source:'unknown',recordedAt:1000},
    {rate:0,source:'user-entry',recordedAt:1000},
    {rate:1.5,source:'user-entry',recordedAt:0},
    [1.5]
  ]){
    const candidate=deepClone(s);
    candidate.settings.lastFx.USD_AED=invalid;
    assert.ok(Schema.validateStateStrict(candidate).some(x=>x.includes('سعر صرف محفوظ غير صالح')));
  }
  console.log('Documented FX validation and restore: PASS');
})();

{
 const s=Schema.migrate(emptyState());s.settings.bankReviewHolds={repair:{reason:'repair-destination-unconfirmed',at:1000,parserVersion:'9.2.7-financial-contract',decisionSource:'deterministic-contract'}};
 assert.deepStrictEqual(Schema.validateStateStrict(s),[]);
 assert.deepStrictEqual(Schema.migrate(JSON.parse(JSON.stringify(s))).settings.bankReviewHolds,s.settings.bankReviewHolds);
 s.settings.bankReviewHolds.repair.reason='unknown';assert(Schema.validateStateStrict(s).some(e=>e.includes('مراجعة إصلاح')));
 console.log('Repair review holds survive strict backup migration: PASS');
}
{
 const s=Schema.migrate(emptyState());s.settings.bankReviewHolds={'atm-review':{reason:'repair-destination-unconfirmed',at:1000,parserVersion:'9.2.8-financial-contract',decisionSource:'deterministic-contract',quarantinedTransactionId:'original-atm',evidence:{kind:'cash_withdrawal',currency:'EGP',amount:350,postedAt:1682261238844,bankId:'nbe-egypt'}}};
 assert.deepStrictEqual(Schema.validateStateStrict(s),[],'ATM review evidence must survive restore');
 assert.deepStrictEqual(Schema.validateStateStrict(Schema.migrate(JSON.parse(JSON.stringify(s)))),[]);
 s.settings.bankReviewHolds['atm-review'].evidence.kind='made-up';assert(Schema.validateStateStrict(s).length);
}
