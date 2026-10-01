'use strict';
const assert=require('assert');
const R=require('../../main/assets/js/receipt-core.js');

(function validation(){
  assert.deepStrictEqual(R.validateFile(null),{ok:false,reason:'missing'});
  assert.deepStrictEqual(R.validateFile({type:'text/plain',size:10}),{ok:false,reason:'type'});
  assert.deepStrictEqual(R.validateFile({type:'image/jpeg',size:15*1024*1024+1}),{ok:false,reason:'size'});
  assert.deepStrictEqual(R.validateFile({type:'image/png',size:100}),{ok:true});
})();

(function dimensions(){
  assert.deepStrictEqual(R.compressionDimensions(800,600),{scale:1,width:800,height:600});
  const d=R.compressionDimensions(3200,1600);
  assert.strictEqual(d.scale,0.5);
  assert.strictEqual(d.width,1600);
  assert.strictEqual(d.height,800);
  const portrait=R.compressionDimensions(1000,3000);
  assert.strictEqual(portrait.width,533);
  assert.strictEqual(portrait.height,1600);
})();

(function metaAndLabel(){
  const m=R.makeMeta({name:'x.png'},{type:'image/jpeg',size:2048},12345);
  assert.deepStrictEqual(m,{name:'x.png',type:'image/jpeg',size:2048,updatedAt:12345});
  assert.strictEqual(R.sizeLabel(2048),'2 KB');
  assert.strictEqual(R.sizeLabel(0),'1 KB');
})();

(function txIdentity(){
  assert.strictEqual(R.currentTxId({_sheet:'tx',id:'t1'}),'t1');
  assert.strictEqual(R.currentTxId({_sheet:'transfer',id:'xfer1'}),'xfer1');
  assert.strictEqual(R.currentTxId({_sheet:'account',id:'a1'}),null);
  assert.strictEqual(R.currentTxId({_sheet:'tx',id:''}),null);
  assert.strictEqual(R.currentTxId(null),null);

  const txs=[{id:'old'},{id:'new'}];
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old']),null,txs),'new');
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old']),'edit-1',txs),'edit-1');
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old','new']),null,txs),null);
  assert.strictEqual(R.resolveAttachmentTxId(['old'],null,txs),'new');
})();

console.log('receipt-core regression tests: PASS');
