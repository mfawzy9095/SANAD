(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadMutationCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createMutationService(options){
    const d=options||{};
    const canWrite=typeof d.canWrite==='function'?d.canWrite:function(){return false;};
    const snapshotState=d.snapshotState;
    const loadState=d.loadState;
    const fingerprint=d.fingerprint;
    const captureInvariant=typeof d.captureInvariant==='function'?d.captureInvariant:function(){return null;};
    const checkInvariant=typeof d.checkInvariant==='function'?d.checkInvariant:function(){return null;};
    const validateState=typeof d.validateState==='function'?d.validateState:function(){return [];};
    const validateChanges=typeof d.validateChanges==='function'?d.validateChanges:function(){return null;};
    const isPreview=typeof d.isPreview==='function'?d.isPreview:function(){return false;};
    const writeSafetySnapshot=d.writeSafetySnapshot;
    const verifiedWrite=d.verifiedWrite;
    const tryRestore=d.tryRestore;
    const enterRecovery=typeof d.enterRecovery==='function'?d.enterRecovery:async function(){};
    const setMutationError=typeof d.setMutationError==='function'?d.setMutationError:function(){};
    const logError=typeof d.logError==='function'?d.logError:function(){};

    for(const [name,fn] of Object.entries({
      snapshotState,loadState,fingerprint,writeSafetySnapshot,verifiedWrite,tryRestore
    })){
      if(typeof fn!=='function')throw new Error(name+'-required');
    }

    async function run(mutateFn){
      if(typeof mutateFn!=='function')throw new Error('mutateFn-required');
      if(!canWrite())return {ok:false,reason:'read-only'};

      setMutationError(null);
      const before=snapshotState();
      const beforeFp=fingerprint(before);
      const invariantBefore=captureInvariant();

      let mainWriteAttempted=false;
      try{
        const result=await mutateFn();
        if(result===false){
          loadState(before);
          return {ok:false,reason:'mutation-rejected'};
        }

        const inv=checkInvariant(invariantBefore);
        if(inv){
          setMutationError(inv);
          loadState(before);
          return {ok:false,reason:inv,restored:true};
        }

        const candidate=snapshotState();
        const review=validateChanges(candidate,before);
        if(review){
          loadState(before);
          setMutationError(review.reason||'financial-review-required');
          return {ok:false,reason:review.reason||'financial-review-required',review,restored:true};
        }
        const integrityErrors=validateState(candidate)||[];
        if(integrityErrors.length){
          setMutationError('invalid-state');
          logError('Mutation rejected by financial integrity validator:',integrityErrors);
          loadState(before);
          return {ok:false,reason:'invalid-state',errors:integrityErrors,restored:true};
        }

        if(!isPreview()){
          const snapRes=await writeSafetySnapshot(before);
          if(!snapRes||!snapRes.ok){
            loadState(before);
            return {ok:false,reason:(snapRes&&snapRes.reason)||'snapshot-failed'};
          }
        }

        const after=snapshotState();
        const afterFp=fingerprint(after);
        mainWriteAttempted=true;
        const vres=await verifiedWrite(after,before);
        mainWriteAttempted=false;

        if(!vres||!vres.ok){
          loadState(before);
          return {ok:false,reason:(vres&&vres.reason)||'verify-failed',restored:!!(vres&&vres.restored)};
        }

        if(afterFp===beforeFp)return {ok:true,noop:true};
        return {ok:true};
      }catch(e){
        loadState(before);
        if(!mainWriteAttempted){
          return {ok:false,reason:'exception',error:e,restored:false};
        }
        try{
          const okRestore=await tryRestore(before);
          if(!okRestore)await enterRecovery('exception + rollback-failed',e);
        }catch(_){}
        return {ok:false,reason:'exception',error:e};
      }
    }

    return Object.freeze({run});
  }

  return Object.freeze({createMutationService});
});
