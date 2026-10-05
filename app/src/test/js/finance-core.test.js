'use strict';
const assert=require('assert');
const F=require('../../main/assets/js/finance-core.js');

function state(accounts,transactions){return {accounts,transactions};}

(function assetBalance(){
  const s=state(
    [{id:'a',currency:'AED',type:'bank',openingBalance:1000}],
    [
      {currency:'AED',type:'expense',accountId:'a',amount:100},
      {currency:'AED',type:'income',accountId:'a',amount:250},
      {currency:'AED',type:'adjustment',accountId:'a',walletAmount:-25},
      {currency:'AED',type:'external_transfer',fromAccountId:'a',fromAmount:50,fee:5},
    ]
  );
  assert.strictEqual(F.accountBalance(s,'a'),1070);
})();

(function internalTransferAndFee(){
  const s=state(
    [
      {id:'a',currency:'AED',type:'bank',openingBalance:1000},
      {id:'b',currency:'AED',type:'bank',openingBalance:100}
    ],
    [{currency:'AED',type:'transfer',fromAccountId:'a',toAccountId:'b',fromAmount:200,toAmount:200,fee:10}]
  );
  assert.strictEqual(F.accountBalance(s,'a'),790);
  assert.strictEqual(F.accountBalance(s,'b'),300);
})();

(function liabilityBalanceAndCredit(){
  const s=state(
    [
      {id:'cash',currency:'AED',type:'bank',openingBalance:1000},
      {id:'cc',currency:'AED',type:'credit',openingDebt:200,creditLimit:1000}
    ],
    [
      {currency:'AED',type:'expense',accountId:'cc',walletAmount:100},
      {currency:'AED',type:'transfer',fromAccountId:'cash',toAccountId:'cc',fromAmount:150,toAmount:150,fee:0}
    ]
  );
  assert.strictEqual(F.accountBalance(s,'cc'),-150);
  assert.strictEqual(F.accountDebt(s,'cc'),150);
  assert.strictEqual(F.creditAvailable(s,'cc'),850);
})();

(function repaymentFeeOnLiabilitySource(){
  const s=state(
    [{id:'cc',currency:'AED',type:'credit',openingDebt:100}],
    [{currency:'AED',type:'transfer',fromAccountId:'cc',toAccountId:'x',fromAmount:20,toAmount:20,fee:5}]
  );
  assert.strictEqual(F.accountBalance(s,'cc'),-125);
})();

(function walletAmountWins(){
  const s=state(
    [{id:'a',currency:'AED',type:'bank',openingBalance:0}],
    [{currency:'AED',type:'income',accountId:'a',amount:100,walletAmount:367}]
  );
  assert.strictEqual(F.accountBalance(s,'a'),367);
})();

(function unknownAccount(){
  assert.strictEqual(F.accountBalance(state([],[]),'missing'),null);
  assert.strictEqual(F.creditAvailable(state([],[]),'missing'),null);
})();


(function reportedBalancePresentation(){
  const current=state(
    [{id:'w',currency:'AED',type:'ewallet',openingBalance:10,observedBalance:0,observedBalanceAt:200}],
    [{id:'t1',currency:'AED',type:'expense',accountId:'w',amount:1.5,created:200}]
  );
  const view=F.accountBalancePresentation(current,'w');
  assert.strictEqual(view.calculated,8.5);
  assert.strictEqual(view.observed,0);
  assert.strictEqual(view.display,8.5);
  assert.strictEqual(view.observedIsCurrent,true);
  assert.strictEqual(view.mismatch,false);
  assert.strictEqual(view.difference,null);

  current.transactions.push({id:'manual',currency:'AED',type:'expense',accountId:'w',amount:2,created:300});
  const stale=F.accountBalancePresentation(current,'w');
  assert.strictEqual(stale.calculated,6.5);
  assert.strictEqual(stale.display,6.5); // last explicit zero plus the later debit
  assert.strictEqual(stale.projected,null);
  assert.strictEqual(stale.observedIsCurrent,false);
})();

(function rates(){
  const defaults={USD_AED:3.67,AED_USD:0.272};
  assert.strictEqual(F.suggestRate('AED','AED',{},defaults),1);
  assert.strictEqual(F.suggestRate('USD','AED',{USD_AED:3.66},defaults),3.66);
  assert.strictEqual(F.suggestRate('USD','AED',{},defaults),3.67);
  assert.strictEqual(F.suggestRate('AED','USD',{}, {USD_AED:3.67}),0.2725);
  assert.strictEqual(F.suggestRate('ABC','XYZ',{},defaults),null);
})();

(function prepaidInvariant(){
  const beforeState=state([{id:'p',currency:'AED',type:'prepaid',openingBalance:100}],[]);
  const before=F.capturePrepaidBalances(beforeState);
  assert.strictEqual(before.get('p'),100);

  const safe=state([{id:'p',currency:'AED',type:'prepaid',openingBalance:100}],
    [{currency:'AED',type:'expense',accountId:'p',amount:100}]);
  assert.strictEqual(F.checkPrepaidInvariant(before,safe),null);

  const negative=state([{id:'p',currency:'AED',type:'prepaid',openingBalance:100}],
    [{currency:'AED',type:'expense',accountId:'p',amount:100.02}]);
  assert.strictEqual(F.checkPrepaidInvariant(before,negative),'prepaid-insufficient');

  const legacyBefore=F.capturePrepaidBalances(
    state([{id:'p',currency:'AED',type:'prepaid',openingBalance:-20}],[])
  );
  const improved=state([{id:'p',currency:'AED',type:'prepaid',openingBalance:-20}],
    [{currency:'AED',type:'income',accountId:'p',amount:5}]);
  assert.strictEqual(F.checkPrepaidInvariant(legacyBefore,improved),null);

  const worsened=state([{id:'p',currency:'AED',type:'prepaid',openingBalance:-20}],
    [{currency:'AED',type:'expense',accountId:'p',amount:1}]);
  assert.strictEqual(F.checkPrepaidInvariant(legacyBefore,worsened),'prepaid-insufficient');

  const newNegative=state([{id:'new',currency:'AED',type:'prepaid',openingBalance:-1}],[]);
  assert.strictEqual(F.checkPrepaidInvariant(new Map(),newNegative),'prepaid-insufficient');
})();

console.log('finance-core regression tests: PASS');

// An unclassified bank observation must not discard earlier ledger transactions.
{
  const s={accounts:[{id:'timeline',currency:'AED',type:'bank',openingBalance:100,bankBalanceBaseline:{at:2000,balance:100}}],transactions:[
    {currency:'AED',type:'income',accountId:'timeline',amount:1000,created:1000},
    {currency:'AED',type:'expense',accountId:'timeline',amount:10,created:2000},
    {currency:'AED',type:'income',accountId:'timeline',amount:20,created:3000}
  ]};
  assert.strictEqual(F.accountBalance(s,'timeline'),1110);
  assert.strictEqual(F.accountBalanceAt(s,'timeline',2000),1090);
  assert.strictEqual(F.accountBalanceAt(s,'timeline',1000),1100);
}

// Available credit is independent of debt and can explicitly be negative.
{
  const s=state([{id:'c',currency:'AED',type:'credit',openingDebt:0,creditLimit:0,baselinePartial:true,observedAvailableCredit:-608.56,observedAvailableCreditAt:300}],[]);
  assert.strictEqual(F.creditAvailable(s,'c'),-608.56);
  assert.strictEqual(F.creditAvailableCalculated(s,'c'),null);
  s.transactions.push({currency:'AED',type:'expense',accountId:'c',amount:5,created:400});
  assert.strictEqual(F.creditAvailable(s,'c'),null); // historical observation is no longer current
}

// Explicit opening edits preserve the original bank observation and all history.
{
  const a={id:'edited',currency:'AED',type:'bank',openingBalance:100,bankBalanceBaseline:{at:2000,balance:100}};
  const s=state([a],[{currency:'AED',type:'income',accountId:'edited',amount:500,created:1000},{currency:'AED',type:'expense',accountId:'edited',amount:10,created:3000}]);
  F.setOpeningBalance(a,120);
  assert.strictEqual(F.accountBalance(s,'edited'),610);
  assert.strictEqual(a.bankBalanceBaseline.at,2000);
}
