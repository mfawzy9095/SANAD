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

console.log('backup-core regression tests: PASS');
