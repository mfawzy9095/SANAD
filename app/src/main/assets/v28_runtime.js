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

// V3.2: all legacy voice preparation/diagnostic hooks removed.
})();