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
  assert.strictEqual(R.currentTxId({_sheet:'tx',id:7}),7);
  assert.strictEqual(R.currentTxId(null),null);

  const txs=[{id:'old'},{id:'new'}];
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old']),null,txs),'new');
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old']),'edit-1',txs),'edit-1');
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old']),7,txs),7);
  assert.strictEqual(R.resolveAttachmentTxId(new Set(['old','new']),null,txs),null);
  assert.strictEqual(R.resolveAttachmentTxId(['old'],null,txs),'new');
  assert.strictEqual(R.resolveAttachmentAfterSave(false,new Set(['old']),'edit-1',txs),null);
  assert.strictEqual(R.resolveAttachmentAfterSave(undefined,new Set(['old']),'edit-1',txs),null);
  assert.strictEqual(R.resolveAttachmentAfterSave(true,new Set(['old']),'edit-1',txs),'edit-1');
  assert.strictEqual(R.resolveAttachmentAfterSave(true,new Set(['old']),null,txs),'new');
  assert.strictEqual(R.resolveAttachmentAfterSave(false,new Set(['old']),null,txs),null);
})();

(async function receiptService(){
  const calls=[];
  const records=new Map([['t1',{txId:'t1',blob:{size:10},meta:{name:'old'}}]]);
  const storage={
    async getReceipt(id){calls.push(['get',id]);return records.get(id)||null;},
    async putReceipt(id,blob,meta){calls.push(['put',id,blob,meta]);records.set(id,{txId:id,blob,meta});return true;},
    async delReceipt(id){calls.push(['del',id]);records.delete(id);return true;}
  };
  const dirty=[];
  const service=R.createReceiptService({
    storage,
    markDirty:async(id,deleted)=>{dirty.push([id,deleted]);}
  });

  const existing=await service.get('t1');
  assert.strictEqual(existing.txId,'t1');
  assert.strictEqual(await service.get(null),null);

  const pending={blob:{size:20},meta:{name:'new'}};
  assert.strictEqual(await service.attach('t2',pending),true);
  assert.deepStrictEqual(dirty.pop(),['t2',false]);
  assert.strictEqual(records.get('t2').meta.name,'new');

  assert.strictEqual(await service.remove('t2'),true);
  assert.deepStrictEqual(dirty.pop(),['t2',true]);
  assert.strictEqual(records.has('t2'),false);

  assert.strictEqual(await service.attach(null,pending),false);
  assert.strictEqual(await service.remove(null),false);

  const failed=R.createReceiptService({
    storage:Object.assign({},storage,{putReceipt:async()=>false}),
    markDirty:async(id,deleted)=>{dirty.push([id,deleted]);}
  });
  const beforeDirty=dirty.length;
  assert.strictEqual(await failed.attach('t3',pending),false);
  assert.strictEqual(dirty.length,beforeDirty);

  assert.throws(()=>R.createReceiptService({storage:{}}),/receipt-storage-required/);
})().then(()=>{
  console.log('receipt-core regression tests: PASS');
}).catch(err=>{
  console.error(err);
  process.exitCode=1;
});
