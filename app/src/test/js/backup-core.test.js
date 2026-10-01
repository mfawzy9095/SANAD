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

console.log('backup-core regression tests: PASS');
