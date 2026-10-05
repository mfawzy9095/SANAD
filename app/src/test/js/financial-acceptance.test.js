'use strict';
// Holdout synthetic expectations are written from the financial contract, not old parser output.
const assert=require('assert/strict'),M=require('../../main/assets/js/bank-message-core'),I=require('../../main/assets/js/bank-ingestion-core'),F=require('../../main/assets/js/finance-core');
const state=()=>({institutions:[{id:'inst',bankRegistryId:'emirates-nbd',name:'Emirates NBD',country:'UAE',type:'bank'}],accounts:[{id:'asset',institutionId:'inst',type:'bank',currency:'AED',country:'UAE',openingBalance:2000,bankRefs:['019XXX70XXX03']},{id:'liability',institutionId:'inst',type:'credit',currency:'AED',country:'UAE',openingDebt:0,creditLimit:1000}],paymentInstruments:[{id:'creditcard',institutionId:'inst',accountId:'liability',type:'credit_card',last4:'9765'},{id:'debitcard',institutionId:'inst',accountId:'asset',type:'debit_card',last4:'8234'}],transactions:[],settings:{}});
let total=0,auto=0,review=0,ignored=0,wrong=0;
const cases=[];
for(const [value,merchant,cat] of [['42.75','Green Pharmacy','health'],['105.20','Hill Grocery','grocery'],['9.10','Harbor Cafe','cafe'],['781.99','Example Store','other']]){
 cases.push({text:`تمت عملية شراء في AED ${value} ${merchant} على البطاقة 9765 الائتمان المتوفر AED 900.00`,action:'auto-save',type:'expense',account:'liability',amount:Number(value),cat});
 cases.push({text:`تمت عملية شراء بقيمة AED ${value} لدى ${merchant} باستخدام بطاقة خصم تنتهي ارقامها ب8234 الرصيد المتوفر هو AED 900.00`,action:'auto-save',type:'expense',account:'asset',amount:Number(value),cat});
}
cases.push({text:'تم إيداع الراتب AED 6,250.00 في حسابك .019XXX70XXX03',action:'auto-save',type:'income',account:'asset',amount:6250,cat:'salary'});
for(const text of ['Salary AED 6250 failed; no funds were credited','Pending salary AED 6250 into your account 019XXX70XXX03','Purchase AED 40 declined due to insufficient funds','تم رفض عملية شراء AED 40 باستخدام بطاقة 9765'])cases.push({text,action:'ignored'});
for(const text of ['تم إيداع الراتب AED 6250 في حسابك .019XXX70XXX04','Purchase reversal AED 40 on credit card ending 9765','Purchase KWD 4.125 using credit card ending 9765','Purchase AED 4.125 using credit card ending 9765','Salary AED 6250 credited to account 000000000','Purchase AED 900719925474099.99 using credit card ending 9765'])cases.push({text,action:'review'});
cases.push({sender:'UnknownBank',text:'تم إيداع الراتب AED 6250 في حسابك .019XXX70XXX03',action:'review'});
for(const [n,c] of cases.entries()){
 const s=state(),p=M.parse({id:'acceptance-'+n,title:c.sender||'EmiratesNBD',text:c.text,postedAt:1791010000000+n*1000000});
 const plan=p.ignored?{action:'ignored'}:I.plan(p,s,{uid:()=> 't-'+n});
 total++;assert.equal(plan.action,c.action,c.text);
 if(plan.action==='auto-save'){
  auto++;const t=plan.transaction;
  try{assert.equal(t.type,c.type);assert.equal(t.accountId,c.account);assert.equal(t.amount,c.amount);assert.equal(t.cat,c.cat);}catch(e){wrong++;throw e;}
  I.applyPlan(s,plan);assert.equal(I.plan(p,s).action,'duplicate');assert.equal(s.transactions.length,1);
 }else if(plan.action==='ignored')ignored++;else review++;
}
// Financial invariants use actual ledger arithmetic, not just planned labels.
const s=state();s.accounts.push({id:'cash',type:'cash',country:'UAE',currency:'AED',openingBalance:0});
s.transactions.push({id:'own',type:'transfer',fromAccountId:'asset',toAccountId:'cash',fromAmount:135.25,toAmount:135.25,fee:1.5,created:1});
assert.equal(F.accountBalance(s,'asset')+F.accountBalance(s,'cash'),1998.5);
s.transactions.push({id:'purchase',type:'expense',accountId:'liability',amount:120,walletAmount:120,created:2},{id:'pay',type:'transfer',fromAccountId:'asset',toAccountId:'liability',fromAmount:60,toAmount:60,created:3});
assert.equal(F.accountDebt(s,'liability'),60);assert.equal(s.transactions.filter(t=>t.type==='expense').length,1);
console.log(JSON.stringify({total,auto,review,ignored,wrongAutomaticPostings:wrong,autoCoverageOfCompletedCandidates:auto/(total-ignored),reviewRateOfCompletedCandidates:review/(total-ignored),scope:'synthetic local holdout; external independent reviewer and device tests still required'}));
