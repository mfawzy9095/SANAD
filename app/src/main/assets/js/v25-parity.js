/* SANAD V25: exact visual hierarchy with real read-only financial data.
   This adapter does NOT store financial data, perform SMS parsing, or bypass security. */
(function(){
'use strict';
const V=window.SanadV252;
if(!V||window.__v25ParityInstalled)return;
window.__v25ParityInstalled=true;
const originalHome=viewHome;
const money=(value,cur)=>{
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return 'غير مؤكد';
  return amtText(value)+' '+esc(Finance.curSymbol(cur));
};
const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:'#066b83';
const tr=(ar,en)=>S.settings&&S.settings.language==='en'?en:ar;
const countryBar=()=>'<div class="v252-country" role="group" aria-label="'+tr('اختيار البلد','Select country')+'">'+
  [['UAE','الإمارات','UAE'],['EGY','مصر','Egypt'],['MAR','المغرب','Morocco']].map(([code,ar,en])=>
    '<button type="button" data-v252-country="'+code+'" class="'+(S.activeCountry===code?'active':'')+'" aria-pressed="'+(S.activeCountry===code)+'">'+tr(ar,en)+'</button>').join('')+'</div>';
V.countryBar=()=>countryBar();
function title(text){return '<div class="v25-page-head"><h2>'+text+'</h2><small>'+esc(countryInfo(S.activeCountry).name)+'</small></div>'}
function subhead(heading,action,label){
  return '<div class="v25-heading"><h3>'+heading+'</h3>'+(action?'<button type="button" '+action+'>'+label+'</button>':'')+'</div>';
}
function realHome(){
  const country=S.activeCountry,all=Finance.getCountryAccounts(country);
  const primary=Finance.getPrimaryAccount(country)||Finance.getDefaultAccount(country)||all.find(a=>isAssetAccount(a)&&!a.archived)||null;
  const period=ymKey(new Date());
  const liquidity=Finance.countryLiquidity(country);
  const cur=(primary&&primary.currency)||({UAE:'AED',EGY:'EGP',MAR:'MAD'}[country]||'AED');
  const balances=Object.entries(liquidity).filter(([k,v])=>v!==undefined&&v!==null);
  const mainBalance=Object.prototype.hasOwnProperty.call(liquidity,cur)?liquidity[cur]:null;
  const ds=all.length?Finance.buildReportDataset({country,period:'month',month:period}):null;
  const income=ds&&ds.incomeByCur&&Object.prototype.hasOwnProperty.call(ds.incomeByCur,cur)?ds.incomeByCur[cur]:null;
  const expense=ds&&ds.spendingByCur&&Object.prototype.hasOwnProperty.call(ds.spendingByCur,cur)?ds.spendingByCur[cur]:null;
  const showNoAccounts=!all.length;
  const rows=all.length?S.transactions.filter(tx=>tx.date&&(
    (tx.accountId&&all.some(a=>a.id===tx.accountId))||
    (tx.fromAccountId&&all.some(a=>a.id===tx.fromAccountId))||
    (tx.toAccountId&&all.some(a=>a.id===tx.toAccountId))
  )).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4):[];
  const reviewButton='<button type="button" class="v25-review-btn" data-sanad-act="bank-inbox">'+
    '<span><b>'+tr('عمليات تحتاج تأكيدك','Transactions need confirmation')+'</b><small>'+tr('راجع العمليات غير المؤكدة قبل اعتمادها','Review unresolved transactions before posting')+'</small></span><span class="pill">'+tr('المراجعة ←','Review →')+'</span></button>';
  const logoButton='<button type="button" data-sanad-act="amount-visibility" aria-label="'+(amountsMasked()?'إظهار المبالغ':'إخفاء المبالغ')+'">'+(amountsMasked()?'إظهار':'إخفاء')+'</button>';
  const status=primary?tr('الحساب الأساسي في '+countryInfo(country).name,'Primary account in '+({UAE:'UAE',EGY:'Egypt',MAR:'Morocco'}[country]||country)+' · '+(mainBalance===null?'Balance unconfirmed':'Ledger balance')):tr('لا يوجد حساب أساسي','No primary account');
  const hero='<div class="v25-hero"><small>'+tr('أرصدة الأصول من السجل','Ledger asset balances')+' · '+esc(cur)+'</small>'+
    '<strong class="amt-val">'+(showNoAccounts?'—':money(mainBalance,cur))+'</strong>'+
    '<small class="wh-sub">'+esc(status)+'</small>'+
    '<div class="v25-hero-foot"><small>'+tr('العملات الأخرى لا تُجمع ولا يدخل الائتمان ضمن الأصول','Currencies are not combined; credit is not an asset')+'</small>'+
    (S.settings.hideAmounts?logoButton:'<button type="button" data-act="go-accounts">'+tr('محفظتي ←','My wallet →')+'</button>')+'</div></div>';
  const chips=balances.map(([currency,value])=>'<div class="v25-cur-chip"><small>رصيد '+esc(currency)+'</small><b class="amt-val">'+money(value,currency)+'</b></div>').join('')||'<div class="v25-cur-chip"><small>الأرصدة</small><b>غير مؤكدة</b></div>';
  const metrics='<div class="v25-metrics"><div class="v25-metric"><small>'+tr('دخل الشهر','Monthly income')+' · '+esc(cur)+'</small>'+
    '<b class="amt-val" style="color:#079375">'+money(income,cur)+'</b><em>'+tr('دخل مؤكد في السجل','Recorded income')+'</em></div>'+
    '<div class="v25-metric"><small>'+tr('مصروفات الشهر','Monthly spending')+' · '+esc(cur)+'</small>'+
    '<b class="amt-val" style="color:#b97858">'+money(expense,cur)+'</b><em>'+tr('مصاريف مسجلة','Recorded spending')+'</em></div></div>';
  const actions='<div class="v25-actions">'+
    '<button type="button" data-sanad-act="bank-sms-recent">'+svg('sms')+' استيراد الجديد</button>'+
    '<button type="button" data-act="account-add-menu">'+svg('plus')+' إضافة حساب</button>'+
    '</div>';
  const txs=rows.length?'<div class="card">'+rows.map(t=>txRowHtml(t,true)).join('')+'</div>':
    '<div class="v252-empty">لا توجد عمليات في البلد المحدد.</div>';
  const expanded=originalHome();
  return '<div class="v25-page" id="v25Home">'+previewBannerHtml()+recoveryBannerHtml()+missedRecurringBannerHtml()+
    title(tr('أهلاً بيك في سند','Welcome to SANAD'))+countryBar()+'<p class="v25-hint">'+tr('حساباتك وحركاتك المالية في مكان واحد.','Manage accounts and transactions in one place.')+'</p>'+
    hero+'<div class="v25-cur-strip">'+chips+'</div>'+metrics+
    subhead(tr('مركز المراجعة','Review center'),'data-sanad-act="bank-inbox"','فتح')+reviewButton+
    subhead(tr('آخر العمليات','Recent transactions'),'data-act="go-tx"','عرض الكل')+txs+actions+
    '<details class="v25-advanced"><summary>الأدوات والتفاصيل المالية المتقدمة</summary><div class="v25-advanced-body">'+expanded+'</div></details>'+
    '</div>';
}
function svg(type){
  const p={sms:'<path d="M4 5h16v13H9l-5 3zM8 9h8M8 13h6"/>',plus:'<path d="M12 5v14M5 12h14"/>'}[type]||'';
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
}
viewHome=realHome;
// Selection defaults display content immediately, just like the approved prototype.
V.walletView=function(){
  const groups=this.groups();
  const available=new Set(groups.map(g=>g.id));
  if(!available.has(this.bankId)){this.bankId=groups[0]?.id||null;this.accountId=null;this.cardId=null;}
  const selected=groups.find(g=>g.id===this.bankId);
  if(selected&&!selected.accounts.some(a=>a.id===this.accountId)){this.accountId=selected.accounts[0]?.id||null;this.cardId=null;}
  const chosen=selected&&selected.accounts.find(a=>a.id===this.accountId);
  const cards=chosen?Finance.getCountryInstruments(S.activeCountry).filter(i=>!i.archived&&i.accountId===chosen.id&&['credit_card','debit_card','prepaid_card','wallet_card'].includes(i.type)):[];
  if(!cards.some(i=>i.id===this.cardId))this.cardId=cards[0]?.id||null;
  const bankItems=groups.map(g=>{
    const inst=g.institution,name=inst?.name||tr('حساب غير مرتبط','Unlinked account');
    const b=inst?.bankRegistryId?UaeBankRegistryCore.get(inst.bankRegistryId):null;
    const p=inst?.providerRegistryId?UaeBankRegistryCore.getProvider(inst.providerRegistryId):null;
    const abbreviation=b?bankUiShort(b):p?providerUiShort(p):String(name).slice(0,3);
    // Use an honest offline institutional monogram until licensed master
    // brand artwork is available. Never display a false "official" bank logo.
    const mark='<span role="img" aria-label="'+esc(name)+'">'+esc(abbreviation.slice(0,4))+'</span>';
    return '<button class="v252-bank" type="button" title="'+esc(name)+'" data-v252-bank="'+esc(g.id)+'" aria-pressed="'+(g.id===this.bankId)+'">'+
      '<span class="v252-mark">'+mark+'</span><span><b>'+esc(abbreviation)+'</b><small>'+g.accounts.length+' '+tr('حساب','accounts')+'</small></span></button>';
  }).join('');
  const accountItems=selected?selected.accounts.map(a=>{
    const pres=!isLiabilityAccount(a)?Finance.accountBalancePresentation(a.id):null;
    const balance=pres?pres.display:Finance.accountBalance(a.id);
    return '<button type="button" class="v252-account" data-v252-account="'+esc(a.id)+'" aria-pressed="'+(a.id===this.accountId)+'">'+
      '<strong>'+esc(a.name)+'</strong><span>'+esc(a.currency)+' · '+(isLiabilityAccount(a)?'مديونية':'رصيد السجل')+'</span>'+
      '<span class="amt-val">'+money(balance,a.currency)+'</span></button>';
  }).join(''):'';
  const cardItems=cards.map(i=>{
    const a=Finance.getAccount(i.accountId);
    const debt=i.type==='credit_card';
    const presented=!debt&&a?Finance.accountBalancePresentation(a.id):null;
    const amount=debt?Finance.creditAvailable(a.id):(presented?presented.display:Finance.accountBalance(a.id));
    const safe=safeColor(i.color||a?.color);
    const network=String(i.network||'').replace(/[^A-Za-z0-9 \-]/g,'').slice(0,20);
    return '<div class="v25-payment-card" role="button" tabindex="0" data-v252-card="'+esc(i.id)+'" aria-pressed="'+(i.id===this.cardId)+'" style="background:linear-gradient(125deg,'+safe+',#063d54)">'+
      '<div class="v25-payment-card-head"><div><b>'+esc(a?.name||'الحساب')+'</b><small>'+esc(i.name)+'</small></div><span class="v25-card-type">'+esc(cardTypeShortLabel(i.type))+'</span></div>'+
      '<div class="v25-payment-card-number">'+esc(maskedCardNumber(i)||'•••• •••• •••• ••••')+'</div>'+
      '<div class="v25-payment-card-foot"><div><small>'+(debt?'الائتمان المتاح':'الرصيد المرتبط')+'</small><b class="amt-val">'+money(amount,a?.currency||'AED')+'</b></div>'+
      '<div class="v25-card-network">'+cardNetworkLogoHtml(i.network)+'</div></div></div>';
  }).join('');
  return '<section class="v25-page" id="v252Wallet">'+title(tr('محفظتي','My wallet'))+countryBar()+
    '<div class="v252-section"><h3>البنوك والمحافظ</h3><small class="v252-hint">اضغط على البنك لاختياره</small></div>'+
    (groups.length?'<div class="v252-strip" id="v252BankStrip">'+bankItems+'</div>':'<div class="v252-empty">لا توجد حسابات في هذا البلد بعد.</div>')+
    '<div class="v252-section"><h3>الحسابات</h3><small class="v252-hint">اختيار مباشر</small></div>'+
    (accountItems?'<div class="v252-strip" id="v252AccountStrip">'+accountItems+'</div>':'<div class="v252-empty">أضف حسابًا لعرض رصيده.</div>')+
    '<div class="v252-section"><h3>البطاقات</h3><small class="v252-hint">اسحب البطاقات بأصبعك</small></div>'+
    (cardItems?'<div class="v252-strip v252-cards" id="v252CardStrip">'+cardItems+'</div>':'<div class="v25-card-list-empty">لا توجد بطاقات مرتبطة بالحساب المختار.</div>')+
    '<div class="v25-actions"><button type="button" data-act="account-add-menu">'+svg('plus')+' إضافة حساب أو بطاقة</button>'+
    '<button type="button" data-sanad-act="bank-sms-recent">'+svg('sms')+' استيراد رسائل SMS</button></div>'+
    '</section>';
};
// The product is direct entry after splash. The previous onboarding carousel
// is presentation-only and is skipped without modifying the persisted onboarding flag.
showOnboarding=function(){
  document.getElementById('onboard').hidden=true;
  startApp();
};
const formerBank=V.bank;
V.bank=function(id){
  // A selected bank opens its read-only sheet on a second tap.
  return formerBank.call(this,id);
};
// After durable scan completion, keep the result visible briefly and then
// minimize into the tappable summary chip. Do not stop or alter the import.
const coreFinish=SanadSmsImportUI.finish.bind(SanadSmsImportUI);
SanadSmsImportUI.finish=function(result){
  coreFinish(result);
  if(this.state==='complete'){
    setTimeout(()=>{
      if(this.result===result&&this.state==='complete'&&this.visible)this.minimize();
    },6500);
  }
};
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-act="go-tx"]'))return;
  e.preventDefault();go('tx');
},true);
// Keep country filtering at the top of all financial/report screens, not only
// the wallet. This is a presentation wrapper and never persists country changes.
const oldRender=render;
render=function(){
  oldRender();
  const target=document.getElementById('view');
  if(target&&['tx','rep','subs'].includes(S.tab)&&!target.querySelector(':scope > .v252-country')){
    target.insertAdjacentHTML('afterbegin',countryBar());
  }
};
// Remove flags in presentation, never modify account country metadata.
const oldStrip=V.stripFlags.bind(V);
V.stripFlags=function(root){oldStrip(root);};
})();