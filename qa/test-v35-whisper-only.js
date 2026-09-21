const fs=require("fs"),vm=require("vm");
let starts=0,stops=0,parses=0;
global.window=global;
global.LANG="ar";
global.S={settings:{voiceLocale:"ar-EG"}};
global.UI={addText:""};
global.voiceNativeActive=false;
global.voiceAwaitingResult=false;
global.voicePartial="";
global.voiceChunks=[];
global.voiceLevel=0;
global.waveHtml=()=>"<wave>";
global.runParse=()=>{parses++;};
global.toast=()=>{};
global.Android={startVoice:()=>{starts++;},stopVoice:()=>{stops++;}};
const els={};
function el(){return {textContent:"",style:{},disabled:false,className:"micb",parentNode:{appendChild:()=>{}}};}
["vlabel","vstop","micb","wave","vlive"].forEach(k=>els[k]=el());
global.document={
  getElementById:id=>els[id]||null,
  addEventListener:()=>{},
  createElement:()=>el(),
  documentElement:{}
};
global.MutationObserver=function(){this.observe=()=>{};};
vm.runInThisContext(fs.readFileSync("app/src/main/assets/v35_voice.js","utf8"),{filename:"v35_voice.js"});
function ok(n,c){if(!c)throw new Error("FAIL "+n);console.log("PASS "+n);}
startVoice();
ok("tap reaches native engine",starts===1);
sanadNativeVoiceState("listening","model_loading");
ok("listening activates UI while model loads",voiceNativeActive===true);
sanadNativeVoiceState("model_ready","ar");
ok("model ready does not cancel listening",voiceNativeActive===true);
sanadNativeVoicePartial("دفعت خمسين درهم في كارفور");
ok("partial text visible",els.vlive.textContent.includes("كارفور"));
sanadNativeVoiceDone("دفعت خمسين درهم في كارفور");
ok("final text reaches parser",UI.addText.includes("كارفور")&&parses===1&&!voiceNativeActive);
