'use strict';
const assert=require('assert');
const Core=require('../../main/assets/js/feature-storage-core.js');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

(async()=>{
  const store=Core.createFeatureStorage({
    dbName:'features-test',
    getIndexedDB:()=>null,
    deepClone:clone
  });

  assert.deepStrictEqual(await store.init(),{mode:'memory'});
  assert.strictEqual(store.mode,'memory');

  const source={enabled:true,nested:{x:1}};
  assert.strictEqual(await store.set('security',source),true);
  source.nested.x=99;
  assert.deepStrictEqual(await store.get('security'),{enabled:true,nested:{x:1}});

  const read=await store.get('security');
  read.nested.x=77;
  assert.deepStrictEqual(await store.get('security'),{enabled:true,nested:{x:1}});

  assert.strictEqual(await store.get('missing','fallback'),'fallback');
  assert.strictEqual(await store.del('security'),true);
  assert.strictEqual(await store.get('security',null),null);

  const blob={fakeBlob:true,size:123};
  assert.strictEqual(await store.putReceipt('t1',blob,{name:'r1'}),true);
  assert.strictEqual(await store.putReceipt('',blob,{}),false);
  assert.strictEqual((await store.getReceipt('t1')).blob,blob);

  assert.strictEqual(await store.putReceipt('t2',{fakeBlob:true,size:50},{name:'r2'}),true);
  let receipts=await store.listReceipts();
  assert.deepStrictEqual(receipts.map(r=>r.txId).sort(),['t1','t2']);

  assert.strictEqual(await store.pruneReceiptOrphans(new Set(['t2'])),1);
  assert.strictEqual(await store.getReceipt('t1'),null);
  assert.ok(await store.getReceipt('t2'));

  assert.strictEqual(await store.replaceReceipts([
    {txId:'a',blob:{b:1},meta:{}},
    {txId:'b',blob:{b:2},meta:{}}
  ]),true);
  receipts=await store.listReceipts();
  assert.deepStrictEqual(receipts.map(r=>r.txId).sort(),['a','b']);

  const before=await store.listReceipts();
  assert.strictEqual(await store.replaceReceipts([{txId:'ok',blob:{b:1}},{txId:'bad'}]),false);
  assert.deepStrictEqual((await store.listReceipts()).map(r=>r.txId).sort(),before.map(r=>r.txId).sort(),
    'memory replacement must remain atomic on invalid input');

  await store.set('x',{v:1});
  assert.strictEqual(await store.secureWipe(),true);
  assert.strictEqual(await store.get('x',null),null);
  assert.deepStrictEqual(await store.listReceipts(),[]);

  const warnings=[];
  const denied=Core.createFeatureStorage({
    dbName:'features-test',
    getIndexedDB:()=>{throw new Error('blocked');},
    deepClone:clone,
    warn:(...args)=>warnings.push(args)
  });
  assert.deepStrictEqual(await denied.init(),{mode:'memory'});
  assert.strictEqual(warnings.length,1);

  console.log('feature-storage-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
