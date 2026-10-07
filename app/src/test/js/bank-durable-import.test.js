'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {createRequire}=require('module');
const I=require('../../main/assets/js/bank-ingestion-core'),M=require('../../main/assets/js/bank-message-core');
const State=require('../../main/assets/js/state-core');
const F=require('../../main/assets/js/finance-core'),Mutation=require('../../main/assets/js/mutation-core'),Backup=require('../../main/assets/js/backup-core');
const Money=require('../../main/assets/js/money-core');
const fixturePath=path.join(__dirname,'bank-ingestion-schema.test.js');
const fixture=fs.readFileSync(fixturePath,'utf8');
const fixtureCtx={require:createRequire(fixturePath),console};vm.createContext(fixtureCtx);
const {Schema,empty}=vm.runInContext(fixture.slice(0,fixture.indexOf('function strictOk('))+'\n({Schema,empty})',fixtureCtx);
const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
const a=html.indexOf('const SanadBankInbox = {'),b=html.indexOf('\n};',a);
const inboxCode='('+html.slice(a+'const SanadBankInbox = '.length,b+2)+')';
const clone=v=>JSON.parse(JSON.stringify(v));
function harness(options={}){
 let now=Date.UTC(2026,9,4,12),seq=0,disk=empty(),failFinance=false,failKey=null,writes=0;
 const store={},acks=[],queries=[];const initial=empty();initial.settings.bankSmsStartAt=now-30*86400000;
 class Clock extends Date{constructor(...v){super(...(v.length?v:[now]));}static now(){return now;}}
 const ctx={S:initial,Date:Clock,Set,Map,Number,Math,Object,Infinity,_dataReplacementInFlight:false,canWrite:()=>true,uid:p=>p+'_'+(++seq),toast(){},render(){},closeSheet(){},BankIngestionCore:I,BankMessageCore:M,FinanceCore:F,isFiniteNumberLike:v=>v!=null&&v!==''&&Number.isFinite(Number(v)),AndroidBridge:{acknowledgeBankNotifications:v=>acks.push(...JSON.parse(v))},SanadExtStorage:{get:async(k,f)=>k in store?clone(store[k]):f,set:async(k,v)=>{if(k===failKey)return false;store[k]=clone(v);return true;}}};
 ctx.Finance={ensureAllPrimaries(){},getAccount:id=>ctx.S.accounts.find(x=>x.id===id)};
 ctx.SanadMoneyCore=Money;
 const mutator=Mutation.createMutationService({canWrite:()=>true,snapshotState:()=>clone(ctx.S),loadState:s=>{ctx.S=clone(s);},fingerprint:State.stateFingerprint,validateState:s=>Schema.validateStateStrict(s),writeSafetySnapshot:async()=>({ok:true}),verifiedWrite:async s=>{writes++;if(failFinance)return {ok:false,restored:true};disk=clone(s);return {ok:true};},tryRestore:async s=>{disk=clone(s);return true;}});
 ctx.commitCriticalMutation=fn=>mutator.run(fn);
 ctx.snapshotState=()=>clone(ctx.S);ctx.stateFingerprint=State.stateFingerprint;ctx.loadStateInto=s=>{ctx.S=clone(s);};
 vm.createContext(ctx);let inbox;
 const boot=()=>{inbox=vm.runInContext(inboxCode,ctx);Object.assign(inbox,{supported:()=>true,historicalSupported:()=>true,historicalPermission:()=>true,yieldUi:async()=>{},readNative:()=>inbox.smsReviewEvents,open:async()=>inbox.syncImpl({viewReview:true}),requestHistoricalPage:async(days,date,id,limit,through)=>{queries.push({date,through});return {ok:true,done:true,scanned:0,messages:[]};}});inbox.smsReviewEvents=clone(store.bankSmsReviewEvents||[]);return inbox;};
 boot();
 return {ctx,store,acks,queries,get writes(){return writes;},get inbox(){return inbox;},get now(){return now;},advance:ms=>{now+=ms;},failFinance:v=>{failFinance=v;},failKey:k=>{failKey=k;},restart:()=>{ctx.S=clone(disk);boot();},persist:async()=>ctx.commitCriticalMutation(()=>true)};
}
const salary=h=>({id:'synthetic-salary',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:h.now-60000,text:'تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66'});
const review=h=>({id:'synthetic-review',title:'EI SMS',packageName:'sms:EI',postedAt:h.now-10000,text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: TESTSHOP المبلغ: AED 25.00 التاريخ: 04/10/2026, 9:05 الحد المتوفر: 800.00 AED'});
const scan=(h,events)=>h.inbox.syncImpl({events,minPostedAt:h.ctx.S.settings.bankSmsStartAt,maxPostedAt:h.now,force:true});
(async()=>{
 for(const [currency,unit] of [['AED',0.01],['KWD',0.001],['JPY',1]]){
  const q=harness();q.ctx.S.accounts.push({id:'minor',type:'bank',currency,openingBalance:2,openingBalanceKnown:true});
  const parsed={availableBalance:2-unit,balanceType:'ledger_balance',postedAt:q.now};
  assert.equal(q.inbox.applyReconciliation(parsed,{observationAccountId:'minor'}).warning,true,currency+' native observation discrepancy');
  assert.equal(q.ctx.S.accounts[0].bankReconciliation.difference,-unit);
  q.ctx.S.accounts[0]={id:'minor',type:'credit',currency,openingDebt:1,openingDebtKnown:true,creditLimit:2};
  assert.equal(q.inbox.applyReconciliation({availableCredit:1-unit,postedAt:q.now},{observationAccountId:'minor'}).warning,true);
  assert.equal(q.ctx.S.accounts[0].creditReconciliation.difference,-unit);
 }
 // The real parser, planner, financial validator and mutation service share one commit.
 const h=harness();await scan(h,[salary(h)]);assert.equal(h.ctx.S.transactions.length,1);
 assert.equal(I.eventDecision(h.ctx.S,'synthetic-salary').action,'saved');assert.equal(F.accountBalance(h.ctx.S,h.ctx.S.accounts[0].id),null);assert.equal(F.accountMovement(h.ctx.S,h.ctx.S.accounts[0].id),9000);assert.equal(F.accountBalancePresentation(h.ctx.S,h.ctx.S.accounts[0].id).observed,9001.66);
 h.restart();await scan(h,[salary(h)]);assert.equal(h.ctx.S.transactions.length,1);
 // An explicit deletion cannot be undone by a later historical SMS replay.
 await h.ctx.commitCriticalMutation(()=>{h.ctx.S.transactions=[];return true;});await scan(h,[salary(h)]);assert.equal(h.ctx.S.transactions.length,0);
 const backup=Backup.makeFullBackup({state:h.ctx.S,fingerprint:State.stateFingerprint});assert(Backup.validateFullEnvelope(backup,State.stateFingerprint));
 assert.equal(backup.finance.settings.bankEventDecisions['synthetic-salary'].action,'saved');

 const failed=harness();failed.failFinance(true);const result=await scan(failed,[salary(failed)]);
 assert.equal(failed.ctx.S.transactions.length,0);assert.equal(I.eventDecision(failed.ctx.S,'synthetic-salary'),null);assert.equal(failed.acks.length,0);
 failed.failFinance(false);await scan(failed,[salary(failed)]);assert.equal(failed.ctx.S.transactions.length,1);
 // Finance succeeds but the audit fails: replay must still post zero new transactions.
 const audit=harness();audit.failKey('bankDecisionAudit');assert.equal((await scan(audit,[salary(audit)])).ok,false);assert.equal(audit.acks.length,0);
 audit.restart();audit.failKey(null);await scan(audit,[salary(audit)]);assert.equal(audit.ctx.S.transactions.length,1);

 const dismissed=harness();dismissed.inbox.smsReviewEvents=[review(dismissed)];await dismissed.persist();
 await dismissed.inbox.dismiss('synthetic-review');dismissed.restart();await scan(dismissed,[review(dismissed)]);
 assert.equal(dismissed.inbox.smsReviewEvents.length,0);assert.equal(dismissed.ctx.S.transactions.length,0);
 const reject=harness();reject.inbox.smsReviewEvents=[review(reject)];reject.failFinance(true);
 assert.equal(await reject.inbox.dismiss('synthetic-review'),false);assert.equal(reject.inbox.smsReviewEvents.length,1);assert.equal(reject.acks.length,0);

 const defaults=harness();delete defaults.ctx.S.settings.bankSmsStartAt;const first=defaults.inbox.configuredSmsStart();defaults.advance(2*86400000);
 assert.equal(defaults.inbox.configuredSmsStart(),first);assert(await defaults.inbox.ensureSmsStart());defaults.restart();assert.equal(defaults.inbox.configuredSmsStart(),first);
 const defaultFailure=harness();delete defaultFailure.ctx.S.settings.bankSmsStartAt;defaultFailure.failFinance(true);await defaultFailure.inbox.refreshRecentSms();assert.equal(defaultFailure.queries.length,0);

 // Failed expanded ranges cannot inherit the later checkpoint from a different range.
 for(const status of ['query-failed','cancelled','review-capacity','processing-failed']){
  const changed=harness(),floor=changed.ctx.S.settings.bankSmsStartAt;
  changed.store.bankImportLastRecent={configuredStartAt:floor+86400000,scannedThrough:changed.now-3600000,status:'complete'};
  changed.inbox.requestHistoricalPage=async()=>({ok:false,status});await changed.inbox.refreshRecentSms();assert.equal(changed.store.bankImportLastRecent.scannedThrough,0);
  let options;changed.inbox.importHistoricalSms=async(d,o)=>{options=o;};await changed.inbox.refreshRecentSms();assert.equal(options.fromDate,floor,status);
 }
 const historical=harness();historical.store.bankImportLastRecent={configuredStartAt:historical.ctx.S.settings.bankSmsStartAt,scannedThrough:historical.now-86400000};
 const before=clone(historical.store.bankImportLastRecent);await historical.inbox.importHistoricalSms(0,{mode:'historical',fromDate:historical.now-3600000});assert.deepEqual(historical.store.bankImportLastRecent,before);
 const busy=harness();busy.inbox.historicalImporting=true;await busy.inbox.saveSmsConfig();assert.equal(busy.ctx.S.settings.bankSmsStartAt,busy.now-30*86400000);
 // Invalid identities and registry exhaustion cannot silently drop decisions.
 assert.throws(()=>I.rememberEventDecision(empty(),'__proto__','dismissed',1));
 const full=empty();full.settings.bankEventDecisions=Object.fromEntries(Array.from({length:I.EVENT_DECISION_LIMIT},(_,n)=>['event-'+n,{action:'dismissed',at:1,transactionId:null}]));
 assert.throws(()=>I.rememberEventDecision(full,'one-more','dismissed',1),/capacity/);assert.equal(Object.keys(full.settings.bankEventDecisions).length,I.EVENT_DECISION_LIMIT);
 I.rememberEventDecision(full,'event-1','ignored',2);assert.equal(full.settings.bankEventDecisions['event-1'].action,'ignored');
 const invalid=empty();invalid.settings.bankEventDecisions={bad:{action:'saved',at:-1}};assert(Schema.validateStateStrict(invalid).length);
 // An observation-only event must update its matching snapshot atomically too.
 const obs=harness();
 const wallet={id:'wallet',type:'ewallet',country:'EGY',currency:'EGP',openingBalance:0,openingBalanceKnown:false,observedBalance:200,observedBalanceAt:obs.now-2000,bankReconciliation:{kind:'balance',observed:200,at:obs.now-2000,status:'observed-only'}};
 obs.ctx.S.accounts.push(wallet);obs.ctx.S=Schema.migrate(obs.ctx.S);assert.equal((await obs.persist()).ok,true);
 const parsed={eventId:'observation-only',kind:'balance_observation',availableBalance:75,postedAt:obs.now-1000};
 const plan={action:'observe',observations:[{accountId:'wallet',field:'observedBalance',value:75,at:parsed.postedAt}]};
 assert.equal((await obs.inbox.commitPlan(parsed,plan)).ok,true);
 assert.equal(obs.ctx.S.accounts[0].bankReconciliation.observed,75,'observation-only reconciliation must not retain old balance');
 obs.restart();assert.equal(obs.ctx.S.accounts[0].bankReconciliation.at,parsed.postedAt);
 const available=harness();available.ctx.S.accounts.push({...wallet,openingBalanceKnown:true,openingBalance:300});available.ctx.S=Schema.migrate(available.ctx.S);await available.persist();
 assert.equal((await available.inbox.commitPlan(parsed,plan)).ok,true);
 assert.equal(available.ctx.S.accounts[0].bankReconciliation.difference,null,'available balance is not comparable with ledger balance');
 // A provider page is one durable financial mutation, including its terminal decisions.
 const batch=harness();const rows=Array.from({length:20},(_,n)=>({...salary(batch),id:'batch-'+n,postedAt:batch.now-60000+n,text:'Purchase AED '+(10+n)+'.00 at SYNTHETIC '+n+' using debit card ending 7654. Available balance AED 900.00. Transaction reference BATCH'+String(n).padStart(4,'0')}));
 const failedBatch=await batch.inbox.syncImpl({events:rows,historical:true,force:true});
 assert.equal(failedBatch.ok===false,false);assert.equal(batch.ctx.S.transactions.length,20);assert.equal(batch.writes,1,'one atomic verified financial write per page');
 batch.restart();await batch.inbox.syncImpl({events:rows,historical:true,force:true});assert.equal(batch.ctx.S.transactions.length,20);
 const failedPage=harness();failedPage.failFinance(true);const noSave=await failedPage.inbox.syncImpl({events:rows,historical:true,force:true});assert.equal(noSave.ok,false);assert.equal(failedPage.ctx.S.transactions.length,0);assert.equal(failedPage.acks.length,0);assert.equal(I.eventDecision(failedPage.ctx.S,'batch-0'),null);
 failedPage.failFinance(false);await failedPage.inbox.syncImpl({events:rows,historical:true,force:true});assert.equal(failedPage.ctx.S.transactions.length,20);failedPage.restart();assert.equal(failedPage.ctx.S.transactions.length,20);
 const concurrent=harness();let intervened=false;
 concurrent.inbox.yieldUi=async()=>{if(!intervened){intervened=true;await concurrent.ctx.commitCriticalMutation(()=>{concurrent.ctx.S.settings.bankAutoImportEnabled=false;return true;});}};
 const stale=await concurrent.inbox.syncImpl({events:rows,historical:true,force:true,cooperative:true});
 assert.equal(stale.ok,false);assert.equal(concurrent.ctx.S.transactions.length,0);assert.equal(concurrent.ctx.S.settings.bankAutoImportEnabled,false);assert.equal(concurrent.acks.length,0,'concurrent user change rejects stale draft and preserves evidence');
 const progress=harness();let starts=0,ends=0,notifications=[];
 progress.ctx.AndroidBridge.beginSmsImportForeground=()=>{starts++;return true;};progress.ctx.AndroidBridge.endSmsImportForeground=()=>ends++;
 progress.ctx.AndroidBridge.updateSmsImportForeground=(read,added,review,total)=>{assert(progress.store.bankImportActive,'notification must follow durable checkpoint');notifications.push({read,total});};
 let page=0;progress.inbox.requestHistoricalPage=async()=>({ok:true,done:++page===2,scanned:20,remainingCount:page===1?40:undefined,nextAfterDate:progress.now-1000+page,nextAfterId:page*20,messages:[]});
 await progress.inbox.importHistoricalSms(0,{fromDate:1});assert.equal(starts,1);assert.equal(ends,1);assert.equal(progress.inbox.lastHistoricalImport.totalCount,40);assert.equal(notifications.at(-1).read,40);assert.equal(progress.store.bankImportActive.status,'complete');
 progress.store.bankImportActive.status='paused';assert.equal(await progress.inbox.cancelHistoricalImport('user'),true);assert.equal(progress.store.bankImportActive.status,'cancelled');
 progress.store.bankImportActive.status='paused';progress.failKey('bankImportActive');assert.equal(await progress.inbox.cancelHistoricalImport('user'),false);assert.equal(progress.store.bankImportActive.status,'paused');
 console.log('Atomic page: 20 postings, one verified financial write, durable decisions, rollback and retry: PASS');
 console.log('Durable financial decisions, dismissal/restart/backup, write failures, frozen starts and compatible checkpoints: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
