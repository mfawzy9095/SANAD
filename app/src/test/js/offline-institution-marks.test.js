'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'../../main/assets/index.html'),'utf8');
const ctx={esc:String,UaeBankRegistryCore:require('../../main/assets/js/uae-bank-registry-core')};vm.createContext(ctx);
for(const [start,end] of [['function bankLogoHtml(','function bankRegistryPickerHtml('],['function providerLogoHtml(','function providerRegistryPickerHtml(']])vm.runInContext(html.slice(html.indexOf(start),html.indexOf(end)),ctx);
for(const b of ctx.UaeBankRegistryCore.list())assert(!/https?:|<img/i.test(ctx.bankLogoHtml(b,24)),'bank picker must not request online favicons');
for(const p of ctx.UaeBankRegistryCore.listProviders())assert(!/https?:|<img/i.test(ctx.providerLogoHtml(p,24)),'wallet picker must work offline');
console.log('Institution marks have no remote image dependency: PASS');
