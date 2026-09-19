(function(){
"use strict";
window.__SANAD_MIC_FIX_VERSION__="2.9-mic-fix";

var originalStartVoice=window.startVoice;
var originalVoiceError=window.sanadNativeVoiceError;
var voiceStarting=false;

function el(id){return document.getElementById(id);}
function setLabel(ar,en){var l=el("vlabel");if(l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?ar:en;}
function setStop(show){var s=el("vstop");if(s)s.style.display=show?"inline-flex":"none";}
function setMicBusy(busy){
  var m=el("micb");
  if(!m)return;
  m.disabled=!!busy;
  m.style.opacity=busy?".72":"1";
}

window.sanadNativeVoiceState=function(state,detail){
  var w=el("wave");
  if(state==="permission_required"){
    voiceStarting=true; voiceNativeActive=false; setMicBusy(true); setStop(false);
    setLabel("اسمح لسند باستخدام الميكروفون","Allow SANAD to use the microphone");
    return;
  }
  if(state==="permission_denied"){
    voiceStarting=false; voiceNativeActive=false; setMicBusy(false); setStop(false); stopVoiceUI();
    setLabel("صلاحية الميكروفون مطلوبة","Microphone permission is required");
    return;
  }
  if(state==="permission_blocked"||state==="privacy_blocked"){
    voiceStarting=false; voiceNativeActive=false; setMicBusy(false); setStop(false); stopVoiceUI();
    setLabel("الميكروفون مقفول من إعدادات الهاتف","Microphone is blocked in phone settings");
    return;
  }
  if(state==="loading_model"){
    voiceStarting=true; voiceNativeActive=false; setMicBusy(true); setStop(false);
    setLabel("جاري تجهيز Whisper لأول استخدام…","Preparing Whisper for first use…");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }
  if(state==="ready"){
    voiceStarting=false; voiceNativeActive=false; setMicBusy(false); setStop(false);
    setLabel("جاهز — اضغط على الميكروفون وابدأ الكلام","Ready — tap the microphone and start speaking");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }
  if(state==="starting"){
    voiceStarting=true; voiceNativeActive=false; setMicBusy(true); setStop(false);
    setLabel("جاري فتح الميكروفون…","Opening microphone…");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }
  if(state==="silent"){
    voiceStarting=false; setMicBusy(false);
    if(!voiceNativeActive)voiceUiStart();
    setLabel("الميكروفون شغال — اتكلم دلوقتي","Microphone is on — speak now");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }
  if(state==="speech"){
    voiceStarting=false; setMicBusy(false);
    if(!voiceNativeActive)voiceUiStart();
    setLabel("سامعك… كمل كلام","Voice detected… keep talking");
    return;
  }
  if(state==="processing"){
    voiceStarting=false; voiceAwaitingResult=true; setMicBusy(true); setStop(false);
    setLabel("جاري تحويل الصوت إلى نص…","Transcribing speech…");
    return;
  }
  if(state==="stopped"){
    voiceStarting=false; setMicBusy(false);
    if(!voiceAwaitingResult){voiceNativeActive=false;stopVoiceUI();}
  }
};

window.startVoice=function(){
  if(voiceNativeActive||voiceStarting||voiceAwaitingResult)return;
  var A=null;
  try{A=nativeBridge();}catch(e){}
  if(A&&typeof A.startVoice==="function"){
    voiceStarting=true;
    voicePartial="";voiceChunks=[];
    setMicBusy(true);setStop(false);
    setLabel("جاري تشغيل الميكروفون…","Starting microphone…");
    try{
      A.startVoice((S.settings&&S.settings.voiceLocale)||(LANG==="ar"?"ar-EG":"en-US"));
      return;
    }catch(e){
      voiceStarting=false;setMicBusy(false);
      if(typeof toast==="function")toast((LANG==="ar"?"تعذر تشغيل الميكروفون: ":"Unable to start microphone: ")+String(e),"err");
      return;
    }
  }
  voiceStarting=false;
  if(typeof originalStartVoice==="function")return originalStartVoice();
};

window.sanadNativeVoiceError=function(msg){
  voiceStarting=false;setMicBusy(false);
  if(typeof originalVoiceError==="function")originalVoiceError(msg);
};

document.addEventListener("click",function(e){
  var t=e.target&&e.target.closest?e.target.closest("#micb"):null;
  if(!t)return;
  if(voiceStarting){
    e.preventDefault();e.stopImmediatePropagation();
  }
},true);
})();