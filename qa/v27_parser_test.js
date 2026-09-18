const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;
global.DAY=86400000;
global.N=s=>String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
global.Cur={valid:c=>['AED','SAR','USD','EUR','GBP','EGP','MAD'].includes(String(c||'').toUpperCase())};
global.detCur=s=>{s=N(s);if(/درهم/.test(s))return'AED';if(/ريال/.test(s))return'SAR';if(/دولار/.test(s))return'USD';if(/يورو/.test(s))return'EUR';if(/جنيه/.test(s))return'EGP';return null;};
global.bankDateFromText=function(){return null;};
global.bankAmountFromExplicitTransaction=function(){return null;};
global.UI={sheet:null,stack:[{r:'home',p:{}}],openRow:null};
global.closeSheet=()=>{UI.sheet=null;};
global.back=()=>{if(UI.stack.length>1)UI.stack.pop();};
global.tab=r=>{UI.stack=[{r,p:{}}];};
global.render=()=>{};
global.finishVoice=()=>{};
global.voiceNativeActive=false;global.voiceAwaitingResult=false;
vm.runInThisContext(fs.readFileSync('app/src/main/assets/v27_fixes.js','utf8'),{filename:'v27_fixes.js'});

let a=bankAmountFromExplicitTransaction('Your card AED 125.50 was debited at CARREFOUR');
assert(a&&a.amount===125.50&&a.currency==='AED');
a=bankAmountFromExplicitTransaction('تم خصم مبلغ 42.50 درهم من بطاقتك');
assert(a&&a.amount===42.50&&a.currency==='AED');
assert.strictEqual(bankAmountFromExplicitTransaction('Minimum due AED 500 on your statement'),null);

let ref=new Date('2026-09-18T18:00:00+04:00').getTime();
let d=bankDateFromText('Purchase on 18-Sep-26 at 14:30',ref);
assert(d&&d.startsWith('2026-09-18T14:30:00'));
d=bankDateFromText('عملية شراء بتاريخ 18/09/2026 الساعة 14:30',ref);
assert(d&&d.startsWith('2026-09-18T14:30:00'));
ref=new Date('2026-12-31T12:00:00+04:00').getTime();
d=bankDateFromText('purchase 01/01 10:15',ref);
assert(d&&d.startsWith('2027-01-01T10:15:00'));

UI.sheet='cur'; assert.strictEqual(window.sanadHandleAndroidBack(),true); assert.strictEqual(UI.sheet,null);
UI.stack=[{r:'home',p:{}},{r:'details',p:{}}]; assert.strictEqual(window.sanadHandleAndroidBack(),true); assert.strictEqual(UI.stack.length,1);
UI.stack=[{r:'transactions',p:{}}]; assert.strictEqual(window.sanadHandleAndroidBack(),true); assert.strictEqual(UI.stack[0].r,'home');
console.log('V2.7 JavaScript QA passed');