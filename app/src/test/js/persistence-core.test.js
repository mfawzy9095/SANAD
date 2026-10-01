'use strict';
const assert=require('assert');
const P=require('../../main/assets/js/persistence-core.js');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function fp(v){return JSON.stringify(v);}
function fakeStorage(initial){
  let state=clone(initial||null);
  const snaps=new Map();
  const ctl={
    failWrite:false, failRead:false, corruptRead:false, failSnapshot:null
  };
  return {
    ctl,
    snaps,
    async writeState(v){
      if(ctl.failWrite)return false;
      state=clone(v);
      return true;
    },
    async readState(){
      if(ctl.failRead)return {ok:false};
      const out=clone(state);
      if(ctl.corruptRead&&out&&typeof out==='object')out.__corrupt=true;
      return {ok:true,state:out};
    },
    async writeSnapshot(name,v){
      if(ctl.failSnapshot===name)return false;
      snaps.set(name,clone(v));return true;
    },
    async readSnapshot(name){return snaps.has(name)?clone(snaps.get(name)):null;}
  };
}

(async()=>{
  {
    const storage=fakeStorage({v:1});
    const svc=P.createPersistenceService({storage,validateState:()=>[],fingerprint:fp});
    const r=await svc.verifiedWriteState({v:2},{v:1});
    assert.deepStrictEqual(r,{ok:true,reason:'ok',restored:false});
    assert.deepStrictEqual((await storage.readState()).state,{v:2});
  }

  {
    const storage=fakeStorage({v:1});
    const svc=P.createPersistenceService({
      storage,
      validateState:()=>['bad'],
      fingerprint:fp
    });
    const r=await svc.verifiedWriteState({v:2},{v:1});
    assert.strictEqual(r.reason,'invalid-state');
    assert.strictEqual(r.restored,true);
    assert.deepStrictEqual((await storage.readState()).state,{v:1});
  }

  {
    const storage=fakeStorage({v:1});
    storage.ctl.failWrite=true;
    let recovery=0;
    const svc=P.createPersistenceService({
      storage,validateState:()=>[],fingerprint:fp,
      onRecovery:async()=>{recovery++;}
    });
    const r=await svc.verifiedWriteState({v:2},{v:1});
    assert.strictEqual(r.reason,'write-failed');
    assert.strictEqual(r.restored,false);
    assert.strictEqual(recovery,1);
  }

  {
    const storage=fakeStorage({v:1});
    const rawWrite=storage.writeState.bind(storage);
    let writes=0;
    storage.writeState=async v=>{
      writes++;
      if(writes===1){ await rawWrite(v); storage.ctl.corruptRead=true; return true; }
      storage.ctl.corruptRead=false;
      return rawWrite(v);
    };
    const svc=P.createPersistenceService({storage,validateState:()=>[],fingerprint:fp});
    const r=await svc.verifiedWriteState({v:2},{v:1});
    assert.strictEqual(r.reason,'fingerprint-mismatch');
    assert.strictEqual(r.restored,true);
    assert.deepStrictEqual((await storage.readState()).state,{v:1});
  }

  {
    const storage=fakeStorage(null);
    const svc=P.createPersistenceService({storage,validateState:()=>[],fingerprint:fp});
    storage.snaps.set('pre-crit-1',{v:1});
    storage.snaps.set('pre-crit-2',{v:2});
    const r=await svc.rotateVerifiedSnapshot(
      {v:3},
      {one:'pre-crit-1',two:'pre-crit-2',three:'pre-crit-3'},
      'snap'
    );
    assert.deepStrictEqual(r,{ok:true});
    assert.deepStrictEqual(storage.snaps.get('pre-crit-1'),{v:3});
    assert.deepStrictEqual(storage.snaps.get('pre-crit-2'),{v:1});
    assert.deepStrictEqual(storage.snaps.get('pre-crit-3'),{v:2});
  }

  {
    const storage=fakeStorage(null);
    storage.ctl.failSnapshot='1';
    const svc=P.createPersistenceService({storage,validateState:()=>[],fingerprint:fp});
    const r=await svc.rotateVerifiedSnapshot({v:1},{one:'1',two:'2',three:'3'},'user-snap');
    assert.strictEqual(r.reason,'user-snap1-write-failed');
  }

  console.log('persistence-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
