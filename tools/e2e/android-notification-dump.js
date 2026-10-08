'use strict';
// Android UiAutomator can return "null root node" while System UI is
// changing surfaces. A missing/partial XML is not a passed notification test.
// Remove any previous dump before each bounded attempt to avoid stale matches.
async function readNotificationHierarchy({
  adb, wait, remotePath='/sdcard/sanad-qa-notifications.xml',
  maxAttempts=5, onAttempt=()=>{}
}) {
  if(typeof adb!=='function'||typeof wait!=='function')throw Error('adb and wait are required');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>12)throw Error('Invalid hierarchy retry count');
  const errors=[];
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      adb('shell','rm','-f',remotePath);
      const dump=adb('shell','uiautomator','dump',remotePath);
      if(/null root node|^ERROR:/im.test(dump))throw Error('UiAutomator: '+dump);
      const xml=adb('shell','cat',remotePath);
      if(!/<hierarchy(?:\s|>)/.test(xml)||!/<node(?:\s|>)/.test(xml))
        throw Error('Hierarchy dump contains no Android UI nodes');
      onAttempt({attempt,ok:true});
      return xml;
    }catch(e){
      errors.push('attempt '+attempt+': '+String(e.message||e).slice(0,300));
      onAttempt({attempt,ok:false,error:errors.at(-1)});
    }
    if(attempt<maxAttempts)await wait(Math.min(1000,250+attempt*150));
  }
  throw Error('Unable to inspect Android System UI after '+maxAttempts+' attempts. '+errors.join(' | '));
}
module.exports={readNotificationHierarchy};
