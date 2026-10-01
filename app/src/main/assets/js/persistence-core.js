(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadPersistenceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createPersistenceService(options){
    const opts=options||{};
    const storage=opts.storage;
    const validateState=typeof opts.validateState==='function'?opts.validateState:function(){return [];};
    const fingerprint=typeof opts.fingerprint==='function'?opts.fingerprint:function(){return '';};
    const onRecovery=typeof opts.onRecovery==='function'?opts.onRecovery:async function(){};
    const logError=typeof opts.logError==='function'?opts.logError:function(){};

    if(!storage)throw new Error('storage-required');

    async function rotateVerifiedSnapshot(state,names,prefix){
      const n=Object.assign({one:'1',two:'2',three:'3'},names||{});
      const p=String(prefix||'snap');
      const fp=fingerprint(state);
      try{
        const s2=await storage.readSnapshot(n.two);
        const s1=await storage.readSnapshot(n.one);
        if(s2){
          if(!await storage.writeSnapshot(n.three,s2))return {ok:false,reason:p+'3-write-failed'};
        }
        if(s1){
          if(!await storage.writeSnapshot(n.two,s1))return {ok:false,reason:p+'2-write-failed'};
        }
        if(!await storage.writeSnapshot(n.one,state))return {ok:false,reason:p+'1-write-failed'};
        const rb=await storage.readSnapshot(n.one);
        if(!rb)return {ok:false,reason:p+'1-readback-null'};
        if(fingerprint(rb)!==fp)return {ok:false,reason:p+'1-fp-mismatch'};
        return {ok:true};
      }catch(e){
        return {ok:false,reason:p+'-exception',error:e};
      }
    }

    async function tryRestoreVerified(prevState){
      if(!prevState)return false;
      const prevFp=fingerprint(prevState);
      try{
        if(!await storage.writeState(prevState))return false;
        const r=await storage.readState();
        if(!r||!r.ok||!r.state)return false;
        return fingerprint(r.state)===prevFp;
      }catch(_){return false;}
    }

    async function verifiedWriteState(nextState,fallbackState){
      const integrityErrors=validateState(nextState)||[];
      if(integrityErrors.length){
        logError('Blocked invalid financial state:',integrityErrors);
        return {ok:false,reason:'invalid-state',restored:!!fallbackState,errors:integrityErrors};
      }

      const nextFp=fingerprint(nextState);
      let wrote=false;
      try{wrote=await storage.writeState(nextState);}catch(_){wrote=false;}
      if(!wrote){
        if(fallbackState){
          const okRestore=await tryRestoreVerified(fallbackState);
          if(!okRestore){
            await onRecovery('write-failed + rollback-failed',new Error('durable write rejected'));
            return {ok:false,reason:'write-failed',restored:false};
          }
          return {ok:false,reason:'write-failed',restored:true};
        }
        return {ok:false,reason:'write-failed',restored:false};
      }

      let verify={ok:false};
      try{verify=await storage.readState();}catch(_){verify={ok:false};}
      if(!verify.ok||!verify.state){
        if(fallbackState){
          const okRestore=await tryRestoreVerified(fallbackState);
          if(!okRestore){
            await onRecovery('verify-failed + rollback-failed',new Error('read-back failed'));
            return {ok:false,reason:'verify-failed',restored:false};
          }
          return {ok:false,reason:'verify-failed',restored:true};
        }
        return {ok:false,reason:'verify-failed',restored:false};
      }

      if(fingerprint(verify.state)!==nextFp){
        if(fallbackState){
          const okRestore=await tryRestoreVerified(fallbackState);
          if(!okRestore){
            await onRecovery('fingerprint-mismatch + rollback-failed',new Error('persisted ≠ intended'));
            return {ok:false,reason:'fingerprint-mismatch',restored:false};
          }
          return {ok:false,reason:'fingerprint-mismatch',restored:true};
        }
        return {ok:false,reason:'fingerprint-mismatch',restored:false};
      }

      return {ok:true,reason:'ok',restored:false};
    }

    return Object.freeze({
      rotateVerifiedSnapshot,
      tryRestoreVerified,
      verifiedWriteState
    });
  }

  return Object.freeze({createPersistenceService});
});
