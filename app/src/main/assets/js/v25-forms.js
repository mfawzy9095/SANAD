/* V25 form presentation. Moves the existing real DOM input elements
 * into semantic groups; never copies fields or changes the save function.
 */
(function(){
'use strict';
if(window.__v25FormsInstalled)return;
window.__v25FormsInstalled=true;
const baseOpen=openSheet;
const el=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content)e.textContent=content;return e;};
function sectionOf(kind,block){
 const has=id=>!!block.querySelector('#'+id);
 if(kind==='card'){
  if(['cardName','cardNetwork','cardFirst4','cardLast4'].some(has))return 'identity';
  if(['cardLinked','cardCountry','cardBankRegistry','cardInst','cardInstName'].some(has))return 'links';
  if(['cardCur','cardDebt','cardLimit','cardRepay','cardBal','cardPrepaidFundingMode','cardPrepaidSource'].some(has))return 'financial';
  if(['cardIco','cardCol'].some(has))return 'appearance';
  if(block.classList.contains('default-toggle'))return 'preferences';
 }else{
  if(['wName','wCountry','wCur'].some(has))return 'identity';
  if(['wInst','wBankRegistry','wProviderRegistry','wInstName','wBankRefs'].some(has))return 'links';
  if(['wBalance','wDebt','wOpeningKnown','wCreditLimit'].some(has))return 'financial';
  if(['wIco','wCol'].some(has))return 'appearance';
 }
 return 'other';
}
const sections={
 card:[['identity','بيانات البطاقة'],['links','الربط والمؤسسة'],['financial','العملة والأرصدة'],['appearance','المظهر'],['preferences','التفضيلات'],['other','خيارات إضافية']],
 account:[['identity','بيانات الحساب'],['links','البنك والمصادر'],['financial','الرصيد والتفاصيل المالية'],['appearance','التخصيص'],['other','خيارات إضافية']]
};
function previewCard(){
 const result=el('div','r25-form-card-preview');
 result.innerHTML='<div><strong id="r25PreviewName">بطاقة</strong><span id="r25PreviewNetwork">CARD</span></div>'+
 '<div class="r25-form-card-chip" aria-hidden="true"><i></i><i></i></div>'+
 '<div id="r25PreviewNumber" class="r25-form-card-number" dir="ltr">XXXX XXXX XXXX XXXX</div>'+
 '<small>للمعاينة فقط — لا يتم تخزين الرقم الكامل</small>';
 return result;
}
function updatePreview(root){
 const name=(root.querySelector('#cardName')?.value||'بطاقة').trim()||'بطاقة';
 const network=(root.querySelector('#cardNetwork')?.value||'other').toUpperCase();
 const first=String(root.querySelector('#cardFirst4')?.value||'').replace(/\D/g,'').slice(0,4);
 const last=String(root.querySelector('#cardLast4')?.value||'').replace(/\D/g,'').slice(0,4);
 const color=root.querySelector('#cardCol')?.value||'#076d82';
 const safe=/^#[0-9a-f]{6}$/i.test(color)?color:'#076d82';
 const preview=root.querySelector('.r25-form-card-preview');if(!preview)return;
 root.querySelector('#r25PreviewName').textContent=name;
 root.querySelector('#r25PreviewNetwork').textContent=network;
 root.querySelector('#r25PreviewNumber').textContent=(first||'XXXX')+' XXXX XXXX '+(last||'XXXX');
 preview.style.background='linear-gradient(125deg,'+safe+',#063e56)';
}
let controller=new AbortController();
function reshape(kind){
 const sheet=document.getElementById('sheet');
 if(!sheet||sheet.dataset.sheetType!==kind)return;
 const body=sheet.querySelector(':scope > .sheet-body');
 if(!body||body.dataset.r25Reshaped==='yes')return;
 body.dataset.r25Reshaped='yes';
 sheet.classList.add('r25-rebuilt-form');
 const nodes=[...body.children],intro=[],footer=[];
 const data={};for(const [key] of sections[kind])data[key]=el('div','r25-form-fields');
 for(const node of nodes){
  if(node.matches('input[type="hidden"]')){footer.push(node);continue;}
  if(node.matches('button.btn.primary,[data-act^="save-"]')){footer.push(node);continue;}
  if(node.classList.contains('help-box')){intro.push(node);continue;}
  data[sectionOf(kind,node)].appendChild(node);
 }
 body.replaceChildren();
 for(const node of intro)body.appendChild(node);
 if(kind==='card')body.appendChild(previewCard());
 for(const [key,label] of sections[kind]){
  const group=data[key];
  if(!group.children.length)continue;
  const sec=el('section','r25-form-section');
  sec.append(el('h3','r25-form-section-title',label),group);
  body.appendChild(sec);
 }
 const actions=el('div','r25-form-footer');
 for(const node of footer)actions.appendChild(node);
 if(actions.children.length)body.appendChild(actions);
 if(kind==='card'){
  const update=()=>updatePreview(sheet);
  sheet.addEventListener('input',update,{signal:controller.signal});
  sheet.addEventListener('change',update,{signal:controller.signal});
  update();
 }
}
openSheet=function(html,kind){
 controller.abort();controller=new AbortController();
 const out=baseOpen(html,kind);
 if(kind==='card'||kind==='account')reshape(kind);
 else document.getElementById('sheet')?.classList.remove('r25-rebuilt-form');
 return out;
};
window.SanadV25Forms={reshape};
})();