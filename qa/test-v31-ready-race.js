const fs=require("fs"),vm=require("vm");
let starts=0, parses=0;
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
global.Android={startVoice:()=>{starts++;},stopVoice:()=>{}};
const els={};
function el(){return {textContent:"",style:{},disabled:false,className:"micb"};}
["vlabel","vstop","micb","wave","vlive"].forEach(k=>els[k]=el());
global.document={
  getElementById:id=>els[id]||null,
  addEventListener:()=>{}
};
vm.runInThisContext(fs.readFileSync("app/src/main/assets/v31_voice.js","utf8"),{filename:"v31_voice.js"});
function ok(n,c){if(!c)throw new Error("FAIL "+n);console.log("PASS "+n);}

// Reproduce the exact previous failure: a READY event arrives before the user taps.
sanadNativeVoiceState("ready","");
ok("early ready does not mark mic active",voiceNativeActive===false);
startVoice();
ok("tap after early ready reaches native engine",starts===1);

sanadNativeVoiceState("listening_device","");
ok("actual listening marks mic active",voiceNativeActive===true);
sanadNativeVoicePartial("دفعت خمسين درهم في كارفور");
ok("live partial appears",els.vlive.textContent.includes("كارفور"));
sanadNativeVoiceDone("دفعت خمسين درهم في كارفور");
ok("final transcript reaches parser",UI.addText.includes("كارفور")&&parses===1&&voiceNativeActive===false);
