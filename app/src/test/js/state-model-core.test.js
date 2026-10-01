'use strict';
const assert=require('assert');
const Core=require('../../main/assets/js/state-model-core.js');

const cats={expense:[{id:'food'}],income:[{id:'salary'}]};
const countries={UAE:{},EGY:{}};
const M=Core.createStateModel({
  schemaVersion:16,
  defaultCats:cats,
  countries,
  deepClone:v=>v==null?v:JSON.parse(JSON.stringify(v))
});

(function defaultsAreFresh(){
  const a=M.defaultState(),b=M.defaultState();
  assert.strictEqual(a.schemaVersion,16);
  assert.strictEqual(a.settings.language,'ar');
  a.categories.expense[0].id='changed';
  a.settings.lastFx.X=1;
  assert.strictEqual(b.categories.expense[0].id,'food');
  assert.deepStrictEqual(b.settings.lastFx,{});
})();

(function loadFallbacks(){
  const runtime={};
  M.loadStateInto(runtime,{
    schemaVersion:16,
    accounts:'bad',
    categories:{expense:null,income:[{id:'x'}]},
    settings:{defaultCountry:'NOPE',saving:null,lastFx:null}
  });
  assert.deepStrictEqual(runtime.accounts,[]);
  assert.deepStrictEqual(runtime.categories.expense,[]);
  assert.deepStrictEqual(runtime.categories.income,[{id:'x'}]);
  assert.strictEqual(runtime.settings.defaultCountry,'UAE');
  assert.strictEqual(runtime.activeCountry,'UAE');
  assert.deepStrictEqual(runtime.settings.saving,{amount:0,currency:'EGP',saved:0,targetDate:null});
  assert.deepStrictEqual(runtime.settings.lastFx,{});
})();

(function validCountryPreserved(){
  const runtime={};
  M.loadStateInto(runtime,{settings:{defaultCountry:'EGY'}});
  assert.strictEqual(runtime.activeCountry,'EGY');
})();

(function snapshotIsDeepCopy(){
  const runtime=M.defaultState();
  runtime.accounts.push({id:'a',nested:{x:1}});
  const snap=M.snapshotState(runtime);
  runtime.accounts[0].nested.x=9;
  assert.strictEqual(snap.accounts[0].nested.x,1);
  snap.settings.language='en';
  assert.strictEqual(runtime.settings.language,'ar');
})();

console.log('state-model-core regression tests: PASS');
