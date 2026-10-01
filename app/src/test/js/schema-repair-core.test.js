'use strict';
const assert=require('assert');
const Finance=require('../../main/assets/js/finance-core.js');
const Core=require('../../main/assets/js/schema-repair-core.js');

const R=Core.createSchemaRepairCore({financeCore:Finance,now:()=>1000});

(function repaymentFeeMigration(){
  const s={
    accounts:[
      {id:'bank',type:'bank',currency:'AED',openingBalance:1000},
      {id:'cc',type:'credit',currency:'AED',openingDebt:100}
    ],
    paymentInstruments:[],
    transactions:[
      {id:'tr1',type:'transfer',fromAccountId:'bank',toAccountId:'cc',fromCurrency:'AED',fromAmount:50,toAmount:50,fee:5,date:'2026-10-01',created:200}
    ]
  };
  R.normalizeRepaymentFees(s);
  assert.strictEqual(s.transactions[0].fee,0);
  const fee=s.transactions.find(x=>x.linkedTransferId==='tr1');
  assert.ok(fee);
  assert.strictEqual(fee.amount,5);
  assert.strictEqual(fee.accountId,'bank');
  assert.strictEqual(fee.created,201);
  R.normalizeRepaymentFees(s);
  assert.strictEqual(s.transactions.filter(x=>x.linkedTransferId==='tr1').length,1);
})();

(function prepaidOwnership(){
  const s={
    accounts:[
      {id:'p',type:'prepaid',archived:false},
      {id:'b',type:'bank',ownedByInstrumentId:'ghost'}
    ],
    paymentInstruments:[
      {id:'cardp',type:'prepaid_card',accountId:'p',archived:true},
      {id:'bad',type:'prepaid_card',accountId:'b',archived:false}
    ],
    transactions:[]
  };
  R.repairPrepaidOwnedAccounts(s);
  assert.strictEqual(s.accounts[0].ownedByInstrumentId,'cardp');
  assert.strictEqual(s.accounts[0].archived,true);
  assert.strictEqual(s.paymentInstruments[1].accountId,null);
  assert.strictEqual('ownedByInstrumentId' in s.accounts[1],false);
})();

(function creditArchiveConsistency(){
  const active={
    accounts:[{id:'cc',type:'credit',openingDebt:0,archived:true}],
    paymentInstruments:[{id:'c1',type:'credit_card',accountId:'cc',archived:false}],
    transactions:[]
  };
  R.repairCreditArchiveConsistency(active);
  assert.strictEqual(active.accounts[0].archived,false);

  const zero={
    accounts:[{id:'cc',type:'credit',openingDebt:0,archived:false}],
    paymentInstruments:[{id:'c1',type:'credit_card',accountId:'cc',archived:true}],
    transactions:[]
  };
  R.repairCreditArchiveConsistency(zero);
  assert.strictEqual(zero.accounts[0].archived,true);

  const debt={
    accounts:[{id:'cc',type:'credit',openingDebt:100,archived:true}],
    paymentInstruments:[{id:'c1',type:'credit_card',accountId:'cc',archived:true}],
    transactions:[]
  };
  R.repairCreditArchiveConsistency(debt);
  assert.strictEqual(debt.accounts[0].archived,false);
  assert.strictEqual(R.schemaAccountBalance(debt,'cc'),-100);
})();

console.log('schema-repair-core regression tests: PASS');
