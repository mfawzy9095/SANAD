'use strict';
// Runs against the installed APK on an Android emulator. No mock native bridge.
const {chromium}=require('playwright');
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const pkg='com.sanad.v9test.forensicqa.stable',out=process.env.SANAD_QA_OUTPUT||'/tmp/sanad-android-qa';fs.mkdirSync(out,{recursive:true});
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
 browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
 page=browser.contexts()[0].pages()[0];assert(page);
 page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&SanadV9.initialized,{},{timeout:60000});
 assert.match(page.url(),/^https:\/\/appassets.androidplatform.net\/assets\/index.html/);
 if(await page.locator('#onboard').isVisible())await page.locator('[onclick="onboardSkip()"]').click();
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 assert.equal(await page.evaluate(()=>Storage._backend),'idb');pass('APK boots on Android; secure asset origin; real IndexedDB');
 assert.equal(await page.evaluate(()=>AndroidBridge.historicalSmsPermissionGranted()),false);
 adb('shell','pm','grant',pkg,'android.permission.READ_SMS');
 assert.equal(await page.evaluate(()=>AndroidBridge.historicalSmsPermissionGranted()),true);pass('Native READ_SMS permission state changes correctly');
 adb('emu','sms','send','ENBD','Salary of AED 9,000.00 has been credited to your account 012XXX50XXX01. Available balance is AED 9,001.66');
 adb('emu','sms','send','ENBD','AED 100.00 has been credited to your account 012XXX50XXX01. Available balance is AED 9,101.66');
 // Wait for Android's SMS provider to persist both messages before requesting a page.
 for(let n=0;n<30;n++){const rows=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body');if(rows.includes('9,000.00')&&rows.includes('100.00'))break;await new Promise(r=>setTimeout(r,1000));}
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
 await page.screenshot({path:path.join(out,'android-home.png')});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',environment:'Android emulator API 35; real APK and AndroidBridge; synthetic SMS',results,errors},null,2));
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'FAIL',results,errors,error:e.message},null,2));if(page)try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
