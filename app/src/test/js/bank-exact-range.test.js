'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const I=require('../../main/assets/js/bank-ingestion-core'),M=require('../../main/assets/js/bank-message-core'),State=require('../../main/assets/js/state-core');
const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
const now=1791100000000,floor=now-180000;
assert.equal(I.recentScanStart(null,now,floor),floor);
assert.equal(I.recentScanStart({scannedThrough:now-60},now,floor),floor);
assert.equal(I.recentScanStart({scannedThrough:now-1000},now,now-86400000),now-301000);
assert.equal(I.recentScanStart({scannedThrough:now+1000},now,floor),floor);
const start=html.indexOf('function localDateTimeInput('),end=html.indexOf('function txRowHtml(',start);
const ctx={Date,pad:n=>String(n).padStart(2,'0'),esc:String};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
const v='2026-10-04T16:10';assert.equal(ctx.localDateTimeInput(ctx.parseLocalDateTime(v)),v);
for(const x of ['2026-02-30T12:00','2026-10-04T24:00','2026-10-04','2026-13-01T16:01'])assert.equal(ctx.parseLocalDateTime(x),null);
const p=M.parse({id:'clock',title:'EI SMS',postedAt:now,text:'عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: MERCHANT المبلغ: AED 25.00 التاريخ: 04/10/2026, 9:05 الحد المتوفر: 800.00 AED'});
assert(p.recognized);const built=M.buildTransaction(p,{status:'routed',account:{id:'c',type:'credit',currency:'AED'},instrument:{id:'card'}},{uid:()=> 't'});
assert(built.ok);assert.equal(built.transaction.transactionTime,'09:05');assert.equal(built.transaction.smsReceivedAt,now);assert.equal(built.transaction.timeSource,'bank-message');
const without=M.buildTransaction({...p,transactionTime:null},{status:'routed',account:{id:'c',currency:'AED'}},{uid:()=> 'u'}).transaction;
assert.equal(without.transactionTime,null);assert(ctx.transactionTimeText(without).includes('استلام'),'SMS receipt time must not be mislabeled as bank event time');
assert(State.txTimeValue({date:'2026-10-04',transactionTime:'09:05',created:now})<State.txTimeValue({date:'2026-10-04',transactionTime:'10:05',created:now-999999}));
const a=html.indexOf('const SanadBankInbox = {'),b=html.indexOf('\n};',a);
assert(a>=0&&b>a);
async function run(extra={}){
 const store={},saved=[],acked=[];
 const state={settings:{bankSmsStartAt:floor},transactions:[]};
 const context={S:state,Date,Set,Map,Number,Math,Object,_dataReplacementInFlight:false,canWrite:()=>true,uid:()=> 't',toast(){},AndroidBridge:{acknowledgeBankNotifications:ids=>acked.push(...JSON.parse(ids))},SanadExtStorage:{get:async(k,f)=>store[k]??f,set:async(k,v)=>{if(k===extra.failKey)return false;store[k]=JSON.parse(JSON.stringify(v));return true;}},BankIngestionCore:{eventDecision:I.eventDecision,rememberEventDecision:I.rememberEventDecision,sortNotifications:arr=>arr.slice(),plan:p=>({action:p.action||'auto-save',reason:'test',transaction:{id:p.eventId}})},BankMessageCore:{parse:n=>({recognized:true,eventId:n.id,action:n.action,kind:'purchase',amount:1,currency:'AED',postedAt:n.postedAt}),resolveRoute:()=>({status:'routed'})}};
 vm.createContext(context);const inbox=vm.runInContext('('+html.slice(a+'const SanadBankInbox = '.length,b+2)+')',context);
 Object.assign(inbox,{supported:()=>true,readNative:()=>[{id:'old-queue',postedAt:floor-1,text:'old'},{id:'now-queue',postedAt:now,text:'new'}],commitPlan:async(p,plan)=>{saved.push(plan.transaction.id);return {ok:true};}});
 const events=[{id:'too-old',postedAt:floor-1,text:'old'},{id:'boundary',postedAt:floor,text:'at-boundary'},{id:'future',postedAt:now+1,text:'future'}];
 const result=await inbox.syncImpl(extra.review?{viewReview:true}:{events,minPostedAt:floor,maxPostedAt:now});
 return {store,saved,acked,inbox,result};
}
(async()=>{
 const x=await run();assert.deepEqual(x.saved,['boundary']);assert.deepEqual(x.acked,['boundary']);assert.equal(x.store.bankDecisionAudit.rows[0].id,'boundary');
 const reviewWrite=await run();await reviewWrite.inbox.recordAudit(Array.from({length:1001},(_,i)=>({id:'log'+i,text:'diagnostic'})));assert.equal(reviewWrite.store.bankDecisionAudit.rows.length,1000);assert.equal(reviewWrite.store.bankDecisionAudit.omitted,2);
 const fail=await run({failKey:'bankDecisionAudit'});assert.equal(fail.result.ok,false);assert.deepEqual(fail.acked,[],'failed audit persistence cannot acknowledge or advance scan');
 const review=await run({review:true});assert.deepEqual(review.saved,[],'opening review does not post old pending messages');assert.equal(review.inbox.items.length,2,'historic review remains visible');
 assert(html.includes('data-sanad-act="bank-support-export"'));assert(html.includes('diagnosticReport={'));assert(html.includes("'bankSmsReviewEvents'"));
 console.log('Exact range, queue isolation, bank/manual time, review visibility and audit failure safety: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
