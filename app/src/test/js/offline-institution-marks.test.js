'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'../../main/assets/index.html'),'utf8');
const ctx={esc:String,S:{settings:{language:'en'}},countryInfo:code=>({name:code}),UaeBankRegistryCore:require('../../main/assets/js/uae-bank-registry-core')};vm.createContext(ctx);
for(const [start,end] of [['function registryUiLang(){','function filterBankRegistryList('],['function providerLogoHtml(','function providerRegistryPickerHtml(']]){
 const from=html.indexOf(start),to=html.indexOf(end);
 assert(from>=0&&to>from,'Institution logo section must exist');
 vm.runInContext(html.slice(from,to),ctx);
}
for(const b of ctx.UaeBankRegistryCore.list())assert(!/https?:|<img/i.test(ctx.bankLogoHtml(b,24)),'bank picker must not request online favicons');
for(const p of ctx.UaeBankRegistryCore.listProviders())assert(!/https?:|<img/i.test(ctx.providerLogoHtml(p,24)),'wallet picker must work offline');
const egypt=ctx.bankRegistryOptions(null,'EGY'),uae=ctx.bankRegistryOptions(null,'UAE');
assert(egypt.includes('value="emirates-nbd-egypt"'),'Egypt picker offers the Egyptian legal issuer');
assert(!egypt.includes('value="emirates-nbd"'),'Egypt picker excludes the UAE legal issuer');
assert(uae.includes('value="emirates-nbd"'),'UAE picker offers the UAE legal issuer');
assert(!uae.includes('value="emirates-nbd-egypt"'),'UAE picker excludes the Egyptian legal issuer');
const egyptPicker=ctx.bankRegistryPickerHtml(null,'bank','EGY');
assert(egyptPicker.includes('data-bank-country="EGY"'),'Regional issuer country survives visible picker rendering');
console.log('Institution marks offline and Egyptian/UAE issuer pickers separated: PASS');
