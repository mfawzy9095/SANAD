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
 if(await page.locator('#onboard').isVisible())await page.locator('[onclick="onboardSkip()"]').click();
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 await page.waitForFunction(()=>!document.getElementById('sanadBootSplash')||getComputedStyle(document.getElementById('sanadBootSplash')).visibility==='hidden');
 assert((await page.locator('#view').innerText()).length>30);record('Boot, meaningful screen, IndexedDB and onboarding');
 await page.evaluate(()=>go('settings'));await page.locator('[data-sanad-act="bank-sms-config"]').click();
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
 await page.waitForFunction(()=>SanadBankInbox.lastRecentImport?.status==='complete');
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Generic deposit origin must remain review');
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-deposit'));
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 assert.equal(await page.evaluate(()=>S.transactions.length),1,'Unchecked external origin cannot post');
 await page.locator('#bankFixExternalIncome').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(()=>S.transactions.length===2&&!_criticalMutationInFlight);
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
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());
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
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-sanad-act="full-export"]').click();
 const download=await downloadPromise;const backupPath=path.join(output,'synthetic-full-backup.json');await download.saveAs(backupPath);
 const saved=JSON.parse(fs.readFileSync(backupPath));assert.equal(saved.format,'SANAD_FULL_BACKUP');
 await page.evaluate(()=>go('home'));await addManual('expense',5);
 await page.evaluate(()=>go('settings'));await page.locator('[data-sanad-act="full-import"]').click();
 await page.locator('#sanadFullImport').setInputFiles(backupPath);await page.locator('.dialog-backdrop.on #dlgOk').click();
 await page.waitForFunction(expected=>stateFingerprint(snapshotState())===expected,fp);
 assert(await page.evaluate(async id=>!!(await SanadExtStorage.getReceipt(id)),expenseId));record('Full backup export/restore with receipt and fingerprint equality');
 // Add a second account and transfer through the actual forms.
 await page.evaluate(()=>openAccountSheet(null,'bank'));
 await page.locator('#wName').fill('QA Savings');await page.locator('#wBalance').fill('0');await page.locator('#wOpeningKnown').check();
 await page.locator('[data-act="save-account"]').click();
 await page.waitForFunction(()=>S.accounts.some(a=>a.name==='QA Savings')&&!_criticalMutationInFlight);
 const savingsId=await page.evaluate(()=>S.accounts.find(a=>a.name==='QA Savings').id);
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
 for(const tab of ['tx','accounts','subs','rep','home']){await page.locator('#bottomNav [data-tab="'+tab+'"]').click();assert((await page.locator('#view').innerText()).length>0);}
 record('All primary tabs respond without blank pages');
 await page.evaluate(()=>go('settings'));await page.locator('[data-sanad-act="lang"][data-value="en"]').click();
 await page.waitForFunction(()=>document.documentElement.dir==='ltr');await page.locator('[data-sanad-act="theme"][data-value="dark"]').click();
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.evaluate(()=>go('home'));await stableHome();await page.screenshot({path:path.join(output,'mobile-en-dark.png')});record('English LTR and dark theme');
 for(const width of [360,1280]){await page.setViewportSize({width,height:852});await stableHome();assert(await page.evaluate(()=>{const a=document.querySelector('.wh-link').getBoundingClientRect(),b=document.querySelector('.wh-name').getBoundingClientRect();return a.bottom<=b.top;}),'long account name must not overlap the account link');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'viewport-'+width+'.png')});}
 record('360/393/1280 widths without page overflow');

 await page.evaluate(()=>{window.__qaRows.push({id:'qa-after-scan',title:'Emirates NBD',packageName:'sms:ENBD',postedAt:Date.now(),text:'لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QAAFTERSCAN01. الرصيد المتوفر هو AED 9,031.66'});});
 const beforeRecent=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent);
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent);
 assert.equal(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.filter(r=>r.id==='qa-after-scan').length),1,'Repeated import retains one unresolved review');
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-after-scan'));
 await page.locator('#bankFixExternalIncome').check();
 await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeRecent);
 await page.evaluate(()=>closeSheet());

 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeRecent+1);
 record('New unresolved inbound remains one review across repeats, then posts once after origin confirmation');
 await page.evaluate(()=>go('settings'));
 const diagnosticDownload=page.waitForEvent('download');await page.locator('[data-sanad-act="bank-support-export"]').click();
 const diagnostic=await diagnosticDownload,diagnosticPath=path.join(output,'synthetic-diagnostic-backup.json');await diagnostic.saveAs(diagnosticPath);
 const diagnosticData=JSON.parse(fs.readFileSync(diagnosticPath));assert.equal(diagnosticData.format,'SANAD_FULL_BACKUP');assert(diagnosticData.features.diagnosticReport);assert(diagnosticData.features.bankImportAudit.decisions.rows.some(r=>r.id==='qa-after-scan'&&r.action==='saved'));
 record('Restorable backup plus diagnostic report exports posting decisions and exact scan bounds');
 const decisionCount=await page.evaluate(()=>Object.keys(S.settings.bankEventDecisions).length);
 await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 assert.equal(await page.evaluate(()=>Object.keys(S.settings.bankEventDecisions).length),decisionCount);
 const txBeforeReload=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-after-scan',title:'Emirates NBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'لقد تم ايداع AED 10.00 في رقم حسابك 012XXX50XXX01 OBP TR REF QAAFTERSCAN01. الرصيد المتوفر هو AED 9,031.66'}];});
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),txBeforeReload);
 record('Durable event decisions survive reload and prevent repeated posting');
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-dismiss',title:'ENBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'Bank transfer: incomplete financial details'}];});
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.some(r=>r.id==='qa-dismiss')));
 await page.evaluate(()=>SanadBankInbox.dismiss('qa-dismiss'));await page.reload();await page.waitForFunction(()=>S.ready&&SanadV9.initialized);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-dismiss',title:'ENBD',postedAt:Date.now()-1000,packageName:'sms:ENBD',text:'Bank transfer: incomplete financial details'}];});
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>SanadBankInbox.smsReviewEvents.some(r=>r.id==='qa-dismiss')),false);
 record('Dismissed review stays dismissed after reload and provider rescan');
 const expandedFloor=await page.evaluate(async()=>{const floor=S.settings.bankSmsStartAt-86400000;const result=await commitCriticalMutation(()=>{S.settings.bankSmsStartAt=floor;return true;});if(!result.ok)throw Error('test range write failed');window.__qaFail='query-failed';return floor;});
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>SanadBankInbox.lastRecentImport.scannedThrough),0);
 await page.evaluate(()=>{window.__qaFail=null;window.__qaRows=[];});await page.evaluate(()=>SanadBankInbox.refreshRecentSms());
 assert.equal(await page.evaluate(()=>SanadBankInbox.lastRecentImport.fromDate),expandedFloor);
 record('Failed expanded range retries from the saved start without inheriting old coverage');

 const beforeOutgoing=await page.evaluate(()=>S.transactions.length);
 await page.evaluate(()=>{window.__qaRows=[{id:'qa-outgoing-origin',title:'EmiratesNBD',packageName:'sms:ENBD',postedAt:Date.now()-1000,text:'تم خصم مبلغ AED 37.35 من حسابك 012XXX50XXX01 لتحويل الاموال'}];});
 await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing);
 await page.evaluate(()=>SanadBankInbox.openCorrection('qa-outgoing-origin'));
 await page.locator('[data-sanad-act="bank-fix-save"]').click();assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing);
 await page.locator('#bankFixExternalDestination').check();await page.locator('[data-sanad-act="bank-fix-save"]').click();
 await page.waitForFunction(n=>S.transactions.length===n+1&&!_criticalMutationInFlight,beforeOutgoing);
 assert.equal(await page.evaluate(()=>S.transactions.find(t=>t.bankImportEventId==='qa-outgoing-origin').economicOrigin.kind),'external-destination');
 await page.evaluate(()=>closeSheet());await page.evaluate(()=>SanadBankInbox.refreshRecentSms());assert.equal(await page.evaluate(()=>S.transactions.length),beforeOutgoing+1);
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
 const perfContext=await browser.newContext(),perfPage=await perfContext.newPage();perfPage.on('pageerror',e=>errors.push(e.message));
 await perfPage.goto(process.env.SANAD_QA_URL||'http://127.0.0.1:8765');await perfPage.waitForFunction(()=>typeof S!=='undefined'&&S.ready&&SanadV9.initialized);
 if(await perfPage.locator('#onboard').isVisible())await perfPage.locator('[onclick="onboardSkip()"]').click();await perfPage.waitForFunction(()=>!document.getElementById('app').hidden&&!_criticalMutationInFlight);
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

