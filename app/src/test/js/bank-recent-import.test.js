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
async function scenario(status,mode='recent',permission=true,extra={}){
 const writes={},queries=[];let renders=0;
 const old={scannedThrough:now-3*day,configuredStartAt:now-4*day};
 const context={Date:class extends Date{static now(){return now;}},S:{tab:'home'},Set,Number,Math,Object,confirm:()=>true,AndroidBridge:{requestHistoricalSmsPermission(){}},toast(){},render(){renders++;},canWrite:()=>true,BankIngestionCore:I,SanadExtStorage:{get:async k=>writes[k]||old,set:async(k,v)=>{if(extra.failKey===k)return false;writes[k]=JSON.parse(JSON.stringify(v));return true;}}};
 vm.createContext(context);
 const inbox=vm.runInContext('({'+html.slice(start,end)+'})',context);
 Object.assign(inbox,{historicalSupported:()=>true,historicalPermission:()=>permission,yieldUi:async()=>{},cancelHistoricalImport(){},requestHistoricalPage:async(days,date,id)=>{queries.push({days,date,id});return ['complete','processing-failed','cancel-last','navigate-last'].includes(status)?{ok:true,done:true,scanned:2,financialCandidates:1}:{ok:false,status};},sync:async()=>{if(status==='processing-failed')throw Error('batch failed');if(status==='cancel-last')inbox.historicalCancelRequested=true;if(status==='navigate-last')context.S.tab='tx';return {added:1,parsed:1,duplicates:0,review:0,reviewIds:[]};}});
 await inbox.importHistoricalSms(0,{mode,fromDate:now-4*day,configuredStartAt:now-4*day});
 return {writes,queries,inbox,renders};
}
(async()=>{
 const complete=await scenario('complete');
 assert.strictEqual(complete.queries[0].date,now-4*day-1);
 assert.strictEqual(complete.writes.bankImportLastRecent.scannedThrough,now);
 assert.strictEqual(complete.writes.bankImportLastRecent.total.added,1);
 assert(complete.renders>=2,'home shows running and completed state');
 for(const failure of ['cancelled','review-capacity','query-failed','permission-restricted','processing-failed','cancel-last','navigate-last']){
  const x=await scenario(failure);
  assert.strictEqual(x.writes.bankImportLastRecent.scannedThrough,now-3*day,'failed scan cannot skip unprocessed messages');
  assert.strictEqual(x.inbox.historicalImporting,false);
 }
 for(const failKey of ['bankImportLastHistorical','bankImportLastRecent']){
  const x=await scenario('complete','recent',true,{failKey});
  assert.strictEqual(x.inbox.lastRecentImport.scannedThrough,now-3*day);
  assert.strictEqual(x.inbox.lastHistoricalImport.status,'checkpoint-failed');
 }
 const historical=await scenario('complete','historical');
 assert.strictEqual(historical.writes.bankImportLastRecent,undefined,'historical scan does not change recent coverage');
 const pending=await scenario('complete','recent',false);
 assert.strictEqual(pending.queries.length,0);
 assert.strictEqual(pending.inbox._historicalPendingOptions.fromDate,now-4*day,'permission handoff preserves recent cutoff');
 assert(html.slice(html.indexOf('function openAddMenu(){'),html.indexOf('function openRecurringPicker(){')).includes('data-sanad-act="bank-sms-recent"'),'plus menu contains SMS action');
 assert(html.includes("if(a==='bank-sms-recent')return SanadBankInbox.refreshRecentSms();"));
 console.log('Recent SMS import: checkpoints, failures, permissions and plus entry: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

// A credit-card acknowledgement observes the repaid card, never cash credit.
{
 const from={id:'bank',type:'bank',currency:'AED',openingBalance:1000},to={id:'credit',type:'credit',currency:'AED',baselinePartial:true};
 const state={accounts:[from,to],transactions:[]};
 const a=html.indexOf('  applyReconciliation(parsed,plan){'),b=html.indexOf('  async commitPlan(parsed,plan){',a);
 const ctx={S:state,Date,Number,Math,isFiniteNumberLike:v=>v!=null&&v!==''&&Number.isFinite(Number(v)),Finance:{getAccount:id=>state.accounts.find(x=>x.id===id)},FinanceCore:{accountBalanceAt:()=>1000,creditAvailableCalculated:()=>null}};
 ctx.SanadMoneyCore=require('../../main/assets/js/money-core');
 vm.createContext(ctx);const inbox=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 inbox.applyReconciliation({kind:'card_repayment',postedAt:now,availableBalance:null,availableCredit:500},{transaction:{type:'transfer',fromAccountId:'bank',toAccountId:'credit'}});
 assert.strictEqual(to.observedAvailableCredit,500);assert.strictEqual(from.observedAvailableCredit,undefined);
 assert.strictEqual(to.creditReconciliation.status,'observed-only');
}

// Issuer accounts stay selectable for an FX review, but saving still requires
// an explicitly corrected settlement amount/currency and the exact card.
{
 const state={accounts:[{id:'egp',name:'Egypt card',country:'EGY',currency:'EGP',type:'credit'}],paymentInstruments:[{id:'card',name:'9721',accountId:'egp',country:'EGY',type:'credit_card',last4:'9721'}]};
 const a=html.indexOf('  correctionSourceOptions(parsed,selected){'),b=html.indexOf('  openCorrection(id){',a);
 const ctx={S:state,Finance:{getAccount:id=>state.accounts.find(x=>x.id===id)},esc:s=>String(s)};vm.createContext(ctx);
 const ui=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 const p={kind:'purchase',country:'EGY',currency:'MAD',amount:100,cardLast4:'9721'};
 assert(ui.correctionSourceOptions(p,'').includes('instrument:card'));
 assert(ui.correctionSourceOptions(p,'').includes('(EGP)'));
 assert.strictEqual(I.routeFromManualChoice(p,state,{sourceType:'instrument',sourceId:'card'}).status,'needs-review');
 assert.strictEqual(I.routeFromManualChoice({...p,currency:'EGP',amount:550},state,{sourceType:'instrument',sourceId:'card'}).status,'routed');
}

// Simultaneous foreground/history requests must each get a fresh scan with
// their own force policy. A previous failure must not poison future requests.
(async()=>{
 const a=html.indexOf('  _syncPromise:null,'),b=html.indexOf('  async syncImpl(options){',a);
 assert(a>=0&&b>a);
 const ctx={};vm.createContext(ctx);
 const inbox=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 let release;const barrier=new Promise(r=>{release=r;});
 const calls=[];let active=0,maxActive=0;
 inbox.syncImpl=async options=>{calls.push(options.force);active++;maxActive=Math.max(maxActive,active);try{if(calls.length===1)await barrier;if(options.fail)throw Error('read failed');return {added:options.force?1:0};}finally{active--;}};
 const first=inbox.sync({force:false}),second=inbox.sync({force:true}),third=inbox.sync({force:true});
 assert.deepStrictEqual(calls,[false]);release();
 const results=await Promise.all([first,second,third]);
 assert.deepStrictEqual(calls,[false,true,true]);
 assert.deepStrictEqual(results.map(x=>x.added),[0,1,1]);
 assert.strictEqual(maxActive,1);assert.strictEqual(inbox._syncPromise,null);
 await assert.rejects(inbox.sync({fail:true}),/read failed/);
 assert.strictEqual((await inbox.sync({force:true})).added,1);
 console.log('Concurrent bank scans preserve request policy and recover after failures: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
