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
