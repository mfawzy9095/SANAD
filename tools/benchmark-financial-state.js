'use strict';
// Synthetic benchmark only. Optional baseline is a local copy of an earlier finance-core.
const fs=require('fs'),path=require('path'),vm=require('vm'),os=require('os'),{performance}=require('perf_hooks');
const F=require('../app/src/main/assets/js/finance-core');
const baselinePath=process.argv[2],baseline=baselinePath?(()=>{const ctx={module:{exports:{}},require};vm.createContext(ctx);vm.runInContext(fs.readFileSync(baselinePath,'utf8'),ctx);return ctx.module.exports;})():null;
const clone=x=>JSON.parse(JSON.stringify(x));
const time=fn=>{const samples=[];for(let n=0;n<3;n++){const start=performance.now();fn();samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return {medianMs:samples[1],maxMs:samples[2]};};
const results=[];
for(const count of [1000,22934,100000]){
 const state={accounts:[{id:'synthetic',type:'bank',currency:'AED',openingBalance:10000,openingBalanceKnown:true}],transactions:Array.from({length:count},(_,n)=>({id:'s-'+n,type:n%2?'income':'expense',accountId:'synthetic',currency:'AED',amount:0.01,walletAmount:0.01,fxRate:1,cat:'other',date:'2026-10-01',created:1790859000000+n})),settings:{}};
 const next=clone(state);next.transactions.push({id:'new',type:'expense',accountId:'synthetic',currency:'AED',amount:0.01,walletAmount:0.01,fxRate:1,cat:'other',date:'2026-10-01',created:1790859500000});
 const beforeBalance=baseline?time(()=>baseline.accountBalance(state,'synthetic')):null;
 const afterBalance=time(()=>F.accountBalance(state,'synthetic'));
 const copying=time(()=>{clone(state);clone(next);});
 const prewrite=time(()=>{if(F.validateMoneyChanges(next,state))throw Error('synthetic guard rejected');});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sanad-synthetic-bench-'));
 const snapshotIo=time(()=>{const text=JSON.stringify(next);for(let n=0;n<3;n++)fs.writeFileSync(path.join(dir,'snapshot-'+n+'.json'),text);if(fs.readFileSync(path.join(dir,'snapshot-0.json'),'utf8')!==text)throw Error('snapshot mismatch');});fs.rmSync(dir,{recursive:true});
 results.push({count,bytes:Buffer.byteLength(JSON.stringify(state)),beforeNumberBalance:beforeBalance,afterExactBalance:afterBalance,twoStateCopies:copying,exactPrewrite:prewrite,threeSnapshotFileIO:snapshotIo,rssBytes:process.memoryUsage().rss,heapUsedBytes:process.memoryUsage().heapUsed});
}
console.log(JSON.stringify({scope:'Desktop Node, synthetic ledger, 3 timing samples; filesystem snapshots are not IndexedDB/mobile storage. RSS sampled, not isolated peak. Browser/UI measured separately.',node:process.version,results,maxProcessRssKB:process.resourceUsage().maxRSS},null,2));
