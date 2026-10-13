'use strict';
// Synthetic data only. This exercises the actual DOM/IndexedDB app in Chromium.
// Android permissions, notification delivery and biometrics require device QA.
const {chromium}=require('playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const output=process.env.SANAD_QA_OUTPUT||'/tmp/sanad-browser-qa';fs.mkdirSync(output,{recursive:true});
const results=[],errors=[];let browser,page;
const record=(name)=>{results.push({name,status:'PASS'});console.log('PASS:',name);};
async function stableHome(){await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('toast')).opacity)<0.01&&Number(getComputedStyle(document.getElementById('backdrop')).opacity)<0.01&&Number(getComputedStyle(document.querySelector('#view .wallet-hero')||document.getElementById('view')).opacity)>0.99);}
(async()=>{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:393,height:852},acceptDownloads:true});
 await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
 await context.addInitScript(()=>{
  window.__qaRows=[];
  const read=()=>JSON.parse(localStorage.getItem('qa-native')||'[]');
  const write=rows=>localStorage.setItem('qa-native',JSON.stringify(rows));
  window.AndroidBridge={
   bankNotificationAccessEnabled:()=>true,openBankNotificationAccessSettings(){},
   getPendingBankNotifications:()=>JSON.stringify(read()),
   acknowledgeBankNotifications:ids=>write(read().filter(x=>!JSON.parse(ids).includes(x.id))),
   getBankNotificationDiagnostics:()=>JSON.stringify({accessEnabled:true,listenerConnected:true,pendingCount:read().length}),
   startRescanActiveBankNotifications:id=>setTimeout(()=>window.sanadBankRescanResult(id,0),0),
   historicalSmsPermissionGranted:()=>true,requestHistoricalSmsPermission(){},cancelHistoricalSmsImport(){},
   startHistoricalFinancialSmsPageRange:(id,days,date,cursorId,limit,through)=>{
    if(window.__qaFail){setTimeout(()=>window.sanadHistoricalSmsPageResult(id,{ok:false,status:window.__qaFail}),0);return;}
    const rows=window.__qaRows.filter(x=>x.postedAt>date&&x.postedAt<=through).slice(0,limit).map(x=>Object.assign({candidate:true},x));
    setTimeout(()=>window.sanadHistoricalSmsPageResult(id,{ok:true,done:true,scanned:rows.length,financialCandidates:rows.length,messages:rows,nextAfterDate:rows.at(-1)?.postedAt||date,nextAfterId:0}),0);
   },
   startHistoricalFinancialSmsPage:(id,days,date,cursorId,limit)=>{
    const rows=window.__qaRows.filter(x=>x.postedAt>date).slice(0,limit);
    const queue=read();for(const row of rows)if(!queue.some(x=>x.id===row.id))queue.push(row);write(queue);
    setTimeout(()=>window.sanadHistoricalSmsPageResult(id,{ok:true,done:true,scanned:rows.length,financialCandidates:rows.length,nextAfterDate:rows.at(-1)?.postedAt||date,nextAfterId:0}),0);
   }
  };
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 await page.goto(process.env.SANAD_QA_URL||'http://127.0.0.1:8765');
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&typeof SanadV9!=='undefined'&&SanadV9.initialized);
 assert.match(await page.title(),/SANAD/);
 // Correct date input must reject impossible dates instead of creating a
 // malformed/empty field and silently shifting the transaction date.
 const reviewDates=await page.evaluate(()=>({
   valid:bankReviewDateInputValue('2026-02-28',Date.UTC(2026,9,8,12)),
   invalid:bankReviewDateInputValue('2026-02-30',Date.UTC(2026,9,8,12)),
   malformed:bankReviewDateInputValue('08/10/2026',Date.UTC(2026,9,8,12))
 }));
 assert.equal(reviewDates.valid,'2026-02-28');
 assert.match(reviewDates.invalid,/^\d{4}-\d{2}-\d{2}$/);
 assert.notEqual(reviewDates.invalid,'2026-02-30');
 assert.equal(reviewDates.invalid,reviewDates.malformed);
 // Initial bootstrap may intentionally go directly to Home on an already
 // initialized local profile. Exercise the welcome component independently as
 // a presentation/interaction flow without fabricating a first-run state.
 await page.waitForFunction(()=>S.ready&&(!document.getElementById('app').hidden||!document.getElementById('onboard').hidden));
 // Boot is allowed to finish a deferred startApp() after S.ready turns true.
 // Avoid competing with that bootstrap transition before testing the optional tour.
 if(await page.locator('#onboard').isVisible())await page.evaluate(()=>{S.settings.onboarded=true;startApp();});
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 await page.waitForTimeout(450);
 // The new-install runtime may intentionally suppress the optional welcome
 // after security/bootstrap. Inspect its actual DOM visuals independently,
 // not by competing with the authenticated startApp lifecycle.
 await page.evaluate(()=>{
   document.getElementById('onboard').hidden=false;
   document.getElementById('app').hidden=true;
 });
 await page.locator('#onboard').waitFor({state:'visible',timeout:8000});
 await page.waitForFunction(()=>!document.getElementById('sanadBootSplash')||getComputedStyle(document.getElementById('sanadBootSplash')).visibility==='hidden',{},{timeout:5000});
 {
   assert.equal(await page.locator('#onboard[data-v25-entry-ready="yes"]').count(),1,'First-run onboarding must use rebuilt V25 presentation');
   assert.equal(await page.locator('#onboard .ob-slide .em svg').count(),3,'Welcome illustrations are all local vectors, not emoji');
   assert.equal(await page.locator('#onboard .r25-welcome-brand img').count(),1,'SANAD shield is available in onboarding');
   for(const [width,height] of [[320,640],[393,852]]){
     await page.setViewportSize({width,height});
     const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,brand:document.querySelector('#onboard .r25-welcome-brand').getBoundingClientRect().width,next:document.querySelector('#onboard .r25-welcome-next').getBoundingClientRect(),skip:document.querySelector('#onboard .r25-welcome-skip').getBoundingClientRect()}));
     assert(layout.scroll<=layout.width+2&&layout.next.right<=layout.width+1&&layout.skip.right<=layout.width+1,'Welcome fits viewport '+width);
     await page.screenshot({path:path.join(output,'v25-welcome-first-run-'+width+'.png')});
   }
   await page.locator('[onclick="onboardNext()"]').click();
   assert.match(await page.locator('#onboard .ob-slide.on h2').innerText(),/بطاقاتك/);
   await page.locator('[onclick="onboardNext()"]').click();
   assert.match(await page.locator('#onboard .ob-slide.on h2').innerText(),/حدود إنفاق/);
   await page.locator('[onclick="onboardSkip()"]').click();
   await page.setViewportSize({width:393,height:852});
 }
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 await page.waitForFunction(()=>!document.getElementById('sanadBootSplash')||getComputedStyle(document.getElementById('sanadBootSplash')).visibility==='hidden');
 assert((await page.locator('#view').innerText()).length>30);
 assert.equal(await page.locator('#bottomNav .ico svg').count(),5,'All bottom navigation icons must render as local vector icons');
 assert.equal(await page.locator('link[href*="fonts.googleapis.com"]').count(),0,'V25 must never block startup fetching Cairo/Tajawal remotely');
 const bundledTajawal=await page.evaluate(async()=>{
   await document.fonts.load('900 18px "Tajawal Local"');
   return document.fonts.check('900 18px "Tajawal Local"');
 });
 assert.equal(bundledTajawal,true,'Bundled local Tajawal Black must load without the network');

 assert.equal(await page.locator('#bottomNav [data-tab="settings"] .ico[data-r25-gear="true"] svg').count(),1,'Settings must show the persistent gear, not the obsolete sun icon');
 const quickActionCount=await page.locator('.quick-chip[data-quick]').count();
 if(quickActionCount===0){
  // A newly onboarded user has no account and correctly sees the create-account
  // empty state. Check the icon renderer directly instead of demanding a hidden
  // quick-expense UI that would allow spending without a source account.
  assert((await page.locator('[data-act="account-add-menu"]').count())>0,'Empty home must prompt for an account');
  const sampleMarkup=await page.evaluate(()=>categoryIconHtml(Finance.getCat('expense','food'),20));
  assert.match(sampleMarkup,/<svg\b/,'Default food icon must render as an offline vector');
 }else{
  assert((await page.locator('.quick-chip[data-quick] .ci svg').count())>=3,'Default expense category quick actions must use local vector icons');
 }
 assert((await page.locator('#topBar .r25-header-actions svg').count())>=2,'Both brand-header actions must render accessible offline SVG icons');
 record('Boot, offline vector navigation, meaningful screen, IndexedDB and onboarding');
 await page.evaluate(()=>go('settings'));await page.locator('#r25Settings > .r25-settings-group [data-sanad-act="bank-sms-config"]').click();
 const configured=await page.evaluate(()=>localDateTimeInput(Date.now()-3600000));
 await page.locator('#bankSmsConfiguredStart').fill(configured);await page.locator('[data-sanad-act="bank-sms-config-save"]').click();
 await page.waitForFunction(v=>S.settings.bankSmsStartAt===parseLocalDateTime(v)&&!_criticalMutationInFlight,configured);
 await page.evaluate(()=>go('home'));record('Settings save an exact local date/time for Plus SMS scans');
 // A stale native queue must neither leak old postings nor block direct provider scans.
 await page.evaluate(()=>{localStorage.setItem('qa-native',JSON.stringify(Array.from({length:200},(_,i)=>({id:'old-'+i,title:'Emirates NBD',postedAt:Date.now()-86400000,packageName:'sms:ENBD',text:'old pending unknown message '+i}))));});

 await page.evaluate(()=>{window.__qaRows=[
  {id:'qa-salary',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:Date.now()-120000,text:'تم ايداع الراتب AED 9,000.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66'},
  {id:'qa-deposit',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:Date.now()-60000,text:'لقد تم ايداع AED 100.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QADEPOSIT001. الرصيد المتوفر هو AED 9,101.66'}
 ];});
 await page.locator('#fab').click();
 await page.locator('#sheet [data-sanad-act="bank-sms-recent"]').click();
 // Report the actual scan outcome instead of losing 30s to an opaque timeout.
 // This remains a real browser/SMS-bridge import; never force a completed result.
 await page.waitForFunction(()=>!SanadBankInbox._recentStarting&&!SanadBankInbox.historicalImporting,null,{timeout:45000});
 const qaRecent=await page.evaluate(()=>({
   recent:SanadBankInbox.lastRecentImport?.status||null,
   lastHistorical:SanadBankInbox.lastHistoricalImport?.status||null,
   scanned:SanadBankInbox.lastRecentImport?.total?.scanned||0,
   review:SanadBankInbox.lastRecentImport?.total?.review||0,
   added:SanadBankInbox.lastRecentImport?.total?.added||0,
   reviews:SanadBankInbox.smsReviewEvents?.length||0
 }));
 assert.equal(qaRecent.recent,'complete','Recent SMS scan did not complete: '+JSON.stringify(qaRecent));
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),true);
 await page.locator('#sanadScanDone').click(); // Real user closes completion summary before editing a review item.
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),false);
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Generic deposit origin must remain review');
 await page.evaluate(()=>{const item=SanadBankInbox.items.find(x=>x.native.id==='qa-deposit');item.parsed.transactionDate='2026-02-30';SanadBankInbox.openCorrection('qa-deposit');});
 assert.match(await page.locator('#bankFixDate').inputValue(),/^\d{4}-\d{2}-\d{2}$/,'SMS review must present a valid ISO date before saving');
 assert.notEqual(await page.locator('#bankFixDate').inputValue(),'2026-02-30');
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Unchecked or malformed date cannot post');
 await page.locator('#bankFixExternalIncome').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'External income confirmation alone must not approve invalid bank date');
 await page.locator('#bankFixConfirmDate').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(()=>S.transactions.length===2&&!_criticalMutationInFlight);
 await page.waitForFunction(()=>document.getElementById('sheet').dataset.sheetType==='bank-inbox'&&!SanadBankInbox.syncing);
 assert.equal(await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-deposit').economicOrigin.source),'user-confirmation');
 record('Generic inbound stays review until per-event external income confirmation');
 await page.evaluate(()=>closeSheet());
 const bankId=await page.evaluate(()=>S.accounts.find(x=>x.bankRefs?.includes('012XXX50XXX01')).id);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),null);
 assert.equal(await page.evaluate(id=>FinanceCore.accountMovement(S,id),bankId),9100);
 assert.match(await page.locator('#app').innerText(),/غير معروف|غير مؤكد/);
 await page.evaluate(id=>openAccountSheet(id),bankId);
 await page.locator('#wBalance').fill('1.66');await page.locator('#wOpeningKnown').check();
 await page.locator('[data-act="save-account"]').click();await page.waitForFunction(id=>S.accounts.find(a=>a.id===id)?.openingBalanceKnown===true&&S.accounts.find(a=>a.id===id)?.openingBalance===1.66&&!_criticalMutationInFlight,bankId);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),9101.66);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 await page.waitForFunction(()=>!SanadBankInbox._recentStarting&&!SanadBankInbox.historicalImporting);
 assert.equal(await page.evaluate(()=>S.transactions.length),2);record('Plus SMS scan, salary/deposit discovery, balance and repeat deduplication');
 const centralGuard=await page.evaluate(async()=>{
   const before=stateFingerprint(snapshotState()),old=S.transactions.find(t=>t.bankImportEventId==='qa-deposit');
   const result=await commitCriticalMutation(()=>{S.transactions.push({id:'qa-direct-duplicate',type:'income',accountId:old.accountId,currency:old.currency,amount:old.amount,walletAmount:old.walletAmount,fxRate:1,cat:'other',date:old.date,transactionTime:old.transactionTime,created:old.created});return true;});
   return {result,unchanged:stateFingerprint(snapshotState())===before};
 });
 assert.equal(centralGuard.result.reason,'possible-bank-duplicate');assert.equal(centralGuard.unchanged,true);
 record('Application central mutation guard rejects a direct manual duplicate and restores state');
 const guardBefore=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.evaluate(id=>{const t=S.transactions.find(t=>t.bankImportEventId==='qa-deposit');openNewTx('income');S.form.source={type:'account',id,accountId:id};S.form.amount='100';S.form.date=t.date;S.form.transactionTime=t.transactionTime||localDateTimeInput(t.created).slice(11);renderTxSheet();},bankId);
 await page.locator('[data-act="save-tx"]').click();
 await page.locator('#dlg.on #dlgCancel').click();
 await page.waitForFunction(()=>!_financialFlowInFlight&&!_criticalMutationInFlight);
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),guardBefore);
 record('Manual-after-SMS duplicate guard cancellation preserves the complete financial fingerprint');
 await page.evaluate(()=>closeSheet());
 async function addManual(kind,amount){
  const before=await page.evaluate(()=>S.transactions.length);
  await page.evaluate(()=>closeSheet());
  await page.locator('#bottomNav [data-tab="home"]').click();
  await page.locator('#fab').click();
  await page.locator('#sheet [data-pick-action="'+kind+'"]').click();
  const mode=page.locator('#sheet [data-tx-mode="accounts"]');if(await mode.count())await mode.click();
  await page.locator('#sheet [data-src-id="'+bankId+'"]').click();
  await page.locator('#amountIn').fill(String(amount));await page.locator('#txTimeIn').fill('14:32');
  await page.locator('#sheet [data-act="save-tx"]').click();
  await page.waitForFunction(n=>S.transactions.length===n+1&&!_financialFlowInFlight,before);
 }
 await addManual('expense',25);await addManual('income',50);
 assert.equal(await page.evaluate(()=>S.transactions.find(t=>t.type==='expense').transactionTime),'14:32');assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),9126.66);record('DOM expense/income entry and exact account balance');
 const expenseId=await page.evaluate(()=>S.transactions.find(t=>t.type==='expense').id);
 await page.evaluate(id=>openEditTx(id),expenseId);
 await page.locator('#amountIn').fill('30');await page.locator('#sheet [data-act="save-tx"]').click();
 await page.waitForFunction(id=>S.transactions.find(t=>t.id===id)?.amount===30&&!_criticalMutationInFlight,expenseId);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),9121.66);record('Edit existing expense without duplicating it');
 // Attach a real PNG via the file input, then save and verify durability.
 await stableHome();
 await page.evaluate(id=>openEditTx(id),expenseId);
 const png=await page.screenshot({clip:{x:0,y:0,width:20,height:20}});
 await page.locator('#sanadReceiptInput').setInputFiles({name:'qa-receipt.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>!!SanadReceipts.pending);
 await page.locator('#sheet [data-act="save-tx"]').click();
 await page.waitForFunction(async id=>!!(await SanadExtStorage.getReceipt(id)),expenseId);
 await page.waitForFunction(()=>!_financialFlowInFlight);
 const fp=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),fp);
 assert(await page.evaluate(async id=>!!(await SanadExtStorage.getReceipt(id)),expenseId));record('Receipt attachment and financial/receipt persistence after reload');
 // A full export/restore round trip uses the same UI path as the user.
 await page.evaluate(()=>go('settings'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#r25Settings > .r25-settings-group [data-sanad-act="full-export"]').click();
 const download=await downloadPromise;const backupPath=path.join(output,'synthetic-full-backup.json');await download.saveAs(backupPath);
 const saved=JSON.parse(fs.readFileSync(backupPath));assert.equal(saved.format,'SANAD_FULL_BACKUP');
 await page.evaluate(()=>go('home'));await addManual('expense',5);
 await page.evaluate(()=>go('settings'));await page.locator('#r25Settings > .r25-settings-group [data-sanad-act="full-import"]').click();
 await page.locator('#sanadFullImport').setInputFiles(backupPath);await page.locator('.dialog-backdrop.on #dlgOk').click();
 await page.waitForFunction(expected=>stateFingerprint(snapshotState())===expected,fp);
 assert(await page.evaluate(async id=>!!(await SanadExtStorage.getReceipt(id)),expenseId));record('Full backup export/restore with receipt and fingerprint equality');
 // Full restore also finishes receipt/feature writes after the financial fingerprint changes.
 await page.waitForFunction(()=>!_dataReplacementInFlight&&!_criticalMutationInFlight&&!_financialFlowInFlight);
 // Add a second account and transfer through the actual forms.
 await page.evaluate(()=>openAccountSheet(null,'bank'));
 await page.locator('#wName').fill('QA Savings');await page.locator('#wBalance').fill('0');await page.locator('#wOpeningKnown').check();
 await page.locator('[data-act="save-account"]').click();
 await page.waitForFunction(()=>S.accounts.some(a=>a.name==='QA Savings')&&!_criticalMutationInFlight);
 const savingsId=await page.evaluate(()=>S.accounts.find(a=>a.name==='QA Savings').id);
 const v252Before=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.evaluate(()=>go('accounts'));
 assert.equal(await page.locator('#bottomNav [data-tab]').count(),5);
 assert.equal(await page.locator('#v252Wallet').count(),1,'Live V25.2 wallet adapter must be mounted');

 assert.equal(await page.locator('#v252Wallet.r25-wallet-design').count(),1,'Wallet must use independent rebuilt design, not legacy markup');

 await page.waitForFunction(()=>!document.getElementById('toast')?.classList.contains('on'),null,{timeout:4000});
 assert.equal(await page.locator('#v252Wallet .r25-wallet-quick-actions button').count(),2,'Wallet retains explicit add/SMS actions');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('fab')).display),'none','Old floating FAB must not overlap the new wallet actions');
 await page.evaluate(()=>go('home'));
 assert.equal(await page.locator('#r25Home [data-act="account-add-menu"]').count()>0,true,'Home retains the real add menu');
 const homeFab=await page.evaluate(()=>{
   const el=document.getElementById('fab'),r=el.getBoundingClientRect();
   const buttons=[...document.querySelectorAll('.top-bar .r25-icon-button')].map(b=>b.getBoundingClientRect());
   return {shown:getComputedStyle(el).display!=='none',left:r.left,top:r.top,width:r.width,height:r.height,screen:document.documentElement.clientWidth,
     overlappingHeader:buttons.some(b=>!(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom))};
 });
 assert(homeFab.shown&&homeFab.width<=44&&homeFab.top<=65&&homeFab.left>=75&&homeFab.left+homeFab.width<=homeFab.screen&&
   !homeFab.overlappingHeader,'Home + shortcut belongs in free header space without overlapping other controls: '+JSON.stringify(homeFab));
 await page.evaluate(()=>go('tx'));
 assert.equal(await page.locator('#r25Tx [data-act="account-add-menu"]').count()>0,true,'Transactions retains the real add action');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('fab')).display),'none','Transactions add action must not be obscured by duplicate FAB');
 await page.evaluate(()=>go('accounts'));

 assert.equal(await page.evaluate(()=>window.SanadWalletDesign?.source),'Finance','Wallet render source is stable finance engine');
 assert.equal(await page.locator('#v252BankStrip .r25-bank-item').count()>0,true,'Financial institutions use full-size dedicated components');
 assert.equal(await page.locator('#v252AccountStrip .r25-account-item').count()>0,true,'Accounts use full-size readable cards');
 const walletSizes=await page.evaluate(()=>{
   const bank=document.querySelector('.r25-bank-item')?.getBoundingClientRect();
   const account=document.querySelector('.r25-account-item')?.getBoundingClientRect();
   return {bank:bank?.width||0,account:account?.width||0,screen:document.documentElement.clientWidth,
     legacyPanels:document.querySelectorAll('#v252Wallet .v252-account,#v252Wallet .v252-bank').length};
 });
 assert(walletSizes.bank>=205&&walletSizes.account>=215&&!walletSizes.legacyPanels,'Untruncated bank/account layout: '+JSON.stringify(walletSizes));

 assert.equal(await page.locator('[data-v252-country]').count(),3,'Country tabs must render without flag icons');
 assert((await page.locator('[data-v252-bank]').count())>0,'Real account must appear in provider selector');
 assert.equal(await page.locator('[data-v252-bank][aria-pressed="true"]').count(),1,'First institution is selected on entry');
 assert((await page.locator('[data-v252-account]').count())>0,'Accounts render immediately without requiring bank tap');
 assert.equal(await page.locator('[data-v252-account][aria-pressed="true"]').count(),1,'A real account is initially selected');
 await page.locator('[data-v252-account][aria-pressed="true"]').click();
 assert.equal(await page.locator('#sheet[data-sheet-type="v252-account-details"]').count(),1,'Tapping selected account opens read-only details');
 await page.evaluate(()=>closeSheet());
 await page.locator('[data-v252-bank][aria-pressed="true"]').click();
 assert.equal(await page.locator('#sheet[data-sheet-type="v252-bank-details"]').count(),1,'Selected bank opens read-only details');
 await page.evaluate(()=>closeSheet());
 await page.locator('[data-v252-country="EGY"]').click();
 assert.equal(await page.evaluate(()=>S.activeCountry),'EGY');
 assert.equal(await page.locator('[data-v252-account][aria-pressed="true"]').count(),0);
 await page.locator('[data-v252-country="UAE"]').click();
 assert.equal(await page.evaluate(()=>S.activeCountry),'UAE');
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),v252Before,'Visual country/account selection must not mutate ledger');

 // Responsive smoke at compact, standard and wide phones, including 200% font sizes.
 const fit=await page.evaluate(async()=>{
   const width=document.documentElement.clientWidth;
   return {width,bodyScroll:document.body.scrollWidth,htmlScroll:document.documentElement.scrollWidth};
 });
 assert(fit.bodyScroll<=fit.width+2&&fit.htmlScroll<=fit.width+2,'No horizontal page overflow on Android-sized viewport '+JSON.stringify(fit));
 assert.equal(await page.evaluate(()=>document.fonts.check('900 18px "Tajawal Local"')),true,'Approved Tajawal must be self-hosted and available offline');
 await page.evaluate(()=>go('home'));
 assert.equal(await page.locator('#r25Home').count(),1,'Prototype home hierarchy should be live, not old hero alone');
 assert.equal(await page.locator('#r25Home .r25-hero').count(),1);
 assert.equal(await page.locator('#r25Home .r25-review').count(),1);
 await page.screenshot({path:path.join(output,'v25-2-responsive-home-393.png')});
 for(const width of [320,360,393,412,430]){
   await page.setViewportSize({width,height:780});
   await page.evaluate(()=>go('home'));
   const metrics=await page.evaluate(()=>({
     width:document.documentElement.clientWidth,
     scroll:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),
     hero:(()=>{const r=document.querySelector('#r25Home .r25-hero').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})(),
     navbar:document.querySelectorAll('#bottomNav [data-tab]').length,
     font:document.fonts.check('900 18px "Tajawal Local"')
   }));
   assert(metrics.scroll<=metrics.width+2,'Global horizontal overflow '+width+': '+JSON.stringify(metrics));
   assert(metrics.hero.left>=-1&&metrics.hero.right<=metrics.width+1,'Hero goes beyond viewport '+width+': '+JSON.stringify(metrics));
   assert.equal(metrics.navbar,5);assert(metrics.font,'Tajawal font lost at '+width);
   const navigationGeometry=await page.evaluate(()=>{
     const items=[...document.querySelectorAll('#bottomNav [data-tab]')];
     const r=items.map(i=>i.getBoundingClientRect());
     const icons=items.map(i=>i.querySelector('.ico svg')?.getBoundingClientRect());
     const overlaps=r.some((a,i)=>r.some((b,j)=>j>i&&Math.min(a.right,b.right)>Math.max(a.left,b.left)+1
       &&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1));
     return {overlaps,buttons:r.length,iconsInside:icons.every((ic,i)=>ic&&ic.width>0&&ic.height>0&&
      ic.left>=r[i].left-1&&ic.right<=r[i].right+1&&ic.top>=r[i].top-1&&ic.bottom<=r[i].bottom+1)};
   });
   assert(!navigationGeometry.overlaps&&navigationGeometry.buttons===5&&navigationGeometry.iconsInside,
     'Five navigation targets and their vector icons must never overlap at '+width+': '+JSON.stringify(navigationGeometry));
   await page.screenshot({path:path.join(output,'v25-2-home-'+width+'.png')});
   await page.evaluate(()=>go('accounts'));
   const wallet=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),bank:!!document.querySelector('[data-v252-bank]'),accounts:!!document.querySelector('[data-v252-account]')}));
   assert(wallet.scroll<=wallet.width+2&&wallet.bank&&wallet.accounts,'Wallet overflow or blank account '+width+': '+JSON.stringify(wallet));

   const selected=await page.evaluate(()=>({
     bank:document.querySelectorAll('#v252Wallet [data-v252-bank][aria-pressed="true"]').length,
     account:document.querySelectorAll('#v252Wallet [data-v252-account][aria-pressed="true"]').length,
     old:document.querySelectorAll('#v252Wallet .v252-account').length,
     bankWidth:Math.round(document.querySelector('#v252Wallet .r25-bank-item')?.getBoundingClientRect().width||0),
     accountWidth:Math.round(document.querySelector('#v252Wallet .r25-account-item')?.getBoundingClientRect().width||0)
   }));
   assert(selected.bank===1&&selected.account===1&&selected.old===0,'Native data-backed selection without legacy wallet components: '+JSON.stringify(selected));
   assert(selected.bank>0&&selected.bankWidth>=190&&selected.accountWidth>=205,'Bank/account names need readable width at '+width+': '+JSON.stringify(selected));
   const readableNames=await page.evaluate(()=>{
    const a=getComputedStyle(document.querySelector('#v252Wallet .r25-account-header strong'));
    const b=getComputedStyle(document.querySelector('#v252Wallet .r25-bank-text small'));
    return {aWhite:a.whiteSpace,aLines:a.webkitLineClamp,bWhite:b.whiteSpace,bLines:b.webkitLineClamp};
   });
   assert.deepEqual(readableNames,{aWhite:'normal',aLines:'2',bWhite:'normal',bLines:'2'},
     'Institution/account labels must allow two lines at '+width+': '+JSON.stringify(readableNames));

   await page.screenshot({path:path.join(output,'v25-2-wallet-'+width+'.png')});
 }
 await page.setViewportSize({width:393,height:852});
 await page.evaluate(()=>go('accounts'));
 record('V25 layout QA on 320/360/393/430px: offline Tajawal, full-width home/wallet, icons, no horizontal clipping');

 // Explicit visual regression for the edit sheets from real user feedback.
 const editorFp=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.evaluate(()=>openInstrumentSheet(null,'debit_card'));
 await page.waitForSelector('#cardName');
 assert.equal(await page.locator('.r25-form-card-preview').count(),1,'Card editor must include its real masked preview');
 await page.locator('#cardFirst4').fill('٤٥٧٨');
 await page.locator('#cardLast4').fill('۳۰٠٨');
 const localized=await page.evaluate(()=>({
  first:document.getElementById('cardFirst4').value,
  last:document.getElementById('cardLast4').value,
  preview:document.getElementById('r25PreviewNumber').textContent,
  direction:getComputedStyle(document.getElementById('cardFirst4')).direction
 }));
 assert.deepEqual(localized,{first:'4578',last:'3008',preview:'4578 XXXX XXXX 3008',direction:'ltr'},
   'Localized card fragments must normalize and preserve masked middle digits');
 await page.locator('#cardFirst4').fill('45');
 await page.locator('#cardLast4').fill('08');
 assert.equal(await page.locator('#r25PreviewNumber').innerText(),'45XX XXXX XXXX XX08',
   'Partially entered card fragments must stay four characters wide');
 for(const width of [320,393]){
   await page.setViewportSize({width,height:760});
   const cardBounds=await page.evaluate(()=>({
     width:document.documentElement.clientWidth,
     page:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
     inputs:['cardName','cardFirst4','cardLast4'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,width:r.width};}),
     sheet:(()=>{const r=document.getElementById('sheet').getBoundingClientRect();return {left:r.left,right:r.right}})()
   }));
   assert(cardBounds.page<=cardBounds.width+2&&cardBounds.inputs.every(x=>x.left>=-1&&x.right<=cardBounds.width+1&&x.width>40),
     'Card editor must be readable and fit '+width+'px: '+JSON.stringify(cardBounds));
   await page.screenshot({path:path.join(output,'v25-rebuild-card-editor-'+width+'.png')});
 }
 await page.evaluate(()=>closeSheet());
 await page.evaluate(id=>openAccountSheet(id),bankId);
 await page.waitForSelector('#wName');
 await page.screenshot({path:path.join(output,'v25-rebuild-account-editor-393.png')});
 await page.evaluate(()=>closeSheet());
 await page.setViewportSize({width:393,height:852});
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),editorFp,'Inspecting edit forms must not mutate finance data');
 record('V25 card/account editors at 320/393px preserve field positions and financial state');


 await page.screenshot({path:path.join(output,'v25-2-real-wallet.png')});
 await page.evaluate(()=>go('settings'));
 const settingsLegacy=page.locator('#r25Settings .r25-extras[data-r25-advanced="settings"]');
 assert.equal(await settingsLegacy.locator('.r25-legacy').innerHTML(),'',
  'Closed settings advanced panel must not render the large original settings tree');
 await settingsLegacy.locator('summary').click();
 await page.waitForFunction(()=>document.querySelector('#r25Settings [data-r25-advanced="settings"] .r25-legacy')?.dataset.r25Loaded==='yes');
 assert((await settingsLegacy.locator('.r25-legacy').innerHTML()).length>120,'Original advanced settings remain fully reachable');
 await page.locator('#r25Settings [data-act="go-subs"]').first().click();
 assert.equal(await page.evaluate(()=>S.tab),'subs','Legacy obligations remain reachable through settings');
 await page.evaluate(()=>go('home'));
 record('V25.2 live wallet: 5 tabs, country/provider/account selection, read-only double tap, financial invariant, obligations access');

 // Two REALISTIC but SYNTHETIC payment instruments are added only inside the
 // transient browser QA session to test multi-card navigation. They are never
 // persisted, imported or shipped as APK demo financial data.
 const deckFingerprint=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.evaluate(bankId=>{
   const account=Finance.getAccount(bankId);
   for(const sample of [
    {id:'qa-ui-visa',name:'QA Visa',network:'visa',first4:'4578',last4:'3993',color:'#086c83'},
    {id:'qa-ui-mastercard',name:'QA Mastercard',network:'mastercard',first4:'5432',last4:'8801',color:'#15505d'}
   ]) S.paymentInstruments.push({...sample,type:'debit_card',country:account.country,accountId:bankId,institutionId:account.institutionId,archived:false});
   S.activeCountry=account.country;
   SanadV252.bankId=account.institutionId||'unlinked';
   SanadV252.accountId=bankId;
   SanadV252.cardId=null;
   go('accounts');
 },bankId);
 assert.equal(await page.locator('#v252CardStrip .r25-wallet-payment').count(),2,'Both live account-linked cards must appear in wallet carousel');
 assert.equal(await page.locator('#v252CardStrip [data-v252-card][aria-pressed="true"]').count(),1,'Exactly one financial card is selected');
 assert.match(await page.locator('#v252CardStrip [data-v252-card="qa-ui-visa"]').innerText(),/4578 XXXX XXXX 3993/);
 const deckVisual=await page.evaluate(()=>{
   const deck=document.getElementById('v252CardStrip');
   const main=deck.querySelector('[data-v252-card][aria-pressed="true"]').getBoundingClientRect();
   const side=deck.querySelector('[data-v252-card][aria-pressed="false"]').getBoundingClientRect();
   const boundary=deck.getBoundingClientRect();
   const exposed=side.x<main.x?Math.max(0,main.left-Math.max(side.left,boundary.left)):Math.max(0,Math.min(side.right,boundary.right)-main.right);
   return {exposed,deckWidth:boundary.width,mainWidth:main.width,deckHeight:boundary.height};
 });
 assert(deckVisual.mainWidth>250&&deckVisual.exposed<=28,'Inactive card should peek as a narrow edge without readable fragments: '+JSON.stringify(deckVisual));

 await page.waitForFunction(()=>{
   const sheet=document.getElementById('sheet'),shade=document.getElementById('backdrop');
   return !sheet?.classList.contains('on')&&!shade?.classList.contains('on');
 });
 await page.waitForTimeout(380); // Real modal CSS closing transition must be complete before image QA.
 assert.equal(await page.locator('#v252CardStrip [data-v252-card="qa-ui-mastercard"] > :first-child').evaluate(el=>getComputedStyle(el).visibility),'hidden','Inactive payment card content cannot peek through at the deck edge');

 await page.screenshot({path:path.join(output,'v25-wallet-two-cards-first-393.png')});
 // Replacing the entire #view on every card click causes freezes on real
 // accounts with thousands of messages. The visual deck must stay mounted.
 await page.evaluate(()=>document.getElementById('v252Wallet').dataset.qaStableRoot='mounted');
 await page.locator('nav.r25-card-pager [data-r25-card-step="1"]').click();
 assert.equal(await page.locator('#v252Wallet').getAttribute('data-qa-stable-root'),'mounted',
   'Changing cards must not reconstruct the wallet or rerun financial page rendering');
 assert.equal(await page.locator('#v252CardStrip [data-v252-card="qa-ui-mastercard"]').getAttribute('aria-pressed'),'true','Wallet next-card button must select linked Mastercard');
 assert.equal(await page.locator('#v252CardStrip [data-v252-card="qa-ui-visa"]').getAttribute('aria-pressed'),'false');
 await page.screenshot({path:path.join(output,'v25-wallet-two-cards-second-393.png')});
 // A pointer MOVE must animate the payment card with the user's finger,
 // rather than jumping only when pointerup occurs.
 const activeCard=page.locator('#v252CardStrip [data-v252-card="qa-ui-mastercard"]');
 await activeCard.scrollIntoViewIfNeeded();
 const dragBox=await activeCard.boundingBox();
 const dragX=dragBox.x+dragBox.width*.5,dragY=dragBox.y+dragBox.height*.5;
 await page.evaluate(()=>{
  window.__qaPointerTrace=[];
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click']){
   window.addEventListener(type,event=>{
    window.__qaPointerTrace.push({type,x:Math.round(event.clientX||0),y:Math.round(event.clientY||0),
      pid:event.pointerId,card:SanadV252.cardId,target:event.target?.getAttribute?.('data-v252-card')||event.target?.tagName});
   },true);
  }
 });
 const oldTransform=await activeCard.evaluate(el=>el.style.transform);
 await page.mouse.move(dragX,dragY);
 await page.mouse.down();
 await page.mouse.move(dragX-72,dragY,{steps:5});
 const dragPose=await activeCard.evaluate(el=>({transform:el.style.transform,opacity:getComputedStyle(el).opacity,transition:el.style.transition}));
 assert.notEqual(dragPose.transform,oldTransform,'Selected card must follow live pointer movement');
 assert.match(dragPose.transform,/translate3d\(-?\d+px/,'Card transform must include live pixel offset');
 assert.equal(Number(dragPose.opacity),1,'Card stays fully opaque during real drag');
 await page.screenshot({path:path.join(output,'v25-wallet-finger-drag-in-progress-393.png')});
 await page.mouse.up();
 const swipeAfter=await page.evaluate(()=>({
  cardId:SanadV252.cardId,
  active:[...document.querySelectorAll('#v252CardStrip [data-v252-card][aria-pressed="true"]')].map(e=>e.dataset.v252Card),
  deckConnected:!!document.getElementById('v252CardStrip'),
  detailsOpen:document.getElementById('sheet')?.classList.contains('on'),
  pointerTrace:window.__qaPointerTrace?.slice(-18)
 }));
 assert.equal(await page.locator('#v252CardStrip [data-v252-card="qa-ui-visa"]').getAttribute('aria-pressed'),'true',
  'RTL swipe-left returns to previous Visa: '+JSON.stringify(swipeAfter));
 assert.equal(await page.locator('#v252Wallet').getAttribute('data-qa-stable-root'),'mounted',
  'Swipe completion should only move payment cards, not reconstruct the financial DOM');
 // RTL opposite direction: swipe right from the first card to the next.
 await page.locator('#v252CardStrip [data-v252-card="qa-ui-visa"]').scrollIntoViewIfNeeded();
 const firstBox=await page.locator('#v252CardStrip [data-v252-card="qa-ui-visa"]').boundingBox();
 const firstX=firstBox.x+firstBox.width/2,firstY=firstBox.y+firstBox.height/2;
 await page.mouse.move(firstX,firstY);await page.mouse.down();await page.mouse.move(firstX+69,firstY,{steps:4});await page.mouse.up();
 assert.equal(await page.locator('#v252CardStrip [data-v252-card="qa-ui-mastercard"]').getAttribute('aria-pressed'),'true','RTL swipe-right selects next Mastercard');
 // Four card states are necessary to catch the old opacity:0 fade beyond
 // two visible neighbors.
 await page.evaluate(bankId=>{
   const a=Finance.getAccount(bankId);
   for(const sample of [{id:'qa-ui-third',network:'discover',last4:'6603'},{id:'qa-ui-fourth',network:'visa',last4:'4404'}]){
     S.paymentInstruments.push({...sample,name:'QA Additional',type:'debit_card',country:a.country,accountId:bankId,institutionId:a.institutionId,archived:false});
   }
   render();
 },bankId);
 const opaque=await page.locator('#v252CardStrip [data-v252-card]').evaluateAll(nodes=>nodes.map(n=>Number(getComputedStyle(n).opacity)));
 assert.equal(opaque.length,4,'Full deck with four linked cards must render');
 assert(opaque.every(x=>x===1),'No card may be semi-transparent in any carousel state: '+JSON.stringify(opaque));
 await page.evaluate(()=>{
   S.paymentInstruments=S.paymentInstruments.filter(i=>!String(i.id).startsWith('qa-ui-'));
   SanadV252.cardId=null;
   render();
 });
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),deckFingerprint,'Wallet carousel test must not change persisted or real financial records');
 record('Real data adapter: two account-linked cards, masked numbers, card selection, network and immutable financial snapshot');

 // A credit card is tested against the REAL Finance.accountDebt /
 // Finance.creditAvailable implementation, not UI arithmetic or fake release data.
 const creditBefore=await page.evaluate(()=>stateFingerprint(snapshotState()));
 await page.evaluate(bankId=>{
   const bank=Finance.getAccount(bankId);
   S.accounts.push({id:'qa-ui-credit-account',name:'QA Credit Owed',country:bank.country,currency:bank.currency,
     institutionId:bank.institutionId,type:'credit',openingDebt:500,openingDebtKnown:true,
     openingBalance:0,creditLimit:3000,archived:false,created:isoToday()});
   S.paymentInstruments.push({id:'qa-ui-credit-card',name:'QA Credit Visa',country:bank.country,
     accountId:'qa-ui-credit-account',institutionId:bank.institutionId,type:'credit_card',
     network:'visa',first4:'4123',last4:'1991',color:'#0f5781',archived:false});
   SanadV252.bankId=bank.institutionId||'unlinked';
   SanadV252.accountId='qa-ui-credit-account';
   SanadV252.cardId=null;
   go('accounts');
 },bankId);
 assert.equal(await page.evaluate(()=>Finance.accountDebt('qa-ui-credit-account')),500);
 assert.equal(await page.evaluate(()=>Finance.creditAvailable('qa-ui-credit-account')),2500);
 assert.equal(await page.locator('[data-v252-account="qa-ui-credit-account"] .r25-account-amount').innerText(), '500 د.إ','Credit account UI must show positive owed amount');
 const creditLabel=await page.locator('#v252CardStrip [data-v252-card="qa-ui-credit-card"]').innerText();
 assert.match(creditLabel,/المديونية الحالية/,'Credit card must label its debt rather than claiming it is available balance');
 assert.match(creditLabel,/المتاح/,'Available credit must appear separately from owed debt');
 await page.screenshot({path:path.join(output,'v25-wallet-credit-debt-vs-limit-393.png')});
 await page.locator('[data-v252-account="qa-ui-credit-account"]').click();
 assert.equal(await page.locator('#sheet[data-sheet-type="v252-account-details"]').count(),1,'Selecting current credit account opens its read-only details');
 const displayedDebt=await page.locator('#sheet[data-sheet-type="v252-account-details"] .amt-val').innerText();
 assert.match(displayedDebt,/500/,'Debt detail must show the positive 500 owed amount');
 assert(!displayedDebt.includes('-500'),'Credit debt must not appear as a negative cash balance in details');
 await page.evaluate(()=>closeSheet());

 await page.evaluate(()=>{
   S.accounts=S.accounts.filter(a=>a.id!=='qa-ui-credit-account');
   S.paymentInstruments=S.paymentInstruments.filter(i=>i.id!=='qa-ui-credit-card');
   SanadV252.accountId=null;SanadV252.cardId=null;render();
 });
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),creditBefore,'Credit UI fixture may not alter the underlying ledger');
 record('Credit card UI: exact debt 500 versus separate available 2500, no mixed balances or persistent test data');


 await page.evaluate(()=>openNewTransfer());await page.locator('#fromAmtIn').fill('100');
 await page.locator('[data-act="save-tx"]').click();
 await page.waitForFunction(()=>S.transactions.some(t=>t.type==='transfer')&&!_financialFlowInFlight);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),9021.66);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),savingsId),100);record('Account creation and own transfer conserve money');
 // Invalid input cannot save a transaction.
 const count=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>openNewTx('expense'));await page.locator('#amountIn').fill('-5');
 await page.locator('[data-act="save-tx"]').click();await page.waitForFunction(()=>!_financialFlowInFlight);
 assert.equal(await page.evaluate(()=>S.transactions.length),count);await page.evaluate(()=>closeSheet());record('Negative manual input rejected without a ledger change');
 // An import cannot overlap a pending critical save.
 assert(await page.evaluate(async data=>{let finish;const saving=commitCriticalMutation(()=>new Promise(r=>{finish=r;}));await Promise.resolve();const refused=await SanadFullBackup.importData(data,false);finish(false);await saving;return refused===false;},saved));
 record('Full restore blocked during an unfinished financial write');
 await page.evaluate(()=>go('home'));await stableHome();await page.screenshot({path:path.join(output,'mobile-ar.png')});
 for(const tab of ['tx','accounts','rep','settings','home']){await page.locator('#bottomNav [data-tab="'+tab+'"]').click();assert((await page.locator('#view').innerText()).length>0);}
 assert.equal(await page.locator('#bottomNav [data-tab="settings"] .ico[data-r25-gear="true"] svg').count(),1,'Repeated navigation must preserve settings gear icon');
 record('All primary tabs respond without blank pages');

 // Every major financial screen retains its original delegated actions,
 // but icon-only affordances must be offline SVG rather than emoji glyphs.
 await page.evaluate(()=>go('settings'));
 assert.equal(await page.locator('#view .r25-action-icon svg.v25-ui-icon').count()>2,true,'Settings icons must be SVG');
 await page.evaluate(()=>go('tx'));
 assert.equal(await page.locator('#view .r25-search svg.v25-ui-icon').count(),1,'Transaction search has an offline SVG icon');
 const beforeAppearance=await page.evaluate(()=>stateFingerprint(snapshotState()));
 for(const tab of ['home','accounts','tx','rep','settings']){
   await page.evaluate(tab=>go(tab),tab);
   const box=await page.evaluate(()=>({tab:S.tab,width:document.documentElement.clientWidth,pageWidth:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),visible:document.getElementById('view').innerText.trim().length}));
   assert.equal(box.tab,tab);assert(box.visible>5,'Page '+tab+' must display real text content');assert(box.pageWidth<=box.width+2,'Page '+tab+' must fit 393px');
   const uniqueCountry=await page.locator('#view .v252-country').count();
   if(tab==='settings')assert.equal(uniqueCountry,0,'Settings must not prepend legacy browsing countries widget');
   else assert.equal(uniqueCountry,1,'Page '+tab+' must show exactly one country selector, not hybrid duplication');
   await page.screenshot({path:path.join(output,'v25-screen-'+tab+'-393.png')});
 }
 assert.equal(await page.evaluate(()=>stateFingerprint(snapshotState())),beforeAppearance,'Visual navigation must not mutate financial ledger');
 for(const tab of ['rep','settings']){
   await page.evaluate(tab=>go(tab),tab);
   const visiblePanels=await page.evaluate(()=>[...document.querySelectorAll('#view .r25-paper,#view .r25-stat,#view .r25-settings-group,#view .r25-report-primary')]
     .filter(el=>el.getBoundingClientRect().width>20)
     .map(el=>({className:el.className,opacity:Number(getComputedStyle(el).opacity),animation:getComputedStyle(el).animationName})));
   assert(visiblePanels.length>0,'Expected visible panels in '+tab);
   assert(visiblePanels.every(x=>x.opacity>=0.99&&x.animation==='none'),'Financial panels must not fade/blank on '+tab+': '+JSON.stringify(visiblePanels.slice(0,10)));
   if(tab==='rep'){
     const selected=await page.evaluate(()=>{const e=document.querySelector('#view .r25-period button[aria-pressed="true"]');if(!e)return null;const s=getComputedStyle(e);return {text:e.textContent.trim(),color:s.color,bg:s.backgroundColor};});
     assert(selected&&selected.text.length>0&&selected.color!==selected.bg,'Selected report period should be readable: '+JSON.stringify(selected));
   }
   await page.screenshot({path:path.join(output,'v25-screen-'+tab+'-no-fade.png')});
 }
 record('V25 transaction/report/settings visuals, SVG icon assets and navigation are live and read-only');

 await page.evaluate(()=>go('rep'));
 const periodBefore=await page.evaluate(()=>S.repPeriod);
 await page.locator('#r25Reports > .r25-period [data-period="today"]').click();
 assert.equal(await page.evaluate(()=>S.repPeriod),'today','Rebuilt report must preserve requested period, never force month');
 await page.locator('#r25Reports > .r25-period [data-period="month"]').click();
 assert.equal(await page.evaluate(()=>S.repPeriod),'month');
 await page.evaluate(()=>{S.repPeriod='month';});
 record('Rebuilt report period tabs stay selectable and do not silently reset financial periods');


 await page.evaluate(()=>go('settings'));await page.locator('#r25Settings .r25-inline-options [data-sanad-act="lang"][data-value="en"]').click();
 await page.waitForFunction(()=>document.documentElement.dir==='ltr');await page.locator('#r25Settings .r25-inline-options [data-sanad-act="theme"][data-value="dark"]').click();
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.evaluate(()=>go('home'));await stableHome();
 const englishHero=await page.locator('#r25Home .r25-hero .r25-eyebrow').innerText();
 assert.match(englishHero,/Asset balances/,'Main asset currency line should be English');
 assert(!/[\u0600-\u06FF]/.test(englishHero),'Financial status description must not mix Arabic text into English view');
 await page.screenshot({path:path.join(output,'mobile-en-dark.png')});record('English LTR, translated primary-balance status and dark theme');
 for(const width of [360,1280]){await page.setViewportSize({width,height:852});await stableHome();assert(await page.evaluate(()=>{const a=document.querySelector('#r25Home .r25-page-title').getBoundingClientRect(),b=document.querySelector('#r25Home .r25-hero').getBoundingClientRect();return a.bottom<=b.top+1&&b.left>=-1&&b.right<=innerWidth+1;}),'V25 home header must not overlap the real balance hero');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'viewport-'+width+'.png')});}
 record('360/393/1280 widths without page overflow');

 await page.evaluate(()=>{window.__qaRows.push({id:'qa-after-scan',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:Date.now(),text:'لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QAAFTERSCAN01. الرصيد المتوفر هو AED 9,031.66'});});
 const beforeRecent=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent);
 assert.equal(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.filter(r=>r.id==='qa-after-scan').length),1,'Repeated import retains one unresolved review');
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-after-scan'));
 await page.locator('#bankFixExternalIncome').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeRecent);
 await page.evaluate(()=>closeSheet());

 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent+1);
 record('New unresolved inbound remains one review across repeats, then posts once after origin confirmation');
 await page.evaluate(()=>go('settings'));
 await page.locator('#r25Settings > .r25-settings-group [data-sanad-act="bank-support-export"]').click();
 await page.locator('[data-sheet-type="bank-support-guide"]').count();
 const diagnosticDownload=page.waitForEvent('download');await page.locator('[data-sanad-act="bank-support-export-confirm"]').click();
 const diagnostic=await diagnosticDownload,diagnosticPath=path.join(output,'synthetic-diagnostic-backup.json');await diagnostic.saveAs(diagnosticPath);
 const diagnosticData=JSON.parse(fs.readFileSync(diagnosticPath));assert.equal(diagnosticData.format,'SANAD_FULL_BACKUP');assert(diagnosticData.features.diagnosticReport);assert(diagnosticData.features.bankImportAudit.decisions.rows.some(r=>r.id==='qa-after-scan'&&r.action==='saved'));
 record('Restorable backup plus diagnostic report exports posting decisions and exact scan bounds');
 const decisionCount=await page.evaluate(()=>Object.keys(S.settings.bankEventDecisions).length);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>Object.keys(S.settings.bankEventDecisions).length),decisionCount);
 const txBeforeReload=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-after-scan',title:'Emirates NBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QAAFTERSCAN01. الرصيد المتوفر هو AED 9,031.66'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),txBeforeReload);
 record('Durable event decisions survive reload and prevent repeated posting');
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-dismiss',title:'ENBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'Bank transfer: incomplete financial details'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.some(r=>r.id==='qa-dismiss')));
 await page.evaluate(()=>SanadBankInbox.dismiss('qa-dismiss'));await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-dismiss',title:'ENBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'Bank transfer: incomplete financial details'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.some(r=>r.id==='qa-dismiss')),false);
 record('Dismissed review stays dismissed after reload and provider rescan');
 const expandedFloor=await page.evaluate(async()=>{const floor=S.settings.bankSmsStartAt-86400000;const result=await commitCriticalMutation(()=>{S.settings.bankSmsStartAt=floor;return true;});if(!result.ok)throw Error('test range write failed');window.__qaFail='query-failed';return floor;});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>SanadBankInbox.lastRecentImport.scannedThrough),0);
 await page.evaluate(()=>{window.__qaFail=null;window.__qaRows=[];});await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 assert.equal(await page.evaluate(()=>SanadBankInbox.lastRecentImport.fromDate),expandedFloor);
 record('Failed expanded range retries from the saved start without inheriting old coverage');

 const beforeOutgoing=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-outgoing-origin',title:'EmiratesNBD',packageName:'sms:ENBD',postedAt:Date.now()-1000,text:'تم خصم مبلغ AED 37.35 من حسابك 012XXX50XXX01 لتحويل الاموال'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing);
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-outgoing-origin'));
 await page.locator('[data-sanad-act="bank-fix-save"]').click();assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing);
 await page.locator('#bankFixExternalDestination').check();await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeOutgoing);
 assert.equal(await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-outgoing-origin').economicOrigin.kind),'external-destination');
 await page.evaluate(()=>closeSheet());await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing+1);
 record('Outgoing direction needs per-event destination ownership confirmation and posts once');
 const legacyReview=await page.evaluate(async()=>{
   const t=S.transactions.find(t=>t.bankImportEventId==='qa-deposit'),before={id:t.id,amount:t.amount,count:S.transactions.length};
   const result=await commitCriticalMutation(()=>{delete t.economicOrigin;return true;});if(!result.ok)throw Error('legacy fixture mutation failed');return before;
 });
 await page.evaluate(()=>go('rep'));
 assert.equal(await page.evaluate(()=>Finance.buildReportDataset({country:'UAE',period:'month',currency:'AED',month:isoToday().slice(0,7)}).incomeByCur.AED),null);
 assert.match(await page.locator('#view').innerText(),/إجماليات التقرير غير مؤكدة/);
 await page.evaluate(id=>openEditTx(id),legacyReview.id);
 await page.locator('#txExternalOriginConfirmed').check();await page.locator('[data-act="save-tx"]').click();
 await page.waitForFunction(id=>S.transactions.find(t=>t.id===id)?.economicOrigin?.kind==='external-income'&&!_criticalMutationInFlight,legacyReview.id);
 assert.equal(await page.evaluate(()=>S.transactions.length),legacyReview.count);assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).amount,legacyReview.id),legacyReview.amount);
 record('Legacy origin uncertainty is visible; user confirmation preserves transaction ID, count and principal');
 const beforeFx=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(id=>{openNewTx('expense');S.form.source={type:'account',id,accountId:id};S.form.currency='USD';S.form.amount='0.01';renderTxSheet();},bankId);
 await page.locator('#fxRateIn').fill('1.5');await page.locator('[data-act="save-tx"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeFx);
 const fxSaved=await page.evaluate(()=>S.transactions.at(-1));assert.equal(fxSaved.walletAmount,0.02);assert.equal(fxSaved.fxRateSource,'user-entry');assert.equal(fxSaved.currency,'USD');
 record('Actual foreign-currency expense uses exact declared FX and target minor-unit rounding');
 const heldCount=await page.evaluate(()=>S.transactions.length);
 const heldRow={id:'qa-held-repair',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:Date.now()-500,text:'تم ايداع الراتب AED 77.00 في حسابك .012XXX50XXX01 الرصيد المتوفر هو AED 9,001.66'};
 await page.evaluate(async row=>{const result=await commitCriticalMutation(()=>{S.settings.bankReviewHolds={...(S.settings.bankReviewHolds||{}),[row.id]:{reason:'repair-destination-unconfirmed',quarantinedTransactionId:'qa-original-quarantined-id',at:Date.now(),parserVersion:'9.2.7-financial-contract',decisionSource:'deterministic-contract'}};return true;});if(!result.ok)throw Error('review hold fixture rejected');window.__qaRows=[row];},heldRow);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),heldCount);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 await page.evaluate(row=>{window.__qaRows=[row];},heldRow);await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 assert.equal(await page.evaluate(()=>S.transactions.length),heldCount);assert(await page.evaluate(()=>S.settings.bankReviewHolds['qa-held-repair']));
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-held-repair'));await page.locator('#bankFixSource').selectOption('account:'+bankId);await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,heldCount);
 assert.equal(await page.evaluate(()=>S.settings.bankReviewHolds['qa-held-repair']),undefined);
 assert.equal(await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-held-repair').id),'qa-original-quarantined-id');
 await page.evaluate(()=>closeSheet());await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),heldCount+1);
 record('Repair quarantine survives reload/rescan; explicit correction posts once and clears the hold durably');
 const pendingBefore=await page.evaluate(()=>({count:S.transactions.length,balance:Finance.accountBalance(S.accounts.find(a=>a.bankRefs?.includes('012XXX50XXX01')).id)}));
 await page.evaluate(async id=>{const account=Finance.getAccount(id);const result=await commitCriticalMutation(()=>{S.paymentInstruments.push({id:'qa-pending-card',name:'Synthetic debit',type:'debit_card',country:account.country,accountId:id,institutionId:account.institutionId,last4:'6452'});return true;});if(!result.ok)throw Error('Pending fixture card rejected');window.__qaRows=[{id:'qa-pending-fx',title:'EmiratesNBD',postedAt:Date.now(),text:'Purchase EUR 23.45 at Synthetic Store using debit card ending 6452. Transaction reference PENDINGQA01'}];},bankId);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-pending-fx'));
 await page.locator('#bankFixAdvanced').evaluate(el=>{el.open=true;});await page.locator('#bankFixRetainPending').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,pendingBefore.count);
 await page.waitForFunction(()=>document.getElementById('sheet').dataset.sheetType==='bank-inbox'&&!SanadBankInbox.syncing);
 const pendingId=await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-pending-fx').id);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),null);
 await page.evaluate(()=>{closeSheet();go('rep');});
 assert.equal(await page.evaluate(async()=>{const r=await commitCriticalMutation(()=>{Finance.setOverallLimit(S.month,'UAE','AED',1000);return true;});render();return r.ok;}),true);
 assert.match(await page.locator('#view').innerText(),/شراء يحتاج تأكيد مبلغ الخصم/);
 assert.match(await page.locator('#view').innerText(),/المتبقي غير مؤكد حتى تأكيد مبالغ الخصم/);
 assert.equal(await page.locator('#r25Reports .r25-report-average .v').innerText(),'غير معروف');
 assert.equal(await page.evaluate(()=>Finance.buildReportDataset({country:'UAE',period:'month',month:isoToday().slice(0,7),currency:'AED'}).pendingSettlementCount),1);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).walletAmount,pendingId),null);
 await page.evaluate(id=>openTxDetails(id),pendingId);
 await page.locator('#pendingSettlementAmount').fill('94.25');await page.locator('#pendingSettlementFee').fill('1.25');
 await page.locator('#pendingSettlementConfirmed').check();await page.locator('[data-sanad-act="bank-settlement-save"]').click();
 await page.waitForFunction(id=>S.transactions.find(t=>t.id===id)?.settlementStatus==='confirmed'&&!_criticalMutationInFlight,pendingId);
 assert.equal(await page.evaluate(()=>S.transactions.length),pendingBefore.count+1);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),Math.round((pendingBefore.balance-95.5)*100)/100);
 const confirmed=await page.evaluate(id=>S.transactions.find(t=>t.id===id),pendingId);
 assert.equal(confirmed.amount,23.45);assert.equal(confirmed.currency,'EUR');assert.equal(confirmed.bankPrincipalAmount,94.25);assert.equal(confirmed.bankSettlementAudit.length,1);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).walletAmount,pendingId),95.5);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});assert.equal(await page.evaluate(()=>S.transactions.length),pendingBefore.count+1);
 record('Known foreign purchase retained without settlement; incomplete report; durable same-event settlement, exact fees and repeat deduplication');
 const autoBefore=await page.evaluate(id=>({count:S.transactions.length,balance:Finance.accountBalance(id)}),bankId);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-late-original',title:'EmiratesNBD',packageName:'sms:ENBD',postedAt:Date.now(),text:'Purchase USD 10.00 at Synthetic Late Shop using debit card ending 6452. Transaction reference AUTOFX01'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});await page.evaluate(()=>SanadBankInbox.openCorrection('qa-late-original'));
 await page.locator('#bankFixAdvanced').evaluate(el=>{el.open=true;});await page.locator('#bankFixRetainPending').check();await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(()=>document.getElementById('sheet').dataset.sheetType==='bank-inbox'&&!SanadBankInbox.syncing&&S.transactions.some(t=>t.bankImportEventId==='qa-late-original'));
 const autoId=await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-late-original').id);
 await page.evaluate(()=>{const date=S.transactions.find(t=>t.bankImportEventId==='qa-late-original').date;window.__qaRows=[{id:'qa-late-proof',title:'EmiratesNBD',packageName:'sms:ENBD',postedAt:Date.now(),text:'Purchase settlement completed. Original purchase: USD 10.00. Original reference: AUTOFX01. Purchase date: '+date+'. Settled amount excluding fees: AED 37.00. Total fees: AED 1.00. Debit card ending 6452.'}];});
 const settlementProof=await page.evaluate(()=>window.__qaRows[0]);
 await page.evaluate(()=>{window.__qaRows=[{...window.__qaRows[0],id:'qa-composite-proof',text:window.__qaRows[0].text+' Original reference: DIFFERENT01.'}];});
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).settlementStatus,autoId),'pending');
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),null);
 assert.equal(await page.evaluate(()=>SanadBankInbox.items.find(x=>x.native.id==='qa-composite-proof').plan.reason),'settlement-evidence-ambiguous');
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).settlementStatus,autoId),'pending');
 assert.equal(await page.evaluate(async()=>(await SanadExtStorage.get('bankSmsReviewEvents',[])).some(x=>x.id==='qa-composite-proof')),true);
 record('Composite settlement evidence remains durable review; pending purchase and unknown balance survive restart');
 await page.evaluate(proof=>{window.__qaRows=[{...proof,postedAt:Date.now()}];},settlementProof);
 await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 assert.equal(await page.evaluate(()=>S.transactions.length),autoBefore.count+1);
 assert.equal(await page.evaluate(id=>Finance.accountBalance(id),bankId),Math.round((autoBefore.balance-38)*100)/100);
 assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).bankSettlementEvidence.source,autoId),'bank-message');
 assert.equal(await page.evaluate(()=>SanadBankInbox.lastHistoricalImport.total.updated),1);
 assert.equal(await page.evaluate(()=>SanadBankInbox.lastHistoricalImport.total.added),0);
 await page.evaluate(()=>{const copy={...window.__qaRows[0],id:'qa-late-notification',postedAt:Date.now()};window.__qaRows.push(copy);});await page.evaluate(async()=>{const result=await SanadBankInbox.refreshRecentSms();SanadSmsImportUI.dismiss();return result;});
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>S.transactions.length),autoBefore.count+1);assert.equal(await page.evaluate(id=>S.transactions.find(t=>t.id===id).bankSettlementAudit.length,autoId),1);
 record('Late bank settlement replaces original purchase, counts an update, retains proof and survives cross-channel repeat/reload');
 const historicalBeforeLearning=await page.evaluate(()=>JSON.stringify(S.transactions));
 await page.evaluate(()=>{closeSheet();go('settings');});await page.locator('#r25Settings > .r25-settings-group [data-sanad-act="bank-learning"]').click();
 const ruleButton=page.locator('[data-sanad-act="bank-learning-toggle"][data-learning-type="template"][data-enabled="false"]').first();
 const ruleId=await ruleButton.getAttribute('data-id');await ruleButton.click();
 await page.waitForFunction(id=>S.settings.bankLearningRules.find(r=>r.id===id)?.enabled===false&&!_criticalMutationInFlight,ruleId);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(id=>S.settings.bankLearningRules.find(r=>r.id===id).enabled,ruleId),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),historicalBeforeLearning);
 record('Learning screen revokes a saved template durably without changing historical transactions');
 // Synthetic review-only UI regression. Drain any in-flight provider sync first:
 // otherwise a pre-existing async sync can overwrite the injected 95-row fixture
 // with the actual one-row queue while openSheet renders.
 await page.waitForFunction(()=>!SanadBankInbox.syncing&&!SanadBankInbox.historicalImporting&&!SanadBankInbox._recentStarting);
 const initialReview=await page.evaluate(async()=>{
   window.qaOriginalReviewSync=SanadBankInbox.sync;
   window.qaOriginalReviewItems=SanadBankInbox.items;
   SanadBankInbox.sync=async()=>({ok:true,review:95});
   SanadBankInbox.items=Array.from({length:95},(_,n)=>({
     native:{id:'qa-unknown-'+n,title:'Synthetic unknown issuer',text:'Synthetic financial notification requiring manual review '+n,postedAt:Date.now()},
     parsed:{recognized:false,ignored:false},plan:{action:'review',reason:'source-not-identified'}
   }));
   await SanadBankInbox.open();
   return {queued:SanadBankInbox.items.length,rendered:document.querySelectorAll('#sheet [data-sanad-act="bank-fix"]').length};
 });
 assert.deepEqual(initialReview,{queued:95,rendered:40},'Review queue was replaced mid-render: '+JSON.stringify(initialReview));
 assert.match(await page.locator('#sheet').innerText(),/عرض 1–40 من 95/);
 await page.locator('#sheet [data-sanad-act="bank-review-page"][data-page="1"]').click();
 assert.equal(await page.locator('#sheet [data-sanad-act="bank-fix"]').count(),40);
 await page.locator('#sheet [data-sanad-act="bank-fix"][data-id="qa-unknown-40"]').click();
 assert.equal(await page.locator('#bankFixManualProof').count(),1);
 assert.equal(await page.locator('#bankFixConfirmIssuer').count(),1);
 assert.equal(await page.locator('#bankFixConfirmCurrency').count(),1);
 assert((await page.locator('#bankFixSource option').count())>1);
 await page.evaluate(()=>{SanadBankInbox.sync=window.qaOriginalReviewSync;SanadBankInbox.items=window.qaOriginalReviewItems;closeSheet();});
 record('Review queue paginates 40 of 95 and unknown sources offer explicit human-controlled correction without posting');
 // User-selected SMS XML must be review-only even when parser/known-card routing
 // would otherwise qualify the message for automatic posting.
 const ledgerBeforeXml=await page.evaluate(()=>S.transactions.length);
 const xmlFirst=await page.evaluate(async()=>{
   const now=Date.now(),body='Purchase AED 17.19 at SYNTHETIC XML SHOP using debit card ending 6452';
   const xml='<?xml version="1.0"?><smses count="2"><sms address="EmiratesNBD" date="'+now+'" body="'+body+'"/><sms address="Other" date="'+now+'" body="Hello"/></smses>';
   window.__qaXmlText=xml;
   return SanadBankInbox.importSmsXmlFile(new File([xml],'qa-sms.xml',{type:'application/xml'}));
 });
 assert.equal(xmlFirst.ok,true);assert.equal(xmlFirst.total,2);assert.equal(xmlFirst.added,1);
 assert.equal(await page.evaluate(()=>S.transactions.length),ledgerBeforeXml);
 const fileId=await page.evaluate(()=>SanadBankInbox.smsReviewEvents.find(n=>n.importProvenance==='untrusted-sms-xml')?.id);
 assert(fileId&&fileId.startsWith('smsxml:'));
 await page.evaluate(()=>SanadBankInbox.sync({force:true}));
 assert.equal(await page.evaluate(()=>S.transactions.length),ledgerBeforeXml,'Forced auto sync must never post imported XML evidence');
 const fileHold=await page.evaluate(id=>SanadBankInbox.items.find(x=>x.native.id===id)?.plan,fileId);
 assert.equal(fileHold?.reason,'file-import-human-confirmation-required');
 await page.evaluate(id=>SanadBankInbox.openCorrection(id),fileId);
 assert.equal(await page.locator('#bankFixManualProof').count(),1);
 await page.evaluate(()=>closeSheet());
 const xmlRepeat=await page.evaluate(()=>SanadBankInbox.importSmsXmlFile(new File([window.__qaXmlText],'qa-sms.xml',{type:'application/xml'})));
 assert.equal(xmlRepeat.ok,true);assert.equal(xmlRepeat.added,0);assert.equal(xmlRepeat.existing,1);
 await page.evaluate(()=>closeSheet());
 assert.equal(await page.evaluate(()=>S.transactions.length),ledgerBeforeXml);
 record('Untrusted SMS XML: local parse, progress, human-only review, no ledger posting on forced sync, repeat dedup');
 // Visual and interaction QA for the actual packaged modal, using only synthetic sample statistics.
 const beforeImportModal=await page.evaluate(()=>JSON.stringify(S.transactions));
 await page.evaluate(()=>{
   SanadSmsImportUI.start('recent');
   SanadSmsImportUI.progress({scanned:1260,totalCount:3000,financialCandidates:340,added:95,review:48,duplicates:21,updated:2},'تحليل الرسائل المالية');
 });
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),true);
 assert.equal(await page.locator('#sanadScanPercent').innerText(),'42٪');

 // The reported Samsung issue was modal clipping at real mobile dimensions.
 for(const [width,height] of [[320,640],[360,760],[393,852]]){
   await page.setViewportSize({width,height});
   const ui=await page.evaluate(()=>({
     viewport:document.documentElement.clientWidth,
     pageWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
     header:(()=>{let r=document.querySelector('#sanadScanDialog .sanad-scan-top h2').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})(),
     panel:(()=>{let r=document.querySelector('#sanadScanDialog').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,height:r.height}})(),
     metrics:(()=>{const el=document.querySelector('#sanadScanDialog .sanad-scan-metrics');return {cols:getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length,counts:[...el.querySelectorAll('.sanad-scan-metric')].map(x=>x.innerText.trim())}})(),
     actions:[...document.querySelectorAll('#sanadScanDialog .sanad-scan-actions button')].filter(b=>b.getClientRects().length>0).map(b=>{let r=b.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})
   }));
   assert(ui.pageWidth<=ui.viewport+2&&ui.panel.left>=-1&&ui.panel.right<=ui.viewport+1,'Import panel must fit viewport '+width+': '+JSON.stringify(ui));
   assert(ui.header.left>=-1&&ui.header.right<=ui.viewport+1,'Import heading clipped on '+width+': '+JSON.stringify(ui));
   assert.equal(ui.metrics.cols,2,'Mobile scan must use legible two-column metric grid at '+width);
   assert.equal(ui.metrics.counts.length,4,'All four authentic native scan counters must be present');
   assert(ui.actions.every(b=>b.width>=70&&b.left>=-1&&b.right<=ui.viewport+1),'Import actions clipped at '+width+': '+JSON.stringify(ui));
   await page.screenshot({path:path.join(output,'v25-sms-progress-'+width+'.png')});
 }
 await page.setViewportSize({width:393,height:852});
 record('SMS import 320/360/393 mobile visual sizes: no horizontal clipping or overflowing buttons');

 await page.screenshot({path:path.join(output,'sms-import-progress.png')});
 await page.locator('#sanadScanHide').click();
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),false);
 assert.equal(await page.locator('#sanadScanMini').isVisible(),true);
 await page.locator('#sanadScanMini').click();
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),true);
 await page.evaluate(()=>SanadSmsImportUI.finish({status:'complete',total:{scanned:3000,financialCandidates:740,added:105,review:51,duplicates:37,updated:2},totalCount:3000}));
 assert.equal(await page.locator('#sanadScanPercent').innerText(),'100٪');
 await page.screenshot({path:path.join(output,'sms-import-finished.png')});
 await page.locator('#sanadScanDone').click();
 assert.equal(await page.locator('#sanadScanOverlay').isVisible(),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(S.transactions)),beforeImportModal);
 record('SMS progress modal: 42% synthetic visual, minimize/reopen, 100% completed and no ledger mutation');
 const perfContext=await browser.newContext(),perfPage=await perfContext.newPage();perfPage.on('pageerror',e=>errors.push(e.message));
 await perfPage.goto(process.env.SANAD_QA_URL||'http://127.0.0.1:8765');await perfPage.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&SanadV9.initialized);
 if(await perfPage.locator('#onboard').isVisible())await perfPage.locator('[onclick="onboardSkip()"]').click();await perfPage.waitForFunction(()=>!document.getElementById('app').hidden&&(!document.getElementById('sanadBootSplash')||getComputedStyle(document.getElementById('sanadBootSplash')).visibility==='hidden')&&!_criticalMutationInFlight&&!_dataReplacementInFlight&&!_financialFlowInFlight&&!SanadBankInbox.syncing&&!SanadBankInbox.historicalImporting&&!SanadBankInbox._recentStarting);
 const financialPerformance=await perfPage.evaluate(async()=>{
   const seed=snapshotState(),day=isoToday(),now=Date.now();seed.accounts=[{id:'perf',type:'bank',country:'UAE',currency:'AED',name:'Synthetic performance',institutionId:null,openingBalance:10000,openingBalanceKnown:true,openingDebt:0,creditLimit:0,archived:false,created:day}];seed.paymentInstruments=[];seed.institutions=[];seed.transactions=Array.from({length:22934},(_,n)=>({id:'perf-'+n,type:n%2?'income':'expense',accountId:'perf',currency:'AED',amount:0.01,walletAmount:0.01,fxRate:1,cat:'other',date:day,created:now+n}));seed.settings.defaultAccountByCountry={UAE:'perf'};seed.settings.primaryAccountByCountry={UAE:'perf'};seed.settings.defaultInstrumentByCountry={};
   const loadStart=performance.now();let seedResult;await withExclusiveDataOperation(async()=>{seedResult=await _commitCriticalMutationImpl(()=>{loadStateInto(seed);return true;});});if(!seedResult.ok)throw Error('large synthetic seed rejected '+seedResult.reason);
   const initialWriteMs=performance.now()-loadStart;S.activeCountry='UAE';
   let last=performance.now(),maxHeartbeatGapMs=0;const pulse=setInterval(()=>{const now=performance.now();maxHeartbeatGapMs=Math.max(maxHeartbeatGapMs,now-last);last=now;},16);
   const start=performance.now();const result=await commitCriticalMutation(()=>{S.transactions.push({id:'perf-new',type:'expense',accountId:'perf',currency:'AED',amount:0.01,walletAmount:0.01,fxRate:1,cat:'other',date:day,created:now+30000});return true;});const mutationMs=performance.now()-start;
   const renderStart=performance.now();render();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const renderAndTwoFramesMs=performance.now()-renderStart;clearInterval(pulse);
   const disk=await Storage.readState();return {transactions:S.transactions.length,initialWriteMs,mutationMs,renderAndTwoFramesMs,maxHeartbeatGapMs,heapUsedBytes:performance.memory?.usedJSHeapSize||null,balance:Finance.accountBalance('perf'),diskMatches:disk.ok&&stateFingerprint(disk.state)===stateFingerprint(snapshotState()),result};
 });
 assert.equal(financialPerformance.result.ok,true);assert.equal(financialPerformance.balance,9999.99);assert.equal(financialPerformance.diskMatches,true);assert.equal(financialPerformance.transactions,22935);
 fs.writeFileSync(path.join(output,'financial-performance.json'),JSON.stringify({browser:browser.version(),scope:'Synthetic 22934-row history, real browser IndexedDB and application mutation/render; after only, no mobile performance claim.',...financialPerformance},null,2));
 await perfContext.close();record('Large synthetic ledger: exact balance, verified IndexedDB, mutation and frame-delay measurements');
 assert.deepEqual(errors,[]);record('No JavaScript runtime or console errors');
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'PASS',environment:'Chromium/Linux; Android bridge simulated; synthetic data only',results,errors},null,2));
})().catch(async e=>{
 console.error(e);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'FAIL',results,errors,error:e.message},null,2));
 if(page){try{await page.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure-dom.txt'),await page.locator('body').innerText());}catch(_){}}
 process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close();});
