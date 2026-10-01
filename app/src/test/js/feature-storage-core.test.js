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


  const strictWarnings=[];
  const strictDenied=Core.createFeatureStorage({
    dbName:'features-test-strict',
    getIndexedDB:()=>{throw new Error('blocked-strict');},
    deepClone:clone,
    warn:(...args)=>strictWarnings.push(args),
    strictInitFailures:true
  });
  const strictResult=await strictDenied.init();
  assert.strictEqual(strictResult.mode,'error');
  assert.strictEqual(strictDenied.mode,'error');
  assert.ok(strictResult.error instanceof Error);
  assert.strictEqual(strictWarnings.length,1);
  assert.strictEqual(await strictDenied.get('security','fallback'),'fallback');
  assert.strictEqual(await strictDenied.set('security',{enabled:true}),false);
  assert.strictEqual(await strictDenied.del('security'),false);
  assert.strictEqual(await strictDenied.putReceipt('t1',{size:1},{}),false);
  assert.strictEqual(await strictDenied.getReceipt('t1'),null);
  assert.strictEqual(await strictDenied.delReceipt('t1'),false);
  assert.deepStrictEqual(await strictDenied.listReceipts(),[]);
  assert.strictEqual(await strictDenied.replaceReceipts([{txId:'t1',blob:{size:1}}]),false);
  assert.strictEqual(await strictDenied.pruneReceiptOrphans(new Set(['t1'])),0);
  assert.strictEqual(await strictDenied.secureWipe(),false);

  const strictOpenError=Core.createFeatureStorage({
    dbName:'features-test-open-error',
    getIndexedDB:()=>({open(){throw new Error('open-failed');}}),
    deepClone:clone,
    strictInitFailures:true
  });
  const openErrorResult=await strictOpenError.init();
  assert.strictEqual(openErrorResult.mode,'error');
  assert.strictEqual(strictOpenError.mode,'error');

  const strictPreview=Core.createFeatureStorage({
    dbName:'features-test-preview',
    getIndexedDB:()=>null,
    deepClone:clone,
    strictInitFailures:true
  });
  assert.deepStrictEqual(await strictPreview.init(),{mode:'memory'});
  assert.strictEqual(await strictPreview.set('x',{v:1}),true);
  assert.deepStrictEqual(await strictPreview.get('x'),{v:1});

  console.log('feature-storage-core regression tests: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
