'use strict';
const assert=require('assert');
const StorageCore=require('../../main/assets/js/storage-core.js');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

(async()=>{
  const storage=StorageCore.createStorage({
    dbName:'test',
    getIndexedDB:()=>null,
    deepClone:clone,
    isPreviewDeniedError:()=>false
  });
  assert.deepStrictEqual(await storage.init(),{mode:'memory'});
  assert.strictEqual(storage.isPreview(),true);

  const original={accounts:[{id:'a',balance:10}]};
  assert.strictEqual(await storage.writeState(original),true);
  original.accounts[0].balance=99;
  let read=await storage.readState();
  assert.strictEqual(read.ok,true);
  assert.strictEqual(read.state.accounts[0].balance,10);

  read.state.accounts[0].balance=77;
  read=await storage.readState();
  assert.strictEqual(read.state.accounts[0].balance,77,
    'memory readState intentionally matches legacy behavior and returns current in-memory state');

  await storage.writeSnapshot('1',{v:1});
  const snap=await storage.readSnapshot('1');
  snap.v=9;
  assert.deepStrictEqual(await storage.readSnapshot('1'),{v:1});

  await storage.rotateSnapshot({v:2});
  assert.deepStrictEqual(await storage.readSnapshot('1'),{v:2});
  assert.deepStrictEqual(await storage.readSnapshot('2'),{v:1});

  storage.resetConnection();
  assert.deepStrictEqual(await storage.readState(),{ok:false,reason:'not-init'});
  assert.deepStrictEqual(await storage.init(),{mode:'memory'});
  assert.deepStrictEqual(await storage.readState(),{ok:true,state:null});

  await storage.writeState({x:1});
  assert.strictEqual(await storage.secureWipe(),true);
  assert.deepStrictEqual(await storage.readState(),{ok:false,reason:'not-init'});

  const denied=new Error('denied');
  denied.name='SecurityError';
  const preview=StorageCore.createStorage({
    dbName:'test',
    getIndexedDB:()=>{throw denied;},
    deepClone:clone,
    isPreviewDeniedError:e=>e&&e.name==='SecurityError'
  });
  assert.deepStrictEqual(await preview.init(),{mode:'memory'});

  const generic=new Error('boom');
  const broken=StorageCore.createStorage({
    dbName:'test',
    getIndexedDB:()=>{throw generic;},
    deepClone:clone,
    isPreviewDeniedError:()=>false
  });
  const result=await broken.init();
  assert.strictEqual(result.mode,'error');
  assert.strictEqual(result.error,generic);

  console.log('storage-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
