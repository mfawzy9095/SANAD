/* SANAD V25 design icons: Lucide-like vector paths; never changes financial actions. */
(function(){
'use strict';
const paths={
 'bank':'<path d="m3 10 9-6 9 6M4 10h16M6 10v9m4-9v9m4-9v9m4-9v9M3 21h18"/>',
 'card':'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
 'wallet':'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18m-5 4h2"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m0-14.2 1.4 1.4m11.4 11.4 1.4 1.4"/>',
 'moon':'<path d="M20.2 16.9A9 9 0 0 1 7.1 3.8a9 9 0 1 0 13.1 13.1"/>',
 'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10zM10 21h4"/>',
 'eye':'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'settings':'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
 'chart':'<path d="M3 3v18h18M8 17v-6M13 17V8M18 17V5"/>',
 'receipt':'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4"/>',
 'search':'<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'transfer':'<path d="M3 7h18m-5-4 5 4-5 4M21 17H3m5-4-5 4 5 4"/>',
 'upload':'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 'download':'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/>',
 'user':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 'tag':'<path d="M11 3H3v8l10 10 8-8L11 3z"/><circle cx="7.5" cy="7.5" r="1"/>',
 'shield':'<path d="M12 2 4 5v7c0 5 3 8 8 10 5-2 8-5 8-10V5z"/><path d="m8 12 3 3 5-6"/>',
 'lock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 'check':'<path d="m4 12 5 5L20 6"/>',
 'warning':'<path d="m12 3 10 18H2zM12 9v5m0 4v.2"/>',
 'target':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
 'file':'<path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7M9 17h7"/>',
 'trash':'<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
 'sms':'<path d="M3 5h18v13H9l-6 3zM7 9h10M7 13h7"/>',
 'list':'<path d="M9 6h12M9 12h12M9 18h12M4 6h1M4 12h1M4 18h1"/>'
};
const emojiToKey=[
 [/🏦|🏛|🏪|🏢/u,'bank'],[/💳/u,'card'],[/👛|💰|💵|💸/u,'wallet'],
 [/🌙/u,'moon'],[/☀|🌤/u,'sun'],[/🔔/u,'bell'],[/👁/u,'eye'],
 [/⚙|🎨/u,'settings'],[/📊|📈|📉/u,'chart'],[/🧾|📜/u,'receipt'],
 [/🔎|🔍/u,'search'],[/➕|✚/u,'plus'],[/🔁|🔄|🔀/u,'transfer'],
 [/⬆|📤/u,'upload'],[/⬇|📥/u,'download'],[/⏰|🕒/u,'clock'],
 [/📅|🗓/u,'calendar'],[/👤|👥/u,'user'],[/🏷/u,'tag'],
 [/🛡/u,'shield'],[/🔒|🔐/u,'lock'],[/✅/u,'check'],
 [/⚠|❗/u,'warning'],[/🎯/u,'target'],[/📄|💾/u,'file'],
 [/🗑/u,'trash'],[/💬|📩|✉/u,'sms']
];
function vector(key){
 const body=paths[key]||paths.list;
 return '<svg class="v25-ui-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">'+body+'</svg>';
}
function polish(root){
 if(!root)return;
 const targets=root.querySelectorAll('.li-ico,.pc-ico,.tx-item .ic,.search-wrap .icon,.filter-btn,.empty .em,.help-box .hi,.ar-ico,.mg-hdr .hi');
 for(const el of targets){
  if(el.querySelector('svg')||el.dataset.v25Vector==='yes')continue;
  const raw=el.textContent.trim();
  const match=emojiToKey.find(([re])=>re.test(raw));
  if(!match)continue;
  // The filter button includes a badge span and must retain its live badge.
  if(el.classList.contains('filter-btn')){
   const badge=el.querySelector('.badge');
   el.innerHTML=vector(match[1]);
   if(badge)el.append(badge);
  }else if(raw.length<=6){
   el.innerHTML=vector(match[1]);
  }else continue;
  el.dataset.v25Vector='yes';
 }
}
const prevRender=render;
render=function(){
 prevRender();
 if(!S.ready)return;
 polish(document.getElementById('view'));
 polish(document.getElementById('topBar'));
};
const prevSheet=openSheet;
openSheet=function(html,kind){
 const r=prevSheet(html,kind);
 polish(document.getElementById('sheet'));
 return r;
};
window.SanadV25Icons={polish,vector};
})();