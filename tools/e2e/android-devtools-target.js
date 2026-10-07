'use strict';
// Discover only this app's WebView. Other Android processes can expose DevTools too.
const APP_URL='https://appassets.androidplatform.net/assets/index.html';
async function findAppTarget({adb,fetchTargets,wait,attempts=60,onAttempt=()=>{}}){
 let last='app process unavailable';
 for(let n=0;n<attempts;n++){
  try{
   const pid=String(adb('shell','pidof',process.env.SANAD_QA_PACKAGE||'com.sanad.v9test.forensicqa.stable')).trim();
   if(!/^\d+$/.test(pid))throw Error('app PID unavailable or ambiguous');
   const socket='webview_devtools_remote_'+pid;
   const sockets=adb('shell','cat','/proc/net/unix');
   if(!sockets.split('\n').some(line=>line.trim().endsWith('@'+socket)))throw Error('app DevTools socket unavailable');
   adb('forward','tcp:9222','localabstract:'+socket);
   const targets=await fetchTargets();
   const target=targets.find(t=>t.type==='page'&&typeof t.url==='string'&&(t.url===APP_URL||t.url.startsWith(APP_URL+'#'))&&t.webSocketDebuggerUrl);
   onAttempt({attempt:n+1,pid,socket,pages:targets.filter(t=>t.type==='page').map(t=>({id:t.id,url:t.url}))});
   if(target)return target;
   last='app asset page not ready';
  }catch(e){last=e.message;onAttempt({attempt:n+1,error:last});}
  if(n+1<attempts)await wait(1000);
 }
 throw Error('Android app DevTools target unavailable: '+last);
}
module.exports={findAppTarget};
