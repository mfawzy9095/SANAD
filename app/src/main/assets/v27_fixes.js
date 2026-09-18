(function(){
"use strict";
function ccyToken(v){
  v=String(v||"").toUpperCase();
  if(v==="DH"||v==="DHS") return "AED";
  return (typeof Cur!=="undefined"&&Cur.valid(v))?v:null;
}
function num(v){
  var x=parseFloat(String(v||"").replace(/,/g,""));
  return isFinite(x)&&x>0?x:null;
}

bankDateFromText=function(raw,referenceMs){
  var o=N(String(raw||"")),ref=referenceMs?new Date(Number(referenceMs)):new Date(),m,mons={
    jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,
    jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,
    oct:10,october:10,nov:11,november:11,dec:12,december:12
  };
  if(isNaN(ref.getTime())) ref=new Date();
  function finish(y,mo,d,h,mi,ap){
    y=+y;if(y<100)y+=2000;mo=+mo;d=+d;h=+(h||0);mi=+(mi||0);ap=String(ap||"").toLowerCase();
    if(ap==="pm"&&h<12)h+=12;if(ap==="am"&&h===12)h=0;
    if(h>23||mi>59)return null;
    var x=new Date(y,mo-1,d,h,mi,0,0);
    if(x.getFullYear()!==y||x.getMonth()!==mo-1||x.getDate()!==d)return null;
    if(referenceMs&&Math.abs(x.getTime()-ref.getTime())>400*DAY)return null;
    return x.toISOString();
  }
  function inferredYear(mo,d){
    var y=ref.getFullYear(),x=new Date(y,mo-1,d,12,0,0,0);
    if(x.getTime()-ref.getTime()>45*DAY)y--;
    else if(ref.getTime()-x.getTime()>320*DAY)y++;
    return y;
  }
  m=o.match(/(?:^|\D)(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ t]*(?:at)?\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i);
  if(m){var z=finish(m[1],m[2],m[3],m[4],m[5],m[6]);if(z)return z;}
  m=o.match(/(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s*(?:at|الساعه)?\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i);
  if(m){var z2=finish(m[3],m[2],m[1],m[4],m[5],m[6]);if(z2)return z2;}
  m=o.match(/(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})(?![\/\-.]\d)(?:\s*(?:at|الساعه)?\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i);
  if(m){var z3=finish(inferredYear(+m[2],+m[1]),m[2],m[1],m[3],m[4],m[5]);if(z3)return z3;}
  m=o.match(/(?:^|\s)(\d{1,2})[\s\-\/]*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s\-\/]*(\d{2,4})(?:\s*(?:at)?\s*(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?)?/i);
  if(m){var z4=finish(m[3],mons[m[2].toLowerCase()],m[1],m[4],m[5],m[6]);if(z4)return z4;}
  m=o.match(/(?:^|\s)(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{2,4})(?:\s*(?:at)?\s*(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?)?/i);
  if(m){var z5=finish(m[3],mons[m[1].toLowerCase()],m[2],m[4],m[5],m[6]);if(z5)return z5;}
  return null;
};

bankAmountFromExplicitTransaction=function(o){
  o=String(o||"");
  var CODE="(?:AED|DHS?|SAR|USD|EUR|GBP|EGP|MAD)", AMT="([\\d,]+(?:\\.\\d{1,2})?)",m,a,c;
  var rules=[
    [new RegExp("("+CODE+")\\s*"+AMT+"\\s*(?:was\\s+)?(?:debited|charged|paid|spent|withdrawn|credited|received|transferred)","i"),2,1],
    [new RegExp(AMT+"\\s*("+CODE+")\\s*(?:was\\s+)?(?:debited|charged|paid|spent|withdrawn|credited|received|transferred)","i"),1,2],
    [new RegExp("(?:was\\s+debited|debited|charged|paid|spent|purchase(?:\\s+of)?|withdrawn|credited|received|transferred|transaction\\s+of|used\\s+for)\\s*(?:amount\\s*)?("+CODE+")?\\s*"+AMT,"i"),2,1]
  ];
  for(var i=0;i<rules.length;i++){
    m=o.match(rules[i][0]);
    if(m){a=num(m[rules[i][1]]);c=ccyToken(m[rules[i][2]]);if(a)return {amount:a,currency:c,source:"transaction_explicit"};}
  }
  m=o.match(/(?:تم\s+خصم|خصم|تم\s+سحب|سحب|عملية\s+شراء(?:\s+بقيمة)?|دفعت|دفع|تم\s+إيداع|إيداع)\s*(?:مبلغ\s*)?(?:(AED|DHS?|SAR|USD|EUR|GBP|EGP|MAD)\s*)?([\d,]+(?:\.\d{1,2})?)\s*(درهم|دراهم|ريال|ريالات|دولار|يورو|جنيه|جنيهات)?/i);
  if(m){
    a=num(m[2]); c=ccyToken(m[1]);
    if(!c&&m[3])c=detCur(N(m[3]));
    if(a)return {amount:a,currency:c,source:"transaction_explicit"};
  }
  var action=/(debited|charged|paid|spent|purchase|withdrawn|credited|received|transferred|transaction|used\s+for|تم خصم|خصم|تم سحب|سحب|عملية شراء|دفعت|دفع|تم إيداع|إيداع|تحويل)/i.test(o);
  if(!action)return null;
  m=o.match(/\b(AED|DHS?|SAR|USD|EUR|GBP|EGP|MAD)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if(m){a=num(m[2]);c=ccyToken(m[1]);if(a)return {amount:a,currency:c,source:"currency_adjacent"};}
  m=o.match(/([\d,]+(?:\.\d{1,2})?)\s*(AED|DHS?|SAR|USD|EUR|GBP|EGP|MAD)\b/i);
  if(m){a=num(m[1]);c=ccyToken(m[2]);if(a)return {amount:a,currency:c,source:"currency_adjacent"};}
  m=o.match(/([\d,]+(?:\.\d{1,2})?)\s*(درهم|دراهم|ريال|ريالات|دولار|يورو|جنيه|جنيهات)/i);
  if(m){a=num(m[1]);c=detCur(N(m[2]));if(a)return {amount:a,currency:c,source:"currency_adjacent"};}
  return null;
};

if(typeof window.sanadNativeBankBulk==="function"&&!window.__sanadV27BulkWrapped){
  var oldBulk=window.sanadNativeBankBulk;
  window.sanadNativeBankBulk=function(payload,fullSync){
    try{
      var arr=typeof payload==="string"?JSON.parse(payload):payload;
      if(Array.isArray(arr)){
        arr=arr.map(function(x){
          if(!x||typeof x!=="object")return x;
          var y={};Object.keys(x).forEach(function(k){y[k]=x[k];});
          var parsed=bankDateFromText(y.text||"",Number(y.date)||0);
          if(parsed)y.date=0;
          return y;
        });
        payload=JSON.stringify(arr);
      }
    }catch(e){}
    return oldBulk(payload,fullSync);
  };
  window.__sanadV27BulkWrapped=true;
}

window.sanadHandleAndroidBack=function(){
  try{
    if(typeof UI!=="undefined"&&UI.sheet){closeSheet();return true;}
    if(typeof voiceNativeActive!=="undefined"&&(voiceNativeActive||voiceAwaitingResult)){finishVoice();return true;}
    if(typeof UI!=="undefined"&&UI.openRow){UI.openRow=null;render(false);return true;}
    if(typeof UI!=="undefined"&&UI.stack&&UI.stack.length>1){back();return true;}
    if(typeof UI!=="undefined"&&UI.stack&&UI.stack.length===1&&UI.stack[0].r!=="home"){tab("home");return true;}
  }catch(e){}
  return false;
};

if(typeof window.sanadNativeVoiceState==="function"&&!window.__sanadV27VoiceWrapped){
  var oldVoiceState=window.sanadNativeVoiceState;
  window.sanadNativeVoiceState=function(state,detail){
    oldVoiceState(state,detail);
    if(state==="permission_required"){
      var l=document.getElementById("vlabel");
      if(l)l.textContent=LANG==="ar"?"اسمح لسند باستخدام الميكروفون":"Allow SANAD to use the microphone";
    }
  };
  window.__sanadV27VoiceWrapped=true;
}
})();