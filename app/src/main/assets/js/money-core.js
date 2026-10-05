(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SanadMoneyCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Explicit supported extraction table. Unknown currency precision is never guessed.
const digits={AED:2,EGP:2,USD:2,EUR:2,MAD:2,SAR:2,GBP:2,JPY:0,KRW:0,KWD:3,BHD:3,OMR:3,TND:3};
const MAX=1000000000000n; // maximum minor units accepted at the import boundary
function decimal(token,currency){
 const scale=digits[String(currency||'').toUpperCase()];if(scale==null)return {ok:false,reason:'currency-precision-unsupported'};
 let x=String(token==null?'':token).trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\u066b/g,'.').replace(/\u066c/g,',');
 if(!/^-?\d[\d.,]*$/.test(x))return {ok:false,reason:'invalid-money'};
 const negative=x.startsWith('-');if(negative)x=x.slice(1);
 if(x.includes('.')&&x.includes(',')){
  const decimalSep=x.lastIndexOf('.')>x.lastIndexOf(',')?'.':',',group=decimalSep==='.'?',':'.';
  const parts=x.split(decimalSep);if(parts.length!==2||!parts[1]||!new RegExp('^\\d{1,3}(?:\\'+group+'\\d{3})+$').test(parts[0]))return {ok:false,reason:'ambiguous-number'};
  x=parts[0].split(group).join('')+'.'+parts[1];
 }else if(x.includes(',')){
  if(/^\d+,\d{1,2}$/.test(x))x=x.replace(',','.');
  else return {ok:false,reason:'ambiguous-number'};
 }else if((x.match(/\./g)||[]).length>1)return {ok:false,reason:'ambiguous-number'};
 const [whole,fraction='']=x.split('.');if(fraction.length>scale)return {ok:false,reason:'money-overprecision'};
 let minor=BigInt(whole)*10n**BigInt(scale)+BigInt((fraction+'0'.repeat(scale)).slice(0,scale)||'0');if(negative)minor=-minor;
 if(minor>MAX||minor< -MAX)return {ok:false,reason:'money-out-of-range'};
 const canonical=(negative?'-':'')+whole+(fraction?'.'+fraction:'');
 return {ok:true,currency:String(currency).toUpperCase(),scale,minorUnits:String(minor),decimal:canonical,value:Number(minor)/10**scale};
}
function ledgerValue(value,currency){const v=decimal(String(value),currency);return v.ok&&v.scale===2?v:{ok:false,reason:v.reason||'ledger-currency-review'};}
function sum(values,currency){
 const scale=digits[String(currency||'').toUpperCase()];if(scale==null)return {ok:false,reason:'currency-precision-unsupported'};
 let total=0n;for(const value of values){const parsed=decimal(value,currency);if(!parsed.ok)return parsed;total+=BigInt(parsed.minorUnits);}
 if(total>MAX||total< -MAX)return {ok:false,reason:'money-out-of-range'};
 return {ok:true,currency:String(currency).toUpperCase(),scale,minorUnits:String(total),value:Number(total)/10**scale};
}
return Object.freeze({decimal,ledgerValue,sum,digits});
});
