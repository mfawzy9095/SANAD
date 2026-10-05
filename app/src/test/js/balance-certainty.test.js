'use strict';
const assert=require('assert'),F=require('../../main/assets/js/finance-core.js'),M=require('../../main/assets/js/money-core.js');
const cases=[];function test(name,fn){cases.push([name,fn]);}
const asset=(extra={})=>({id:'a',type:'bank',currency:'AED',...extra});
const state=(a,transactions=[])=>({accounts:[a],transactions});
test('missing opening is unknown, with recorded movement preserved',()=>{
 const s=state(asset(),[{type:'income',accountId:'a',amount:100}]);
 assert.equal(F.accountBalance(s,'a'),null);assert.equal(F.accountMovement(s,'a'),100);
 assert.equal(F.accountBalancePresentation(s,'a').display,null);
});
test('discovered inferred baseline does not certify opening',()=>{
 const s=state(asset({autoDiscovered:true,openingBalance:0,bankBalanceBaseline:{at:20,balance:900},observedBalance:1000,observedBalanceType:'available_balance',observedBalanceAt:20}),[{type:'income',accountId:'a',amount:100,created:20}]);
 assert.equal(F.accountBalance(s,'a'),null);const v=F.accountBalancePresentation(s,'a');
 assert.equal(v.observed,1000);assert.equal(v.display,null);assert.equal(v.projected,null);assert.equal(v.difference,null);
});
test('available balance never overrides ledger or manufactures mismatch',()=>{
 const s=state(asset({openingBalance:100,openingBalanceKnown:true,observedBalance:75,observedBalanceType:'available_balance',observedBalanceAt:20}),[{type:'expense',accountId:'a',amount:10,created:30}]);
 const v=F.accountBalancePresentation(s,'a');assert.equal(v.calculated,90);assert.equal(v.display,90);assert.equal(v.observed,75);assert.equal(v.projected,null);assert.equal(v.mismatch,false);
});
test('partial liability cannot claim final debt',()=>{
 const s=state({...asset(),type:'credit',openingDebt:0,baselinePartial:true,creditLimit:1000},[{type:'expense',accountId:'a',amount:50}]);
 assert.equal(F.accountBalance(s,'a'),null);assert.equal(F.accountDebt(s,'a'),null);assert.equal(F.accountMovement(s,'a'),-50);assert.equal(F.creditAvailableCalculated(s,'a'),null);
});
test('confirmed opening edit does not alter bank evidence',()=>{
 const a=asset({autoDiscovered:true,openingBalance:0,bankBalanceBaseline:{at:20,balance:75}}),old=JSON.stringify(a.bankBalanceBaseline);
 F.setOpeningBalance(a,100);assert.equal(a.openingBalanceKnown,true);assert.equal(JSON.stringify(a.bankBalanceBaseline),old);
 assert.equal(F.accountBalance(state(a,[{type:'income',accountId:'a',amount:10,created:10}]),'a'),110);
});
test('exact currency scales and invalid precision are respected',()=>{
 for(const [currency,opening,amount,expected] of [['AED',0.1,0.2,0.3],['KWD',1.001,0.002,1.003],['JPY',1,2,3]])assert.equal(F.accountBalance(state(asset({currency,openingBalance:opening}),[{type:'income',accountId:'a',amount}]),'a'),expected);
 assert.equal(F.accountBalance(state(asset({currency:'JPY',openingBalance:0}),[{type:'income',accountId:'a',amount:0.01}]),'a'),null);
 assert.equal(F.accountBalance(state(asset({openingBalance:0}),[{type:'income',accountId:'a',amount:100,currency:'USD'}]),'a'),null);
});
test('exact total is order independent and bounded at result',()=>{
 assert.equal(M.sum([9999999999.99,0.02,-0.02],'AED').value,9999999999.99);
 assert.equal(M.sum([0.02,9999999999.99,-0.02],'AED').minorUnits,'999999999999');
 assert.equal(M.sum([9999999999.99,0.02],'AED').ok,false);
});
test('unknown prepaid debit cannot pass a false zero comparison',()=>{
 const before=F.capturePrepaidBalances(state({...asset(),type:'prepaid',openingBalanceKnown:false,openingBalance:0}));
 assert.equal(F.checkPrepaidInvariant(before,state({...asset(),type:'prepaid',openingBalanceKnown:false,openingBalance:0},[{type:'expense',accountId:'a',amount:1}])),'prepaid-balance-unknown');
});
test('prewrite precision, currency and aggregate bounds reject without false balance',()=>{
 const before=state(asset({openingBalance:0}));
 assert.equal(F.validateMoneyChanges(state(asset({openingBalance:0}),[{id:'x',type:'income',accountId:'a',amount:0.001}]),before).reason,'money-overprecision');
 assert.equal(F.validateMoneyChanges(state(asset({openingBalance:0}),[{id:'x',type:'income',accountId:'a',currency:'USD',amount:1}]),before).reason,'transaction-currency-mismatch');
 assert.equal(F.validateMoneyChanges(state(asset({openingBalance:9999999999.99}),[{id:'x',type:'income',accountId:'a',amount:0.02}]),before).reason,'money-out-of-range');
});
let failed=0;for(const [name,fn]of cases){try{fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
if(failed)process.exitCode=1;
