/* SANAD V25.2 layout adapter. No financial state/ledger writes; only existing UI actions. */
(function(){
'use strict';
const V = {
  countryCode:null,bankId:null,accountId:null,cardId:null,
  country(code){
    if(!['UAE','EGY','MAR'].includes(code))return;
    if(S.activeCountry===code)return;
    S.activeCountry=code;this.countryCode=code;this.bankId=null;this.accountId=null;this.cardId=null;
    if(S.repAccountId){const a=Finance.getAccount(S.repAccountId);if(!a||a.country!==code)S.repAccountId=null;}
    render();
  },
  groups(){
    const accounts=Finance.getCountryAccounts(S.activeCountry).filter(a=>!a.archived&&!a.ownedByInstrumentId);
    const groups=new Map();
    for(const a of accounts){
      const key=a.institutionId||'unlinked';
      if(!groups.has(key))groups.set(key,{id:key,institution:a.institutionId?Finance.getInstitution(a.institutionId):null,accounts:[]});
      groups.get(key).accounts.push(a);
    }
    return Array.from(groups.values());
  },
  bank(id){
    if(this.bankId===id){this.bankDetails(id);return;}
    this.bankId=id;this.accountId=null;this.cardId=null;
    render();
  },
  account(id){
    const a=Finance.getAccount(id);
    if(!a||a.archived||a.country!==S.activeCountry)return;
    if(this.accountId===id){this.accountDetails(id);return;}
    this.accountId=id;this.cardId=null;render();
  },
  card(id){
    const i=Finance.getInstrument(id);
    if(!i||i.archived||i.country!==S.activeCountry)return;
    if(this.cardId===id){this.cardDetails(id);return;}
    this.cardId=id;
    const nodes=document.querySelectorAll('[data-v252-card]');
    nodes.forEach(n=>n.setAttribute('aria-pressed',n.dataset.v252Card===id?'true':'false'));
  },
  bankDetails(id){
    const group=this.groups().find(g=>g.id===id);if(!group)return;
    const name=group.institution&&group.institution.name||'حسابات بدون مؤسسة';
    openSheet('<div class="sheet-head"><h2>تفاصيل المؤسسة</h2><button type="button" class="close" data-act="close-sheet">×</button></div>'+
      '<div class="sheet-body"><h3>'+esc(name)+'</h3><p>'+group.accounts.length+' حساب</p>'+
      '<p class="v252-hint">المؤسسة تضم الحسابات المعروضة من بيانات SANAD الفعلية.</p></div>','v252-bank-details');
  },
  accountDetails(id){
    const a=Finance.getAccount(id);if(!a)return;
    const inst=a.institutionId?Finance.getInstitution(a.institutionId):null;
    const present=isLiabilityAccount(a)?null:Finance.accountBalancePresentation(a.id);
    const balance=present?present.display:Finance.accountBalance(a.id);
    const label=isLiabilityAccount(a)?'المديونية':'رصيد السجل';
    openSheet('<div class="sheet-head"><h2>تفاصيل الحساب</h2><button type="button" class="close" data-act="close-sheet">×</button></div>'+
      '<div class="sheet-body"><div class="v252-card"><h3>'+esc(a.name)+'</h3>'+
      '<p class="v252-hint">'+esc(inst?inst.name:'غير مرتبط بمؤسسة')+' · '+esc(a.currency)+'</p>'+
      '<div class="sec"><h2>'+label+'</h2><strong class="amt-val">'+amtText(balance)+' '+esc(Finance.curSymbol(a.currency))+'</strong></div>'+
      (present&&present.mismatch?'<p class="v252-hint">الرصيد المبلغ من البنك يختلف عن رصيد السجل؛ راجع الحساب قبل الاعتماد.</p>':'')+
      '</div>'+(canWrite()?'<button class="v252-quick" type="button" data-account-edit="'+esc(a.id)+'">تعديل الحساب</button>':'')+
      '</div>','v252-account-details');
  },
  cardDetails(id){
    const i=Finance.getInstrument(id);if(!i)return;
    const a=Finance.getAccount(i.accountId);
    openSheet('<div class="sheet-head"><h2>تفاصيل البطاقة</h2><button type="button" class="close" data-act="close-sheet">×</button></div>'+
      '<div class="sheet-body"><div class="v252-card"><h3>'+esc(i.name)+'</h3>'+
      '<p>'+esc(maskedCardNumber(i)||'بطاقة بدون رقم جزئي')+'</p>'+
      '<p class="v252-hint">'+esc(cardTypeShortLabel(i.type))+' · '+esc(String(i.network||'غير محدد'))+'</p>'+
      '<p class="v252-hint">الحساب المرتبط: '+esc(a?a.name:'غير موجود')+'</p></div>'+
      (canWrite()?'<button class="v252-quick" type="button" data-instrument-edit="'+esc(i.id)+'">تعديل البطاقة بأمان</button>':'')+
      '</div>','v252-card-details');
  },
  nav(){
    const nav=document.getElementById('bottomNav');
    if(!nav||nav.dataset.v252Nav==='ready')return;
    const existing=Array.from(nav.querySelectorAll('[data-tab]'));
    const byId=new Map(existing.map(n=>[n.dataset.tab,n]));
    const settings=document.createElement('button');
    settings.type='button';settings.dataset.tab='settings';settings.setAttribute('aria-label','الإعدادات');
    settings.innerHTML='<div class="ico"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg></div><span>الإعدادات</span>';
    settings.addEventListener('click',()=>go('settings'));
    nav.replaceChildren(...['home','accounts','tx','rep'].map(k=>byId.get(k)),settings);
    byId.get('accounts').querySelector('span').textContent='محفظتي';
    byId.get('tx').querySelector('span').textContent='العمليات';
    nav.dataset.v252Nav='ready';
  },
  stripFlags(root){
    if(!root)return;
    const pattern=/[\u{1F1E6}-\u{1F1FF}]{2}/gu;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n;while((n=walker.nextNode())){if(/[\u{1F1E6}-\u{1F1FF}]/u.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(pattern,'');}
  },
  countryBar(){
    const codes=[['UAE','الإمارات'],['EGY','مصر'],['MAR','المغرب']];
    return '<div class="v252-country" role="group" aria-label="اختيار البلد">'+codes.map(pair=>
      '<button type="button" data-v252-country="'+pair[0]+'" class="'+(S.activeCountry===pair[0]?'active':'')+'" aria-pressed="'+(S.activeCountry===pair[0])+'">'+pair[1]+'</button>'
    ).join('')+'</div>';
  },
  walletView(){
    const allGroups=this.groups(),ids=new Set(allGroups.map(g=>g.id));
    if(!ids.has(this.bankId)){this.bankId=null;this.accountId=null;this.cardId=null;}
    const group=allGroups.find(g=>g.id===this.bankId);
    if(this.accountId&&(!group||!group.accounts.some(a=>a.id===this.accountId))){this.accountId=null;this.cardId=null;}
    const account=group&&group.accounts.find(a=>a.id===this.accountId);
    const cards=account?Finance.getCountryInstruments(S.activeCountry).filter(i=>!i.archived&&i.accountId===account.id&&['credit_card','debit_card','prepaid_card','wallet_card'].includes(i.type)):[];
    if(this.cardId&&!cards.some(c=>c.id===this.cardId))this.cardId=null;
    const banks=allGroups.map(g=>{
      const inst=g.institution,name=inst?inst.name:'بدون مؤسسة',short=String(name||'').trim().slice(0,2);
      const mark=inst&&(inst.bankRegistryId||inst.providerRegistryId)?institutionLogoHtml(inst,30,''):('<span>'+esc(short||'SA')+'</span>');
      return '<button class="v252-bank" type="button" data-v252-bank="'+esc(g.id)+'" aria-pressed="'+(this.bankId===g.id)+'" title="'+esc(name)+'">'+
        '<span class="v252-mark">'+mark+'</span><span><b>'+esc(name)+'</b><small>'+g.accounts.length+' حساب</small></span></button>';
    }).join('');
    const accounts=group?group.accounts.map(a=>{
      const balance=isLiabilityAccount(a)?Finance.accountBalance(a.id):Finance.accountBalancePresentation(a.id).display;
      const label=isLiabilityAccount(a)?'مديونية':'رصيد السجل';
      return '<button type="button" class="v252-account" data-v252-account="'+esc(a.id)+'" aria-pressed="'+(this.accountId===a.id)+'">'+
        '<strong>'+esc(a.name)+'</strong><span>'+label+' · '+esc(a.currency)+'</span>'+
        '<span class="amt-val">'+amtText(balance)+' '+esc(Finance.curSymbol(a.currency))+'</span></button>';
    }).join(''):'';
    const cardMarkup=cards.map(i=>{
      // Do not use existing editor click target here: first tap only selects; second opens details.
      const tile=instrumentTileHtml(i).replace(/data-instrument-edit="[^"]*"/g,'');
      return '<div class="v252-card-wrap" role="button" tabindex="0" data-v252-card="'+esc(i.id)+'" aria-pressed="'+(this.cardId===i.id)+'" aria-label="'+esc(i.name)+'">'+tile+'</div>';
    }).join('');
    return '<div class="v252-card" id="v252Wallet"><h2 class="v252-heading">محفظتي</h2>'+this.countryBar()+
      '<div class="v252-section"><h3>البنوك والمحافظ</h3><small class="v252-hint">اضغط مرتين للتفاصيل</small></div>'+
      (allGroups.length?'<div class="v252-strip" id="v252BankStrip">'+banks+'</div>':'<div class="v252-empty">لا توجد حسابات في هذا البلد. أضف حسابًا أو اسحب الرسائل البنكية.</div>')+
      '<div class="v252-section"><h3>الحسابات</h3><small class="v252-hint">اسحب الشريط للتصفح</small></div>'+
      (group?'<div class="v252-strip" id="v252AccountStrip">'+accounts+'</div>':'<div class="v252-empty">اختر بنكًا أو محفظة لعرض الحسابات.</div>')+
      '<div class="v252-section"><h3>البطاقات المرتبطة</h3><small class="v252-hint">السحب لا يغير الحساب</small></div>'+
      (account?(cards.length?'<div class="v252-strip v252-cards" id="v252CardStrip">'+cardMarkup+'</div>':'<div class="v252-empty">لا توجد بطاقات مرتبطة بهذا الحساب.</div>'):'<div class="v252-empty">اختر حسابًا لعرض بطاقاته.</div>')+
      '<button type="button" data-sanad-act="bank-sms-recent" class="v252-quick" style="margin-top:13px">فحص الرسائل البنكية الجديدة</button>'+
      '</div>';
  },
  settingsTop(){
    return '<div class="v252-card">'+this.countryBar()+
      '<button type="button" class="v252-quick" data-v252-subs="1">الالتزامات والاشتراكات</button>'+
      '<p class="v252-hint" style="margin-top:10px">تظل جميع وظائف النسخ الاحتياطي والمراجعة وإعدادات الرسائل متاحة أدناه.</p></div>';
  }
};
window.SanadV252=V;
const legacyAccounts=viewAccounts;
viewAccounts=function(){
  const old=legacyAccounts();
  return previewBannerHtml()+recoveryBannerHtml()+V.walletView()+
    '<details class="v252-advanced"><summary>إدارة كل الحسابات والبطاقات والخيارات المتقدمة</summary>'+old+'</details>';
};
const oldRender=render;
render=function(){
  oldRender();
  if(!S.ready)return;
  V.nav();
  const view=document.getElementById('view');
  if(S.tab==='settings'&&view)view.insertAdjacentHTML('afterbegin',V.settingsTop());
  V.stripFlags(view);V.stripFlags(document.getElementById('topBar'));
  document.querySelectorAll('.bottom-nav [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
  if(S.tab==='accounts'&&V.bankId){
    const active=document.querySelector('[data-v252-bank="'+CSS.escape(V.bankId)+'"]');
    if(active)active.scrollIntoView({block:'nearest',inline:'nearest'});
  }
};
V.nav();
document.addEventListener('click',function(event){
  const button=event.target.closest('[data-v252-country],[data-v252-bank],[data-v252-account],[data-v252-card],[data-v252-subs]');
  if(!button)return;
  event.preventDefault();event.stopPropagation();
  if(button.dataset.v252Country)V.country(button.dataset.v252Country);
  else if(button.dataset.v252Bank)V.bank(button.dataset.v252Bank);
  else if(button.dataset.v252Account)V.account(button.dataset.v252Account);
  else if(button.dataset.v252Card)V.card(button.dataset.v252Card);
  else if(button.dataset.v252Subs)go('subs');
},true);
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const el=event.target.closest('[data-v252-card]');if(!el)return;
  event.preventDefault();V.card(el.dataset.v252Card);
},true);
})();