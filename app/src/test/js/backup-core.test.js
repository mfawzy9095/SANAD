'use strict';
const assert=require('assert');
const B=require('../../main/assets/js/backup-core.js');
const State=require('../../main/assets/js/state-core.js');

function state(){
  return {
    schemaVersion:16,
    institutions:[],
    accounts:[{id:'a',type:'bank'}],
    paymentInstruments:[],
    transactions:[{id:'t1',type:'income',amount:10}],
    beneficiaries:[],
    categories:{expense:[],income:[]},
    tags:[],
    recurring:[],
    settings:{}
  };
}

(function financeEnvelope(){
  const s=state();
  const b=B.makeFinanceBackup(s,{
    schemaVersion:16,
    exportedAt:'2026-10-01T00:00:00.000Z',
    fingerprint:State.stateFingerprint
  });
  assert.strictEqual(b.schemaVersion,16);
  assert.strictEqual(b.exportedAt,'2026-10-01T00:00:00.000Z');
  assert.strictEqual(b.integrity.version,1);
  assert.strictEqual(B.verifyFinanceIntegrity(b,State.stateFingerprint).ok,true);
  b.transactions[0].amount=11;
  assert.strictEqual(B.verifyFinanceIntegrity(b,State.stateFingerprint).ok,false);
})();

(function legacyFinanceBackup(){
  const s=state();
  const v=B.verifyFinanceIntegrity(s,State.stateFingerprint);
  assert.deepStrictEqual(v,{ok:true,legacy:true});
})();

(function fullEnvelope(){
  const s=state();
  const full=B.makeFullBackup({
    state:s,
    appVersion:'9.0.10',
    exportedAt:'2026-10-01T00:00:00.000Z',
    fingerprint:State.stateFingerprint,
    features:{family:{id:null}},
    receipts:[{txId:'t1',data:'data:image/jpeg;base64,AA=='}]
  });
  const checked=B.validateFullEnvelope(full,State.stateFingerprint);
  assert.strictEqual(checked.finance.transactions.length,1);
  assert.strictEqual(checked.receipts.length,1);
  assert.strictEqual(checked.features.family.id,null);
})();

(function corruptedFullBackup(){
  const s=state();
  const full=B.makeFullBackup({state:s,fingerprint:State.stateFingerprint});
  full.finance.transactions[0].amount=77;
  assert.throws(()=>B.validateFullEnvelope(full,State.stateFingerprint),/fingerprint-mismatch/);
})();

(function invalidEnvelope(){
  assert.throws(()=>B.validateFullEnvelope({},State.stateFingerprint),/not-full-backup/);
})();

(function receiptDescriptors(){
  const valid=new Set(['t1','t2']);
  const ok=B.validateReceiptDescriptors([
    {txId:'t1',data:'data:image/jpeg;base64,AA=='},
    {txId:'t2',data:'data:image/png;base64,AA=='}
  ],valid);
  assert.strictEqual(ok.length,2);
  assert.throws(()=>B.validateReceiptDescriptors([{txId:'missing',data:'x'}],valid),/receipt-invalid/);
  assert.throws(()=>B.validateReceiptDescriptors([{txId:'t1',data:'x'},{txId:'t1',data:'y'}],valid),/receipt-invalid/);
})();

(function jsonParsing(){
  assert.deepStrictEqual(B.parseJsonText('{"ok":true}'),{ok:true});
  assert.throws(()=>B.parseJsonText('{bad'),/json-invalid/);
})();

(function restorePreparation(){
  const s=state();
  const full=B.makeFullBackup({
    state:s,
    fingerprint:State.stateFingerprint,
    features:{family:{id:null}},
    receipts:[{txId:'t1',data:'data:image/jpeg;base64,AA=='}]
  });
  const prepared=B.prepareFullRestore(full,{
    fingerprint:State.stateFingerprint,
    migrate:x=>JSON.parse(JSON.stringify(x)),
    validateStateStrict:()=>[]
  });
  assert.strictEqual(prepared.migrated.transactions[0].id,'t1');
  assert.strictEqual(prepared.receiptDescriptors.length,1);
  assert.strictEqual(prepared.features.family.id,null);

  assert.throws(()=>B.prepareFullRestore(full,{
    fingerprint:State.stateFingerprint,
    migrate:()=>{throw new Error('boom');},
    validateStateStrict:()=>[]
  }),/migration-failed/);

  let schemaError=null;
  try{
    B.prepareFullRestore(full,{
      fingerprint:State.stateFingerprint,
      migrate:x=>x,
      validateStateStrict:()=>['bad-state']
    });
  }catch(e){schemaError=e;}
  assert(schemaError);
  assert.strictEqual(schemaError.message,'schema-invalid');
  assert.deepStrictEqual(schemaError.validationErrors,['bad-state']);
})();

(function financeRestoreValidation(){
  const s=state();
  const backup=B.makeFinanceBackup(s,{
    schemaVersion:16,
    fingerprint:State.stateFingerprint
  });
  const valid=B.validateFinanceRestoreInput(backup,{
    fingerprint:State.stateFingerprint,
    validateForImport:()=>[]
  });
  assert.strictEqual(valid.ok,true);

  const corrupt=JSON.parse(JSON.stringify(backup));
  corrupt.transactions[0].amount=999;
  const badIntegrity=B.validateFinanceRestoreInput(corrupt,{
    fingerprint:State.stateFingerprint,
    validateForImport:()=>[]
  });
  assert.strictEqual(badIntegrity.ok,false);
  assert.strictEqual(badIntegrity.reason,'fingerprint-mismatch');

  const badSchema=B.validateFinanceRestoreInput(backup,{
    fingerprint:State.stateFingerprint,
    validateForImport:()=>['bad import']
  });
  assert.strictEqual(badSchema.reason,'schema-invalid');
  assert.deepStrictEqual(badSchema.errors,['bad import']);

  const validatorCrash=B.validateFinanceRestoreInput(backup,{
    fingerprint:State.stateFingerprint,
    validateForImport:()=>{throw new Error('validator detail');}
  });
  assert.strictEqual(validatorCrash.reason,'validation-error');
  assert.deepStrictEqual(validatorCrash.errors,['validator detail']);
})();

(function financeRestorePreparation(){
  const s=state();
  const prepared=B.prepareFinanceRestore(s,{
    migrate:x=>Object.assign({},x,{schemaVersion:17}),
    validateStateStrict:()=>[]
  });
  assert.strictEqual(prepared.schemaVersion,17);

  let migrationError=null;
  try{
    B.prepareFinanceRestore(s,{
      migrate:()=>{throw new Error('migration detail');},
      validateStateStrict:()=>[]
    });
  }catch(e){migrationError=e;}
  assert(migrationError);
  assert.strictEqual(migrationError.message,'migration-failed');
  assert.strictEqual(migrationError.cause.message,'migration detail');

  let strictError=null;
  try{
    B.prepareFinanceRestore(s,{
      migrate:x=>x,
      validateStateStrict:()=>['strict failure']
    });
  }catch(e){strictError=e;}
  assert(strictError);
  assert.strictEqual(strictError.message,'schema-invalid');
  assert.deepStrictEqual(strictError.validationErrors,['strict failure']);
})();

(function v9010Compatibility(){
  function legacyStableStringify(obj){
    if(obj===null||obj===undefined)return JSON.stringify(obj);
    if(typeof obj!=='object')return JSON.stringify(obj);
    if(Array.isArray(obj)){
      const allHaveId=obj.length>0&&obj.every(x=>x&&typeof x==='object'&&'id' in x);
      const arr=allHaveId?[...obj].sort((a,b)=>String(a.id).localeCompare(String(b.id))):obj;
      return '['+arr.map(legacyStableStringify).join(',')+']';
    }
    const keys=Object.keys(obj).sort();
    return '{'+keys.map(k=>JSON.stringify(k)+':'+legacyStableStringify(obj[k])).join(',')+'}';
  }
  function v9010Fingerprint(st){
    return legacyStableStringify({
      schemaVersion:st.schemaVersion,
      institutions:st.institutions||[],
      accounts:st.accounts||[],
      paymentInstruments:st.paymentInstruments||[],
      transactions:st.transactions||[],
      beneficiaries:st.beneficiaries||[],
      categories:st.categories||{},
      tags:st.tags||[],
      recurring:st.recurring||[],
      settings:st.settings||{}
    });
  }

  const s=state();
  assert.strictEqual(State.stateFingerprint(s),v9010Fingerprint(s));

  const oldFinance=Object.assign({
    schemaVersion:16,
    exportedAt:'2026-10-01T01:30:00.000Z',
    integrity:{version:1,fingerprint:v9010Fingerprint(s)}
  },JSON.parse(JSON.stringify(s)));
  const financeCheck=B.validateFinanceRestoreInput(oldFinance,{
    fingerprint:State.stateFingerprint,
    validateForImport:()=>[]
  });
  assert.strictEqual(financeCheck.ok,true);
  const financePrepared=B.prepareFinanceRestore(oldFinance,{
    migrate:x=>JSON.parse(JSON.stringify(x)),
    validateStateStrict:()=>[]
  });
  assert.strictEqual(financePrepared.schemaVersion,16);
  assert.strictEqual(financePrepared.transactions[0].id,'t1');

  const oldFull={
    format:'SANAD_FULL_BACKUP',
    version:1,
    appVersion:'9.0.10',
    exportedAt:'2026-10-01T01:30:00.000Z',
    finance:Object.assign({},JSON.parse(JSON.stringify(s)),{
      integrity:{version:1,fingerprint:v9010Fingerprint(s)}
    }),
    features:{
      family:{id:null,name:'',members:[],sharedTxIds:[],pendingUnshareIds:[]},
      syncMeta:{dirty:true},
      firebaseConfig:null
    },
    receipts:[{txId:'t1',meta:{},data:'data:image/jpeg;base64,AA=='}]
  };
  const fullPrepared=B.prepareFullRestore(oldFull,{
    fingerprint:State.stateFingerprint,
    migrate:x=>JSON.parse(JSON.stringify(x)),
    validateStateStrict:()=>[]
  });
  assert.strictEqual(fullPrepared.migrated.schemaVersion,16);
  assert.strictEqual(fullPrepared.receiptDescriptors.length,1);
  assert.strictEqual(fullPrepared.receiptDescriptors[0].txId,'t1');
})();

console.log('backup-core regression tests: PASS');
