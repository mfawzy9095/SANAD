'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'../../main/assets/index.html'),'utf8');
const start=html.indexOf('  async importHistoricalSms(days=0,options={}){'),end=html.indexOf('  canManualApprove(item){',start);
const store={},now=1791288000000;let fail=false;
function instance(pages){
 const ctx={Date:class extends Date{static now(){return now;}},S:{tab:'settings'},Set,Number,Math,Object,toast(){},render(){},canWrite:()=>true,SanadExtStorage:{get:async(k,f)=>store[k]??f,set:async(k,v)=>{if(fail&&k==='bankImportActive')return false;store[k]=JSON.parse(JSON.stringify(v));return true;}}};vm.createContext(ctx);
 const o=vm.runInContext('({'+html.slice(html.indexOf('  updateImportProgress(){'),html.indexOf('  homeImportHtml(){'))+html.slice(start,end)+'})',ctx);let queries=[];
 Object.assign(o,{historicalSupported:()=>true,historicalPermission:()=>true,yieldUi:async()=>{},sync:async()=>({added:1,reviewIds:[]}),requestHistoricalPage:async(d,date,id)=>{queries.push([date,id]);return pages.shift()||{ok:false,status:'worker-unavailable'};}});return {o,queries};
}
(async()=>{
 const a=instance([{ok:true,done:false,scanned:20,nextAfterDate:1000,nextAfterId:20}]);await a.o.importHistoricalSms(0,{fromDate:1});
 assert.equal(store.bankImportActive.nextAfterId,20,'cursor saved after successful batch');
 store.bankImportActive.pages=2000; // A previous per-run safety limit must remain resumable.
 const b=instance([{ok:true,done:true,scanned:5,nextAfterDate:1100,nextAfterId:25}]);await b.o.importHistoricalSms(0,{resume:true});
 assert.deepEqual(b.queries[0],[1000,20],'new JS instance resumes durable cursor');assert.equal(b.o.lastHistoricalImport.total.scanned,25);
 assert.equal(store.bankImportActive.status,'complete');
 fail=true;const c=instance([{ok:true,done:false,scanned:20,nextAfterDate:1500,nextAfterId:40}]);await c.o.importHistoricalSms(0,{fromDate:1});assert.equal(c.o.lastHistoricalImport.status,'checkpoint-failed');assert.equal(c.queries.length,0,'initial checkpoint failure prevents reading any page');
 console.log('Import durable resume and checkpoint failure: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
