(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadSecurityCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createSecurityCore(options){
    const opts=options||{};
    const cryptoObj=opts.crypto||(typeof crypto!=='undefined'?crypto:null);
    const Encoder=opts.TextEncoder||(typeof TextEncoder!=='undefined'?TextEncoder:null);
    const btoaFn=opts.btoa||(typeof btoa==='function'?btoa:null);
    const atobFn=opts.atob||(typeof atob==='function'?atob:null);

    function ensureCrypto(){
      if(!cryptoObj||!cryptoObj.subtle||typeof cryptoObj.getRandomValues!=='function')throw new Error('crypto-unavailable');
    }
    function encodeBase64(bytes){
      const arr=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
      if(btoaFn)return btoaFn(String.fromCharCode(...arr));
      if(typeof Buffer!=='undefined')return Buffer.from(arr).toString('base64');
      throw new Error('base64-unavailable');
    }
    function decodeBase64(s){
      if(atobFn){
        const bin=atobFn(s);
        return Uint8Array.from(bin,c=>c.charCodeAt(0));
      }
      if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));
      throw new Error('base64-unavailable');
    }
    function b64(bytes){
      return encodeBase64(bytes).split('+').join('-').split('/').join('_').replace(/=+$/,'');
    }
    function unb64(s){
      let v=String(s||'').replace(/-/g,'+').replace(/_/g,'/');
      while(v.length%4)v+='=';
      return decodeBase64(v);
    }
    function random(n=32){
      ensureCrypto();
      const a=new Uint8Array(n);
      cryptoObj.getRandomValues(a);
      return a;
    }
    function normalizeRecovery(s){return String(s||'').replace(/[^0-9]/g,'');}
    function formatRecovery(code){
      const v=normalizeRecovery(code);
      const parts=[];
      for(let i=0;i<v.length;i+=4)parts.push(v.slice(i,i+4));
      return parts.join('-');
    }
    function generateRecoveryCode(length=16){
      const bytes=random(length);
      return Array.from(bytes).map(x=>(x%10)).join('');
    }
    async function hash(s){
      ensureCrypto();
      if(!Encoder)throw new Error('text-encoder-unavailable');
      const data=new Encoder().encode(String(s));
      return b64(await cryptoObj.subtle.digest('SHA-256',data));
    }
    async function recoveryDigest(code,saltB64,iterations){
      ensureCrypto();
      if(!Encoder)throw new Error('text-encoder-unavailable');
      const key=await cryptoObj.subtle.importKey(
        'raw',
        new Encoder().encode(normalizeRecovery(code)),
        {name:'PBKDF2'},
        false,
        ['deriveBits']
      );
      const bits=await cryptoObj.subtle.deriveBits({
        name:'PBKDF2',
        salt:unb64(saltB64),
        iterations:Number(iterations)||210000,
        hash:'SHA-256'
      },key,256);
      return b64(bits);
    }

    return Object.freeze({
      b64,
      unb64,
      random,
      normalizeRecovery,
      formatRecovery,
      generateRecoveryCode,
      hash,
      recoveryDigest
    });
  }

  return Object.freeze({createSecurityCore});
});
