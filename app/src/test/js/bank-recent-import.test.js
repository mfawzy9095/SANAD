'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const I=require('../../main/assets/js/bank-ingestion-core');
const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
const now=1791054000000,day=86400000;
assert.strictEqual(I.recentScanStart(null,now),now-30*day);
assert.strictEqual(I.recentScanStart({scannedThrough:now-100*day},now),now-101*day);
assert.strictEqual(I.recentScanStart({scannedThrough:now+day},now),now-day);
assert.throws(()=>I.recentScanStart(null,NaN),/valid-scan-time/);
const start=html.indexOf('  async importHistoricalSms(days=0,options={}){');
const end=html.indexOf('  canManualApprove(item){',start);
assert(start>=0&&end>start);
async function scenario(status,mode='recent',permission=true){
 const writes={},queries=[];let renders=0;
 const old={scannedThrough:now-3*day};
 const context={Date:class extends Date{static now(){return now;}},S:{tab:'home'},Set,Number,Math,Object,confirm:()=>true,AndroidBridge:{requestHistoricalSmsPermission(){}},toast(){},render(){renders++;},canWrite:()=>true,SanadExtStorage:{get:async k=>writes[k]||old,set:async(k,v)=>{writes[k]=v;}}};
 vm.createContext(context);
 const inbox=vm.runInContext('({'+html.slice(start,end)+'})',context);
 Object.assign(inbox,{historicalSupported:()=>true,historicalPermission:()=>permission,yieldUi:async()=>{},cancelHistoricalImport(){},requestHistoricalPage:async(days,date,id)=>{queries.push({days,date,id});return status==='complete'?{ok:true,done:true,scanned:2,financialCandidates:1}:{ok:false,status};},sync:async()=>({added:1,parsed:1,duplicates:0,review:0,reviewIds:[]})});
 await inbox.importHistoricalSms(0,{mode,fromDate:now-4*day});
 return {writes,queries,inbox,renders};
}
(async()=>{
 const complete=await scenario('complete');
 assert.strictEqual(complete.queries[0].date,now-4*day);
 assert.strictEqual(complete.writes.bankImportLastRecent.scannedThrough,now);
 assert.strictEqual(complete.writes.bankImportLastRecent.total.added,1);
 assert(complete.renders>=2,'home shows running and completed state');
 for(const failure of ['cancelled','review-capacity','query-failed','permission-restricted']){
  const x=await scenario(failure);
  assert.strictEqual(x.writes.bankImportLastRecent.scannedThrough,now-3*day,'failed scan cannot skip unprocessed messages');
  assert.strictEqual(x.inbox.historicalImporting,false);
 }
 const historical=await scenario('complete','historical');
 assert.strictEqual(historical.writes.bankImportLastRecent.scannedThrough,now,'historical scan seeds subsequent recent scans');
 const pending=await scenario('complete','recent',false);
 assert.strictEqual(pending.queries.length,0);
 assert.strictEqual(pending.inbox._historicalPendingOptions.fromDate,now-4*day,'permission handoff preserves recent cutoff');
 assert(html.slice(html.indexOf('function openAddMenu(){'),html.indexOf('function openRecurringPicker(){')).includes('data-sanad-act="bank-sms-recent"'),'plus menu contains SMS action');
 assert(html.includes("if(a==='bank-sms-recent')return SanadBankInbox.refreshRecentSms();"));
 console.log('Recent SMS import: checkpoints, failures, permissions and plus entry: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

// A credit-card acknowledgement observes the repaid card, never cash credit.
{
 const from={id:'bank',type:'bank',openingBalance:1000},to={id:'credit',type:'credit',baselinePartial:true};
 const state={accounts:[from,to],transactions:[]};
 const a=html.indexOf('  applyReconciliation(parsed,plan){'),b=html.indexOf('  async commitPlan(parsed,plan){',a);
 const ctx={S:state,Date,Number,Math,isFiniteNumberLike:v=>v!=null&&v!==''&&Number.isFinite(Number(v)),Finance:{getAccount:id=>state.accounts.find(x=>x.id===id)},FinanceCore:{accountBalanceAt:()=>1000,creditAvailableCalculated:()=>null}};
 vm.createContext(ctx);const inbox=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 inbox.applyReconciliation({kind:'card_repayment',postedAt:now,availableBalance:null,availableCredit:500},{transaction:{type:'transfer',fromAccountId:'bank',toAccountId:'credit'}});
 assert.strictEqual(to.observedAvailableCredit,500);assert.strictEqual(from.observedAvailableCredit,undefined);
 assert.strictEqual(to.creditReconciliation.status,'observed-only');
}
