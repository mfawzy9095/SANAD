'use strict';
const assert=require('assert');
const R=require('../../main/assets/js/report-core.js');

const now=new Date(2026,8,15,12,0,0,0).getTime();
const state={
  accounts:[
    {id:'uae1',country:'UAE',currency:'AED'},
    {id:'uae2',country:'UAE',currency:'AED'},
    {id:'egy1',country:'EGY',currency:'EGP'}
  ],
  transactions:[
    {id:'e1',type:'expense',accountId:'uae1',amount:100,date:'2026-09-10',cat:'food'},
    {id:'e2',type:'expense',accountId:'uae1',amount:999,walletAmount:50,date:'2026-09-11',cat:'food'},
    {id:'i1',type:'income',accountId:'uae1',amount:300,date:'2026-09-12',cat:'salary'},
    {id:'t1',type:'transfer',fromAccountId:'uae1',toAccountId:'uae2',fromAmount:20,toAmount:20,fee:2,date:'2026-09-13'},
    {id:'t2',type:'transfer',fromAccountId:'uae1',toAccountId:'egy1',fromAmount:40,toAmount:500,fee:3,date:'2026-09-14'},
    {id:'t3',type:'transfer',fromAccountId:'egy1',toAccountId:'uae1',fromAmount:200,toAmount:15,fee:0,date:'2026-09-15'},
    {id:'x1',type:'external_transfer',fromAccountId:'uae1',fromAmount:25,fee:1,date:'2026-09-15'}
  ]
};

(function ranges(){
  assert.deepStrictEqual(R.periodRange('today','2026-09',now),{start:'2026-09-15',end:'2026-09-15'});
  assert.deepStrictEqual(R.periodRange('week','2026-09',now),{start:'2026-09-09',end:'2026-09-15'});
  assert.deepStrictEqual(R.periodRange('month','2026-09',now),{start:'2026-09-01',end:'2026-09-30'});
  assert.deepStrictEqual(R.periodRange('6months','2026-09',now),{start:'2026-04-01',end:'2026-09-30'});
})();

(function expenseAccounting(){
  const e=R.reportExpenseEntries(state,{country:'UAE',period:'month',month:'2026-09',now});
  const byType=Object.fromEntries(e.map(x=>[x.sourceType+':'+x.sourceTxId,x.amount]));
  assert.strictEqual(byType['expense:e1'],100);
  assert.strictEqual(byType['expense:e2'],50);
  assert.strictEqual(byType['transfer_fee:t1'],2);
  assert.strictEqual(byType['transfer_fee:t2'],3);
  assert.strictEqual(byType['external_transfer_principal:x1'],25);
  assert.strictEqual(byType['external_transfer_fee:x1'],1);
})();

(function filters(){
  const e=R.reportExpenseEntries(state,{country:'UAE',period:'month',month:'2026-09',accountId:'uae2',now});
  assert.strictEqual(e.length,0);
  const income=R.reportIncomeEntries(state,{country:'UAE',period:'month',month:'2026-09',currency:'AED',now});
  assert.strictEqual(income.length,1);
  assert.strictEqual(income[0].amount,300);
})();

(function transfers(){
  const t=R.reportTransferEntries(state,{country:'UAE',period:'month',month:'2026-09',now});
  assert.deepStrictEqual(t.internal.map(x=>x.id),['t1']);
  assert.deepStrictEqual(t.outbound.map(x=>x.id),['t2']);
  assert.deepStrictEqual(t.inbound.map(x=>x.id),['t3']);
  assert.deepStrictEqual(t.internalOut.map(x=>x.id),['t1']);
  assert.deepStrictEqual(t.crossOut.map(x=>x.id),['t2']);
  assert.deepStrictEqual(t.crossIn.map(x=>x.id),['t3']);
})();

(function dataset(){
  const d=R.buildReportDataset(state,{country:'UAE',period:'month',month:'2026-09',now});
  assert.strictEqual(d.spendingByCur.AED,181);
  assert.strictEqual(d.incomeByCur.AED,300);
  assert.strictEqual(d.categoryByCur.AED.food,150);
  assert.strictEqual(d.categoryByCur.AED.transferFee,6);
  assert.strictEqual(d.categoryByCur.AED.externalTransfer,25);
  assert.ok(d.chartBuckets.length>=4);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(d,'now'),false);
})();

(function budgetAccess(){
  const categoryBudgets={};
  R.setCategoryBudget(categoryBudgets,'2026-09','UAE','AED','food',500);
  assert.strictEqual(R.getCategoryBudget(categoryBudgets,'2026-09','UAE','AED','food'),500);
  assert.deepStrictEqual(categoryBudgets,{'2026-09':{UAE:{AED:{food:500}}}});
  R.setCategoryBudget(categoryBudgets,'2026-09','UAE','AED','food',0);
  assert.strictEqual(R.getCategoryBudget(categoryBudgets,'2026-09','UAE','AED','food'),0);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(categoryBudgets['2026-09'].UAE.AED,'food'),false);
  assert.strictEqual(R.getCategoryBudget(null,'2026-09','UAE','AED','food'),0);

  const overallSpendingLimits={};
  R.setOverallLimit(overallSpendingLimits,'2026-09','UAE','AED',1200);
  assert.strictEqual(R.getOverallLimit(overallSpendingLimits,'2026-09','UAE','AED'),1200);
  assert.deepStrictEqual(overallSpendingLimits,{'2026-09':{UAE:{AED:1200}}});
  R.setOverallLimit(overallSpendingLimits,'2026-09','UAE','AED',0);
  assert.strictEqual(R.getOverallLimit(overallSpendingLimits,'2026-09','UAE','AED'),0);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(overallSpendingLimits['2026-09'].UAE,'AED'),false);
  assert.strictEqual(R.getOverallLimit(null,'2026-09','UAE','AED'),0);
})();

(function budgetAlertEvaluation(){
  const budgetAlerts={};
  const options={
    month:'2026-09',country:'UAE',budgetAlerts,
    overallSpendingLimits:{'2026-09':{UAE:{AED:100}}},
    categoryBudgets:{'2026-09':{UAE:{AED:{food:50}}}}
  };
  let ds={spendingByCur:{AED:80},categoryByCur:{AED:{food:40}}};
  let alerts=R.evaluateBudgetAlerts(ds,options);
  assert.deepStrictEqual(alerts.map(x=>x.type).sort(),['category','overall']);
  assert.deepStrictEqual(budgetAlerts['overall|2026-09|UAE|AED|_'],{warned80:true,warned95:false,warned100:false});
  assert.deepStrictEqual(budgetAlerts['category|2026-09|UAE|AED|food'],{warned80:true,warned95:false,warned100:false});
  assert.strictEqual(R.evaluateBudgetAlerts(ds,options).length,0);

  ds={spendingByCur:{AED:70},categoryByCur:{AED:{food:30}}};
  assert.strictEqual(R.evaluateBudgetAlerts(ds,options).length,0);
  assert.deepStrictEqual(budgetAlerts['overall|2026-09|UAE|AED|_'],{warned80:false,warned95:false,warned100:false});

  ds={spendingByCur:{AED:95},categoryByCur:{AED:{food:47.5}}};
  alerts=R.evaluateBudgetAlerts(ds,options);
  assert.deepStrictEqual(alerts.map(x=>x.level),['strong','strong']);
  assert.strictEqual(R.evaluateBudgetAlerts(ds,options).length,0);

  ds={spendingByCur:{AED:110},categoryByCur:{AED:{food:55}}};
  alerts=R.evaluateBudgetAlerts(ds,options);
  assert.deepStrictEqual(alerts.map(x=>x.level),['over','over']);
  assert.deepStrictEqual(budgetAlerts['overall|2026-09|UAE|AED|_'],{warned80:true,warned95:true,warned100:true});
})();

(function reportPresentationData(){
  assert.deepStrictEqual(R.categoryPieBuckets({food:30,transport:20}),[
    {id:'food',value:30,other:false},{id:'transport',value:20,other:false}
  ]);
  assert.deepStrictEqual(R.categoryPieBuckets({a:70,b:60,c:50,d:40,e:30,f:20,g:10}),[
    {id:'a',value:70,other:false},{id:'b',value:60,other:false},{id:'c',value:50,other:false},
    {id:'d',value:40,other:false},{id:'e',value:30,other:false},{id:null,value:30,other:true}
  ]);
  assert.deepStrictEqual(R.categoryPieBuckets(null),[]);

  const entries=[
    {sourceTxId:'t1',currency:'AED'},
    {sourceTxId:'t1',currency:'AED'},
    {sourceTxId:'t2',currency:'AED'},
    {sourceTxId:'t3',currency:'EGP'},
    {sourceTxId:'t4',currency:'AED'}
  ];
  assert.strictEqual(R.distinctSourceTransactionCount(entries,'AED'),3);
  assert.strictEqual(R.distinctSourceTransactionCount(entries,'EGP'),1);
  assert.strictEqual(R.distinctSourceTransactionCount(entries,null),4);
  assert.strictEqual(R.distinctSourceTransactionCount(null,'AED'),0);
})();

(function budgetStatus(){
  assert.deepStrictEqual(R.computeBudgetStatus(0,0),{level:'none',pct:0});
  assert.strictEqual(R.computeBudgetStatus(79,100).level,'normal');
  assert.strictEqual(R.computeBudgetStatus(80,100).level,'warn');
  assert.strictEqual(R.computeBudgetStatus(95,100).level,'strong');
  assert.strictEqual(R.computeBudgetStatus(100,100).level,'over');
})();

console.log('report-core regression tests: PASS');
