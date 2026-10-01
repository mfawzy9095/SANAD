(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadSecurityAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createSecurityAdapter(options){
    const opts=options||{};
    const host=opts.host||(typeof globalThis!=='undefined'?globalThis:{});
    const nav=opts.navigator||host.navigator||{};
    const cryptoObj=opts.crypto||host.crypto||null;
    const setTimeoutFn=opts.setTimeout||host.setTimeout||(typeof setTimeout==='function'?setTimeout:null);
    let nativeResolve=null;

    function bridge(){
      return host&&host.AndroidBridge;
    }

    function nativeAvailable(){
      try{
        const b=bridge();
        return !!(b&&typeof b.supportsDeviceAuth==='function'&&b.supportsDeviceAuth());
      }catch(_){
        return false;
      }
    }

    function nativeResult(ok){
      if(!nativeResolve)return false;
      const resolve=nativeResolve;
      nativeResolve=null;
      resolve(!!ok);
      return true;
    }

    async function nativeAuth(reason,timeoutMs=60000){
      if(!nativeAvailable())return false;
      return await new Promise(resolve=>{
        nativeResolve=resolve;
        try{
          bridge().authenticateDevice(String(reason||'Verify SANAD'));
        }catch(_){
          nativeResolve=null;
          resolve(false);
          return;
        }
        if(setTimeoutFn){
          setTimeoutFn(()=>{
            if(nativeResolve===resolve){
              nativeResolve=null;
              resolve(false);
            }
          },Number(timeoutMs)||60000);
        }
      });
    }

    function webAuthnAvailable(storageMode){
      return !!(
        storageMode==='idb' &&
        host &&
        host.isSecureContext &&
        host.PublicKeyCredential &&
        nav &&
        nav.credentials &&
        cryptoObj &&
        cryptoObj.subtle
      );
    }

    async function getCredential(publicKey){
      if(!nav||!nav.credentials||typeof nav.credentials.get!=='function')throw new Error('webauthn-get-unavailable');
      return await nav.credentials.get({publicKey});
    }

    async function createCredential(publicKey){
      if(!nav||!nav.credentials||typeof nav.credentials.create!=='function')throw new Error('webauthn-create-unavailable');
      return await nav.credentials.create({publicKey});
    }

    return Object.freeze({
      nativeAvailable,
      nativeResult,
      nativeAuth,
      webAuthnAvailable,
      getCredential,
      createCredential
    });
  }

  return Object.freeze({createSecurityAdapter});
});
