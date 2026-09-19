const fs=require("fs"),vm=require("vm");
let uiStarts=0,uiStops=0,bridgeStarts=0;
global.window=global;
global.LANG="ar";
global.S={settings:{voiceLocale:"ar-EG"}};
global.voiceNativeActive=false;
global.voiceAwaitingResult=false;
global.voicePartial="";
global.voiceChunks=[];
global.waveHtml=()=>"<wave>";
global.voiceUiStart=()=>{uiStarts++;global.voiceNativeActive=true;};
global.stopVoiceUI=()=>{uiStops++;global.voiceNativeActive=false;};
global.toast=()=>{};
global.nativeBridge=()=>({startVoice:()=>{bridgeStarts++;}});
global.startVoice=()=>{throw new Error("old startVoice must not be used");};
global.sanadNativeVoiceError=()=>{global.voiceNativeActive=false;};
const els={};
function E(){return {textContent:"",style:{},disabled:false,parentNode:null};}
["vlabel","vstop","micb","wave"].forEach(k=>els[k]=E());
global.document={
  getElementById:(id)=>els[id]||null,
  addEventListener:()=>{}
};
vm.runInThisContext(fs.readFileSync("app/src/main/assets/v29_micfix.js","utf8"),{filename:"v29_micfix.js"});
function ok(name,cond){if(!cond)throw new Error("FAIL "+name);console.log("PASS "+name);}
sanadNativeVoiceState("loading_model","");
ok("loading does not activate recorder UI",voiceNativeActive===false&&uiStarts===0);
sanadNativeVoiceState("ready","");
ok("ready does not activate recorder UI",voiceNativeActive===false&&uiStarts===0);
startVoice();
ok("mic click calls native bridge exactly once",bridgeStarts===1&&voiceNativeActive===false);
sanadNativeVoiceState("starting","");
ok("starting still not marked recording",voiceNativeActive===false&&uiStarts===0);
sanadNativeVoiceState("silent","");
ok("actual audio state activates recorder UI",voiceNativeActive===true&&uiStarts===1);
sanadNativeVoiceState("processing","");
ok("processing waits for result",voiceAwaitingResult===true);
