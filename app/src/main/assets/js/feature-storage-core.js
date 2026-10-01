(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadFeatureStorageCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function fallbackClone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

  function createFeatureStorage(options){
    const opts=options||{};
    const dbName=String(opts.dbName||'sanad_features_v1');
    const clone=typeof opts.deepClone==='function'?opts.deepClone:fallbackClone;
    const getIndexedDB=typeof opts.getIndexedDB==='function'?opts.getIndexedDB:function(){return typeof indexedDB!=='undefined'?indexedDB:null;};
    const warn=typeof opts.warn==='function'?opts.warn:function(){};

    return {
      db:null,
      mode:'memory',
      memKV:new Map(),
      memReceipts:new Map(),

      async init(){
        let idb=null;
        try{idb=getIndexedDB();}catch(e){warn('SANAD feature DB fallback:',e);this.mode='memory';return {mode:this.mode};}
        if(!idb){this.mode='memory';return {mode:this.mode};}
        try{
          this.db=await new Promise((resolve,reject)=>{
            let req;
            try{req=idb.open(dbName,1);}catch(e){reject(e);return;}
            req.onupgradeneeded=()=>{
              const db=req.result;
              if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv',{keyPath:'key'});
              if(!db.objectStoreNames.contains('receipts'))db.createObjectStore('receipts',{keyPath:'txId'});
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error||new Error('feature db open failed'));
            req.onblocked=()=>reject(new Error('feature db blocked'));
          });
          this.mode='idb';
        }catch(e){
          warn('SANAD feature DB fallback:',e);
          this.db=null;
          this.mode='memory';
        }
        return {mode:this.mode};
      },

      async get(key,fallback=null){
        if(this.mode!=='idb'||!this.db)return this.memKV.has(key)?clone(this.memKV.get(key)):fallback;
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('kv','readonly');
            const r=tx.objectStore('kv').get(key);
            r.onsuccess=()=>resolve(r.result?clone(r.result.value):fallback);
            r.onerror=()=>reject(r.error);
          });
        }catch(_){return fallback;}
      },

      async set(key,value){
        if(this.mode!=='idb'||!this.db){this.memKV.set(key,clone(value));return true;}
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('kv','readwrite');
            tx.objectStore('kv').put({key,value:clone(value)});
            tx.oncomplete=()=>resolve(true);
            tx.onerror=()=>reject(tx.error);
            tx.onabort=()=>reject(tx.error||new Error('aborted'));
          });
        }catch(_){return false;}
      },

      async del(key){
        if(this.mode!=='idb'||!this.db){this.memKV.delete(key);return true;}
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('kv','readwrite');
            tx.objectStore('kv').delete(key);
            tx.oncomplete=()=>resolve(true);
            tx.onerror=()=>reject(tx.error);
          });
        }catch(_){return false;}
      },

      async putReceipt(txId,blob,meta){
        if(!txId||!blob)return false;
        const rec={txId,blob,meta:Object.assign({updatedAt:Date.now()},meta||{})};
        if(this.mode!=='idb'||!this.db){this.memReceipts.set(txId,rec);return true;}
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('receipts','readwrite');
            tx.objectStore('receipts').put(rec);
            tx.oncomplete=()=>resolve(true);
            tx.onerror=()=>reject(tx.error);
          });
        }catch(_){return false;}
      },

      async getReceipt(txId){
        if(this.mode!=='idb'||!this.db)return this.memReceipts.get(txId)||null;
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('receipts','readonly');
            const r=tx.objectStore('receipts').get(txId);
            r.onsuccess=()=>resolve(r.result||null);
            r.onerror=()=>reject(r.error);
          });
        }catch(_){return null;}
      },

      async delReceipt(txId){
        if(this.mode!=='idb'||!this.db){this.memReceipts.delete(txId);return true;}
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('receipts','readwrite');
            tx.objectStore('receipts').delete(txId);
            tx.oncomplete=()=>resolve(true);
            tx.onerror=()=>reject(tx.error);
          });
        }catch(_){return false;}
      },

      async listReceipts(){
        if(this.mode!=='idb'||!this.db)return Array.from(this.memReceipts.values());
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('receipts','readonly');
            const r=tx.objectStore('receipts').getAll();
            r.onsuccess=()=>resolve(r.result||[]);
            r.onerror=()=>reject(r.error);
          });
        }catch(_){return [];}
      },

      async replaceReceipts(records){
        records=Array.isArray(records)?records:[];
        if(this.mode!=='idb'||!this.db){
          const next=new Map();
          for(const rec of records){
            if(!rec||!rec.txId||!rec.blob)return false;
            next.set(rec.txId,rec);
          }
          this.memReceipts=next;
          return true;
        }
        try{
          return await new Promise((resolve,reject)=>{
            const tx=this.db.transaction('receipts','readwrite');
            const store=tx.objectStore('receipts');
            store.clear();
            for(const rec of records){
              if(!rec||!rec.txId||!rec.blob){tx.abort();return;}
              store.put(rec);
            }
            tx.oncomplete=()=>resolve(true);
            tx.onerror=()=>reject(tx.error);
            tx.onabort=()=>reject(tx.error||new Error('receipt replace aborted'));
          });
        }catch(_){return false;}
      },

      async pruneReceiptOrphans(validIds){
        const valid=validIds instanceof Set?validIds:new Set(validIds||[]);
        const all=await this.listReceipts();
        let removed=0;
        for(const rec of all){
          if(rec&&rec.txId&&!valid.has(rec.txId)){
            if(await this.delReceipt(rec.txId))removed++;
          }
        }
        return removed;
      },

      async secureWipe(){
        this.memKV.clear();
        this.memReceipts.clear();
        if(this.mode!=='idb'||!this.db){this.db=null;this.mode='memory';return true;}
        try{
          const idb=getIndexedDB();
          try{this.db.close();}catch(_){}
          this.db=null;
          if(!idb){this.mode='memory';return false;}
          const ok=await new Promise(resolve=>{
            let req;
            try{req=idb.deleteDatabase(dbName);}catch(_){resolve(false);return;}
            req.onsuccess=()=>resolve(true);
            req.onerror=()=>resolve(false);
            req.onblocked=()=>resolve(false);
          });
          if(ok)this.mode='memory';
          return ok;
        }catch(_){return false;}
      }
    };
  }

  return Object.freeze({createFeatureStorage});
});
