(function(){
"use strict";
window.__SANAD_VOICE_ENGINE__="3.0-offline-live-voice";
var starting=false, lastPartial="", autoStarted=false;

function A(){try{return window.Android||null;}catch(e){return null;}}
function label(ar,en){var l=document.getElementById("vlabel");if(l)l.textContent=(typeof LANG!=="undefined"&&LANG==="ar")?ar:en;}
function micBusy(v){
  var m=document.getElementById("micb");
  if(m){m.disabled=!!v;m.style.opacity=v?".7":"1";}
}
function resetLive(){
  voicePartial="";voiceChunks=[];lastPartial="";
  var lv=document.getElementById("vlive");if(lv)lv.textContent="";
}
window.startVoice=function(){
  if(starting||voiceNativeActive||voiceAwaitingResult)return;
  var b=A();
  if(!b||typeof b.startVoice!=="function"){
    if(typeof toast==="function")toast((LANG==="ar"?"محرك الصوت المحلي غير متاح":"Offline voice engine unavailable"),"err");
    return;
  }
  resetLive();
  starting=true;micBusy(true);
  label("جاري فتح الميكروفون…","Opening microphone…");
  try{b.startVoice((S.settings&&S.settings.voiceLocale)||(LANG==="ar"?"ar-EG":"en-US"));}
  catch(e){starting=false;micBusy(false);if(typeof toast==="function")toast(String(e),"err");}
};

window.sanadNativeVoiceState=function(state,detail){
  var w=document.getElementById("wave");
  if(state==="permission_required"){
    starting=true;voiceNativeActive=false;micBusy(true);
    label("اسمح لسند باستخدام الميكروفون مرة واحدة","Allow microphone access once");
    return;
  }
  if(state==="device_ready"||state==="ready"){
    starting=false;voiceNativeActive=false;micBusy(false);
    label("اضغط واتكلم — التحويل Offline","Tap and speak — offline transcription");
    return;
  }
  if(state==="starting_device"||state==="starting"){
    starting=true;voiceNativeActive=false;micBusy(true);
    label("جاري تشغيل الاستماع المحلي…","Starting offline listening…");
    return;
  }
  if(state==="fallback_whisper"){
    starting=true;voiceNativeActive=false;micBusy(true);
    label("التعرف المحلي غير متاح — تشغيل Whisper Offline…","Local recognizer unavailable — starting offline Whisper…");
    return;
  }
  if(state==="listening_device"||state==="silent"){
    starting=false;micBusy(false);
    if(!voiceNativeActive)voiceUiStart();
    label("سامعك — اتكلم دلوقتي","Listening — speak now");
    if(w)w.innerHTML=waveHtml(0);
    return;
  }
  if(state==="speech"){
    starting=false;micBusy(false);
    if(!voiceNativeActive)voiceUiStart();
    label("سامع الكلام…","Hearing speech…");
    return;
  }
  if(state==="processing_device"||state==="processing"){
    starting=false;voiceAwaitingResult=true;micBusy(true);
    label("جاري تثبيت النص…","Finalizing text…");
    return;
  }
  if(state==="permission_denied"||state==="permission_blocked"){
    starting=false;voiceNativeActive=false;voiceAwaitingResult=false;micBusy(false);stopVoiceUI();
    label("فعّل إذن الميكروفون من إعدادات التطبيق","Enable microphone permission in app settings");
    return;
  }
  if(state==="stopped"){
    starting=false;micBusy(false);
    if(!voiceAwaitingResult){voiceNativeActive=false;stopVoiceUI();}
  }
};

window.sanadNativeVoicePartial=function(text){
  text=String(text||"").replace(/\s+/g," ").trim();
  if(!text||text===lastPartial)return;
  lastPartial=text;voicePartial=text;
  var lv=document.getElementById("vlive");if(lv)lv.textContent=text;
  label("بيتحول الكلام مباشرة…","Transcribing live…");
};

window.sanadNativeVoiceDone=function(text){
  var finalText=String(text||lastPartial||voicePartial||"").replace(/\s+/g," ").trim();
  starting=false;voiceAwaitingResult=false;voiceNativeActive=false;micBusy(false);
  voicePartial="";voiceChunks=[];lastPartial="";stopVoiceUI();
  var lv=document.getElementById("vlive");if(lv)lv.textContent=finalText;
  if(finalText){
    UI.addText=finalText;
    label("تم تحويل الكلام","Speech converted");
    runParse("voice");
  }else{
    label("ما وصلنيش صوت واضح — اضغط واتكلم تاني","No clear speech — tap and try again");
    if(typeof toast==="function")toast(LANG==="ar"?"ما وصلنيش صوت واضح":"No clear speech detected","err");
  }
};

var oldErr=window.sanadNativeVoiceError;
window.sanadNativeVoiceError=function(msg){
  starting=false;voiceAwaitingResult=false;voiceNativeActive=false;micBusy(false);stopVoiceUI();
  label("حصل خطأ في الصوت","Voice error");
  if(msg&&typeof toast==="function")toast(String(msg),"err");
};

document.addEventListener("click",function(e){
  var x=e.target&&e.target.closest?e.target.closest("[data-act]"):null;
  if(!x)return;
  var act=x.getAttribute("data-act"),mode=x.getAttribute("data-m");
  if((act==="mode"||act==="addmode")&&mode==="voice"){
    autoStarted=false;
    setTimeout(function(){
      var mic=document.getElementById("micb");
      if(mic&&!autoStarted){autoStarted=true;window.startVoice();}
    },260);
  }
},false);
})();