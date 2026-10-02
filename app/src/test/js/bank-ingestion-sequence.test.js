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
const INSTRUMENT_TYPES=[{id:'debit_card'},{id:'credit_card'},{id:'prepaid_card'},{id:'wallet_card'}];
const SUPPORTED_TX_TYPES=['expense','income','transfer','external_transfer','adjustment'];
const CURRENCIES={EGP:{},AED:{},USD:{},EUR:{},SAR:{},MAD:{},GBP:{}};
const COUNTRIES={UAE:{},EGY:{},MAR:{},OTHER:{}};
const DEFAULT_CATS={
  expense:[
    {id:'food',n:'طعام',i:'🍔',c:'#f97316'},{id:'transport',n:'مواصلات',i:'🚗',c:'#38bdf8'},
    {id:'bills',n:'فواتير',i:'🧾',c:'#a78bfa'},{id:'shopping',n:'تسوق',i:'🛍️',c:'#f472b6'},
    {id:'health',n:'صحة',i:'💊',c:'#34d399'},{id:'fun',n:'ترفيه',i:'🎮',c:'#fbbf24'},
    {id:'home',n:'منزل',i:'🏠',c:'#fb7185'},{id:'cafe',n:'مقهى',i:'☕',c:'#a16207'},
    {id:'grocery',n:'بقالة',i:'🛒',c:'#65a30d'},{id:'transferFee',n:'رسوم تحويل',i:'🏦',c:'#E65100'},
    {id:'externalTransfer',n:'تحويل لشخص',i:'👤',c:'#D32F2F'},{id:'debtInterest',n:'فوائد',i:'📈',c:'#C62828'},
    {id:'other',n:'أخرى',i:'📌',c:'#94a3b8'}
  ],
  income:[{id:'salary',n:'راتب',i:'💰',c:'#22c55e'},{id:'other',n:'أخرى',i:'📌',c:'#94a3b8'}]
};
const deepClone=v=>JSON.parse(JSON.stringify(v));
const accountTypeInfo=id=>ACCOUNT_TYPES.find(x=>x.id===id)||ACCOUNT_TYPES[ACCOUNT_TYPES.length-1];
const isAssetAccount=a=>!!(a&&accountTypeInfo(a.type).asset===true);
const isFiniteNumberLike=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const repair=RepairCore.createSchemaRepairCore({financeCore:Finance,now:()=>Date.UTC(2026,9,2)});
const Schema=SchemaCore.createSchema({
  schemaVersion:16,deepClone,defaultCats:DEFAULT_CATS,currencies:CURRENCIES,countries:COUNTRIES,
  accountTypes:ACCOUNT_TYPES,instrumentTypes:INSTRUMENT_TYPES,supportedTxTypes:SUPPORTED_TX_TYPES,
  accountTypeInfo,isAssetAccount,isFiniteNumberLike,isValidIsoDate:StateCore.isValidIsoDate,
  isoToday:()=> '2026-10-02',schemaRepair:repair
});
let seq=0; const uid=p=>String(p||'id')+'_'+(++seq);
function empty(){
  return Schema.migrate({
    schemaVersion:16,institutions:[],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[],
    categories:deepClone(DEFAULT_CATS),tags:[],recurring:[],settings:{}
  });
}
function strict(state,label){
  assert.deepStrictEqual(Schema.validateStateStrict(state),[],label);
}
function ingest(state,event){
  const parsed=Message.parse(event);
  assert.strictEqual(parsed.recognized,true,event.id+' parsed');
  const plan=Ingest.plan(parsed,state,{uid});
  assert.strictEqual(plan.action,'auto-save',event.id+' plan '+plan.reason);
  assert.strictEqual(Ingest.applyPlan(state,plan),true,event.id+' apply');
  strict(state,event.id+' strict');
  const rec=Ingest.reconciliation(parsed,state,plan,(st,id)=>Finance.accountBalance(st,id));
  return {parsed,plan,rec};
}

(function duPayShuffledQueueProducesOneConsistentLedger(){
  const state=empty();
  state.accounts.push({
    id:'cash',institutionId:null,country:'UAE',name:'Cash',type:'cash',currency:'AED',
    openingBalance:0,openingDebt:0,creditLimit:0,defaultRepaymentAccountId:null,
    icon:'💵',color:'#00695C',archived:false,created:'2026-10-02'
  });
  strict(state,'du initial');

  const rows=Ingest.sortNotifications([
    {id:'du5',postedAt:5000,text:'You have successfully withdrawn AED 100.00 from your du Pay wallet. Transaction ID: SEQ-WITHDRAW-1 Available balance: AED 650.40'},
    {id:'du2',postedAt:2000,text:'Hello Mohamed Abd, Your du Pay Card ending in 7105 has been used for AED 100.00 at FRESH CRAFT MINI MART. Your available balance is now AED 900.40 and your transaction ID is SEQ-PURCHASE-1. Fee AED 0.00, VAT AED 0.00.'},
    {id:'du4',postedAt:4000,text:"Hello Mohamed Abd, You've received AED 50.00 to your du Pay wallet. Your available balance is now AED 750.40, and the transaction ID is: SEQ-DEPOSIT-2"},
    {id:'du1',postedAt:1000,text:"Hello Mohamed Abd, You've received AED 1,000.00 to your du Pay wallet. Your available balance is now AED 1,000.40, and the transaction ID is: SEQ-DEPOSIT-1"},
    {id:'du3',postedAt:3000,text:'Your request to transfer AED 200.00 to Ahmed Ali is successfully processed and the amount has been credited in the beneficiary account. TID: SEQ-TRANSFER-1'}
  ]);
  assert.deepStrictEqual(rows.map(x=>x.id),['du1','du2','du3','du4','du5']);

  for(const row of rows){
    const out=ingest(state,row);
    if(out.parsed.availableBalance!=null)assert.ok(out.rec&&out.rec.matched,row.id+' reconciliation');
  }
  const wallet=state.accounts.find(a=>a.type==='ewallet');
  assert.ok(wallet,'du wallet discovered');
  assert.strictEqual(Finance.accountBalance(state,wallet.id),650.40);
  assert.strictEqual(Finance.accountBalance(state,'cash'),100);
  assert.strictEqual(state.transactions.length,5);
  assert.strictEqual(state.paymentInstruments.length,1);
  assert.strictEqual(state.paymentInstruments[0].last4,'7105');
  assert.strictEqual(state.beneficiaries.length,1);
  assert.strictEqual(state.beneficiaries[0].name,'Ahmed Ali');

  const duplicate=Message.parse({id:'different-notification-id',postedAt:6000,text:"Hello Mohamed Abd, You've received AED 50.00 to your du Pay wallet. Your available balance is now AED 750.40, and the transaction ID is: SEQ-DEPOSIT-2"});
  const dupPlan=Ingest.plan(duplicate,state,{uid});
  assert.strictEqual(dupPlan.action,'duplicate');
  assert.strictEqual(state.transactions.length,5);
})();

(function enbdAccountCardAndRepaymentSequenceStaysValid(){
  const state=empty();
  const events=[
    {id:'e1',postedAt:1000,text:'تم ايداع الراتب AED 1,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 1,001.66'},
    {id:'e2',postedAt:2000,text:'تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR ,SHARJAH باستخدام بطاقة خصم تنتهي أرقامها بـ 3993. الرصيد المتوفر هو AED 996.56.'},
    {id:'e3',postedAt:3000,text:'تمت عملية شراء في AED 100.00 TEST STORE,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,900.00'},
    {id:'e4',postedAt:4000,text:'تم خصم مبلغ AED 50.00 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021.'}
  ];
  for(const e of events)ingest(state,e);
  const bank=state.accounts.find(a=>a.type==='bank');
  const credit=state.accounts.find(a=>a.type==='credit');
  assert.ok(bank&&credit);
  assert.strictEqual(Finance.accountBalance(state,bank.id),946.56);
  assert.strictEqual(Finance.accountDebt(state,credit.id),50);
  assert.strictEqual(state.paymentInstruments.filter(i=>i.last4==='3993').length,1);
  assert.strictEqual(state.paymentInstruments.filter(i=>i.last4==='4021').length,1);
  assert.strictEqual(state.transactions.length,4);
  strict(state,'enbd final');
})();

console.log('bank ingestion sequence stress tests: PASS');
