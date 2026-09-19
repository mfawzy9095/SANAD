(function(){
"use strict";
window.__SANAD_RUNTIME_VERSION__="2.8-device-runtime-fix";

var nativeParsed=Object.create(null);
function nativeKey(raw){
  try{return typeof N==="function"?N(String(raw||"")):String(raw||"").replace(/\s+/g," ").trim().toLowerCase();}catch(e){return String(raw||"");}
}

if(typeof window.bankParse==="function"&&!window.__sanadV28BankOverlay){
  var oldBankParse=window.bankParse;
  window.bankParse=function(raw,ctx,referenceMs){
    var r=oldBankParse(raw,ctx,referenceMs);
    var n=nativeParsed[nativeKey(raw)];
    if(!r||!n)return r;
    r.meta=r.meta||{};
    if(Number(n.parsedAmount)>0){r.amount=Number(n.parsedAmount);r.meta.amountSource=String(n.parsedAmountSource||"native_context");}
    if(n.parsedCurrency)r.currency=String(n.parsedCurrency);
    if(n.parsedType)r.type=String(n.parsedType);
    if(Number(n.parsedDate)>0){
      var d=new Date(Number(n.parsedDate));
      if(!isNaN(d.getTime())){r.date=d.toISOString();r.meta.dateSource="native_message_date";}
    }
    if(Number(n.parsedConfidence)>0)r.confidence=Math.max(Number(r.confidence)||0,Number(n.parsedConfidence));
    return r;
  };
  window.__sanadV28BankOverlay=true;
}

if(typeof window.sanadNativeBankBulk==="function"&&!window.__sanadV28BulkWrapped){
  var oldBulk=window.sanadNativeBankBulk;
  window.sanadNativeBankBulk=function(payload,fullSync){
    var arr=null;
    try{arr=typeof payload==="string"?JSON.parse(payload):payload;}catch(e){}
    nativeParsed=Object.create(null);
    if(Array.isArray(arr)){
      for(var i=0;i<arr.length;i++){
        var x=arr[i];
        if(x&&typeof x==="object"&&x.text)nativeParsed[nativeKey(x.text)]=x;
      }
    }
    try{return oldBulk(payload,fullSync);}
    finally{setTimeout(function(){nativeParsed=Object.create(null);},0);}
  };
  window.__sanadV28BulkWrapped=true;
}

function bridge(){
  try{return window.Android||null;}catch(e){return null;}
}
function prepareVoice(){
  var A=bridge();
  if(A&&typeof A.prepareVoice==="function"){
    try{A.prepareVoice();}catch(e){}
  }
}
window.sanadV28Diagnostics=function(){
  var A=bridge(),d=null;
  if(A&&typeof A.runtimeDiagnostics==="function"){
    try{d=JSON.parse(String(A.runtimeDiagnostics()||"{}"));}catch(e){}
  }
  if(!d)return null;
  if(typeof toast==="function"){
    var ar=typeof LANG!=="undefined"&&LANG==="ar";
    var msg=(ar?"V2.8 · الميكروفون: ":"V2.8 · Mic: ")+(d.audioPermission?"OK":"NO")+
      (ar?" · الرسائل: ":" · SMS: ")+(d.smsPermission?"OK":"NO")+
      " · Voice: "+String(d.voiceStatus||"?");
    toast(msg,(d.audioPermission&&d.smsPermission)?null:"err");
  }
  return d;
};

document.addEventListener("click",function(e){
  var el=e.target&&e.target.closest?e.target.closest("[data-act]"):null;
  if(!el)return;
  var act=el.getAttribute("data-act"),mode=el.getAttribute("data-m");
  if((act==="mode"||act==="addmode")&&mode==="voice")setTimeout(prepareVoice,120);
},true);

var oldState=window.sanadNativeVoiceState;
if(typeof oldState==="function"&&!window.__sanadV28VoiceState){
  window.sanadNativeVoiceState=function(state,detail){
    oldState(state,detail);
    var l=document.getElementById("vlabel");
    if(state==="permission_required"&&l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?"اسمح لسند باستخدام الميكروفون":"Allow SANAD to use the microphone";
    if(state==="permission_blocked"&&l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?"الميكروفون مقفول من إعدادات النظام":"Microphone blocked in system settings";
    if(state==="ready"&&l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?"الميكروفون جاهز — اضغط وابدأ":"Microphone ready — tap to start";
  };
  window.__sanadV28VoiceState=true;
}

var observer=new MutationObserver(function(){
  var mic=document.getElementById("micb");
  if(mic&&!document.getElementById("v28diag")){
    var b=document.createElement("button");
    b.id="v28diag";b.type="button";b.className="chip sm";
    b.style.marginTop="8px";
    b.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?"تشخيص الصوت V2.8":"Voice diagnostics V2.8";
    b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();window.sanadV28Diagnostics();};
    var parent=mic.parentNode;if(parent)parent.appendChild(b);
    prepareVoice();
  }
});
try{observer.observe(document.documentElement,{subtree:true,childList:true});}catch(e){}
})();