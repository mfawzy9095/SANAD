/* SANAD approved V25 screen reconstruction.
 * Only views and navigation. The financial ledger, state validation, persistence,
 * native SMS and notification code remain owned by existing verified modules.
 * Do not add independent balances or mutate transaction objects here.
 */
(function(){
'use strict';
if(!window.SanadV252||window.__v25RebuildMounted)return;
window.__v25RebuildMounted=true;
const W=window.SanadV252;
const tr=(ar,en)=>S.settings?.language==='en'?en:ar;
const ic=name=>window.SanadV25Icons?.vector?.(name)||'<span aria-hidden="true">•</span>';
const n=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'غير مؤكد':amtText(value);
const money=(val,cur)=>val===null||val===undefined||!Number.isFinite(Number(val))?tr('غير مؤكد','Unconfirmed'):n(val)+' '+esc(Finance.curSymbol(cur));
const frame=(name,sub,body)=>'<section class="r25-page" id="r25'+name+'"><header class="r25-page-title"><h2>'+esc(tr(name==='Home'?'الرئيسية':name==='Wallet'?'محفظتي':name==='Tx'?'العمليات':name==='Reports'?'التقارير':'الإعدادات',name))+'</h2><span>'+esc(sub||countryInfo(S.activeCountry).name)+'</span></header>'+body+'</section>';
const countryBar=()=>W.countryBar();
const section=(label,action='',text='')=>'<div class="r25-section"><h3>'+label+'</h3>'+(action?'<button type="button" '+action+'>'+text+'</button>':'')+'</div>';
const warning=()=>previewBannerHtml()+recoveryBannerHtml();
const act=(name,label,description,icon,extra='')=>'<button type="button" class="r25-list-row" '+name+'><span class="r25-action-icon">'+ic(icon)+'</span><span class="r25-action-text"><b>'+label+'</b><small>'+description+'</small></span>'+extra+'<span class="r25-chevron" aria-hidden="true">‹</span></button>';
const more=(body,label)=>'<details class="r25-extras"><summary>'+label+'</summary><div class="r25-legacy">'+body+'</div></details>';
const previous={home:viewHome,wallet:viewAccounts,tx:viewTx,report:viewRep,settings:viewSet};
function brandHeader(title){
 const isSettings=S.tab==='settings',hide=!!S.settings.hideAmounts,masked=amountsMasked();
 return '<div class="r25-header-brand"><img src="img/sanad-v25-original-logo.webp" alt=""><span><b>سند</b><small>SANAD</small></span></div>'+
 '<div class="r25-header-actions">'+
 '<button type="button" class="r25-icon-button" '+(hide?'data-sanad-act="amount-visibility"':'data-act="toggle-mask"')+' aria-label="'+(masked?'إظهار الأرصدة':'إخفاء الأرصدة')+'">'+ic('eye')+'</button>'+
 '<button type="button" class="r25-icon-button" '+(isSettings?'data-act="close-settings"':'data-sanad-act="bank-inbox"')+' aria-label="'+(isSettings?'رجوع':'مركز المراجعة')+'">'+ic(isSettings?'transfer':'bell')+'</button></div>';
}
topBarHome=function(){return brandHeader('home')};
topBarAccounts=function(){return brandHeader('wallet')};
topBarTx=function(){return brandHeader('transactions')};
topBarRep=function(){return brandHeader('reports')};
topBarSet=function(){return brandHeader('settings')};
topBarSubs=function(){return brandHeader('obligations')};
viewHome=function(){
 const country=S.activeCountry,accounts=Finance.getCountryAccounts(country).filter(a=>!a.archived);
 const primary=Finance.getPrimaryAccount(country)||Finance.getDefaultAccount(country)||accounts.find(a=>isAssetAccount(a))||null;
 const cur=primary?.currency||({UAE:'AED',EGY:'EGP',MAR:'MAD'}[country]||'AED');
 const liquidity=Finance.countryLiquidity(country)||{};
 const hasBalance=Object.prototype.hasOwnProperty.call(liquidity,cur);
 const mainBal=hasBalance?liquidity[cur]:null;
 const currencies=Object.entries(liquidity).filter(([k,v])=>v!==undefined);
 const ds=accounts.length?Finance.buildReportDataset({country,period:'month',month:ymKey(new Date())}):null;
 const income=ds&&Object.prototype.hasOwnProperty.call(ds.incomeByCur||{},cur)?ds.incomeByCur[cur]:null;
 const out=ds&&Object.prototype.hasOwnProperty.call(ds.spendingByCur||{},cur)?ds.spendingByCur[cur]:null;
 const reviewCount=(SanadBankInbox.items||[]).filter(x=>x?.plan?.decision==='review'||x?.plan?.needsReview).length||Number(SanadBankInbox.lastSummary?.review||0);
 const ids=new Set(accounts.map(a=>a.id));
 const recent=(S.transactions||[]).filter(t=>[t.accountId,t.fromAccountId,t.toAccountId].some(x=>ids.has(x))).sort(compareTxDesc).slice(0,3);
 const balances=currencies.length?currencies.map(([k,v])=>'<div class="r25-currency"><small>'+esc(k)+'</small><b class="amt-val">'+money(v,k)+'</b></div>').join(''):'<div class="r25-currency"><small>'+tr('الأرصدة','Balances')+'</small><b>'+tr('غير مؤكدة','Unconfirmed')+'</b></div>';
 const hero='<div class="r25-hero"><span class="r25-eyebrow">'+tr('إجمالي أرصدة الأصول · ','Asset balances · ')+esc(cur)+'</span><strong class="amt-val">'+money(mainBal,cur)+'</strong>'+
 '<div class="r25-hero-bottom"><span>'+tr('العملات منفصلة؛ لا يشمل حد الائتمان','Currencies remain separate; credit limits excluded')+'</span><button type="button" data-act="go-accounts">'+tr('محفظتي ←','My wallet →')+'</button></div></div>';
 const totals='<div class="r25-metrics"><div class="r25-stat"><small>'+tr('دخل الشهر','Monthly income')+'</small><b class="amt-val r25-positive">'+money(income,cur)+'</b><span>'+tr('الدخل المؤكد','Confirmed income')+'</span></div><div class="r25-stat"><small>'+tr('مصروفات الشهر','Monthly expenses')+'</small><b class="amt-val r25-expense">'+money(out,cur)+'</b><span>'+tr('مصروفات مسجلة','Recorded expenses')+'</span></div></div>';
 const transactions=recent.length?'<div class="r25-activity">'+recent.map(t=>txRowHtml(t,false)).join('')+'</div>':'<div class="r25-empty">لا توجد عمليات لهذا البلد.</div>';
 const content=countryBar()+'<p class="r25-intro">'+tr('إدارة أموالك بوضوح وأمان.','Your accounts and money, clearly organized.')+'</p>'+hero+
 '<div class="r25-currency-strip">'+balances+'</div>'+totals+
 section(tr('مركز المراجعة','Review center'),'data-sanad-act="bank-inbox"',tr('فتح','Open'))+
 '<button type="button" class="r25-review" data-sanad-act="bank-inbox"><span class="r25-action-icon">'+ic('shield')+'</span><span><b>'+tr('عمليات تحتاج تأكيدك','Transactions need confirmation')+'</b><small>'+tr('لا تُعتمد العمليات غير المحسومة تلقائيًا','Unresolved transactions are never posted automatically')+'</small></span><strong>'+reviewCount+'</strong></button>'+
 section(tr('آخر العمليات','Recent transactions'),'data-act="go-tx"',tr('عرض الكل','See all'))+transactions+
 '<button type="button" class="r25-primary" data-act="account-add-menu">'+ic('plus')+tr('إضافة حساب أو عملية','Add account or transaction')+'</button>';
 return warning()+frame('Home',countryInfo(country).name,content);
};
viewAccounts=function(){
 // The existing V.walletView already binds to the real Finance engine.
 // Render it directly: no nested legacy accounts UI and no duplicated cards.
 const html=W.walletView();
 return warning()+'<div class="r25-wallet-root">'+html+'</div>';
};
const buildTypes=[['','الكل'],['expense','مصروفات'],['income','دخل'],['transfer','تحويلات']];
let txMode='history';
viewTx=function(){
 const count=Number(SanadBankInbox.lastSummary?.review)||0;
 const tabs='<div class="r25-segment" role="group" aria-label="العمليات"><button type="button" data-r25-mode="history" aria-pressed="'+(txMode==='history')+'">السجل</button>'+
 '<button type="button" data-r25-mode="review" aria-pressed="'+(txMode==='review')+'">المراجعة'+(count?' ('+count+')':'')+'</button></div>';
 const search=txMode==='history'?'<div class="r25-search">'+ic('search')+'<input type="search" id="searchIn" autocomplete="off" value="'+esc(S.filter.q||'')+'" placeholder="ابحث عن عملية أو حساب..." aria-label="بحث العمليات"></div>':'';
 const filters=txMode==='history'?'<div class="r25-filters">'+buildTypes.map(([id,label])=>'<button type="button" data-r25-filter="'+id+'" aria-pressed="'+(String(S.filter.type||'')===id)+'">'+label+'</button>').join('')+'</div>':'';
 const body=txMode==='history'?'<div class="r25-transactions" id="txList">'+txListHtml()+'</div>'+
 '<button type="button" class="r25-primary" data-act="account-add-menu">'+ic('plus')+'إضافة عملية</button>':
 '<div class="r25-review-screen"><p>العمليات غير المحسومة لا تدخل في الأرصدة قبل تأكيدها.</p>'+
 '<button type="button" class="r25-primary" data-sanad-act="bank-inbox">'+ic('shield')+'فتح قائمة المراجعة</button></div>';
 return warning()+frame('Tx',countryInfo(S.activeCountry).name,countryBar()+tabs+search+filters+body);
};
viewRep=function(){
 const accounts=Finance.getCountryAccounts(S.activeCountry).filter(a=>!a.archived);
 if(!accounts.length)return warning()+frame('Reports','',countryBar()+'<div class="r25-empty">أضف حسابًا لعرض التقارير.</div>');
 const curSet=[...new Set(accounts.map(a=>a.currency))],selected=Finance.getAccount(S.repAccountId);
 if(selected&&selected.currency)S.repCurrency=selected.currency;
 if(!curSet.includes(S.repCurrency))S.repCurrency=Finance.getDefaultAccount(S.activeCountry)?.currency||curSet[0];
 if(S.repAccountId&&!accounts.some(a=>a.id===S.repAccountId))S.repAccountId=null;
 const cur=S.repCurrency,ds=Finance.buildReportDataset({country:S.activeCountry,period:S.repPeriod,accountId:S.repAccountId||null,currency:cur,month:S.month});
 const spend=ds.spendingByCur?.[cur]??null,inc=ds.incomeByCur?.[cur]??null;
 const net=spend===null||inc===null?null:SanadMoneyCore.sum([inc,-spend],cur).value;
 const opts=[['today','اليوم'],['week','أسبوع'],['month','شهر'],['6months','٦ أشهر']];
 const tabs='<div class="r25-filters r25-period">'+opts.map(([code,label])=>'<button type="button" data-period="'+code+'" aria-pressed="'+(S.repPeriod===code)+'" class="'+(S.repPeriod===code?'on':'')+'">'+label+'</button>').join('')+'</div>';
 const currencies='<div class="r25-filters r25-report-currencies">'+curSet.map(code=>'<button type="button" data-repcur="'+esc(code)+'" aria-pressed="'+(cur===code)+'">'+esc(code)+'</button>').join('')+'</div>';
 const acctOpts='<select data-rep-account="1" aria-label="حساب التقرير"><option value="">كل الحسابات</option>'+accounts.map(a=>'<option value="'+esc(a.id)+'"'+(S.repAccountId===a.id?' selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>';
 const month='<div class="r25-report-month"><button type="button" data-mv="-1">›</button><span>'+esc(monthLabel(S.month))+'</span><button type="button" data-mv="1">‹</button></div>';
 const main='<div class="r25-report-primary"><small>'+tr('إجمالي المصروفات','Total expenses')+' · '+esc(cur)+'</small><strong class="amt-val">'+money(spend,cur)+'</strong><span>يتم احتساب العمليات المؤكدة فقط</span></div>';
 const metrics='<div class="r25-metrics"><div class="r25-stat"><small>الدخل</small><b class="amt-val r25-positive">'+money(inc,cur)+'</b></div>'+
 '<div class="r25-stat"><small>الصافي</small><b class="amt-val">'+money(net,cur)+'</b></div></div>';
 const chart=Array.isArray(ds.chartBuckets)?ds.chartBuckets:[];
 const max=Math.max(1,...chart.map(x=>Number(x.val)||0));
 const bars='<div class="r25-bars">'+chart.map((v,i)=>'<div class="r25-barcol"><i style="height:'+Math.max(3,Math.round((Number(v.val)||0)/max*100))+'%"></i><small>'+esc(String(v.label||v.name||i+1))+'</small></div>').join('')+'</div>';
 const categories=Object.entries(ds.categoryByCur?.[cur]||{}).sort((a,b)=>b[1]-a[1]);
 const top=Math.max(1,...categories.map(x=>Number(x[1])||0));
 const cat='<div class="r25-categories">'+(categories.length?categories.map(([key,val])=>'<div class="r25-category"><div><b>'+esc(Finance.getCat('expense',key)?.n||key)+'</b><span class="amt-val">'+money(val,cur)+'</span></div><i><em style="width:'+Math.max(0,Math.min(100,Math.round(Number(val)/top*100)))+'%"></em></i></div>').join(''):'<p>لا توجد مصروفات مؤكدة لهذا النطاق.</p>')+'</div>';
 // Existing report remains reachable with all original detailed calculations.
 const body=countryBar()+tabs+(S.repPeriod==='month'||S.repPeriod==='6months'?month:'')+
 '<div class="r25-report-filter"><label>العملة'+currencies+'</label><label>الحساب'+acctOpts+'</label></div>'+
 main+metrics+section('المصروفات عبر الفترة')+'<div class="r25-paper">'+bars+'</div>'+section('التصنيفات')+'<div class="r25-paper">'+cat+'</div>';
 return warning()+frame('Reports',countryInfo(S.activeCountry).name,body);
};
const oldSet=previous.settings;
viewSet=function(){
 const yes=(b)=>'<span class="r25-switch '+(b?'on':'')+'" aria-hidden="true"><i></i></span>';
 const sec=(name,rows)=>'<div class="r25-settings-heading">'+name+'</div><div class="r25-settings-group">'+rows+'</div>';
 const settings=S.settings||{};
 const bankStatus=SanadBankInbox.historicalImporting?'جاري الفحص':tr('تعمل على الجهاز','On-device');
 const core=sec('الأمان والخصوصية',
 act('data-sanad-act="toggle-security"','قفل بالبصمة / الجهاز',SanadSecurity.cfg.enabled?'مفعّل':'غير مفعّل','lock',yes(SanadSecurity.cfg.enabled))+
 act('data-act="toggle-mask"','إخفاء الأرصدة','التحقق بالبصمة عند إظهار المبالغ','eye',yes(settings.hideAmounts))+
 act('data-act="toggle-notif"','الإشعارات','تنبيهات الالتزامات المهمة','bell',yes(settings.notificationsEnabled)))+
 sec('المزامنة البنكية',
 act('data-sanad-act="bank-inbox"','مراجعة العمليات','الحركات التي تحتاج تأكيدك','shield')+
 act('data-sanad-act="bank-sms-recent"','استيراد الجديد','فحص الرسائل الجديدة دون تكرار','sms')+
 act('data-sanad-act="bank-sms-history"','استيراد الرسائل السابقة','تاريخ أو نطاق زمني محدد','calendar')+
 act('data-sanad-act="bank-sms-config"','إعدادات الاستيراد',bankStatus,'settings'))+
 sec('البيانات والنسخ الاحتياطي',
 act('data-sanad-act="full-export"','نسخة احتياطية كاملة','نسخة محلية قابلة للاسترجاع','download')+
 act('data-sanad-act="full-import"','استرجاع النسخة','من ملف محفوظ على جهازك','upload')+
 act('data-sanad-act="bank-support-export"','تقرير التشخيص','معلومات تساعد على تتبع مشكلة SMS','file'))+
 sec('الشكل والتفضيلات',
 '<div class="r25-inline-options"><span>اللغة</span><div><button type="button" data-sanad-act="lang" data-value="ar" aria-pressed="'+(settings.language!=='en')+'">العربية</button><button type="button" data-sanad-act="lang" data-value="en" aria-pressed="'+(settings.language==='en')+'">English</button></div></div>'+
 '<div class="r25-inline-options"><span>المظهر</span><div><button type="button" data-sanad-act="theme" data-value="light" aria-pressed="'+(settings.theme!=='dark')+'">فاتح</button><button type="button" data-sanad-act="theme" data-value="dark" aria-pressed="'+(settings.theme==='dark')+'">داكن</button></div></div>'+
 act('data-act="go-subs"','الالتزامات والاشتراكات','إدارة الدفعات الدورية','calendar'));
 const countries='<div class="r25-default-countries">'+[['UAE','الإمارات'],['EGY','مصر'],['MAR','المغرب']].map(([id,label])=>'<button type="button" data-default-country="'+id+'" aria-pressed="'+(settings.defaultCountry===id)+'">'+label+'</button>').join('')+'</div>';
 const advanced=more(oldSet(),'كل الإعدادات والتصنيفات وإدارة البيانات المتقدمة');
 return warning()+frame('Settings','SANAD',sec('البلد الافتراضية',countries)+core+advanced);
};
// Stay inside existing application event architecture for all financial writes.
document.addEventListener('click',e=>{
 const mode=e.target.closest('[data-r25-mode]');
 if(mode){e.preventDefault();e.stopPropagation();txMode=mode.dataset.r25Mode;render();return;}
 const chip=e.target.closest('[data-r25-filter]');
 if(chip){e.preventDefault();e.stopPropagation();S.filter.type=chip.dataset.r25Filter||null;render();return;}
},true);
window.SanadV25Rebuild={previous,version:'v25-structural-rebuild-1'};
})();