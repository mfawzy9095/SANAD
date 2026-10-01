'use strict';
const assert=require('assert');
const Adapter=require('../../main/assets/js/security-adapter.js');

(async()=>{
  const calls=[];
  const timers=[];
  const credentials={
    async get(req){calls.push(['get',req]);return {id:'got'};},
    async create(req){calls.push(['create',req]);return {id:'made'};}
  };
  const bridge={
    supportsDeviceAuth(){calls.push(['supports']);return true;},
    authenticateDevice(reason){calls.push(['auth',reason]);}
  };
  const host={
    AndroidBridge:bridge,
    isSecureContext:true,
    PublicKeyCredential:function(){},
    setTimeout(fn,ms){timers.push([fn,ms]);return timers.length;}
  };
  const A=Adapter.createSecurityAdapter({
    host,
    navigator:{credentials},
    crypto:{subtle:{}},
    setTimeout:host.setTimeout
  });

  assert.strictEqual(A.nativeAvailable(),true);
  assert.strictEqual(A.webAuthnAvailable('idb'),true);
  assert.strictEqual(A.webAuthnAvailable('memory'),false);

  const auth=A.nativeAuth('Unlock SANAD');
  assert.deepStrictEqual(calls.find(x=>x[0]==='auth'),['auth','Unlock SANAD']);
  assert.strictEqual(A.nativeResult(true),true);
  assert.strictEqual(await auth,true);
  assert.strictEqual(A.nativeResult(false),false);

  const timed=A.nativeAuth('Verify SANAD',1234);
  const timer=timers[timers.length-1];
  assert.strictEqual(timer[1],1234);
  timer[0]();
  assert.strictEqual(await timed,false);

  const pkGet={challenge:new Uint8Array([1])};
  const got=await A.getCredential(pkGet);
  assert.strictEqual(got.id,'got');
  assert.deepStrictEqual(calls.find(x=>x[0]==='get')[1],{publicKey:pkGet});

  const pkCreate={challenge:new Uint8Array([2])};
  const made=await A.createCredential(pkCreate);
  assert.strictEqual(made.id,'made');
  assert.deepStrictEqual(calls.find(x=>x[0]==='create')[1],{publicKey:pkCreate});

  const unavailable=Adapter.createSecurityAdapter({
    host:{isSecureContext:false},
    navigator:{},
    crypto:null,
    setTimeout:()=>{}
  });
  assert.strictEqual(unavailable.nativeAvailable(),false);
  assert.strictEqual(await unavailable.nativeAuth('x'),false);
  assert.strictEqual(unavailable.webAuthnAvailable('idb'),false);
  await assert.rejects(()=>unavailable.getCredential({}),/webauthn-get-unavailable/);
  await assert.rejects(()=>unavailable.createCredential({}),/webauthn-create-unavailable/);

  console.log('security-adapter regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
