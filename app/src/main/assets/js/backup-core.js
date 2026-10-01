(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadBackupCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function makeFinanceBackup(state,options){
    const opts=options||{};
    const fingerprint=opts.fingerprint;
    if(typeof fingerprint!=='function')throw new Error('fingerprint-required');
    return Object.assign({
      schemaVersion:Number(opts.schemaVersion),
      exportedAt:String(opts.exportedAt||new Date().toISOString()),
      integrity:{version:1,fingerprint:fingerprint(state)}
    },state||{});
  }

  function verifyFinanceIntegrity(data,fingerprint){
    if(!data||!data.integrity||!data.integrity.fingerprint)return {ok:true,legacy:true};
    if(typeof fingerprint!=='function')throw new Error('fingerprint-required');
    const expected=String(data.integrity.fingerprint);
    const actual=String(fingerprint(data));
    return {ok:actual===expected,legacy:false,expected,actual};
  }

  function makeFullBackup(options){
    const opts=options||{};
    const state=opts.state;
    const fingerprint=opts.fingerprint;
    if(typeof fingerprint!=='function')throw new Error('fingerprint-required');
    return {
      format:'SANAD_FULL_BACKUP',
      version:1,
      appVersion:String(opts.appVersion||''),
      exportedAt:String(opts.exportedAt||new Date().toISOString()),
      finance:Object.assign({},state||{},{
        integrity:{version:1,fingerprint:fingerprint(state)}
      }),
      features:opts.features||{},
      receipts:Array.isArray(opts.receipts)?opts.receipts:[]
    };
  }

  function validateFullEnvelope(data,fingerprint){
    if(!data||data.format!=='SANAD_FULL_BACKUP'||Number(data.version)!==1||!data.finance){
      throw new Error('not-full-backup');
    }
    const fp=data.finance.integrity&&data.finance.integrity.fingerprint;
    if(!fp||typeof fp!=='string')throw new Error('missing-integrity');
    if(typeof fingerprint!=='function')throw new Error('fingerprint-required');
    if(fingerprint(data.finance)!==fp)throw new Error('fingerprint-mismatch');
    if(!Array.isArray(data.receipts||[]))throw new Error('receipts-invalid');
    return {
      finance:data.finance,
      features:data.features&&typeof data.features==='object'?data.features:{},
      receipts:data.receipts||[]
    };
  }

  function validateReceiptDescriptors(receipts,validIds){
    const ids=validIds instanceof Set?validIds:new Set(validIds||[]);
    const seen=new Set();
    const out=[];
    for(const r of receipts||[]){
      if(!r||typeof r.txId!=='string'||!r.txId||!ids.has(r.txId)||seen.has(r.txId)||typeof r.data!=='string'){
        throw new Error('receipt-invalid');
      }
      seen.add(r.txId);
      out.push(r);
    }
    return out;
  }

  function parseJsonText(text){
    try{return JSON.parse(String(text));}
    catch(_){throw new Error('json-invalid');}
  }

  function prepareFinanceRestore(data,options){
    const opts=options||{};
    if(typeof opts.migrate!=='function')throw new Error('migrate-required');
    if(typeof opts.validateStateStrict!=='function')throw new Error('validate-state-required');
    let migrated;
    try{migrated=opts.migrate(data);}
    catch(err){
      const e=new Error('migration-failed');
      e.cause=err;
      throw e;
    }
    if(!migrated)throw new Error('migration-failed');
    const errors=opts.validateStateStrict(migrated)||[];
    if(errors.length){
      const e=new Error('schema-invalid');
      e.validationErrors=Array.from(errors);
      throw e;
    }
    return migrated;
  }

  function prepareFullRestore(data,options){
    const opts=options||{};
    const envelope=validateFullEnvelope(data,opts.fingerprint);
    const migrated=prepareFinanceRestore(envelope.finance,opts);
    const validIds=new Set((Array.isArray(migrated.transactions)?migrated.transactions:[])
      .map(t=>t&&t.id).filter(id=>typeof id==='string'&&id));
    const receiptDescriptors=validateReceiptDescriptors(envelope.receipts,validIds);
    return {migrated,features:envelope.features,receiptDescriptors};
  }

  return Object.freeze({
    makeFinanceBackup,
    verifyFinanceIntegrity,
    makeFullBackup,
    validateFullEnvelope,
    validateReceiptDescriptors,
    parseJsonText,
    prepareFinanceRestore,
    prepareFullRestore
  });
});
