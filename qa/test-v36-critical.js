const fs=require('fs'),vm=require('vm');
function ok(name,cond){if(!cond)throw new Error('FAIL '+name);console.log('PASS '+name);}
function text(path){return fs.readFileSync(path,'utf8');}

// Static critical-stabilization assertions.
const gradle=text('app/build.gradle');
ok('versionCode 36',/versionCode\s+36/.test(gradle));
ok('versionName unified',/versionName\s+'3\.6-critical-stabilization'/.test(gradle));
ok('native cFlags O3',/cFlags\s+'-O3'/.test(gradle));
ok('native release requested',/CMAKE_BUILD_TYPE=Release/.test(gradle));

const cmake=text('app/src/main/cpp/CMakeLists.txt');
ok('CMake forces optimized native build',/SANAD_FORCE_NATIVE_OPTIMIZED/.test(cmake)&&/set\(CMAKE_BUILD_TYPE Release .* FORCE\)/.test(cmake));
ok('C debug flags contain O3',/CMAKE_C_FLAGS_DEBUG "-O3/.test(cmake));
ok('compile commands exported',/CMAKE_EXPORT_COMPILE_COMMANDS ON/.test(cmake));

const voiceJava=text('app/src/main/java/com/sanad/full/WhisperVoiceEngine.java');
const stopBody=(voiceJava.match(/public void stop\(\)\{([\s\S]*?)\n    \}/)||[])[1]||'';
ok('stop only publishes intent',/recording\.set\(false\)/.test(stopBody)&&!/\.stop\(\)/.test(stopBody));
ok('intentional stop checked after blocking read',/if\(!recording\.get\(\) && n<=0\) break;/.test(voiceJava));
ok('AudioRecord release owned by worker finally',/finally\{\s*safeRelease\(\);\s*\}/.test(voiceJava));

const db=text('app/src/main/java/com/sanad/full/SanadDatabase.java');
ok('database schema v3',/VER=3/.test(db));
ok('state history table exists',/CREATE TABLE app_state_history/.test(db));
ok('three snapshots retained',/MAX_STATE_SNAPSHOTS=3/.test(db));
ok('snapshot before replace in transaction',db.indexOf('INSERT INTO app_state_history')<db.indexOf('insertWithOnConflict("app_state"'));

const main=text('app/src/main/java/com/sanad/full/MainActivity.java');
ok('loadState returns explicit envelope',/out\.put\("ok",false\)/.test(main)&&/out\.put\("ok",true\)/.test(main));
ok('native read-only gate blocks save',/if\(storageRecoveryRequired\) return false;/.test(main));
ok('explicit recovery write path exists',/saveRecoveredState/.test(main));
ok('runtime diagnostics use BuildConfig version',/o\.put\("version",BuildConfig\.VERSION_NAME\)/.test(main));
ok('V3.6 voice runtime injected',/injectAssetJs\("v36_voice\.js"\)/.test(main));

const html=text('app/src/main/assets/index.html');
ok('Web Speech API removed',!/(webkit)?SpeechRecognition/.test(html));
ok('fake sampleVoice removed',!/sampleVoice/.test(html));
ok('read-only state exists',/STORAGE_READ_ONLY/.test(html)&&/showStorageRecoveryOverlay/.test(html));
ok('backup restore can exit recovery',/save\(STORAGE_READ_ONLY\)/.test(html));
ok('JS build version unified',/version:"3\.6-critical-stabilization"/.test(html));

const v36=text('app/src/main/assets/v36_voice.js');
ok('voice runtime version unified',/__SANAD_VOICE_ENGINE__="3\.6-critical-stabilization"/.test(v36));
ok('finalize watchdog configured',/FINALIZE_WATCHDOG_MS=150000/.test(v36)&&/armFinalizeWatchdog/.test(v36));

// Runtime JS regression with a fake native bridge.
let starts=0,stops=0,parses=0,watchdog=null;
global.window=global;
global.LANG='ar';
global.S={settings:{voiceLocale:'ar-EG'}};
global.UI={addText:''};
global.runParse=()=>{parses++;};
global.toast=()=>{};
global.Android={startVoice:()=>{starts++;},stopVoice:()=>{stops++;},runtimeDiagnostics:()=>JSON.stringify({version:'3.6-critical-stabilization',audioPermission:true,voiceStatus:'ready',voiceDetails:'ok'})};
const els={};
function el(){return {textContent:'',style:{},disabled:false,className:'micb',parentNode:{appendChild:()=>{}},onclick:null};}
['vlabel','vstop','micb','wave','vlive'].forEach(k=>els[k]=el());
global.document={
  getElementById:id=>els[id]||null,
  addEventListener:()=>{},
  createElement:()=>el(),
  documentElement:{}
};
global.MutationObserver=function(){this.observe=()=>{};};
const realSetTimeout=global.setTimeout,realClearTimeout=global.clearTimeout;
global.setTimeout=(fn,ms)=>{if(ms===150000){watchdog=fn;return 99;}return 98;};
global.clearTimeout=(id)=>{if(id===99)watchdog=null;};
vm.runInThisContext(v36,{filename:'v36_voice.js'});
startVoice();
ok('tap reaches native engine',starts===1);
sanadNativeVoiceState('listening','model_loading');
ok('listening UI activates',els.micb.className==='micb rec'&&els.vstop.style.display==='inline-flex');
sanadNativeVoicePartial('دفعت خمسين درهم في كارفور');
ok('partial text visible',els.vlive.textContent.includes('كارفور'));
finishVoice();
ok('finish reaches native stop',stops===1&&els.micb.disabled===true&&typeof watchdog==='function');
sanadNativeVoiceState('processing','cloud_transcribing');
ok('cloud processing stays busy',els.micb.disabled===true&&els.vlabel.textContent.includes('الإنترنت'));
sanadNativeVoiceState('cloud_fallback','HTTP 429');
ok('cloud failure keeps the same recording in finalization',els.micb.disabled===true&&els.vlabel.textContent.includes('الهاتف'));
watchdog();
ok('watchdog recovers UI from finalizing',els.micb.disabled===false&&els.vstop.style.display==='none');
sanadNativeVoiceDone('late result');
ok('late cloud result after timeout is ignored',parses===0);
sanadNativeVoiceState('stopped','ar');
startVoice();
sanadNativeVoiceState('listening','model_ready');
sanadNativeVoiceDone('دفعت خمسين درهم في كارفور');
ok('final text reaches parser',UI.addText.includes('كارفور')&&parses===1&&els.micb.disabled===false);
global.setTimeout=realSetTimeout;global.clearTimeout=realClearTimeout;
