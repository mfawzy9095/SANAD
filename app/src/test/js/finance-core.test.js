'use strict';
const assert=require('assert');
const F=require('../../main/assets/js/finance-core.js');

function state(accounts,transactions){return {accounts,transactions};}

(function assetBalance(){
  const s=state(
    [{id:'a',type:'bank',openingBalance:1000}],
    [
      {type:'expense',accountId:'a',amount:100},
      {type:'income',accountId:'a',amount:250},
      {type:'adjustment',accountId:'a',walletAmount:-25},
      {type:'external_transfer',fromAccountId:'a',fromAmount:50,fee:5},
    ]
  );
  assert.strictEqual(F.accountBalance(s,'a'),1070);
})();

(function internalTransferAndFee(){
  const s=state(
    [
      {id:'a',type:'bank',openingBalance:1000},
      {id:'b',type:'bank',openingBalance:100}
    ],
    [{type:'transfer',fromAccountId:'a',toAccountId:'b',fromAmount:200,toAmount:200,fee:10}]
  );
  assert.strictEqual(F.accountBalance(s,'a'),790);
  assert.strictEqual(F.accountBalance(s,'b'),300);
})();

(function liabilityBalanceAndCredit(){
  const s=state(
    [
      {id:'cash',type:'bank',openingBalance:1000},
      {id:'cc',type:'credit',openingDebt:200,creditLimit:1000}
    ],
    [
      {type:'expense',accountId:'cc',walletAmount:100},
      {type:'transfer',fromAccountId:'cash',toAccountId:'cc',fromAmount:150,toAmount:150,fee:0}
    ]
  );
  assert.strictEqual(F.accountBalance(s,'cc'),-150);
  assert.strictEqual(F.accountDebt(s,'cc'),150);
  assert.strictEqual(F.creditAvailable(s,'cc'),850);
})();

(function repaymentFeeOnLiabilitySource(){
  const s=state(
    [{id:'cc',type:'credit',openingDebt:100}],
    [{type:'transfer',fromAccountId:'cc',toAccountId:'x',fromAmount:20,toAmount:20,fee:5}]
  );
  assert.strictEqual(F.accountBalance(s,'cc'),-125);
})();

(function walletAmountWins(){
  const s=state(
    [{id:'a',type:'bank',openingBalance:0}],
    [{type:'income',accountId:'a',amount:100,walletAmount:367}]
  );
  assert.strictEqual(F.accountBalance(s,'a'),367);
})();

(function unknownAccount(){
  assert.strictEqual(F.accountBalance(state([],[]),'missing'),0);
  assert.strictEqual(F.creditAvailable(state([],[]),'missing'),null);
})();


(function reportedBalancePresentation(){
  const current=state(
    [{id:'w',type:'ewallet',openingBalance:10,observedBalance:0,observedBalanceAt:200}],
    [{id:'t1',type:'expense',accountId:'w',amount:1.5,created:200}]
  );
  const view=F.accountBalancePresentation(current,'w');
  assert.strictEqual(view.calculated,8.5);
  assert.strictEqual(view.observed,0);
  assert.strictEqual(view.display,0);
  assert.strictEqual(view.observedIsCurrent,true);
  assert.strictEqual(view.mismatch,true);
  assert.strictEqual(view.difference,-8.5);

  current.transactions.push({id:'manual',type:'expense',accountId:'w',amount:2,created:300});
  const stale=F.accountBalancePresentation(current,'w');
  assert.strictEqual(stale.calculated,6.5);
  assert.strictEqual(stale.display,6.5);
  assert.strictEqual(stale.observedIsCurrent,false);
})();

(function rates(){
  const defaults={USD_AED:3.67,AED_USD:0.272};
  assert.strictEqual(F.suggestRate('AED','AED',{},defaults),1);
  assert.strictEqual(F.suggestRate('USD','AED',{USD_AED:3.66},defaults),3.66);
  assert.strictEqual(F.suggestRate('USD','AED',{},defaults),3.67);
  assert.strictEqual(F.suggestRate('AED','USD',{}, {USD_AED:3.67}),0.2725);
  assert.strictEqual(F.suggestRate('ABC','XYZ',{},defaults),1);
})();

(function prepaidInvariant(){
  const beforeState=state([{id:'p',type:'prepaid',openingBalance:100}],[]);
  const before=F.capturePrepaidBalances(beforeState);
  assert.strictEqual(before.get('p'),100);

  const safe=state([{id:'p',type:'prepaid',openingBalance:100}],
    [{type:'expense',accountId:'p',amount:100}]);
  assert.strictEqual(F.checkPrepaidInvariant(before,safe),null);

  const negative=state([{id:'p',type:'prepaid',openingBalance:100}],
    [{type:'expense',accountId:'p',amount:100.02}]);
  assert.strictEqual(F.checkPrepaidInvariant(before,negative),'prepaid-insufficient');

  const legacyBefore=F.capturePrepaidBalances(
    state([{id:'p',type:'prepaid',openingBalance:-20}],[])
  );
  const improved=state([{id:'p',type:'prepaid',openingBalance:-20}],
    [{type:'income',accountId:'p',amount:5}]);
  assert.strictEqual(F.checkPrepaidInvariant(legacyBefore,improved),null);

  const worsened=state([{id:'p',type:'prepaid',openingBalance:-20}],
    [{type:'expense',accountId:'p',amount:1}]);
  assert.strictEqual(F.checkPrepaidInvariant(legacyBefore,worsened),'prepaid-insufficient');

  const newNegative=state([{id:'new',type:'prepaid',openingBalance:-1}],[]);
  assert.strictEqual(F.checkPrepaidInvariant(new Map(),newNegative),'prepaid-insufficient');
})();

console.log('finance-core regression tests: PASS');

// Historical imports before an explicit bank baseline must not be counted again.
{
  const s={accounts:[{id:'timeline',type:'bank',openingBalance:100,bankBalanceBaseline:{at:2000,balance:100}}],transactions:[
    {type:'income',accountId:'timeline',amount:1000,created:1000},
    {type:'expense',accountId:'timeline',amount:10,created:2000},
    {type:'income',accountId:'timeline',amount:20,created:3000}
  ]};
  assert.strictEqual(F.accountBalance(s,'timeline'),110);
  assert.strictEqual(F.accountBalanceAt(s,'timeline',2000),90);
  assert.strictEqual(F.accountBalanceAt(s,'timeline',1000),null);
}
