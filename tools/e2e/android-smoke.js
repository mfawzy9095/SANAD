'use strict';
// Runs against the installed APK on an Android emulator. No mock native bridge.
// Use raw DevTools commands: WebView does not implement desktop Browser context APIs.

const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const pkg=process.env.SANAD_QA_PACKAGE||'com.sanad.v9test.forensicqa.stable',out=process.env.SANAD_QA_OUTPUT||'/tmp/sanad-android-qa';fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let browser,page;
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8'}).trim();
const pass=name=>{results.push({name,status:'PASS'});console.log('PASS:',name);};
(async()=>{
 adb('shell','am','start','-n',pkg+'/com.sanad.v9test.MainActivity');
 for(let n=0;n<60;n++){
  const sockets=adb('shell','cat','/proc/net/unix');const match=sockets.match(/@(webview_devtools_remote_\d+)/);
  if(match){adb('forward','tcp:9222','localabstract:'+match[1]);break;}
  await new Promise(r=>setTimeout(r,1000));
 }
 const targets=await (await fetch('http://127.0.0.1:9222/json/list')).json();
 const target=targets.find(t=>t.type==='page');assert(target);
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('DevTools timeout: '+method));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(fn,arg)=>{const r=await command('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg===undefined?null:arg)+')',awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await command('Runtime.enable');await command('Page.enable');
 page={evaluate,url:()=>target.url,waitForFunction:async(fn,arg)=>{for(let n=0;n<600;n++){if(await evaluate(fn,arg))return;await new Promise(r=>setTimeout(r,100));}throw Error('Android condition timed out: '+fn);},locator:selector=>({isVisible:()=>evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.getBoundingClientRect().height>0;},selector),click:()=>evaluate(s=>{const e=document.querySelector(s);if(!e)throw Error('missing '+s);e.click();},selector),fill:value=>evaluate(({s,v})=>{const e=document.querySelector(s);if(!e)throw Error('missing '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},{s:selector,v:value})}),reload:async()=>{await command('Page.reload');await new Promise(r=>setTimeout(r,1500));},screenshot:async({path})=>{const png=execFileSync('adb',['exec-out','screencap','-p'],{timeout:15000,maxBuffer:16*1024*1024});assert(png.length>8&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Native screenshot must be a PNG');fs.writeFileSync(path,png);}};
 browser={close:async()=>socket.close()};
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&SanadV9.initialized,{},{timeout:60000});
 assert.match(page.url(),/^https:\/\/appassets.androidplatform.net\/assets\/index.html/);
 if(await page.locator('#onboard').isVisible())await page.locator('[onclick="onboardSkip()"]').click();
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 assert.equal(await page.evaluate(()=>Storage._backend),'idb');pass('APK boots on Android; secure asset origin; real IndexedDB');
 assert.equal(await page.evaluate(()=>AndroidBridge.historicalSmsPermissionGranted()),false);
 adb('shell','pm','grant',pkg,'android.permission.READ_SMS');
 assert.equal(await page.evaluate(()=>AndroidBridge.historicalSmsPermissionGranted()),true);pass('Native READ_SMS permission state changes correctly');
 adb('emu','sms','send','15551234567','تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66');
 adb('emu','sms','send','15551234567','تم ايداع AED 100.00 في حسابك 012XXX50XXX01 الرصيد المتوفر هو AED 9,101.66');
 // Wait for Android's SMS provider to persist both messages before requesting a page.
 for(let n=0;n<30;n++){const rows=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body');if(rows.includes('9,000.00')&&rows.includes('100.00'))break;await new Promise(r=>setTimeout(r,1000));}
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());
 assert.equal(await page.evaluate(()=>S.transactions.length),0);
 assert(await page.evaluate(()=>SanadBankInbox.items.length>=2));
 pass('Unknown numeric SMS sender cannot impersonate bank body');
 // Use fresh native evidence after the previous scan checkpoint. Changing an old
 // provider row must not silently reinterpret the already retained review evidence.
 adb('emu','sms','send','15557654321','تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 OBP TR REF QANATIVESALARY01. الرصيد المتوفر هو AED 9,001.66');
 adb('emu','sms','send','15557654321','تم ايداع AED 100.00 في حسابك 012XXX50XXX01 OBP TR REF QANATIVEDEPOSIT01. الرصيد المتوفر هو AED 9,101.66');
 for(let n=0;n<30;n++){const rows=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body');if(rows.includes('QANATIVESALARY01')&&rows.includes('QANATIVEDEPOSIT01'))break;await new Promise(r=>setTimeout(r,1000));}
 adb('shell','content','update','--uri','content://sms','--bind','address:s:EmiratesNBD');
 assert(adb('shell','content','query','--uri','content://sms/inbox','--projection','address:body').includes('address=EmiratesNBD'),'Controlled provider sender metadata must be updated');
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());
 const result=await page.evaluate(()=>({last:SanadBankInbox.lastRecentImport,transactions:S.transactions,accounts:S.accounts}));
 assert.equal(result.last.status,'complete');assert.equal(result.transactions.length,2);
 const bank=result.accounts.find(a=>a.bankRefs?.includes('012XXX50XXX01'));assert(bank);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9101.66);
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),2);pass('Native SMS provider, paged bridge callback, salary/deposit import, balance and deduplication');
 const before=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),before);pass('Android WebView restart preserves financial state exactly');
 await page.evaluate(()=>openNewTx('expense'));await page.locator('#amountIn').fill('25');await page.locator('[data-act="save-tx"]').click();
 await page.waitForFunction(()=>S.transactions.length===3&&!_financialFlowInFlight);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9076.66);pass('Native WebView manual expense save and balance');
 const beforeFresh=await page.evaluate(()=>S.transactions.length);
 adb('emu','sms','send','15551234567','لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QANATIVEFRESH01. الرصيد المتوفر هو AED 9,086.66');
 for(let n=0;n<30;n++){if(adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body').includes('QANATIVEFRESH01'))break;await new Promise(r=>setTimeout(r,1000));}
 adb('shell','content','update','--uri','content://sms','--bind','address:s:EmiratesNBD');
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeFresh+1);
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeFresh+1);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9086.66);
 const scan=await page.evaluate(()=>SanadBankInbox.lastRecentImport);assert(scan.fromDate>0&&scan.throughDate>=scan.fromDate);
 pass('Bounded direct native SMS scan imports a just-arrived message once after earlier checkpoint');

 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('toast')).opacity)<0.01&&Number(getComputedStyle(document.getElementById('backdrop')).opacity)<0.01&&Number(getComputedStyle(document.querySelector('#view .wallet-hero')||document.getElementById('view')).opacity)>0.99);
 await page.screenshot({path:path.join(out,'android-home.png')});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',environment:'Android emulator API 35; real APK and AndroidBridge; synthetic SMS',results,errors},null,2));
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'FAIL',results,errors,error:e.message},null,2));if(page)try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

