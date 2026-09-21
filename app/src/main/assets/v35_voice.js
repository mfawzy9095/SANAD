(function(){
"use strict";

window.__SANAD_VOICE_ENGINE__="3.5-whisper-only";

var phase="idle";
var lastPartial="";
var autoStartToken=0;

function bridge(){try{return window.Android||null;}catch(e){return null;}}
function byId(id){return document.getElementById(id);}
function say(ar,en){var l=byId("vlabel");if(l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?ar:en;}
function setMicBusy(b){
  var m=byId("micb");
  if(m){m.disabled=!!b;m.style.opacity=b?".72":"1";}
}
function setStop(show){var s=byId("vstop");if(s)s.style.display=show?"inline-flex":"none";}
function clearTranscript(){
  voicePartial="";voiceChunks=[];lastPartial="";
  var v=byId("vlive");if(v)v.textContent="";
}
function markListening(){
  voiceNativeActive=true;
  voiceAwaitingResult=false;
  setMicBusy(false);
  setStop(true);
  var m=byId("micb");if(m)m.className="micb rec";
}
function markIdle(){
  voiceNativeActive=false;
  voiceAwaitingResult=false;
  setMicBusy(false);
  setStop(false);
  var m=byId("micb");if(m)m.className="micb";
}

window.startVoice=function(){
  if(phase!=="idle")return;

  var A=bridge();
  if(!A||typeof A.startVoice!=="function"){
    markIdle();
    say("محرك الصوت غير متاح","Voice engine unavailable");
    if(typeof toast==="function")toast(LANG==="ar"?"محرك الصوت غير متاح":"Voice engine unavailable","err");
    return;
  }

  voiceNativeActive=false;
  voiceAwaitingResult=false;
  clearTranscript();

  phase="starting";
  setMicBusy(true);
  say("جاري فتح الميكروفون…","Opening microphone…");

  try{
    A.startVoice((S.settings&&S.settings.voiceLocale)||(LANG==="ar"?"ar-EG":"en-US"));
  }catch(e){
    phase="idle";
    markIdle();
    say("تعذر تشغيل الميكروفون","Unable to start microphone");
    if(typeof toast==="function")toast(String(e),"err");
  }
};

window.finishVoice=function(){
  if(phase==="idle"||phase==="finalizing")return;

  phase="finalizing";
  voiceAwaitingResult=true;
  setMicBusy(true);
  setStop(false);
  say("جاري تحويل الصوت إلى نص…","Transcribing speech…");

  var A=bridge();
  try{
    if(A&&typeof A.stopVoice==="function"){A.stopVoice();return;}
  }catch(e){}

  phase="idle";
  markIdle();
};

window.sanadNativeVoiceState=function(state,detail){
  var w=byId("wave");

  if(state==="permission_required"){
    phase="permission";
    voiceNativeActive=false;
    voiceAwaitingResult=false;
    setMicBusy(true);
    setStop(false);
    say("اسمح لسند باستخدام الميكروفون","Allow SANAD to use the microphone");
    return;
  }

  if(state==="permission_denied"||state==="permission_blocked"){
    phase="idle";
    markIdle();
    say("فعّل إذن الميكروفون من إعدادات التطبيق","Enable microphone permission in app settings");
    return;
  }

  if(state==="starting"){
    phase="starting";
    voiceNativeActive=false;
    setMicBusy(true);
    say("جاري فتح الميكروفون…","Opening microphone…");
    return;
  }

  if(state==="listening"){
    phase="listening";
    markListening();
    say(detail==="model_loading"?
        "سامعك — Whisper بيتجهز في الخلفية…":
        "سامعك — اتكلم دلوقتي",
        detail==="model_loading"?
        "Listening — Whisper is loading in the background…":
        "Listening — speak now");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }

  if(state==="speech"){
    phase="listening";
    if(!voiceNativeActive)markListening();
    say("سامع الكلام…","Hearing speech…");
    return;
  }

  if(state==="model_loading_background"){
    if(phase==="idle")say("Whisper بيتجهز…","Preparing Whisper…");
    return;
  }

  if(state==="model_ready"){
    if(phase==="idle"){
      markIdle();
      say("جاهز — اضغط واتكلم","Ready — tap and speak");
    }else if(phase==="listening"){
      say("سامعك — اتكلم دلوقتي","Listening — speak now");
    }
    return;
  }

  if(state==="audio_recovered"){
    phase="listening";
    markListening();
    say("تم إعادة فتح الميكروفون — كمل كلام","Microphone recovered — keep speaking");
    return;
  }

  if(state==="processing"){
    phase="finalizing";
    voiceAwaitingResult=true;
    setMicBusy(true);
    setStop(false);
    say(detail==="waiting_model"?
        "تم التسجيل — جاري تجهيز Whisper ثم التحويل…":
        "جاري تحويل الصوت إلى نص…",
        detail==="waiting_model"?
        "Recorded — preparing Whisper then transcribing…":
        "Transcribing speech…");
    return;
  }

  if(state==="audio_open_error"||state==="audio_error"||state==="model_error"){
    phase="idle";
    markIdle();
    if(state==="audio_open_error")say("الميكروفون لم يفتح","Microphone could not open");
    else if(state==="audio_error")say("فشل قراءة الميكروفون","Microphone read failed");
    else say("فشل تحميل Whisper","Whisper failed to load");
    return;
  }

  if(state==="stopped"){
    if(phase!=="finalizing"){
      phase="idle";
      markIdle();
    }
  }
};

window.sanadNativeVoiceLevel=function(level){
  voiceLevel=Number(level)||0;
  var w=byId("wave");
  if(w&&phase==="listening")w.innerHTML=waveHtml(voiceLevel);
};

window.sanadNativeVoicePartial=function(text){
  text=String(text||"").replace(/\s+/g," ").trim();
  if(!text||text===lastPartial)return;

  lastPartial=text;
  voicePartial=text;

  var v=byId("vlive");
  if(v)v.textContent=text;

  say("بيتحول الكلام مباشرة…","Transcribing live…");
};

window.sanadNativeVoiceChunk=function(payload){
  try{
    var list=typeof payload==="string"?JSON.parse(payload):payload;
    if(!Array.isArray(list))list=[String(payload||"")];
    if(list.length)window.sanadNativeVoicePartial(String(list[0]||""));
  }catch(e){}
};
window.sanadNativeVoiceResult=window.sanadNativeVoiceChunk;

window.sanadNativeVoiceDone=function(text){
  var finalText=String(text||lastPartial||voicePartial||"").replace(/\s+/g," ").trim();

  phase="idle";
  markIdle();
  clearTranscript();

  var v=byId("vlive");
  if(v)v.textContent=finalText;

  if(finalText){
    UI.addText=finalText;
    say("تم تحويل الكلام","Speech converted");
    runParse("voice");
  }else{
    say("ما وصلنيش نص واضح — جرّب تاني","No clear text — try again");
    if(typeof toast==="function")toast(LANG==="ar"?"ما وصلنيش نص واضح":"No clear text","err");
  }
};

window.sanadNativeVoiceError=function(msg){
  phase="idle";
  markIdle();
  say("حصل خطأ في الصوت","Voice error");
  if(msg&&typeof toast==="function")toast(String(msg),"err");
};

window.sanadVoiceDiagnostics=function(){
  var A=bridge(),raw="{}";
  try{
    if(A&&typeof A.runtimeDiagnostics==="function")
      raw=String(A.runtimeDiagnostics()||"{}");
  }catch(e){}

  var d={};
  try{d=JSON.parse(raw);}catch(e){}

  var text=(LANG==="ar"?"تشخيص الصوت: ":"Voice diagnostics: ")+
    "permission="+String(d.audioPermission)+
    " | status="+String(d.voiceStatus||"?")+
    " | "+String(d.voiceDetails||"");

  if(typeof toast==="function")toast(text,(d.audioPermission===false)?"err":null);
  return text;
};

if(typeof MutationObserver!=="undefined"&&document&&typeof document.createElement==="function"){
  var diagObserver=new MutationObserver(function(){
    var mic=byId("micb");
    if(!mic||byId("v35diag"))return;

    var b=document.createElement("button");
    b.id="v35diag";
    b.type="button";
    b.className="chip sm";
    b.style.marginTop="8px";
    b.textContent=(LANG==="ar"?"تشخيص الميكروفون":"Microphone diagnostics");
    b.onclick=function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      window.sanadVoiceDiagnostics();
    };

    if(mic.parentNode)mic.parentNode.appendChild(b);
  });

  try{diagObserver.observe(document.documentElement,{subtree:true,childList:true});}catch(e){}
}

// Entering Voice starts recording automatically, like a chat voice composer.
document.addEventListener("click",function(e){
  var x=e.target&&e.target.closest?e.target.closest("[data-act]"):null;
  if(!x)return;

  var act=x.getAttribute("data-act"),mode=x.getAttribute("data-m");

  if((act==="mode"||act==="addmode")&&mode==="voice"){
    var token=++autoStartToken;
    setTimeout(function(){
      if(token!==autoStartToken)return;
      if(byId("micb")&&phase==="idle")window.startVoice();
    },260);
  }
},false);

// Mic button is owned exclusively by V3.5.
document.addEventListener("click",function(e){
  var mic=e.target&&e.target.closest?e.target.closest("#micb"):null;
  if(!mic)return;

  e.preventDefault();
  e.stopImmediatePropagation();
  window.startVoice();
},true);

})();