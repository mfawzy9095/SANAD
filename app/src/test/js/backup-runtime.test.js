'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
function slice(a,b){const from=html.indexOf(a),to=html.indexOf(b,from);assert(from>=0&&to>from);return html.slice(from,to);}
const guard=slice('let _dataReplacementInFlight=false;','function canWrite()');
const importer=slice('  async importData(data,ask=true){','  async importFile(file)');
async function scenario(failure,rollbackFails=false,auditExtra={}){
 let finance={transactions:[{id:'old'}]},receipts=[{txId:'old'}],recoveries=0;
 const incoming={transactions:[{id:'new'}],settings:{bankEventDecisions:{'dismissed-old':{action:'dismissed',at:1,transactionId:null}}}};let writes=0,financeCalls=0,failedOnce=false;const supportStore={bankSmsReviewEvents:[{id:'old-review',text:'old',postedAt:1}],bankDecisionAudit:{rows:[{id:'old-audit'}]}};
 const ctx={_criticalMutationInFlight:false,SanadBankInbox:{},toast(){},console:{error(){}},canWrite:()=>true,deepClone:x=>JSON.parse(JSON.stringify(x)),snapshotState:()=>JSON.parse(JSON.stringify(finance)),dialog:async()=>true,render(){},syncNativeNotifications(){},enterRecoveryMode:async()=>{recoveries++;},SanadFamily:{state:{name:'old'}},SanadCloud:{config:null,meta:{dirty:false},safeApplyRemote:async state=>{financeCalls++;if(rollbackFails&&financeCalls===2)return false;finance=state;return true;},validConfig:()=>true},SanadExtStorage:{get:async(k,f)=>supportStore[k]??f,listReceipts:async()=>receipts,replaceReceipts:async r=>{if(failure==='receipt'&&r[0]?.txId==='new')return false;receipts=r;return true;},set:async(k,v)=>{writes++;if(failure===k&&!failedOnce){failedOnce=true;return false;}supportStore[k]=v;return true;},del:async()=>true}};
 vm.createContext(ctx);vm.runInContext(guard,ctx);
 const backup=vm.runInContext('({'+importer+'})',ctx);backup.prepare=()=>({migrated:incoming,receipts:[{txId:'new'}]});
 const ok=await backup.importData({features:{bankImportAudit:Object.assign({smsReviewEvents:[{id:'new-review',text:'new',postedAt:2}],pendingEvents:[{id:'new-native',text:'pending',postedAt:3}],decisions:{rows:[{id:'new-audit'}]},recent:{configuredStartAt:1,scannedThrough:999}},auditExtra)}},false);
 assert.strictEqual(vm.runInContext('_dataReplacementInFlight',ctx),false,'lock always releases');
 return {ok,finance,receipts,recoveries,supportStore};
}
(async()=>{
 const ctx={_criticalMutationInFlight:false,SanadBankInbox:{},toast(){}};vm.createContext(ctx);vm.runInContext(guard,ctx);
 let release;const operation=vm.runInContext('withExclusiveDataOperation',ctx)(()=>new Promise(r=>{release=r;}));
 assert.strictEqual(await vm.runInContext('withExclusiveDataOperation',ctx)(()=>true),false,'second restore blocked');release(true);assert.strictEqual(await operation,true);
 for(const flag of ['_criticalMutationInFlight','_financialFlowInFlight']){vm.runInContext(flag+'=true',ctx);assert.strictEqual(await vm.runInContext('withExclusiveDataOperation',ctx)(()=>true),false);vm.runInContext(flag+'=false',ctx);}
 ctx.SanadBankInbox.historicalImporting=true;assert.strictEqual(await vm.runInContext('withExclusiveDataOperation',ctx)(()=>true),false);ctx.SanadBankInbox.historicalImporting=false;
 await assert.rejects(vm.runInContext('withExclusiveDataOperation',ctx)(()=>{throw Error('test');}),/test/);assert.strictEqual(vm.runInContext('_dataReplacementInFlight',ctx),false);
 const ok=await scenario();assert(ok.ok);assert.strictEqual(ok.finance.transactions[0].id,'new');assert.equal(ok.supportStore.bankSmsReviewEvents.length,2);assert.equal(ok.supportStore.bankDecisionAudit.rows[0].id,'new-audit');assert.equal(ok.supportStore.bankImportLastRecent.scannedThrough,0,'restored coverage must be revalidated against the current SMS provider');assert.equal(ok.finance.settings.bankEventDecisions['dismissed-old'].action,'dismissed');
 for(const extra of [{decisions:{rows:{}}},{decisions:{rows:[],omitted:-1}},{recent:{scannedThrough:'invalid'}},{smsReviewEvents:{}}]){const invalid=await scenario(null,false,extra);assert(!invalid.ok);assert.equal(invalid.finance.transactions[0].id,'old');}
 for(const f of ['receipt','family','bankDecisionAudit']){const failed=await scenario(f);assert(!failed.ok);assert.strictEqual(failed.finance.transactions[0].id,'old');assert.strictEqual(failed.receipts[0].txId,'old');assert.strictEqual(failed.recoveries,0);assert.equal(failed.supportStore.bankSmsReviewEvents[0].id,'old-review');}
 const unsafe=await scenario('receipt',true);assert(!unsafe.ok);assert.strictEqual(unsafe.recoveries,1,'failed rollback forces read-only recovery');
 // Compression finishing after the user closes a draft must never attach to the next transaction.
 const receiptCode=slice('  async handleFile(file){','  async compress(file){');let finish;
 const receiptCtx={_dataReplacementInFlight:false,_financialFlowInFlight:false,S:{form:{id:'draft'}},SanadExtStorage:{mode:'idb'},ReceiptCore:require('../../main/assets/js/receipt-core'),toast(){},console};vm.createContext(receiptCtx);
 const receipt=vm.runInContext('({'+receiptCode+'})',receiptCtx);Object.assign(receipt,{draftGeneration:0,compress:()=>new Promise(r=>{finish=r;}),ensureInput:()=>({value:''}),refreshControls(){}});
 const pending=receipt.handleFile({type:'image/png',size:10});receipt.draftGeneration++;finish({type:'image/jpeg',size:10});await pending;assert(!receipt.pending);assert.strictEqual(receipt.processing,false);
 console.log('Full restore: concurrency, round trip, verified rollback/recovery and cancelled receipt: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

