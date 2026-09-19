const fs=require("fs"),vm=require("vm");
let bridgeStarts=0,parsed=0,uiStarts=0,uiStops=0;
global.window=global;
global.LANG="ar";
global.S={settings:{voiceLocale:"ar-EG"}};
global.UI={addText:""};
global.voiceNativeActive=false;
global.voiceAwaitingResult=false;
global.voicePartial="";
global.voiceChunks=[];
global.waveHtml=()=>"<wave>";
global.voiceUiStart=()=>{uiStarts++;global.voiceNativeActive=true;};
global.stopVoiceUI=()=>{uiStops++;global.voiceNativeActive=false;};
global.runParse=()=>{parsed++;};
global.toast=()=>{};
global.Android={startVoice:()=>{bridgeStarts++;}};
global.document={
  els:{},
  getElementById(id){
    if(!this.els[id])this.els[id]={textContent:"",style:{},disabled:false};
    return this.els[id];
  },
  addEventListener:()=>{}
};
vm.runInThisContext(fs.readFileSync("app/src/main/assets/v30_voice.js","utf8"),{filename:"v30_voice.js"});
function ok(n,c){if(!c)throw new Error("FAIL "+n);console.log("PASS "+n);}
startVoice();
ok("one tap starts native engine",bridgeStarts===1);
sanadNativeVoiceState("device_ready","");
ok("ready is not recording",voiceNativeActive===false);
sanadNativeVoiceState("listening_device","");
ok("listening marks mic active",voiceNativeActive===true&&uiStarts===1);
sanadNativeVoicePartial("دفعت خمسين درهم في كارفور");
ok("partial text is visible",document.getElementById("vlive").textContent.includes("كارفور"));
sanadNativeVoiceDone("دفعت خمسين درهم في كارفور");
ok("final text reaches parser",UI.addText.includes("كارفور")&&parsed===1&&voiceNativeActive===false);
