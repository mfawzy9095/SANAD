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
 const inbox=vm.runInContext('({'+html.slice(html.indexOf('  updateImportProgress(){'),html.indexOf('  homeImportHtml(){'))+html.slice(start,end)+'})',context);
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
 for(const failure of ['cancelled','review-capacity','query-failed','permission-restricted','processing-failed','cancel-last']){
  const x=await scenario(failure);
  assert.strictEqual(x.writes.bankImportLastRecent.scannedThrough,now-3*day,'failed scan cannot skip unprocessed messages');
  assert.strictEqual(x.inbox.historicalImporting,false);
 }
 for(const failKey of ['bankImportLastHistorical','bankImportLastRecent']){
  const x=await scenario('complete','recent',true,{failKey});
  assert.strictEqual(x.inbox.lastRecentImport.scannedThrough,now-3*day);
  assert.strictEqual(x.inbox.lastHistoricalImport.status,'checkpoint-failed');
 }
 const navigated=await scenario('navigate-last');
 assert.strictEqual(navigated.writes.bankImportLastRecent.scannedThrough,now,'navigation must not cancel scan');
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
 const a=html.indexOf('  applyReconciliation(parsed,plan,state=S){'),b=html.indexOf('  async commitPlan(parsed,plan){',a);
 const ctx={S:state,Date,Number,Math,isFiniteNumberLike:v=>v!=null&&v!==''&&Number.isFinite(Number(v)),Finance:{getAccount:id=>state.accounts.find(x=>x.id===id)},FinanceCore:{getAccount:(s,id)=>s.accounts.find(x=>x.id===id),accountBalanceAt:()=>1000,creditAvailableCalculated:()=>null}};
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
 const ctx={S:state,Finance:{getAccount:id=>state.accounts.find(x=>x.id===id)},esc:s=>String(s),countryInfo:code=>({name:code})};vm.createContext(ctx);
 const ui=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 const p={kind:'purchase',country:'EGY',currency:'MAD',amount:100,cardLast4:'9721'};
 assert(ui.correctionSourceOptions(p,'').includes('instrument:card'));
 assert(ui.correctionSourceOptions(p,'').includes('(EGP)'));
 assert.strictEqual(I.routeFromManualChoice(p,state,{sourceType:'instrument',sourceId:'card'}).status,'routed');
 assert.strictEqual(require('../../main/assets/js/bank-message-core').buildTransaction(p,I.routeFromManualChoice(p,state,{sourceType:'instrument',sourceId:'card'})).ok,false);
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


// UI regression: a 7-day quick scan never silently reopens the full historical range,
// and financial review keeps the bank message timestamp distinct from SMS receipt time.
assert(html.includes('Math.max(now-7*86400000,BankIngestionCore.recentScanStart(compatible,now,floor))'));
assert(html.includes('استلام الرسالة: '));
assert(html.includes('عرض نص الرسالة الأصلية'));
assert(html.includes('aria-label="نسبة التقدم"'));
assert(html.includes('data-sanad-act="bank-fix"'));
{
 const a=html.indexOf('function bankTxSourceHtml(t,acc,card){'),b=html.indexOf('function txRowHtml(t, withSwipe){',a);
 assert(a>=0&&b>a,'compact bank source helper exists');
 const state={institutions:[{id:'enbd-institution',bankRegistryId:'emirates-nbd',name:'Emirates NBD Bank P.J.S.C'}]};
 const ctx={S:state,UaeBankRegistryCore:{get:()=>({short:'ENBD'})},bankUiShort:()=> 'ENBD',esc:x=>String(x),financialInstitutionMark:()=>'<mark/>'};
 vm.createContext(ctx);
 const view=vm.runInContext('('+html.slice(a,b).trim().replace(/}\s*$/,'}')+')',ctx);
 const card=view({}, {institutionId:'enbd-institution',name:'full name',type:'credit'},{type:'credit_card',last4:'4021'});
 assert(card.includes('ENBD')&&card.includes('4021')&&card.includes('ائتمان'));
 assert(!card.includes('P.J.S.C'),'legal bank suffix must not clutter transaction row');
}
{
 const a=html.indexOf('  correctionSourceOptions(parsed,selected){'),b=html.indexOf('  correctionTargetOptions(parsed,selected){',a);
 assert(a>=0&&b>a,'review account/card picker exists');
 const state={institutions:[{id:'bank',bankRegistryId:'emirates-nbd'}],accounts:[{id:'credit',institutionId:'bank',name:'long legal company account name',type:'credit',currency:'AED',country:'UAE'}],paymentInstruments:[{id:'4021',accountId:'credit',type:'credit_card',last4:'4021'}]};
 const ctx={S:state,UaeBankRegistryCore:{get:()=>({short:'ENBD'})},bankUiShort:()=> 'ENBD',countryInfo:()=>({name:'الإمارات'}),esc:x=>String(x)};
 vm.createContext(ctx);
 const ui=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 const selected=ui.correctionSourceOptions({kind:'outgoing_transfer'},'instrument:4021');
 assert(selected.includes('value="account:credit"'));
 assert(selected.includes('value="instrument:4021" selected'));
 assert(selected.includes('حساب سداد بطاقة')&&selected.includes('بطاقة ائتمان'));
 assert(!selected.includes('long legal company account name'));
}


// QA regression: priority order is display-only and is saved atomically.
(async()=>{
 const state={settings:{categoryOrder:{expense:['transport','food'],income:[]}},categories:{expense:[],income:[]}};
 const defaults={expense:[{id:'food'},{id:'transport'},{id:'bills'}],income:[]};
 const a=html.indexOf('  allCats(type){'),b=html.indexOf('  periodRange(',a);
 assert(a>=0&&b>a);
 const ctx={S:state,DEFAULT_CATS:defaults,Map};vm.createContext(ctx);
 const finance=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 assert.deepStrictEqual(Array.from(finance.allCats('expense'),x=>x.id),['transport','food','bills']);
 const s=html.indexOf('async function saveCategorySort(type,ids){'),e=html.indexOf('function openCatEdit(type, id){',s);
 assert(s>=0&&e>s);
 let writes=0,fail=false;
 const saveCtx={S:state,Finance:finance,canWrite:()=>true,Set,Array,Object,document:{addEventListener:()=>{}},toast:()=>{},commitCriticalMutation:async task=>{
   if(fail)return {ok:false};
   await task();writes++;return {ok:true};
 }};
 vm.createContext(saveCtx);vm.runInContext(html.slice(s,e),saveCtx);
 assert.strictEqual(await saveCtx.saveCategorySort('expense',['bills','food','transport']),true);
 assert.strictEqual(writes,1);
 assert.deepStrictEqual(Array.from(state.settings.categoryOrder.expense),['bills','food','transport']);
 assert.strictEqual(await saveCtx.saveCategorySort('expense',['bills','bills','food']),false);
 assert.strictEqual(writes,1,'duplicate category sort must not write finance state');
 fail=true;
 assert.strictEqual(await saveCtx.saveCategorySort('expense',['transport','bills','food']),false);
 assert.deepStrictEqual(Array.from(state.settings.categoryOrder.expense),['bills','food','transport'],'failed persist must not change order in this harness');
 assert(html.includes('data-cat-drag=')&&html.includes("data-cat-step=")&&html.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
 console.log('Ordered category grid: semantic list sorting, persisted drag priorities and rejected unsafe order: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

// QR-like suffix is not a bank identity: only the authentic issuer may be a correction source.
{
 const state={
  institutions:[{id:'enbd',bankRegistryId:'emirates-nbd'},{id:'ei',bankRegistryId:'emirates-islamic'}],
  accounts:[{id:'debit',type:'bank',name:'ENBD debit',institutionId:'enbd',country:'UAE',currency:'AED'},
            {id:'credit',type:'credit',name:'EI credit',institutionId:'ei',country:'UAE',currency:'AED'}],
  paymentInstruments:[{id:'ei0308',accountId:'credit',type:'credit_card',last4:'0308',country:'UAE'}]
 };
 const a=html.indexOf('  correctionSourceOptions(parsed,selected){'),b=html.indexOf('  correctionDraft(item){',a);
 assert(a>=0&&b>a);
 const ctx={S:state,UaeBankRegistryCore:{get:id=>({id,short:id==='emirates-nbd'?'ENBD':'EI'})},bankUiShort:b=>b.short,countryInfo:()=>({name:'UAE'}),esc:x=>String(x)};
 vm.createContext(ctx);
 const u=vm.runInContext('({'+html.slice(a,b)+'})',ctx);
 const p={kind:'card_repayment',bankId:'emirates-nbd',country:'UAE',currency:'AED',cardLast4:'0308'};
 const sources=u.correctionSourceOptions(p,'account:debit');
 assert(sources.includes('account:debit')&&!sources.includes('account:credit')&&!sources.includes('ei0308'),'card-repayment source must be ENBD, not EI payee');
 const targets=u.correctionTargetOptions(p,'credit');
 assert(targets.includes('value="credit" selected'),'EI card can be the target of ENBD repayment');
 assert(!targets.includes('value="debit"'));
}
assert(html.includes('id="bankFixIssues"')&&html.includes('bank-required')&&html.includes('data-bank-conditional="target"')&&html.includes('data-bank-conditional="incoming"'));
assert(html.includes('data-sanad-act="bank-edit-accounts"'));
