(function(root,factory){
  let registry=null;
  if(typeof module==='object'&&module.exports){registry=require('./uae-bank-registry-core.js');module.exports=factory(registry);}
  else{registry=root&&root.SanadUaeBankRegistryCore;if(root)root.SanadBankMessageCore=factory(registry);}
})(typeof globalThis!=='undefined'?globalThis:this,function(Banks){
  'use strict';
  if(!Banks)throw new Error('bank-registry-required');
  function latinDigits(value){return String(value==null?'':value).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));}
  function cleanText(value){return latinDigits(value).replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/\s+/g,' ').trim();}
  function amount(value){const n=Number(String(value==null?'':value).replace(/,/g,''));return Number.isFinite(n)?Math.round(n*100)/100:null;}
  function suffix(ref){const m=latinDigits(ref).match(/(\d{2,4})\D*$/);return m?m[1]:null;}
  function normalizeRef(ref){return latinDigits(ref).replace(/[^A-Za-z0-9*Xx]/g,'').toUpperCase();}
  function bankIdFrom(input,raw){
    if(input&&input.bankId&&Banks.get(input.bankId))return input.bankId;
    const hit=Banks.detect(((input&&input.title)||'')+' '+((input&&input.sender)||'')+' '+raw);
    return hit?hit.bank.id:null;
  }
  function categoryForMerchant(value){
    const x=String(value||'').toLowerCase();
    if(/pharmacy|medical|med cen|hospital|clinic|nmc|صيدلي|مستشف/.test(x))return 'health';
    if(/taxi|uber|careem|metro|rta|fuel|petrol/.test(x))return 'transport';
    if(/restaurant|chicken|caya|bakery|bakeires|cafe|coffee|starbucks|food/.test(x))return 'food';
    if(/grocery|union coop|carrefour|viva|mini mart|noon minutes|nownow/.test(x))return 'grocery';
    if(/du google|etisalat|e&|telecom|internet/.test(x))return 'bills';
    if(/adidas|temu|alibaba|xpressions|day to day|amazon|shopping/.test(x))return 'shopping';
    if(/laundry/.test(x))return 'home';
    return 'other';
  }
  function ignoredReason(raw){
    const x=cleanText(raw).toLowerCase();
    if(!x)return 'empty';
    if(/دفعة بطاقة تتطلب موافقتك|requires your approval|pending approval|authorization required/.test(x))return 'authorization-pending';
    if(/\botp\b|one time password|verification code|رمز التحقق|كلمة مرور لمرة/.test(x))return 'security-code';
    if(/تم استبدال.+nol payment|rewards? redemption|تم استبدال.+بنجاح/.test(x))return 'rewards-redemption';
    return null;
  }
  function result(base,input,raw){
    return Object.assign({recognized:true,eventId:input&&input.id?String(input.id):null,postedAt:Number(input&&input.postedAt)||Date.now(),
      bankId:base.bankId||bankIdFrom(input,raw),kind:base.kind,direction:base.direction||null,amount:Number(base.amount),
      currency:String(base.currency||'AED').toUpperCase(),merchant:base.merchant||'',category:base.category||'other',
      cardLast4:base.cardLast4||null,accountRef:base.accountRef||null,accountSuffix:base.accountSuffix||suffix(base.accountRef),
      availableBalance:base.availableBalance==null?null:Number(base.availableBalance),availableCredit:base.availableCredit==null?null:Number(base.availableCredit),
      raw:String(raw),confidence:Number(base.confidence||0.95)},base);
  }
  function parseEnbd(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/تم\s+خصم\s+مبلغ\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتسديد\s+مستحقات\s+بطاقتك\s+الائتمانية\s*(\d{4})/i);
    if(m)return result({bankId:'emirates-nbd',kind:'card_repayment',direction:'transfer',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),cardLast4:m[4],confidence:0.99},input,raw);
    m=x.match(/تمت\s+عملية\s+شراء\s+في\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+(.+?)\s+على\s+البطاقة\s+(\d{4})\s+الائتمان\s+المتوفر\s+([A-Za-z]{3})?\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],availableCredit:amount(m[6]),confidence:0.99},input,raw);}
    m=x.match(/تمت\s+عملية\s+شراء\s+بقيمة\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+لدى\s+(.+?)\s+باستخدام\s+بطاقة\s+خصم\s+تنتهي\s+ارقامها\s+ب[ـ]?\s*(\d{4}).*?الرصيد\s+المتوفر\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],availableBalance:amount(m[6]),confidence:0.99},input,raw);}
    m=x.match(/(?:لقد\s+)?تم\s+تحويل\s+مبلغ\s+([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})\s+باستخدام\s+بطاقة\s+الخصم.+?(\d{4})\s+لدى\s+(.+?)\.\s*رصيدك\s+الحالي\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[4].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[2],amount:amount(m[1]),merchant,category:categoryForMerchant(merchant),cardLast4:m[3],availableBalance:amount(m[6]),confidence:0.98},input,raw);}
    m=x.match(/تم\s+ايداع\s+الراتب\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'salary',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),category:'salary',confidence:0.99},input,raw);
    m=x.match(/(?:لقد\s+)?تم\s+ايداع\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+(?:رقم\s+)?حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'deposit',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),category:'other',confidence:0.98},input,raw);
    m=x.match(/تم\s+خصم\s+(?:مبلغ\s+)?([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتحويل\s+الاموال/i);
    if(m)return result({bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),category:'externalTransfer',confidence:0.97},input,raw);
    return null;
  }
  function parseGeneric(input,raw){
    const x=cleanText(raw),bankId=bankIdFrom(input,raw); let m=x.match(/(AED|USD|EUR|GBP|SAR|EGP|MAD)\s*([\d,]+(?:\.\d+)?)/i);
    let currency=null,value=null;
    if(m){currency=m[1].toUpperCase();value=amount(m[2]);}else{m=x.match(/([\d,]+(?:\.\d+)?)\s*(AED|USD|EUR|GBP|SAR|EGP|MAD)/i);if(m){value=amount(m[1]);currency=m[2].toUpperCase();}}
    if(!value||!currency)return null;
    const card=(x.match(/(?:card|بطاق\S*)\D{0,30}(\d{4})/i)||[])[1]||null;
    const acc=(x.match(/(?:account|حسابك|حساب)\s*[:.]?\s*([A-Za-z0-9Xx*]{2,30})/i)||[])[1]||null;
    if(/salary|راتب/.test(x.toLowerCase()))return result({bankId,kind:'salary',direction:'credit',amount:value,currency,accountRef:acc?normalizeRef(acc):null,category:'salary',confidence:bankId?0.88:0.78},input,raw);
    if(/deposit|credited|ايداع|اودع/.test(x.toLowerCase()))return result({bankId,kind:'deposit',direction:'credit',amount:value,currency,accountRef:acc?normalizeRef(acc):null,category:'other',confidence:bankId?0.85:0.75},input,raw);
    if(/purchase|pos|شراء|merchant/.test(x.toLowerCase())&&card)return result({bankId,kind:'purchase',direction:'debit',amount:value,currency,cardLast4:card,category:'other',confidence:bankId?0.82:0.72},input,raw);
    return null;
  }
  function parse(input){
    const raw=String((input&&input.text)||input||'').trim(),ignored=ignoredReason(raw);
    if(ignored)return {recognized:false,ignored:true,reason:ignored,raw};
    const obj=input&&typeof input==='object'?input:{};
    return parseEnbd(obj,raw)||parseGeneric(obj,raw)||{recognized:false,ignored:false,reason:'unrecognized',raw};
  }
  function institutionBankId(inst){if(!inst)return null;if(inst.bankRegistryId&&Banks.get(inst.bankRegistryId))return inst.bankRegistryId;const hit=Banks.detect(inst.name||'');return hit?hit.bank.id:null;}
  function refMatches(candidateRef,parsedRef,parsedSuffix){
    if(!candidateRef)return false;const c=normalizeRef(candidateRef),p=normalizeRef(parsedRef||'');if(p&&c===p)return true;const cs=suffix(c);
    if(parsedSuffix&&cs&&parsedSuffix===cs)return true;if(p&&c.length>=2&&p.endsWith(c))return true;return false;
  }
  function resolveRoute(parsed,state){
    const institutions=Array.isArray(state&&state.institutions)?state.institutions:[],accounts=Array.isArray(state&&state.accounts)?state.accounts:[],instruments=Array.isArray(state&&state.paymentInstruments)?state.paymentInstruments:[];
    const bankInstIds=new Set(institutions.filter(i=>!parsed.bankId||institutionBankId(i)===parsed.bankId).map(i=>i.id));
    const activeAccounts=accounts.filter(a=>a&&!a.archived&&a.country==='UAE'&&(!parsed.bankId||bankInstIds.has(a.institutionId)));
    let instrument=null,account=null,fromAccount=null,targetAccount=null;
    if(parsed.cardLast4){
      let cards=instruments.filter(i=>i&&!i.archived&&String(i.last4||'')===String(parsed.cardLast4));
      if(parsed.bankId){const filtered=cards.filter(i=>bankInstIds.has(i.institutionId)||bankInstIds.has((accounts.find(a=>a.id===i.accountId)||{}).institutionId));if(filtered.length)cards=filtered;}
      if(cards.length===1)instrument=cards[0];if(instrument)account=accounts.find(a=>a.id===instrument.accountId)||null;
    }
    if(parsed.accountRef||parsed.accountSuffix){const matches=activeAccounts.filter(a=>refMatches(a.bankRef||a.accountRef||a.accountLast4,parsed.accountRef,parsed.accountSuffix));if(matches.length===1)fromAccount=matches[0];}
    if(!fromAccount&&activeAccounts.length===1)fromAccount=activeAccounts[0];
    if(parsed.kind==='purchase'){if(account)return {status:'routed',account,instrument,confidence:instrument?0.99:0.80};if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:0.75};return {status:'needs-review',reason:'payment-source-not-found',confidence:0};}
    if(parsed.kind==='deposit'||parsed.kind==='salary'){if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:parsed.accountRef?0.95:0.78};return {status:'needs-review',reason:'account-not-found',confidence:0};}
    if(parsed.kind==='card_repayment'){targetAccount=account;if(fromAccount&&targetAccount&&targetAccount.type==='credit')return {status:'routed',fromAccount,targetAccount,instrument,confidence:0.99};return {status:'needs-review',reason:'repayment-route-not-found',fromAccount,targetAccount,instrument,confidence:0};}
    if(parsed.kind==='outgoing_transfer'){if(fromAccount)return {status:'needs-review',reason:'transfer-destination-required',fromAccount,confidence:0.90};return {status:'needs-review',reason:'transfer-source-not-found',confidence:0};}
    return {status:'needs-review',reason:'unsupported-kind',confidence:0};
  }
  function dedupeKey(parsed){return [parsed.bankId||'bank?',parsed.kind||'kind?',parsed.currency||'AED',Number(parsed.amount||0).toFixed(2),parsed.cardLast4||parsed.accountRef||parsed.accountSuffix||'source?',String(parsed.merchant||'').toLowerCase().replace(/\s+/g,' ').trim()].join('|');}
  function buildTransaction(parsed,route,options){
    const opts=options||{},date=opts.date||new Date(parsed.postedAt||Date.now()).toISOString().slice(0,10),id=typeof opts.uid==='function'?opts.uid('t'):('bank_'+Date.now()),key=dedupeKey(parsed);
    if(!route||route.status!=='routed')return {ok:false,reason:(route&&route.reason)||'route-required'};
    if(parsed.kind==='purchase'||parsed.kind==='deposit'||parsed.kind==='salary'){
      const account=route.account;if(!account)return {ok:false,reason:'account-required'};if(account.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      const type=parsed.kind==='purchase'?'expense':'income';
      return {ok:true,transaction:{id,type,amount:parsed.amount,currency:parsed.currency,accountId:account.id,instrumentId:route.instrument?route.instrument.id:null,walletAmount:parsed.amount,fxRate:1,cat:type==='income'?(parsed.kind==='salary'?'salary':'other'):(parsed.category||'other'),note:parsed.merchant||'',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null}};
    }
    if(parsed.kind==='card_repayment'){
      const from=route.fromAccount,to=route.targetAccount;if(!from||!to)return {ok:false,reason:'repayment-route-required'};if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'سداد بطاقة '+(parsed.cardLast4||''),tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null}};
    }
    return {ok:false,reason:'manual-review-required'};
  }
  return Object.freeze({parse,resolveRoute,buildTransaction,dedupeKey,categoryForMerchant,ignoredReason,suffix,normalizeRef});
});
