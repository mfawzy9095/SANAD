'use strict';
const assert=require('assert'),R=require('../../main/assets/js/report-core.js');
const o={country:'UAE',period:'month',month:'2026-10',now:Date.UTC(2026,9,5)};
const state={accounts:[{id:'c',type:'credit',country:'UAE',currency:'AED'},{id:'a',type:'bank',country:'UAE',currency:'AED'}],transactions:[
 {id:'p',type:'expense',accountId:'c',amount:100,date:'2026-10-01',cat:'food'},
 {id:'r',type:'income',accountId:'c',amount:25,date:'2026-10-02',bankImportEvidence:{kind:'refund'}},
 {id:'pay',type:'transfer',fromAccountId:'a',toAccountId:'c',fromAmount:75,toAmount:75,fee:0,date:'2026-10-03'},
 {id:'salary',type:'income',accountId:'a',amount:900,date:'2026-10-04',cat:'salary'}]};
let failed=0;const test=(name,fn)=>{try{fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}};
test('partial refund offsets spending, never creates salary or repayment expense',()=>{const ds=R.buildReportDataset(state,o);assert.equal(ds.incomeByCur.AED,900);assert.equal(ds.spendingByCur.AED,75);assert.equal(ds.expenses.find(e=>e.sourceTxId==='r').sourceType,'refund');assert.equal(ds.expenses.some(e=>e.sourceTxId==='pay'),false);});
test('currency precision totals are exact and cumulative overflow stays unknown',()=>{
 for(const [currency,x,y,total] of [['AED',0.1,0.2,0.3],['KWD',1.001,0.002,1.003],['JPY',1,2,3]]){const s={accounts:[{id:'a',country:'UAE',currency}],transactions:[x,y].map((amount,i)=>({id:String(i),type:'expense',accountId:'a',amount,date:'2026-10-01',cat:'other'}))};assert.equal(R.buildReportDataset(s,o).spendingByCur[currency],total);}
 const s={accounts:[{id:'a',country:'UAE',currency:'AED'}],transactions:[9999999999.99,0.02].map((amount,i)=>({id:String(i),type:'income',accountId:'a',amount,date:'2026-10-01'}))};assert.equal(R.buildReportDataset(s,o).incomeByCur.AED,null);
});
test('mixed currency chart cannot sum unlike money',()=>{const s=JSON.parse(JSON.stringify(state));s.accounts.push({id:'usd',country:'UAE',currency:'USD'});s.transactions.push({id:'u',type:'expense',accountId:'usd',amount:50,date:'2026-10-01'});const ds=R.buildReportDataset(s,o);assert.equal(ds.chartCurrencyRequired,true);assert.deepEqual(ds.chartBuckets,[]);assert.equal(ds.spendingByCur.USD,50);assert.equal(ds.spendingByCur.AED,75);});
test('legacy imported incoming origin remains uncertain without rewriting ledger',()=>{
 const s={accounts:[{id:'a',country:'UAE',currency:'AED',type:'bank'}],transactions:[{id:'old',type:'income',accountId:'a',amount:500,date:'2026-10-01',bankImportEvidence:{kind:'deposit'}}]},original=JSON.stringify(s);
 const ds=R.buildReportDataset(s,o);assert.equal(ds.incomeByCur.AED,null);assert.equal(ds.incomes[0].recordedAmount,500);assert.equal(ds.financialReviews[0].sourceTxId,'old');assert.equal(JSON.stringify(s),original);
});
test('confirmed purchase principal and fees stay separate without double-counting',()=>{
 const s={accounts:[{id:'a',country:'UAE',currency:'AED'}],transactions:[{id:'fee',type:'expense',accountId:'a',amount:12.1,walletAmount:12.1,bankPrincipalAmount:10,bankFeeEvidence:{amount:2.1,currency:'AED',confirmed:true},date:'2026-10-01',cat:'food'}]};
 const ds=R.buildReportDataset(s,o);assert.equal(ds.spendingByCur.AED,12.1);assert.equal(ds.categoryByCur.AED.food,10);assert.equal(ds.categoryByCur.AED.bankFee,2.1);assert.equal(R.distinctSourceTransactionCount(ds.expenses),1);
});
test('report confirmation binds to the evidence and legacy keys preserve uncertainty',()=>{
 const s={accounts:[{id:'a',country:'UAE',currency:'AED',type:'bank'}],transactions:[{id:'old',type:'income',accountId:'a',amount:500,date:'2026-10-01',bankImportEventId:'this-evidence',bankImportKey:'event:this-evidence|du-pay|deposit|AED|500.00|wallet|',economicOrigin:{kind:'external-income',source:'user-confirmation',eventId:'another-evidence'}}]};
 assert.equal(R.buildReportDataset(s,o).incomeByCur.AED,null);
 s.transactions[0].economicOrigin.eventId='this-evidence';assert.equal(R.buildReportDataset(s,o).incomeByCur.AED,500);
 delete s.transactions[0].economicOrigin;assert.equal(R.buildReportDataset(s,o).incomeByCur.AED,null);
});
if(failed)process.exitCode=1;
