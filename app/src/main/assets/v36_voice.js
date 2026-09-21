(function(){
"use strict";

window.__SANAD_VOICE_ENGINE__="3.6-critical-stabilization";

var phase="idle";
var lastPartial="";
var voicePartial="";
var autoStartToken=0;
var finalizeWatchdog=null;
var FINALIZE_WATCHDOG_MS=75000;

function bridge(){try{return window.Android||null;}catch(e){return null;}}
function byId(id){return document.getElementById(id);}
function isAr(){return typeof LANG!=="undefined"&&LANG==="ar";}
function say(ar,en){var l=byId("vlabel");if(l)l.textContent=isAr()?ar:en;}
function setMicBusy(b){var m=byId("micb");if(m){m.disabled=!!b;m.style.opacity=b?".72":"1";}}
function setStop(show){var s=byId("vstop");if(s)s.style.display=show?"inline-flex":"none";}
function waveHtml(level){
  var h='<div class="wave" id="vbars">',i,l=Math.max(0,Number(level)||0);
  for(i=0;i<9;i++){
    var ht=12+Math.min(34,Math.max(0,(l+2)*2.2)+((i%3)*3));
    h+='<i style="height:'+ht.toFixed(0)+'px;animation:none"></i>';
  }
  return h+'</div>';
}
function clearTranscript(){
  voicePartial="";lastPartial="";
  var v=byId("vlive");if(v)v.textContent="";
}
function clearWatchdog(){if(finalizeWatchdog){clearTimeout(finalizeWatchdog);finalizeWatchdog=null;}}
function markListening(){
  setMicBusy(false);setStop(true);
  var m=byId("micb");if(m)m.className="micb rec";
  var w=byId("wave");if(w)w.innerHTML=waveHtml(0);
}
function markIdle(){
  setMicBusy(false);setStop(false);
  var m=byId("micb");if(m)m.className="micb";
  var w=byId("wave");if(w)w.innerHTML=(typeof t==="function"?t("voiceHint"):"");
}
function finalizeTimeout(){
  if(phase!=="finalizing")return;
  phase="idle";
  clearWatchdog();
  markIdle();
  say("التحويل استغرق وقت أطول من المتوقع — جرّب مرة أخرى","Transcription timed out — try again");
  if(typeof toast==="function")toast(isAr()?"انتهت مهلة تحويل الصوت":"Voice transcription timed out","err");
}
function armFinalizeWatchdog(){
  clearWatchdog();
  finalizeWatchdog=setTimeout(finalizeTimeout,FINALIZE_WATCHDOG_MS);
}

window.startVoice=function(){
  if(phase!=="idle")return;
  var A=bridge();
  if(!A||typeof A.startVoice!=="function"){
    markIdle();
    say("محرك الصوت المحلي غير متاح","Local voice engine unavailable");
    if(typeof toast==="function")toast(isAr()?"محرك الصوت المحلي غير متاح":"Local voice engine unavailable","err");
    return;
  }
  clearWatchdog();clearTranscript();
  phase="starting";setMicBusy(true);setStop(false);
  say("جاري فتح الميكروفون…","Opening microphone…");
  try{A.startVoice((S.settings&&S.settings.voiceLocale)||(isAr()?"ar-EG":"en-US"));}
  catch(e){phase="idle";markIdle();say("تعذر تشغيل الميكروفون","Unable to start microphone");if(typeof toast==="function")toast(String(e),"err");}
};

window.finishVoice=function(){
  if(phase==="idle"||phase==="finalizing")return;
  phase="finalizing";
  setMicBusy(true);setStop(false);
  say("جاري تحويل الصوت إلى نص…","Transcribing speech…");
  armFinalizeWatchdog();
  var A=bridge();
  try{if(A&&typeof A.stopVoice==="function"){A.stopVoice();return;}}catch(e){}
  finalizeTimeout();
};

window.sanadNativeVoiceState=function(state,detail){
  var w=byId("wave");
  if(state==="permission_required"){
    clearWatchdog();phase="permission";setMicBusy(true);setStop(false);
    say("اسمح لسند باستخدام الميكروفون","Allow SANAD to use the microphone");return;
  }
  if(state==="permission_denied"||state==="permission_blocked"){
    clearWatchdog();phase="idle";markIdle();
    say("فعّل إذن الميكروفون من إعدادات التطبيق","Enable microphone permission in app settings");return;
  }
  if(state==="starting"){
    clearWatchdog();phase="starting";setMicBusy(true);setStop(false);
    say("جاري فتح الميكروفون…","Opening microphone…");return;
  }
  if(state==="listening"){
    clearWatchdog();phase="listening";markListening();
    say(detail==="model_loading"?"سامعك — Whisper بيتجهز في الخلفية…":"سامعك — اتكلم دلوقتي",
        detail==="model_loading"?"Listening — Whisper is loading in the background…":"Listening — speak now");
    if(w)w.innerHTML=waveHtml(0);return;
  }
  if(state==="speech"){
    phase="listening";markListening();say("سامع الكلام…","Hearing speech…");return;
  }
  if(state==="model_loading_background"){
    if(phase==="idle")say("Whisper بيتجهز…","Preparing Whisper…");return;
  }
  if(state==="model_ready"){
    if(phase==="idle"){markIdle();say("جاهز — اضغط واتكلم","Ready — tap and speak");}
    else if(phase==="listening")say("سامعك — اتكلم دلوقتي","Listening — speak now");
    return;
  }
  if(state==="audio_recovered"){
    phase="listening";markListening();say("تم إعادة فتح الميكروفون — كمل كلام","Microphone recovered — keep speaking");return;
  }
  if(state==="processing"){
    phase="finalizing";setMicBusy(true);setStop(false);armFinalizeWatchdog();
    say(detail==="waiting_model"?"تم التسجيل — جاري تجهيز Whisper ثم التحويل…":"جاري تحويل الصوت إلى نص…",
        detail==="waiting_model"?"Recorded — preparing Whisper then transcribing…":"Transcribing speech…");return;
  }
  if(state==="audio_open_error"||state==="audio_error"||state==="model_error"){
    clearWatchdog();phase="idle";markIdle();
    if(state==="audio_open_error")say("الميكروفون لم يفتح","Microphone could not open");
    else if(state==="audio_error")say("فشل قراءة الميكروفون","Microphone read failed");
    else say("فشل تحميل Whisper","Whisper failed to load");
    return;
  }
  if(state==="stopped"&&phase!=="finalizing"){
    clearWatchdog();phase="idle";markIdle();
  }
};

window.sanadNativeVoiceLevel=function(level){
  var w=byId("wave");if(w&&phase==="listening")w.innerHTML=waveHtml(Number(level)||0);
};
window.sanadNativeVoicePartial=function(text){
  text=String(text||"").replace(/\s+/g," ").trim();
  if(!text||text===lastPartial)return;
  lastPartial=text;voicePartial=text;
  var v=byId("vlive");if(v)v.textContent=text;
  say("بيتحول الكلام مباشرة…","Transcribing live…");
};
window.sanadNativeVoiceChunk=function(payload){
  try{var list=typeof payload==="string"?JSON.parse(payload):payload;if(!Array.isArray(list))list=[String(payload||"")];if(list.length)window.sanadNativeVoicePartial(String(list[0]||""));}catch(e){}
};
window.sanadNativeVoiceResult=window.sanadNativeVoiceChunk;
window.sanadNativeVoiceDone=function(text){
  var finalText=String(text||lastPartial||voicePartial||"").replace(/\s+/g," ").trim();
  clearWatchdog();phase="idle";markIdle();voicePartial="";lastPartial="";
  var v=byId("vlive");if(v)v.textContent=finalText;
  if(finalText){UI.addText=finalText;say("تم تحويل الكلام","Speech converted");runParse("voice");}
  else{say("ما وصلنيش نص واضح — جرّب تاني","No clear text — try again");if(typeof toast==="function")toast(isAr()?"ما وصلنيش نص واضح":"No clear text","err");}
};
window.sanadNativeVoiceError=function(msg){
  clearWatchdog();phase="idle";markIdle();say("حصل خطأ في الصوت","Voice error");if(msg&&typeof toast==="function")toast(String(msg),"err");
};
window.sanadVoiceDiagnostics=function(){
  var A=bridge(),raw="{}";try{if(A&&typeof A.runtimeDiagnostics==="function")raw=String(A.runtimeDiagnostics()||"{}");}catch(e){}
  var d={};try{d=JSON.parse(raw);}catch(e){}
  var text=(isAr()?"تشخيص الصوت: ":"Voice diagnostics: ")+"version="+String(d.version||window.__SANAD_VOICE_ENGINE__)+" | permission="+String(d.audioPermission)+" | status="+String(d.voiceStatus||"?")+" | "+String(d.voiceDetails||"");
  if(typeof toast==="function")toast(text,(d.audioPermission===false)?"err":null);return text;
};

if(typeof MutationObserver!=="undefined"&&document&&typeof document.createElement==="function"){
  var diagObserver=new MutationObserver(function(){
    var mic=byId("micb");if(!mic||byId("v36diag"))return;
    var b=document.createElement("button");b.id="v36diag";b.type="button";b.className="chip sm";b.style.marginTop="8px";b.textContent=isAr()?"تشخيص الميكروفون":"Microphone diagnostics";
    b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();window.sanadVoiceDiagnostics();};
    if(mic.parentNode)mic.parentNode.appendChild(b);
  });
  try{diagObserver.observe(document.documentElement,{subtree:true,childList:true});}catch(e){}
}

// Keep the existing interaction: entering Voice automatically opens the microphone.
document.addEventListener("click",function(e){
  var x=e.target&&e.target.closest?e.target.closest("[data-act]"):null;if(!x)return;
  var act=x.getAttribute("data-act"),mode=x.getAttribute("data-m");
  if((act==="mode"||act==="addmode")&&mode==="voice"){
    var token=++autoStartToken;
    setTimeout(function(){if(token!==autoStartToken)return;if(byId("micb")&&phase==="idle")window.startVoice();},260);
  }
},false);

})();
