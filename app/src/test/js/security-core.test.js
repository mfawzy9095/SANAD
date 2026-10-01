'use strict';
const assert=require('assert');
const {webcrypto}=require('crypto');
const Core=require('../../main/assets/js/security-core.js');

(async()=>{
  const S=Core.createSecurityCore({
    crypto:webcrypto,
    TextEncoder:global.TextEncoder
  });

  const bytes=new Uint8Array([0,1,2,253,254,255]);
  assert.deepStrictEqual(Array.from(S.unb64(S.b64(bytes))),Array.from(bytes));

  assert.strictEqual(S.normalizeRecovery('1234-5678 90ab'),'1234567890');
  assert.strictEqual(S.formatRecovery('1234567890123456'),'1234-5678-9012-3456');

  const code=S.generateRecoveryCode(16);
  assert.match(code,/^\d{16}$/);

  const salt=S.b64(new Uint8Array(16).fill(7));
  const a=await S.recoveryDigest('1234-5678-9012-3456',salt,1000);
  const b=await S.recoveryDigest('1234567890123456',salt,1000);
  const c=await S.recoveryDigest('9999999999999999',salt,1000);
  assert.strictEqual(a,b);
  assert.notStrictEqual(a,c);

  const h1=await S.hash('SANAD');
  const h2=await S.hash('SANAD');
  assert.strictEqual(h1,h2);
  assert.notStrictEqual(h1,await S.hash('sanad'));

  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:true,unlocked:true,backgroundAt:1000,now:30999,relockAfterMs:30000
  }),false);
  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:true,unlocked:true,backgroundAt:1000,now:31000,relockAfterMs:30000
  }),true);
  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:false,unlocked:true,backgroundAt:1000,now:999999,relockAfterMs:30000
  }),false);
  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:true,unlocked:false,backgroundAt:1000,now:999999,relockAfterMs:30000
  }),false);
  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:true,unlocked:true,backgroundAt:0,now:999999,relockAfterMs:30000
  }),false);
  assert.strictEqual(S.shouldRelockOnForeground({
    enabled:true,unlocked:true,backgroundAt:5000,now:4000,relockAfterMs:30000
  }),false);

  const defaults=S.defaultConfig();
  assert.deepStrictEqual(defaults,{
    enabled:false,
    authMode:null,
    credentialId:null,
    recoveryHash:null,
    recoverySalt:null,
    recoveryKdf:null,
    recoveryIterations:0,
    storageUnavailable:false
  });

  const storedInit=S.prepareInitialState({
    markerEnabled:false,
    stored:{enabled:true,authMode:'android-device',recoveryIterations:210000}
  });
  assert.strictEqual(storedInit.config.enabled,true);
  assert.strictEqual(storedInit.config.authMode,'android-device');
  assert.strictEqual(storedInit.config.storageUnavailable,false);
  assert.strictEqual(storedInit.markerValue,true);
  assert.strictEqual(storedInit.unlocked,false);
  assert.strictEqual(storedInit.pendingStart,false);

  const markerOnly=S.prepareInitialState({markerEnabled:true,stored:null});
  assert.strictEqual(markerOnly.config.enabled,true);
  assert.strictEqual(markerOnly.config.storageUnavailable,true);
  assert.strictEqual(markerOnly.markerValue,true);
  assert.strictEqual(markerOnly.unlocked,false);

  const clean=S.prepareInitialState({markerEnabled:false,stored:null});
  assert.deepStrictEqual(clean.config,S.defaultConfig());
  assert.strictEqual(clean.markerValue,false);
  assert.strictEqual(clean.unlocked,true);

  assert.strictEqual(S.unlockRoute({enabled:false}),'disabled');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:'android-device',credentialId:null,nativeAvailable:true,webAuthnEnvironmentAvailable:true
  }),'native');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:'android-device',credentialId:null,nativeAvailable:false,webAuthnEnvironmentAvailable:true
  }),'native-unavailable');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:'webauthn',credentialId:'cred',nativeAvailable:false,webAuthnEnvironmentAvailable:true
  }),'webauthn');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:'webauthn',credentialId:'cred',nativeAvailable:false,webAuthnEnvironmentAvailable:false
  }),'webauthn-unavailable');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:null,credentialId:null,nativeAvailable:true,webAuthnEnvironmentAvailable:true
  }),'native');
  assert.strictEqual(S.unlockRoute({
    enabled:true,authMode:null,credentialId:null,nativeAvailable:false,webAuthnEnvironmentAvailable:true
  }),'webauthn');

  assert.strictEqual(S.shouldShowLockOverlay({enabled:true,unlocked:false}),true);
  assert.strictEqual(S.shouldShowLockOverlay({enabled:true,unlocked:true}),false);
  assert.strictEqual(S.shouldShowLockOverlay({enabled:false,unlocked:false}),false);
  assert.strictEqual(S.shouldShowLockOverlay({enabled:false,unlocked:true}),false);
  assert.strictEqual(S.shouldShowLockOverlay(null),false);

  console.log('security-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
