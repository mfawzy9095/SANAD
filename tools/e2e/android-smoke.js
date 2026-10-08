'use strict';
// Runs against the installed APK on an Android emulator. No mock native bridge.
// Use raw DevTools commands: WebView does not implement desktop Browser context APIs.

const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {findAppTarget}=require('./android-devtools-target');
const {notificationExpand}=require('./android-notification-target');
const {readNotificationHierarchy}=require('./android-notification-dump');
const pkg=process.env.SANAD_QA_PACKAGE||'com.sanad.v9test.forensicqa.stable',out=process.env.SANAD_QA_OUTPUT||'/tmp/sanad-android-qa';fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let browser,page;
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8'}).trim();
// Update only synthetic rows explicitly carrying the trusted-source fixture marker.
const trustFixtureRows=()=>{
 const rows=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body');
 const ids=rows.split('\n').filter(row=>row.includes('QANATIVE')).map(row=>row.match(/_id=(\d+)/)?.[1]).filter(Boolean);
 assert(ids.length>=2,'Trusted fixture rows must exist in the native provider');
 // Android's SMS provider gates shell writes through WRITE_SMS app-op.
 adb('shell','appops','set','com.android.shell','WRITE_SMS','allow');
 ids.forEach(id=>{const response=adb('shell','content','update','--uri','content://sms/'+id,'--bind','address:s:EmiratesNBD');console.log('Trusted provider fixture update:',id,response);assert(!/Error|Exception|denied/i.test(response),'Provider fixture write must succeed: '+response);});
 const updated=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:address:body');
 console.log('Synthetic provider rows after fixture update:',updated);
 ids.forEach(id=>assert(updated.split('\n').some(row=>row.includes('_id='+id+',')&&row.includes('EmiratesNBD')),'Provider address must match trusted fixture id '+id));
};
// Exercise the system notification's real PendingIntent through System UI.
async function locateImportNotificationAction(label){
 adb('shell','cmd','statusbar','expand-notifications');
 for(let attempt=0;attempt<6;attempt++){
  const dumpAttempts=[];
  const xml=await readNotificationHierarchy({
    adb,
    wait:ms=>new Promise(r=>setTimeout(r,ms)),
    onAttempt:entry=>{
      dumpAttempts.push(entry);
      fs.writeFileSync(path.join(out,'notification-'+label+'-'+attempt+'-dump-attempts.json'),JSON.stringify(dumpAttempts,null,2));
    }
  });
  fs.writeFileSync(path.join(out,'notification-'+label+'-'+attempt+'.xml'),xml);
  const nodes=xml.match(/<node\b[^>]*>/g)||[];
  const hit=nodes.find(n=>n.includes('text="'+label+'"'));
  const tap=node=>{const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);if(!b)return false;adb('shell','input','tap',String(Math.floor((+b[1]+ +b[3])/2)),String(Math.floor((+b[2]+ +b[4])/2)));return true;};
  if(hit)return hit;
  const expand=notificationExpand(nodes,'SANAD · قراءة الرسائل محليًا');
  if(expand&&expand.includes('content-desc="Expand"'))tap(expand);
  else {
   // Ongoing low-priority imports can sit below expanded Messages notifications.
   // Scroll the real shade; do not substitute a direct JS/service invocation.
   const bounds=nodes.map(n=>n.match(/bounds="\[\d+,\d+\]\[(\d+),(\d+)\]"/)).filter(Boolean);
   if(!bounds.length){await new Promise(r=>setTimeout(r,300));continue;}
   const width=Math.max(...bounds.map(b=>+b[1])),height=Math.max(...bounds.map(b=>+b[2]));
   adb('shell','input','swipe',String(Math.floor(width/2)),String(Math.floor(height*.84)),String(Math.floor(width/2)),String(Math.floor(height*.4)),'200');
  }
  if(attempt===5)fs.writeFileSync(path.join(out,'notification-action-failure.xml'),xml);
  await new Promise(r=>setTimeout(r,150));
 }
 throw Error('Import notification action not visible: '+label);
}
const pass=name=>{results.push({name,status:'PASS'});console.log('PASS:',name);};
(async()=>{
 adb('shell','am','start','-n',pkg+'/com.sanad.v9test.MainActivity');
 const discovery=[];
 const target=await findAppTarget({adb,fetchTargets:async()=>{
  const response=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(5000)});
  assert(response.ok,'DevTools target list request failed');return response.json();
 },wait:ms=>new Promise(r=>setTimeout(r,ms)),onAttempt:entry=>{
  discovery.push(entry);fs.writeFileSync(path.join(out,'devtools-targets.json'),JSON.stringify(discovery,null,2));
 }});
 console.log('Attached app WebView:',target.id,target.url);
 let socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();
 const receive=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
 socket.addEventListener('message',receive);
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
 // Use fresh native evidence after the previous scan. Changing an old
 // provider row must not silently reinterpret the already retained review evidence.
 adb('emu','sms','send','15557654321','تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 OBP TR REF QANATIVESALARY01. الرصيد المتوفر هو AED 9,001.66');
 adb('emu','sms','send','15557654321','تم ايداع AED 100.00 في حسابك 012XXX50XXX01 OBP TR REF QANATIVEDEPOSIT01. الرصيد المتوفر هو AED 9,101.66');
 for(let n=0;n<30;n++){const rows=adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body');if(rows.includes('QANATIVESALARY01')&&rows.includes('QANATIVEDEPOSIT01'))break;await new Promise(r=>setTimeout(r,1000));}
 trustFixtureRows();
 assert(adb('shell','content','query','--uri','content://sms/inbox','--projection','address:body').includes('address=EmiratesNBD'),'Controlled provider sender metadata must be updated');
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Generic deposit remains review');
 const depositId=await page.evaluate(()=>SanadBankInbox.items.find(x=>x.parsed.transactionRef==='QANATIVEDEPOSIT01').native.id);
 await page.evaluate(id=>SanadBankInbox.openCorrection(id),depositId);
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Unconfirmed origin cannot post');
 await page.evaluate(()=>{document.getElementById('bankFixExternalIncome').checked=true;});
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(()=>S.transactions.length===2&&!_criticalMutationInFlight);
 // Durable write completes before saveCorrection finishes ack/sync/open.
 await page.waitForFunction(()=>document.getElementById('sheet').dataset.sheetType==='bank-inbox'&&document.getElementById('sheet').classList.contains('on'));
 await page.locator('#sheet [data-act="close-sheet"]').click();
 pass('Generic native inbound requires per-event external origin confirmation');
 const result=await page.evaluate(()=>({last:SanadBankInbox.lastRecentImport,transactions:S.transactions,accounts:S.accounts}));
 assert.equal(result.last.status,'complete');assert.equal(result.transactions.length,2);
 const bank=result.accounts.find(a=>a.bankRefs?.includes('012XXX50XXX01'));assert(bank);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),null);
 assert.equal(await page.evaluate(id=>FinanceCore.accountMovement(S,id),bank.id),9100);
 await page.evaluate(id=>openAccountSheet(id),bank.id);
 await page.locator('#wBalance').fill('1.66');await page.evaluate(()=>{document.getElementById('wOpeningKnown').checked=true;});
 await page.locator('[data-act="save-account"]').click();await page.waitForFunction(id=>S.accounts.find(a=>a.id===id)?.openingBalanceKnown===true&&S.accounts.find(a=>a.id===id)?.openingBalance===1.66&&!_criticalMutationInFlight,bank.id);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9101.66);
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),2);pass('Native SMS provider, paged bridge callback, salary/deposit import, balance and deduplication');
 const before=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&typeof SanadV9!=='undefined'&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),before);pass('Android WebView restart preserves financial state exactly');
 await page.evaluate(()=>openNewTx('expense'));await page.locator('#amountIn').fill('25');await page.locator('[data-act="save-tx"]').click();
 await page.waitForFunction(()=>S.transactions.length===3&&!_financialFlowInFlight);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9076.66);pass('Native WebView manual expense save and balance');
 const beforeFresh=await page.evaluate(()=>S.transactions.length);
 adb('emu','sms','send','15551234567','لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QANATIVEFRESH01. الرصيد المتوفر هو AED 9,086.66');
 for(let n=0;n<30;n++){if(adb('shell','content','query','--uri','content://sms/inbox','--projection','_id:body').includes('QANATIVEFRESH01'))break;await new Promise(r=>setTimeout(r,1000));}
 trustFixtureRows();
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeFresh);
 const freshId=await page.evaluate(()=>SanadBankInbox.items.find(x=>x.parsed.transactionRef==='QANATIVEFRESH01').native.id);
 await page.evaluate(id=>SanadBankInbox.openCorrection(id),freshId);
 await page.evaluate(()=>{document.getElementById('bankFixExternalIncome').checked=true;});
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeFresh);
 // Durable write completes before saveCorrection finishes ack/sync/open.
 await page.waitForFunction(()=>document.getElementById('sheet').dataset.sheetType==='bank-inbox'&&document.getElementById('sheet').classList.contains('on'));
 await page.locator('#sheet [data-act="close-sheet"]').click();

 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeFresh+1);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bank.id),9086.66);
 const scan=await page.evaluate(()=>SanadBankInbox.lastRecentImport);assert(scan.fromDate>0&&scan.throughDate>=scan.fromDate);
 pass('Bounded direct native SMS scan imports a just-arrived message once after earlier checkpoint');

 // Real foreground service and provider rows, no timer/mock bridge substitution.
 adb('shell','pm','grant',pkg,'android.permission.POST_NOTIFICATIONS');
 const fixtureDate=Date.now()-5000;
 adb('shell','for n in $(seq 1 160); do content insert --uri content://sms/inbox --bind address:s:QAPROGRESS --bind body:s:QA_PROGRESS_ONLY --bind date:l:'+fixtureDate+' >/dev/null || exit 1; done');
 assert.equal(await page.evaluate(()=>AndroidBridge.beginSmsImportForeground()),true);
 for(let n=0;n<30;n++){
  if(adb('shell','dumpsys','activity','services',pkg).includes('isForeground=true'))break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert(adb('shell','dumpsys','activity','services',pkg).includes('isForeground=true'),'Native service must actually enter foreground');
 const txBeforeBackground=await page.evaluate(()=>JSON.stringify(S.transactions));
 await page.evaluate(()=>{window.qaImportDone=false;SanadBankInbox.importHistoricalSms(0,{fromDate:1}).then(()=>{window.qaImportDone=true;});});
 await page.waitForFunction(()=>SanadBankInbox.historicalImporting&&SanadBankInbox.historicalProgress?.scanned>=20);
 assert.equal(await page.evaluate(()=>window.qaImportDone),false,'Scan must still be active before HOME');
 adb('shell','input','keyevent','KEYCODE_HOME');
 await page.waitForFunction(()=>window.qaImportDone);
 const backgroundScan=await page.evaluate(()=>SanadBankInbox.lastHistoricalImport);
 assert.equal(backgroundScan.status,'complete');assert(backgroundScan.total.scanned>=160);
 assert.equal(backgroundScan.totalCount,backgroundScan.total.scanned,'Known total comes from real SMS provider');
 assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),txBeforeBackground);
 for(let n=0;n<30&&adb('shell','dumpsys','activity','services',pkg).includes('isForeground=true');n++)await new Promise(r=>setTimeout(r,100));
 assert(!adb('shell','dumpsys','activity','services',pkg).includes('isForeground=true'),'Foreground service stops after completion');
 adb('shell','am','start','-n',pkg+'/com.sanad.v9test.MainActivity');
 pass('Native foreground SMS import completes while app is behind HOME; actual count, unchanged ledger, service cleanup');
 for(const [label,status] of [['إيقاف مؤقت','paused'],['إلغاء','cancelled']]){
  // A fast 165-message provider scan can end while adb injects the real
  // System UI notification tap. Slow cooperative yields for BOTH actions,
  // without stubbing the SMS provider, PendingIntent, checkpoint or ledger.
  await page.evaluate(()=>{
    window.qaNativeOriginalYieldUi=SanadBankInbox.yieldUi;
    SanadBankInbox.yieldUi=async function(ms){return window.qaNativeOriginalYieldUi.call(this,Math.max(Number(ms)||0,900));};
  });
  // Prepare the real shade before starting this short scan. UIAutomator discovery
  // took longer than the entire repeated 165-row scan in the retained failure.
  // The prior HOME -> am start command can return before Activity.onStart clears
  // backgroundedAtMs. Wait for actual WebView visibility and then retry the
  // native foreground-service eligibility check for a bounded interval.
  // Keep real System UI action taps and all financial/durable assertions below.
  await page.waitForFunction(()=>document.visibilityState==='visible');
  let serviceStarted=false;
  for(let resumeAttempt=0;resumeAttempt<30;resumeAttempt++){
   serviceStarted=await page.evaluate(()=>AndroidBridge.beginSmsImportForeground());
   if(serviceStarted)break;
   await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(serviceStarted,true,'Foreground import must start once Activity has resumed');
  const actionNode=await locateImportNotificationAction(label);
  const actionBounds=actionNode.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  assert(actionBounds,'Real System UI action must have visible bounds');
  await page.evaluate(()=>{window.qaImportDone=false;SanadBankInbox.importHistoricalSms(0,{fromDate:1}).then(()=>{window.qaImportDone=true;});});
  await page.waitForFunction(()=>SanadBankInbox.historicalImporting&&SanadBankInbox.historicalProgress?.scanned>=20);
  assert.equal(await page.evaluate(()=>window.qaImportDone),false,'Scan must still be active immediately before the real action tap');
  adb('shell','input','tap',String(Math.floor((+actionBounds[1]+ +actionBounds[3])/2)),String(Math.floor((+actionBounds[2]+ +actionBounds[4])/2)));
  adb('shell','cmd','statusbar','collapse');
  await page.waitForFunction(()=>window.qaImportDone);
  const stopped=await page.evaluate(()=>SanadExtStorage.get('bankImportActive',null));
  assert.equal(stopped.status,status);assert(stopped.total.scanned>0&&stopped.total.scanned<backgroundScan.total.scanned,'Notification action must interrupt actual unfinished reading');
  assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),txBeforeBackground);
  adb('shell','am','start','-n',pkg+'/com.sanad.v9test.MainActivity');
  if(status==='paused'){
   await page.evaluate(()=>SanadBankInbox.importHistoricalSms(0,{resume:true}));
   assert.equal(await page.evaluate(()=>SanadBankInbox.lastHistoricalImport.status),'complete');
   assert.equal(await page.evaluate(()=>SanadBankInbox.lastHistoricalImport.total.scanned),backgroundScan.total.scanned);
  }else{
   assert.equal(await page.evaluate(()=>SanadBankInbox.importHistoricalSms(0,{resume:true})),null,'Cancelled checkpoint must not resume');
  }
  await page.evaluate(()=>{
    SanadBankInbox.yieldUi=window.qaNativeOriginalYieldUi;
    delete window.qaNativeOriginalYieldUi;
  });
  pass('Actual notification action '+status+' preserves durable decisions'+(status==='paused'?' and resumes to the range end':' and disables resume'));
 }


 await page.evaluate(()=>{SanadBankInbox.importHistoricalSms(0,{fromDate:1});});
 await page.waitForFunction(()=>SanadBankInbox.historicalImporting&&SanadBankInbox.historicalProgress?.scanned>=20);
 const beforeKill=await page.evaluate(()=>SanadExtStorage.get('bankImportActive',null));
 assert.equal(beforeKill.status,'running');assert(beforeKill.nextAfterId>0);
 adb('shell','am','force-stop',pkg);
 assert.equal(adb('shell','sh','-c','"pidof '+pkg+' || true"'),'','Android process must really be absent');
 adb('shell','am','start','-n',pkg+'/com.sanad.v9test.MainActivity');
 const restartedTarget=await findAppTarget({adb,fetchTargets:async()=>{const r=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(5000)});return r.json();},wait:ms=>new Promise(r=>setTimeout(r,ms))});
 socket=new WebSocket(restartedTarget.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',receive);await command('Runtime.enable');await command('Page.enable');
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&SanadV9.initialized&&!_dataReplacementInFlight&&!_criticalMutationInFlight&&!_financialFlowInFlight);
 const afterKill=await page.evaluate(()=>SanadExtStorage.get('bankImportActive',null));
 assert.equal(afterKill.status,'running','Killed scan must not announce completion');assert.equal(afterKill.throughDate,beforeKill.throughDate);assert(afterKill.pages>=beforeKill.pages);
 assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),txBeforeBackground);
 await page.evaluate(()=>SanadBankInbox.importHistoricalSms(0,{resume:true}));
 const resumed=await page.evaluate(()=>SanadBankInbox.lastHistoricalImport);
 assert.equal(resumed.status,'complete');assert.equal(resumed.throughDate,beforeKill.throughDate);assert.equal(resumed.total.scanned,backgroundScan.total.scanned);
 assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),txBeforeBackground);
 pass('Actual Android process force-stop and cold reopen retain cursor; bounded resume completes without loss or repeated posting');
 fs.writeFileSync(path.join(out,'import-performance.json'),JSON.stringify({scope:'Android 35 emulator, native provider, 160 nonfinancial synthetic rows plus financial fixtures; elapsed stage timings, not Samsung measurements',background:backgroundScan,resumed},null,2));

 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('toast')).opacity)<0.01&&Number(getComputedStyle(document.getElementById('backdrop')).opacity)<0.01&&Number(getComputedStyle(document.querySelector('#view .wallet-hero')||document.getElementById('view')).opacity)>0.99);
 await page.screenshot({path:path.join(out,'android-home.png')});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',environment:'Android emulator API 35; real APK and AndroidBridge; synthetic SMS',webview:adb('shell','dumpsys','webviewupdate').split('\n').filter(s=>s.includes('Current WebView package')).join('\n'),results,errors},null,2));
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'FAIL',results,errors,error:e.message},null,2));try{fs.writeFileSync(path.join(out,'failure-logcat.txt'),execFileSync('adb',['logcat','-d','-t','1000'],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024}));}catch(_){}if(page)try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

