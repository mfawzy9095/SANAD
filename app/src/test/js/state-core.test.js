'use strict';
const assert=require('assert');
const S=require('../../main/assets/js/state-core.js');

(function keyOrderIsDeterministic(){
  assert.strictEqual(S.stableStringify({b:2,a:1}),S.stableStringify({a:1,b:2}));
})();

(function idArraysAreOrderIndependent(){
  const a=[{id:'b',v:2},{id:'a',v:1}];
  const b=[{id:'a',v:1},{id:'b',v:2}];
  assert.strictEqual(S.stableStringify(a),S.stableStringify(b));
})();

(function primitiveArraysPreserveOrder(){
  assert.notStrictEqual(S.stableStringify([1,2]),S.stableStringify([2,1]));
})();

(function fingerprintUsesPersistentFinancialShapeOnly(){
  const base={
    schemaVersion:16,
    institutions:[],accounts:[{id:'a',type:'bank'}],paymentInstruments:[],
    transactions:[{id:'t',type:'income',amount:10}],beneficiaries:[],
    categories:{expense:[],income:[]},tags:[],recurring:[],settings:{theme:'light'}
  };
  const x=Object.assign({},base,{activeCountry:'UAE',tab:'home'});
  const y=Object.assign({},base,{activeCountry:'EGY',tab:'rep'});
  assert.strictEqual(S.stateFingerprint(x),S.stateFingerprint(y));
  const changed=JSON.parse(JSON.stringify(base));
  changed.transactions[0].amount=11;
  assert.notStrictEqual(S.stateFingerprint(base),S.stateFingerprint(changed));
})();

(function isoDates(){
  assert.strictEqual(S.isValidIsoDate('2026-02-28'),true);
  assert.strictEqual(S.isValidIsoDate('2026-02-29'),false);
  assert.strictEqual(S.isValidIsoDate('2024-02-29'),true);
  assert.strictEqual(S.isValidIsoDate('2026-2-01'),false);
})();

(function txSortDescending(){
  const tx=[
    {id:'a',date:'2026-10-01',created:100},
    {id:'b',date:'2026-10-02',created:10},
    {id:'c',date:'2026-10-01',created:200}
  ];
  tx.sort(S.compareTxDesc);
  assert.deepStrictEqual(tx.map(x=>x.id),['b','c','a']);
})();

(function fallbackTimeFromDate(){
  const v=S.txTimeValue({date:'2026-10-01'});
  assert.strictEqual(Number.isFinite(v)&&v>0,true);
  assert.strictEqual(S.txTimeValue({date:'bad'}),0);
})();

console.log('state-core regression tests: PASS');
