(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadReceiptCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEFAULT_MAX_FILE_BYTES=15*1024*1024;
  const DEFAULT_MAX_DIMENSION=1600;

  function validateFile(file,maxBytes=DEFAULT_MAX_FILE_BYTES){
    if(!file)return {ok:false,reason:'missing'};
    const type=String(file.type||'');
    if(!type.startsWith('image/'))return {ok:false,reason:'type'};
    const size=Number(file.size)||0;
    if(size>maxBytes)return {ok:false,reason:'size'};
    return {ok:true};
  }

  function compressionDimensions(width,height,maxDimension=DEFAULT_MAX_DIMENSION){
    const w0=Math.max(1,Number(width)||1);
    const h0=Math.max(1,Number(height)||1);
    const max=Math.max(1,Number(maxDimension)||DEFAULT_MAX_DIMENSION);
    const scale=Math.min(1,max/Math.max(w0,h0));
    return {
      scale,
      width:Math.max(1,Math.round(w0*scale)),
      height:Math.max(1,Math.round(h0*scale))
    };
  }

  function makeMeta(file,blob,now){
    const t=Number(now)||Date.now();
    return {
      name:String((file&&file.name)||'receipt.jpg'),
      type:String((blob&&blob.type)||'image/jpeg'),
      size:Number(blob&&blob.size)||0,
      updatedAt:t
    };
  }

  function sizeLabel(bytes){
    return Math.max(1,Math.round((Number(bytes)||0)/1024))+' KB';
  }

  function currentTxId(form){
    if(!form||!['tx','transfer'].includes(form._sheet))return null;
    return form.id||null;
  }

  function resolveAttachmentTxId(beforeIds,editId,transactions){
    if(editId)return editId;
    const ids=beforeIds instanceof Set?beforeIds:new Set(beforeIds||[]);
    const list=Array.isArray(transactions)?transactions:[];
    const found=list.find(t=>t&&!ids.has(t.id));
    return found?found.id:null;
  }

  function resolveAttachmentAfterSave(saveSucceeded,beforeIds,editId,transactions){
    if(saveSucceeded!==true)return null;
    return resolveAttachmentTxId(beforeIds,editId,transactions);
  }

  function createReceiptService(options){
    const opts=options||{};
    const storage=opts.storage;
    const markDirty=typeof opts.markDirty==='function'?opts.markDirty:async()=>{};
    if(!storage||typeof storage.getReceipt!=='function'||typeof storage.putReceipt!=='function'||typeof storage.delReceipt!=='function'){
      throw new Error('receipt-storage-required');
    }
    return Object.freeze({
      async get(txId){
        return txId?storage.getReceipt(txId):null;
      },
      async remove(txId){
        if(!txId)return false;
        await storage.delReceipt(txId);
        await markDirty(txId,true);
        return true;
      },
      async attach(txId,pending){
        if(!txId||!pending||!pending.blob)return false;
        const ok=await storage.putReceipt(txId,pending.blob,pending.meta);
        if(!ok)return false;
        await markDirty(txId,false);
        return true;
      }
    });
  }

  return Object.freeze({
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_DIMENSION,
    validateFile,
    compressionDimensions,
    makeMeta,
    sizeLabel,
    currentTxId,
    resolveAttachmentTxId,
    resolveAttachmentAfterSave,
    createReceiptService
  });
});
