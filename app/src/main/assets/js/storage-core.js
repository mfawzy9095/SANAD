(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadStorageCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function fallbackClone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

  function createStorage(options){
    const opts=options||{};
    const dbName=String(opts.dbName||'sanad');
    const getIndexedDB=typeof opts.getIndexedDB==='function'?opts.getIndexedDB:function(){return typeof indexedDB!=='undefined'?indexedDB:null;};
    const clone=typeof opts.deepClone==='function'?opts.deepClone:fallbackClone;
    const isPreviewDeniedError=typeof opts.isPreviewDeniedError==='function'?opts.isPreviewDeniedError:function(){return false;};

    const IDBStorage={
      _db:null,
      _idb(){
        const idb=getIndexedDB();
        if(!idb)throw new Error('indexeddb unavailable');
        return idb;
      },
      open(){
        if(this._db)return Promise.resolve(this._db);
        return new Promise((res,rej)=>{
          let r;
          try{r=this._idb().open(dbName,1);}catch(e){rej(e);return;}
          r.onupgradeneeded=e=>{
            const d=e.target.result;
            if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'});
          };
          r.onsuccess=e=>{this._db=e.target.result;res(this._db);};
          r.onerror=()=>rej(r.error||new Error('idb open error'));
          r.onblocked=()=>rej(new Error('idb blocked'));
        });
      },
      close(){
        if(this._db){try{this._db.close();}catch(_){}this._db=null;}
      },
      async readState(){
        try{
          const db=await this.open();
          return await new Promise(resolve=>{
            let done=false;
            try{
              const tx=db.transaction('meta','readonly');
              const r=tx.objectStore('meta').get('state');
              r.onsuccess=()=>{if(!done){done=true;resolve({ok:true,state:r.result?r.result.v:null});}};
              r.onerror=()=>{if(!done){done=true;resolve({ok:false,reason:'corrupted',error:r.error});}};
              tx.onabort=()=>{if(!done){done=true;resolve({ok:false,reason:'corrupted',error:new Error('tx aborted')});}};
            }catch(e){if(!done){done=true;resolve({ok:false,reason:'corrupted',error:e});}}
          });
        }catch(e){return {ok:false,reason:'unavailable',error:e};}
      },
      async writeState(state){
        try{
          const db=await this.open();
          return await new Promise(resolve=>{
            let done=false;
            try{
              const tx=db.transaction('meta','readwrite');
              tx.objectStore('meta').put({k:'state',v:state,ts:Date.now()});
              tx.oncomplete=()=>{if(!done){done=true;resolve(true);}};
              tx.onerror=()=>{if(!done){done=true;resolve(false);}};
              tx.onabort=()=>{if(!done){done=true;resolve(false);}};
            }catch(e){if(!done){done=true;resolve(false);}}
          });
        }catch(e){return false;}
      },
      async writeSnapshot(name,state){
        try{
          const db=await this.open();
          return await new Promise(resolve=>{
            try{
              const tx=db.transaction('meta','readwrite');
              tx.objectStore('meta').put({k:'snap_'+name,v:state,ts:Date.now()});
              tx.oncomplete=()=>resolve(true);
              tx.onerror=()=>resolve(false);
              tx.onabort=()=>resolve(false);
            }catch(e){resolve(false);}
          });
        }catch(e){return false;}
      },
      async readSnapshot(name){
        try{
          const db=await this.open();
          return await new Promise(resolve=>{
            try{
              const r=db.transaction('meta','readonly').objectStore('meta').get('snap_'+name);
              r.onsuccess=()=>resolve(r.result?r.result.v:null);
              r.onerror=()=>resolve(null);
            }catch(e){resolve(null);}
          });
        }catch(e){return null;}
      },
      async listSnapshots(){
        try{
          const db=await this.open();
          return await new Promise(resolve=>{
            try{
              const r=db.transaction('meta','readonly').objectStore('meta').getAll();
              r.onsuccess=()=>{
                const all=r.result||[];
                resolve(all.filter(x=>x.k&&x.k.startsWith('snap_'))
                  .map(x=>({name:x.k.replace('snap_',''),ts:x.ts}))
                  .sort((a,b)=>(b.ts||0)-(a.ts||0)));
              };
              r.onerror=()=>resolve([]);
            }catch(e){resolve([]);}
          });
        }catch(e){return [];}
      },
      async rotateSnapshot(currentState){
        try{
          const s2=await this.readSnapshot('2');
          const s1=await this.readSnapshot('1');
          if(s2)await this.writeSnapshot('3',s2);
          if(s1)await this.writeSnapshot('2',s1);
          await this.writeSnapshot('1',currentState);
          return true;
        }catch(e){return false;}
      },
      async deleteDatabase(){
        this.close();
        return await new Promise(resolve=>{
          let req;
          try{req=this._idb().deleteDatabase(dbName);}catch(_){resolve(false);return;}
          req.onsuccess=()=>resolve(true);
          req.onerror=()=>resolve(false);
          req.onblocked=()=>resolve(false);
        });
      }
    };

    const MemoryStorage={
      _state:null,_snaps:{},
      _reset(){this._state=null;this._snaps={};},
      async readState(){return {ok:true,state:this._state};},
      async writeState(state){this._state=clone(state);return true;},
      async writeSnapshot(name,state){this._snaps[name]={v:clone(state),ts:Date.now()};return true;},
      async readSnapshot(name){const s=this._snaps[name];return s?clone(s.v):null;},
      async listSnapshots(){return Object.entries(this._snaps).map(([name,o])=>({name,ts:o.ts})).sort((a,b)=>(b.ts||0)-(a.ts||0));},
      async rotateSnapshot(currentState){
        const s2=this._snaps['2'],s1=this._snaps['1'];
        if(s2)this._snaps['3']=s2;
        if(s1)this._snaps['2']=s1;
        this._snaps['1']={v:clone(currentState),ts:Date.now()};
        return true;
      }
    };

    const facade={
      _backend:null,_impl:null,
      async init(){
        let idb=null;
        try{idb=getIndexedDB();}
        catch(e){
          if(isPreviewDeniedError(e))return this._useMemory();
          return {mode:'error',error:e};
        }
        if(!idb)return this._useMemory();
        try{
          await IDBStorage.open();
          this._backend='idb';this._impl=IDBStorage;
          return {mode:'idb'};
        }catch(e){
          if(isPreviewDeniedError(e))return this._useMemory();
          this._backend=null;this._impl=null;
          return {mode:'error',error:e};
        }
      },
      _useMemory(){this._backend='memory';this._impl=MemoryStorage;MemoryStorage._reset();return {mode:'memory'};},
      resetConnection(){IDBStorage.close();this._backend=null;this._impl=null;},
      isPreview(){return this._backend==='memory';},
      async readState(){if(!this._impl)return {ok:false,reason:'not-init'};return this._impl.readState();},
      async writeState(s){if(!this._impl)return false;return this._impl.writeState(s);},
      async writeSnapshot(n,s){if(!this._impl)return false;return this._impl.writeSnapshot(n,s);},
      async readSnapshot(n){if(!this._impl)return null;return this._impl.readSnapshot(n);},
      async listSnapshots(){if(!this._impl)return [];return this._impl.listSnapshots();},
      async rotateSnapshot(s){if(!this._impl)return false;return this._impl.rotateSnapshot(s);},
      async secureWipe(){
        if(this._backend==='memory'){MemoryStorage._reset();this._backend=null;this._impl=null;return true;}
        try{
          const ok=await IDBStorage.deleteDatabase();
          if(ok){this._backend=null;this._impl=null;}
          return ok;
        }catch(_){return false;}
      }
    };

    return facade;
  }

  return Object.freeze({createStorage});
});
