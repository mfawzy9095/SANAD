'use strict';
const assert=require('assert/strict');
const {readNotificationHierarchy}=require('../../../../tools/e2e/android-notification-dump');
(async()=>{
  const xml='<?xml version="1.0"?><hierarchy><node text="إيقاف مؤقت" bounds="[1,2][3,4]"/></hierarchy>';
  let stage=0,removed=0,waits=0;const events=[];
  const adb=(...args)=>{
    if(args[1]==='rm'){removed++;return '';}
    if(args[1]==='uiautomator'){stage++;return stage===1?'ERROR: null root node returned by UiTestAutomationBridge.':'';}
    if(args[1]==='cat'){if(stage===2)throw Error('dump missing');return xml;}
    throw Error('unexpected adb call '+args.join(' '));
  };
  const received=await readNotificationHierarchy({adb,wait:async()=>{waits++;},maxAttempts:4,onAttempt:x=>events.push(x)});
  assert.equal(received,xml);
  assert.equal(removed,3,'Every attempt must delete its predecessor to avoid stale XML');
  assert.equal(waits,2);
  assert.deepEqual(events.map(e=>e.ok),[false,false,true]);
  let stale='';let writes=0;
  await assert.rejects(readNotificationHierarchy({
    adb:(...args)=>{
      if(args[1]==='rm'){stale='';return '';}
      if(args[1]==='uiautomator'){writes++;return 'ERROR: null root node returned';}
      if(args[1]==='cat')return stale;
      throw Error('unexpected adb command');
    },
    wait:async()=>{},
    maxAttempts:3
  }),/Unable to inspect Android System UI after 3 attempts/);
  assert.equal(writes,3,'Never pass a broken hierarchy as a successful action tap');
  await assert.rejects(readNotificationHierarchy({adb,wait:async()=>{},maxAttempts:0}),/Invalid hierarchy retry count/);
  console.log('PASS: bounded native notification hierarchy retries; no stale XML or false-positive action');
})().catch(e=>{console.error(e);process.exitCode=1;});
