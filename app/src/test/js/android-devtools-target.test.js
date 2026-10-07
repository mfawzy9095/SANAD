'use strict';
const assert=require('assert/strict');
const {findAppTarget}=require('../../../../tools/e2e/android-devtools-target');
(async()=>{
 const calls=[];let reads=0,waits=0;
 const adb=(...args)=>{calls.push(args);if(args[1]==='pidof')return '456';if(args[1]==='cat')return 'a @webview_devtools_remote_123\nb @webview_devtools_remote_456';return '';};
 const page={id:'sanad',type:'page',url:'https://appassets.androidplatform.net/assets/index.html',webSocketDebuggerUrl:'ws://local/app'};
 const found=await findAppTarget({adb,fetchTargets:async()=>++reads===1?[{...page,url:'about:blank'}]:[{...page,id:'unrelated',url:'https://example.invalid/'},page],wait:async()=>{waits++;},attempts:3});
 assert.equal(found.id,'sanad');assert.equal(waits,1);assert(calls.filter(c=>c[0]==='forward').every(c=>c[2]==='localabstract:webview_devtools_remote_456'));
 await assert.rejects(findAppTarget({adb,fetchTargets:async()=>[{...page,url:'https://example.invalid/'}],wait:async()=>{},attempts:2}),/asset page not ready/);
 let fetched=false;
 await assert.rejects(findAppTarget({adb:(...args)=>args[1]==='pidof'?'456':'a @webview_devtools_remote_123',fetchTargets:async()=>{fetched=true;return [page];},wait:async()=>{},attempts:2}),/socket unavailable/);
 assert.equal(fetched,false,'never inspect another app socket');
 console.log('Android DevTools target: own PID, ready asset page, bounded failure; no financial checks bypassed');
})().catch(e=>{console.error(e);process.exitCode=1;});
