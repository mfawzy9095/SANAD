/* SANAD wallet UI: independent presentation powered only by Finance + S.
 * No storage/ledger writes. Component IDs match the stable action delegation.
 * This module replaces layered legacy wallet HTML, not business operations.
 */
(function(){
'use strict';
if(!window.SanadV252||window.__sanadWalletRedesigned)return;
window.__sanadWalletRedesigned=true;
const W=window.SanadV252;
const h=x=>esc(String(x===null||x===undefined?'':x));
const label=(ar,en)=>S.settings?.language==='en'?en:ar;
const realMoney=(value,currency)=>{
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return label('غير مؤكد','Unconfirmed');
  return amtFull(value,currency);
};
const mark=(g)=>{
  const inst=g.institution;
  const bank=inst?.bankRegistryId&&UaeBankRegistryCore.get?.(inst.bankRegistryId);
  const provider=inst?.providerRegistryId&&UaeBankRegistryCore.getProvider?.(inst.providerRegistryId);
  const full=bank?bankUiName(bank):provider?providerUiName(provider):(inst?.name||label('غير مرتبط بمؤسسة','Unlinked'));
  const short=bank?bankUiShort(bank):provider?providerUiShort(provider):String(full).slice(0,3);
  // Deliberately not presented as an official logo without a verified asset.
  return {full:String(full),short:String(short||full)};
};
function bankChip(g,chosen){
  const v=mark(g),sel=chosen===g.id;
  const acronym=v.short.slice(0,4);
  return '<button type="button" class="r25-bank-item" data-v252-bank="'+h(g.id)+'" aria-pressed="'+sel+'" title="'+h(v.full)+'">'+
    '<span class="r25-bank-monogram" aria-hidden="true">'+h(acronym)+'</span>'+
    '<span class="r25-bank-text"><b>'+h(v.short)+'</b><small>'+h(v.full)+'</small><em>'+g.accounts.length+' '+label('حساب','accounts')+'</em></span></button>';
}
function accountChip(a,chosen){
  const liability=isLiabilityAccount(a);
  const p=!liability?Finance.accountBalancePresentation(a.id):null;
  const balance=p?p.display:Finance.accountBalance(a.id);
  const note=liability?label('المديونية','Debt'):p?.mismatch?label('رصيد السجل — يحتاج مطابقة','Balance needs reconciliation'):label('رصيد الحساب','Account balance');
  return '<button type="button" class="r25-account-item" data-v252-account="'+h(a.id)+'" aria-pressed="'+(a.id===chosen)+'" title="'+h(a.name)+'">'+
    '<span class="r25-account-header"><strong>'+h(a.name)+'</strong><small>'+h(a.currency)+'</small></span>'+
    '<span class="r25-account-amount amt-val">'+realMoney(balance,a.currency)+'</span>'+
    '<span class="r25-account-note">'+note+'</span></button>';
}
function cardView(i,index,selected){
  const a=Finance.getAccount(i.accountId);
  const isCredit=i.type==='credit_card';
  const available=isCredit?Finance.creditAvailable(a?.id):null;
  const p=!isCredit&&a?Finance.accountBalancePresentation(a.id):null;
  const balance=isCredit?available:(p?p.display:a?Finance.accountBalance(a.id):null);
  let base=String(i.color||a?.color||'#076b80');
  if(!/^#[0-9a-f]{6}$/i.test(base))base='#076b80';
  const offset=index-selected,distance=Math.min(3,Math.abs(offset));
  const transform='translate3d('+((offset<0?1:-1)*distance*52)+'%, '+(distance*6)+'px, 0) scale('+(1-distance*.065)+')';
  const active=index===selected;
  return '<div role="button" tabindex="0" class="v25-payment-card r25-wallet-payment" data-v252-card="'+h(i.id)+'" aria-pressed="'+active+'" data-r25-card-index="'+index+'"'+
    ' style="background:linear-gradient(125deg,'+base+',#063d54);transform:'+transform+';z-index:'+(100-distance)+';opacity:'+(distance>2?0:1)+';pointer-events:'+(distance<2?'auto':'none')+'">'+
    '<div class="v25-payment-card-head"><div class="r25-wallet-payment-title"><b>'+h(i.name)+'</b><small>'+h(a?.name||'')+'</small></div>'+
    '<span class="v25-card-type">'+h(cardTypeShortLabel(i.type))+'</span></div>'+
    '<div class="v25-payment-card-number" dir="ltr">'+h(maskedCardNumber(i)||'XXXX XXXX XXXX XXXX')+'</div>'+
    '<div class="v25-payment-card-foot"><div><small>'+label(isCredit?'الائتمان المتاح':'الرصيد المرتبط',isCredit?'Available credit':'Linked balance')+'</small>'+
    '<b class="amt-val">'+realMoney(balance,a?.currency||'AED')+'</b></div>'+
    '<div class="v25-card-network">'+cardNetworkLogoHtml(i.network)+'</div></div></div>';
}
W.walletView=function(){
  const groups=this.groups();
  if(!groups.some(g=>g.id===this.bankId)){this.bankId=groups[0]?.id||null;this.accountId=null;this.cardId=null;}
  const group=groups.find(g=>g.id===this.bankId);
  if(group&&!group.accounts.some(a=>a.id===this.accountId)){this.accountId=group.accounts[0]?.id||null;this.cardId=null;}
  const account=group?.accounts.find(a=>a.id===this.accountId);
  const cards=account?Finance.getCountryInstruments(S.activeCountry).filter(i=>
    !i.archived&&i.accountId===account.id&&['credit_card','debit_card','prepaid_card','wallet_card'].includes(i.type)):[];
  if(!cards.some(i=>i.id===this.cardId))this.cardId=cards[0]?.id||null;
  const selected=Math.max(0,cards.findIndex(i=>i.id===this.cardId));
  const sect=(title,note)=>'<div class="r25-wallet-section"><h3>'+title+'</h3><small>'+note+'</small></div>';
  const dots=cards.map((c,i)=>'<button type="button" data-r25-card-index="'+i+'" aria-label="'+label('البطاقة ','Card ')+(i+1)+'" aria-pressed="'+(i===selected)+'"></button>').join('');
  const pager=cards.length>1?'<nav class="r25-card-pager" aria-label="تصفح البطاقات"><button type="button" data-r25-card-step="-1"'+(selected===0?' disabled':'')+' aria-label="البطاقة السابقة">›</button>'+
    '<div class="r25-card-dots">'+dots+'</div>'+
    '<button type="button" data-r25-card-step="1"'+(selected===cards.length-1?' disabled':'')+' aria-label="البطاقة التالية">‹</button></nav>':'';
  return '<section class="r25-wallet-design" id="v252Wallet">'+
    '<header class="r25-page-title"><h2>'+label('محفظتي','My wallet')+'</h2><span>'+h(countryInfo(S.activeCountry).name)+'</span></header>'+
    this.countryBar()+
    sect(label('البنوك والمحافظ','Banks & wallets'),label('اختر البنك لعرض حساباته','Select an institution'))+
    (groups.length?'<div id="v252BankStrip" class="r25-wallet-slider" role="group" aria-label="اختيار البنك">'+groups.map(g=>bankChip(g,this.bankId)).join('')+'</div>':
      '<div class="r25-empty">'+label('لا توجد حسابات في هذا البلد بعد.','No accounts in this country.')+'</div>')+
    sect(label('الحسابات','Accounts'),label('اضغط على الحساب لعرض بطاقاته','Choose an account'))+
    (group?.accounts.length?'<div id="v252AccountStrip" class="r25-wallet-slider" role="group" aria-label="اختيار الحساب">'+group.accounts.map(a=>accountChip(a,this.accountId)).join('')+'</div>':
      '<div class="r25-empty">'+label('أضف حسابًا لعرض رصيده.','Add an account to see balances.')+'</div>')+
    sect(label('البطاقات','Cards'),label('اسحب البطاقات بإصبعك','Swipe through cards'))+
    (cards.length?'<div id="v252CardStrip" class="r25-card-deck" aria-label="البطاقات المرتبطة بالحساب">'+cards.map((c,i)=>cardView(c,i,selected)).join('')+'</div>'+pager:
      '<div class="r25-empty">'+label('لا توجد بطاقات مرتبطة بالحساب المختار.','No cards linked to this account.')+'</div>')+
    '<div class="r25-wallet-quick-actions"><button type="button" data-act="account-add-menu">'+
      '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'+label('إضافة حساب أو بطاقة','Add account or card')+'</button>'+
      '<button type="button" data-sanad-act="bank-sms-recent">'+
      '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v13H9l-5 3zM8 9h8M8 13h6"/></svg>'+
      label('استيراد الرسائل','Import SMS')+'</button></div>'+
    '</section>';
};
// Wallet and transactions have their own add actions. Home intentionally retains the accessible main '+' shortcut.
// The floating legacy FAB covered those actions and the bottom card rail.
const priorRender=render;
render=function(){
  priorRender();
  const fab=document.getElementById('fab');
  if(fab){
    fab.classList.toggle('r25-home-fab',S.tab==='home');
    if(['accounts','tx'].includes(S.tab))fab.style.display='none';
  }
};
window.SanadWalletDesign={source:'Finance',version:2};
})();