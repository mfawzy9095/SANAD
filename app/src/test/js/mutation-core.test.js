'use strict';
const assert=require('assert');
const M=require('../../main/assets/js/mutation-core.js');

function clone(v){return JSON.parse(JSON.stringify(v));}
function harness(options){
  const o=options||{};
  let state=clone(o.state||{value:1});
  const errors=[];
  const recovery=[];
  let verifiedCalls=0;
  let snapshotCalls=0;

  const service=M.createMutationService({
    canWrite:()=>o.canWrite!==false,
    snapshotState:()=>clone(state),
    loadState:v=>{state=clone(v);},
    fingerprint:v=>JSON.stringify(v),
    captureInvariant:()=>o.invariantBefore||null,
    checkInvariant:()=>o.invariantResult||null,
    validateState:()=>o.validationErrors||[],
    isPreview:()=>!!o.preview,
    writeSafetySnapshot:async()=>{snapshotCalls++;return o.snapshotResult||{ok:true};},
    verifiedWrite:async()=>{verifiedCalls++;if(o.verifiedThrow)throw new Error('write boom');return o.verifiedResult||{ok:true};},
    tryRestore:async()=>o.restoreResult!==false,
    enterRecovery:async(...args)=>{recovery.push(args);},
    setMutationError:v=>errors.push(v),
    logError:()=>{}
  });

  return {service,getState:()=>clone(state),errors,recovery,getVerifiedCalls:()=>verifiedCalls,getSnapshotCalls:()=>snapshotCalls,setState:v=>{state=clone(v);}};
}

(async()=>{
  {
    const h=harness({canWrite:false});
    const r=await h.service.run(async()=>{throw new Error('must not run');});
    assert.deepStrictEqual(r,{ok:false,reason:'read-only'});
  }

  {
    const h=harness();
    const r=await h.service.run(async()=>{h.setState({value:2});return false;});
    assert.strictEqual(r.reason,'mutation-rejected');
    assert.deepStrictEqual(h.getState(),{value:1});
  }

  {
    const h=harness({invariantResult:'prepaid-insufficient'});
    const r=await h.service.run(async()=>{h.setState({value:2});return true;});
    assert.strictEqual(r.reason,'prepaid-insufficient');
    assert.strictEqual(r.restored,true);
    assert.deepStrictEqual(h.getState(),{value:1});
    assert.strictEqual(h.errors.at(-1),'prepaid-insufficient');
    assert.strictEqual(h.getVerifiedCalls(),0);
  }

  {
    const h=harness({validationErrors:['bad']});
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.strictEqual(r.reason,'invalid-state');
    assert.deepStrictEqual(h.getState(),{value:1});
    assert.strictEqual(h.getSnapshotCalls(),0);
  }

  {
    const h=harness({snapshotResult:{ok:false,reason:'snap1-write-failed'}});
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.strictEqual(r.reason,'snap1-write-failed');
    assert.deepStrictEqual(h.getState(),{value:1});
    assert.strictEqual(h.getVerifiedCalls(),0);
  }

  {
    const h=harness({preview:true});
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.deepStrictEqual(r,{ok:true});
    assert.strictEqual(h.getSnapshotCalls(),0);
    assert.strictEqual(h.getVerifiedCalls(),1);
  }

  {
    const h=harness({verifiedResult:{ok:false,reason:'verify-failed',restored:true}});
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.strictEqual(r.reason,'verify-failed');
    assert.strictEqual(r.restored,true);
    assert.deepStrictEqual(h.getState(),{value:1});
  }

  {
    const h=harness();
    const r=await h.service.run(async()=>{});
    assert.deepStrictEqual(r,{ok:true,noop:true});
  }

  {
    const h=harness();
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.deepStrictEqual(r,{ok:true});
    assert.deepStrictEqual(h.getState(),{value:2});
  }

  {
    const h=harness();
    const r=await h.service.run(async()=>{h.setState({value:2});throw new Error('mutate boom');});
    assert.strictEqual(r.reason,'exception');
    assert.strictEqual(r.restored,false);
    assert.deepStrictEqual(h.getState(),{value:1});
  }

  {
    const h=harness({verifiedThrow:true,restoreResult:false});
    const r=await h.service.run(async()=>{h.setState({value:2});});
    assert.strictEqual(r.reason,'exception');
    assert.deepStrictEqual(h.getState(),{value:1});
    assert.strictEqual(h.recovery.length,1);
  }

  console.log('mutation-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
