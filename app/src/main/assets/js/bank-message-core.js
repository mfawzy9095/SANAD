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
  function availableBalanceFromText(x){
    const m=String(x||'').match(/الرصيد\s+المتوفر\s+هو\s+([A-Za-z]{3})\s*(-?[\d,]+(?:\.\d+)?)/i);
    return m?amount(m[2]):null;
  }
  function identifierMatch(packageName,entity){
    const pkg=String(packageName||'').toLowerCase();
    if(!pkg||!entity)return false;
    const segments=pkg.split(/[^a-z0-9]+/).filter(Boolean);
    const compactPkg=segments.join('');
    const aliases=[entity.name].concat(entity.aliases||[]);
    return aliases.some(alias=>{
      const a=Banks.normalize(alias).replace(/\s+/g,'');
      if(a.length>=5&&compactPkg.includes(a))return true;
      return a.length>=3&&segments.includes(a);
    });
  }
  function bankIdFrom(input,raw){
    if(input&&input.bankId&&Banks.get(input.bankId))return input.bankId;
    const hit=Banks.detect(((input&&input.title)||'')+' '+((input&&input.sender)||'')+' '+raw);
    if(hit)return hit.bank.id;
    const pkg=input&&input.packageName;
    if(pkg&&Array.isArray(Banks.BANKS)){
      const byPkg=Banks.BANKS.find(b=>identifierMatch(pkg,b));
      if(byPkg)return byPkg.id;
    }
    return null;
  }
  function providerIdFrom(input,raw){
    if(input&&input.providerId&&Banks.getProvider&&Banks.getProvider(input.providerId))return input.providerId;
    const hit=Banks.detectProvider?Banks.detectProvider(((input&&input.title)||'')+' '+((input&&input.sender)||'')+' '+raw):null;
    if(hit)return hit.provider.id;
    const pkg=input&&input.packageName;
    if(pkg&&Array.isArray(Banks.PAYMENT_PROVIDERS)){
      const byPkg=Banks.PAYMENT_PROVIDERS.find(p=>identifierMatch(pkg,p));
      if(byPkg)return byPkg.id;
    }
    return null;
  }
  function isoDateFromDmy(value){
    const m=latinDigits(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!m)return null;
    const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
    if(y<2000||mo<1||mo>12||d<1||d>31)return null;
    return String(y)+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function categoryForMerchant(value){
    const x=String(value||'').toLowerCase();
    if(/pharmacy|medical|med cen|hospital|clinic|nmc|parla|صيدلي|مستشف/.test(x))return 'health';
    if(/taxi|uber|careem|metro|rta|fuel|petrol/.test(x))return 'transport';
    if(/cafe|cafet|cafeteria|coffee|starbucks/.test(x))return 'cafe';
    if(/restaurant|restauran|chicken|caya|bakery|bakeires|mandi|burger|sweets|cake|noon food|food/.test(x))return 'food';
    if(/grocery|union coop|carrefour|viva|mini mart|hyperma|hypermarket|noon minutes|nownow|souq al madina/.test(x))return 'grocery';
    if(/du google|etisalat|e&|telecom|internet|contabo/.test(x))return 'bills';
    if(/adidas|temu|alibaba|xpressions|day to day|amazon|shopping|discounts cen/.test(x))return 'shopping';
    if(/platinumlist|cinema|entertainment/.test(x))return 'fun';
    if(/laundry/.test(x))return 'home';
    return 'other';
  }
  function ignoredReason(raw){
    const x=cleanText(raw).toLowerCase();
    if(!x)return 'empty';
    if(/دفعة بطاقة تتطلب موافقتك|requires your approval|pending approval|authorization required/.test(x))return 'authorization-pending';
    if(/\botp\b|one time password|verification code|رمز التحقق|كلمة مرور لمرة/.test(x))return 'security-code';
    if(/تم استبدال.+nol payment|rewards? redemption|تم استبدال.+بنجاح/.test(x))return 'rewards-redemption';
    if(/credit card mini statement|minimum amount due|amount to be paid to avoid charges/.test(x))return 'card-statement';
    if(/was declined|declined due to|transaction declined|تم رفض|عملية مرفوض/.test(x))return 'declined-transaction';
    if(/نود تاكيد\s+استلام\s+دفعة.+عن\s+البطاقة\s+الائتمانية/.test(x))return 'card-payment-ack';
    if(/has been suspended|has been resumed|request to freeze|successfully reactivated|registered.+google pay|suspended from google pay|resumed to google pay|suspended from merchant|resumed to merchant|تم تسجيل بطاقتك.+google pay/.test(x))return 'card-status';
    return null;
  }
  function result(base,input,raw){
    return Object.assign({recognized:true,ignored:false,eventId:input&&input.id?String(input.id):null,postedAt:Number(input&&input.postedAt)||Date.now(),
      bankId:base.bankId||bankIdFrom(input,raw),providerId:base.providerId||providerIdFrom(input,raw),kind:base.kind,direction:base.direction||null,amount:Number(base.amount),
      currency:String(base.currency||'AED').toUpperCase(),merchant:base.merchant||'',category:base.category||'other',
      cardLast4:base.cardLast4||null,accountRef:base.accountRef||null,accountSuffix:base.accountSuffix||suffix(base.accountRef),
      transactionRef:base.transactionRef||null,transactionDate:base.transactionDate||null,beneficiaryName:base.beneficiaryName||null,
      sourceHint:base.sourceHint||[input&&input.title,input&&input.sender,input&&input.packageName].filter(Boolean).join(' ').trim(),
      fee:base.fee==null?0:Number(base.fee),vat:base.vat==null?0:Number(base.vat),
      availableBalance:base.availableBalance==null?null:Number(base.availableBalance),availableCredit:base.availableCredit==null?null:Number(base.availableCredit),
      raw:String(raw),confidence:Number(base.confidence||0.95)},base);
  }
  function parseEnbd(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/تم\s+خصم\s+مبلغ\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتسديد\s+مستحقات\s+بطاقتك\s+الائتمانية\s*(\d{4})/i);
    if(m)return result({bankId:'emirates-nbd',kind:'card_repayment',direction:'transfer',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),cardLast4:m[4],confidence:0.99},input,raw);
    m=x.match(/تمت\s+عملية\s+شراء\s+في\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+(.+?)\s+على\s+البطاقة\s+(\d{4})\s+الائتمان\s+المتوفر\s+([A-Za-z]{3})?\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],cardType:'credit_card',availableCredit:amount(m[6]),confidence:0.99},input,raw);}
    m=x.match(/تمت\s+عملية\s+شراء\s+بقيمة\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+لدى\s+(.+?)\s+باستخدام\s+بطاقة\s+خصم\s+تنتهي\s+ارقامها\s+ب[ـ]?\s*(\d{4}).*?الرصيد\s+المتوفر\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],cardType:'debit_card',availableBalance:amount(m[6]),confidence:0.99},input,raw);}
    m=x.match(/(?:لقد\s+)?تم\s+تحويل\s+مبلغ\s+([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})\s+باستخدام\s+بطاقة\s+الخصم.+?(\d{4})\s+لدى\s+(.+?)\.\s*رصيدك\s+الحالي\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[4].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[2],amount:amount(m[1]),merchant,category:categoryForMerchant(merchant),cardLast4:m[3],cardType:'debit_card',availableBalance:amount(m[6]),confidence:0.98},input,raw);}
    m=x.match(/تم\s+ايداع\s+الراتب\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'salary',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),availableBalance:availableBalanceFromText(x),category:'salary',confidence:0.99},input,raw);
    m=x.match(/(?:لقد\s+)?تم\s+ايداع\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+(?:رقم\s+)?حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'deposit',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),availableBalance:availableBalanceFromText(x),category:'other',confidence:0.98},input,raw);
    m=x.match(/تم\s+خصم\s+(?:مبلغ\s+)?([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتحويل\s+الاموال/i);
    if(m)return result({bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),category:'externalTransfer',confidence:0.97},input,raw);
    return null;
  }
  function parseArabicCreditCard(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/عملية\s+دفع\s+ببطاقة\s+الائتمان\s+المنتهية\s+بالرقم\s*:\s*(\d{4})\s+لدى\s*:\s*(.+?)\s+المبلغ\s*:\s*([A-Za-z]{3})\s*(-?[\d,]+(?:\.\d+)?)\s+التاريخ\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2})\s+الحد\s+المتوفر\s*:\s*(-?[\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})/i);
    if(m){
      const merchant=m[2].replace(/\s+/g,' ').trim();
      return result({kind:'purchase',direction:'debit',cardLast4:m[1],cardType:'credit_card',merchant,category:categoryForMerchant(merchant),
        currency:m[3],amount:amount(m[4]),transactionDate:isoDateFromDmy(m[5]),transactionTime:m[6],
        availableCredit:amount(m[7]),confidence:0.99},input,raw);
    }
    return null;
  }
  function parseDuPay(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/your\s+request\s+to\s+transfer\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+to\s+(.+?)\s+is\s+successfully\s+processed.+?\bTID\s*:\s*([A-Za-z0-9_-]+)/i);
    if(m)return result({providerId:'du-pay',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),beneficiaryName:m[3].trim(),transactionRef:m[4],category:'externalTransfer',confidence:0.99},input,raw);
    m=x.match(/you(?:'|’)?ve\s+received\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+to\s+your\s+du\s*pay\s+wallet\.\s+your\s+available\s+balance\s+is\s+now\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?).+?transaction\s+id\s+is\s*:\s*([A-Za-z0-9_-]+)/i);
    if(m)return result({providerId:'du-pay',kind:'deposit',direction:'credit',currency:m[1],amount:amount(m[2]),availableBalance:amount(m[4]),transactionRef:m[5],category:'other',confidence:0.99},input,raw);
    m=x.match(/your\s+du\s*pay\s+card\s+ending\s+in\s+(\d{4})\s+has\s+been\s+used\s+for\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+at\s+(.+?)\.\s+your\s+available\s+balance\s+is\s+now\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+and\s+your\s+transaction\s+id\s+is\s+([A-Za-z0-9_-]+)\.?(?:\s+fee\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?),\s*vat\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?))?/i);
    if(m){
      const merchant=m[4].trim();
      return result({providerId:'du-pay',kind:'purchase',direction:'debit',cardLast4:m[1],cardType:'wallet_card',currency:m[2],amount:amount(m[3]),merchant,category:categoryForMerchant(merchant),
        availableBalance:amount(m[6]),transactionRef:m[7],fee:amount(m[9]||0),vat:amount(m[11]||0),confidence:0.99},input,raw);
    }
    m=x.match(/you\s+have\s+successfully\s+withdrawn\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+from\s+your\s+du\s*pay\s+wallet\..+?transaction\s+id\s*:\s*([A-Za-z0-9_-]+)\s+available\s+balance\s*:\s*([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m)return result({providerId:'du-pay',kind:'cash_withdrawal',direction:'debit',currency:m[1],amount:amount(m[2]),transactionRef:m[3],availableBalance:amount(m[5]),category:'other',confidence:0.99},input,raw);
    return null;
  }
  function parseGeneric(input,raw){
    const x=cleanText(raw),bankId=bankIdFrom(input,raw),providerId=providerIdFrom(input,raw);
    const sourceKnown=!!(bankId||providerId);
    let m=x.match(/(AED|USD|EUR|GBP|SAR|EGP|MAD)\s*([\d,]+(?:\.\d+)?)/i);
    let currency=null,value=null;
    if(m){currency=m[1].toUpperCase();value=amount(m[2]);}
    else{m=x.match(/([\d,]+(?:\.\d+)?)\s*(AED|USD|EUR|GBP|SAR|EGP|MAD)/i);if(m){value=amount(m[1]);currency=m[2].toUpperCase();}}
    if(!value||!currency)return null;
    const card=(x.match(/(?:card|بطاق\S*)\D{0,40}(\d{4})/i)||[])[1]||null;
    const accToken=(x.match(/(?:account|حسابك|حساب)\s*[:.]?\s*([A-Za-z0-9Xx*]{2,30})/i)||[])[1]||null;
    const acc=accToken&&/[0-9Xx*]/.test(accToken)?accToken:null;
    let cardType=null;
    if(/credit\s+card|بطاق\S*\s+الائتمان/i.test(x))cardType='credit_card';
    else if(/debit\s+card|بطاق\S*\s+الخصم/i.test(x))cardType='debit_card';
    else if(/wallet\s+card|بطاق\S*\s+محفظ/i.test(x))cardType='wallet_card';
    else if(providerId&&card)cardType='wallet_card';
    let merchant='';
    let mm=x.match(/\bat\s+(.+?)(?=\s+(?:on\s+your|using|your\s+available|available\s+balance|transaction\s+id|amount\b)|$)/i);
    if(!mm)mm=x.match(/لدى\s+(.+?)(?=\s+(?:باستخدام|المبلغ|الرصيد|التاريخ)|$)/i);
    if(mm)merchant=mm[1].replace(/\s+/g,' ').trim();
    let availableBalance=null,availableCredit=null,beneficiaryName='';
    const balMatch=x.match(/(?:available\s+balance(?:\s+is|\s*:)?|current\s+balance(?:\s+is|\s*:)?|الرصيد\s+(?:المتوفر|الحالي)\s*(?:هو|:)?)[^A-Za-z0-9-]*([A-Za-z]{3})?\s*(-?[\d,]+(?:\.\d+)?)/i);
    if(balMatch)availableBalance=amount(balMatch[2]);
    const creditMatch=x.match(/(?:available\s+credit|available\s+limit|الحد\s+المتوفر)\s*(?:is|هو|:)?[^A-Za-z0-9-]*([A-Za-z]{3})?\s*(-?[\d,]+(?:\.\d+)?)/i);
    if(creditMatch)availableCredit=amount(creditMatch[2]);
    let bm=x.match(/(?:transfer(?:red)?|sent)(?:\s+(?:amount\s+of\s+)?)?(?:[A-Za-z]{3}\s*[\d,.]+\s+)?to\s+(.+?)(?=\s+(?:is\s+successfully|was\s+successful|reference|ref\b|tid\b|transaction\s+id|available\s+balance)|[.;]|$)/i);
    if(!bm)bm=x.match(/(?:تحويل|حول)(?:\s+مبلغ)?(?:\s+[\d,.]+\s*[A-Za-z]{3})?\s+(?:الى|إلى)\s+(.+?)(?=\s+(?:بنجاح|الرقم\s+المرجعي|مرجع|الرصيد)|[.;]|$)/i);
    if(bm)beneficiaryName=bm[1].replace(/\s+/g,' ').trim();
    let transactionRef=null,transactionDate=null;
    const refMatch=x.match(/\b(?:transaction\s*(?:id|reference)|reference(?:\s+number)?|ref|tid)\b\s*[:#-]?\s*([A-Za-z0-9-]{4,40})/i);
    if(refMatch)transactionRef=refMatch[1];
    const dateMatch=x.match(/(?:date\s*[:.-]?\s*|\bon\s+)?(\d{1,2}\/\d{1,2}\/\d{4})\b/i);
    if(dateMatch)transactionDate=isoDateFromDmy(dateMatch[1]);
    const base={bankId,providerId,amount:value,currency,cardLast4:card,cardType,accountRef:acc?normalizeRef(acc):null,merchant,availableBalance,availableCredit,beneficiaryName,transactionRef,transactionDate};
    if(/salary|payroll|راتب/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'salary',direction:'credit',category:'salary',confidence:sourceKnown?0.90:0.76}),input,raw);
    if(/refund|refunded|reversal|reversed|استرداد|مرتجع/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'refund',direction:'credit',category:'other',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/recharge|mobile\s+top.?up|airtime|شحن\s+رصيد/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'mobile_recharge',direction:'debit',category:'bills',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/bill\s+payment|paid\s+bill|فاتور\S*|سداد\s+فاتور/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'bill_payment',direction:'debit',category:'bills',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/cash\s+withdraw|withdrawn|atm|سحب\s+نقد/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'cash_withdrawal',direction:'debit',category:'other',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/deposit|credited|ايداع|اودع/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'deposit',direction:'credit',category:'other',confidence:sourceKnown?0.88:0.75}),input,raw);
    if(/transfer.+to|sent\s+to|transferred\s+to|تحويل.+الى|تحويل.+إلى/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'outgoing_transfer',direction:'debit',category:'externalTransfer',confidence:sourceKnown?0.88:0.74}),input,raw);
    if(/purchase|pos|شراء|merchant|paid\s+at/.test(x.toLowerCase())&&card)return result(Object.assign(base,{kind:'purchase',direction:'debit',category:categoryForMerchant(merchant),confidence:sourceKnown?0.86:0.72}),input,raw);
    return null;
  }
  function parse(input){
    const raw=String((input&&input.text)||input||'').trim(),ignored=ignoredReason(raw);
    if(ignored)return {recognized:false,ignored:true,reason:ignored,raw};
    const obj=input&&typeof input==='object'?input:{};
    return parseEnbd(obj,raw)||parseArabicCreditCard(obj,raw)||parseDuPay(obj,raw)||parseGeneric(obj,raw)||{recognized:false,ignored:false,reason:'unrecognized',raw};
  }
  function institutionBankId(inst){if(!inst)return null;if(inst.bankRegistryId&&Banks.get(inst.bankRegistryId))return inst.bankRegistryId;const hit=Banks.detect(inst.name||'');return hit?hit.bank.id:null;}
  function institutionProviderId(inst){if(!inst)return null;if(inst.providerRegistryId&&Banks.getProvider&&Banks.getProvider(inst.providerRegistryId))return inst.providerRegistryId;const hit=Banks.detectProvider?Banks.detectProvider(inst.name||''):null;return hit?hit.provider.id:null;}
  function accountProviderId(account,institutions){if(!account)return null;const inst=(institutions||[]).find(i=>i.id===account.institutionId);const fromInst=institutionProviderId(inst);if(fromInst)return fromInst;const hit=Banks.detectProvider?Banks.detectProvider(account.name||''):null;return hit?hit.provider.id:null;}
  function refMatches(candidateRef,parsedRef,parsedSuffix){
    if(!candidateRef)return false;const c=normalizeRef(candidateRef),p=normalizeRef(parsedRef||'');if(p&&c===p)return true;const cs=suffix(c);
    if(parsedSuffix&&cs&&parsedSuffix===cs)return true;if(p&&c.length>=2&&p.endsWith(c))return true;return false;
  }
  function accountRefs(account){
    if(!account)return [];
    const out=[];
    if(Array.isArray(account.bankRefs))out.push(...account.bankRefs);
    if(account.bankRef)out.push(account.bankRef);
    if(account.accountRef)out.push(account.accountRef);
    if(account.accountLast4)out.push(account.accountLast4);
    return Array.from(new Set(out.map(normalizeRef).filter(Boolean)));
  }
  function resolveRoute(parsed,state){
    const institutions=Array.isArray(state&&state.institutions)?state.institutions:[],accounts=Array.isArray(state&&state.accounts)?state.accounts:[],instruments=Array.isArray(state&&state.paymentInstruments)?state.paymentInstruments:[];
    const institutionIds=new Set(institutions.filter(i=>{if(parsed.bankId&&institutionBankId(i)!==parsed.bankId)return false;if(parsed.providerId&&institutionProviderId(i)!==parsed.providerId)return false;return true;}).map(i=>i.id));
    const activeAccounts=accounts.filter(a=>{if(!a||a.archived||a.country!=='UAE')return false;if(parsed.bankId&&!institutionIds.has(a.institutionId))return false;if(parsed.providerId&&!institutionIds.has(a.institutionId)&&accountProviderId(a,institutions)!==parsed.providerId)return false;return true;});
    let instrument=null,account=null,fromAccount=null,targetAccount=null;
    if(parsed.cardLast4){
      let cards=instruments.filter(i=>i&&!i.archived&&String(i.last4||'')===String(parsed.cardLast4));
      if(parsed.bankId||parsed.providerId){const filtered=cards.filter(i=>{const linked=accounts.find(a=>a.id===i.accountId)||null;if(institutionIds.has(i.institutionId)||institutionIds.has(linked&&linked.institutionId))return true;return parsed.providerId&&accountProviderId(linked,institutions)===parsed.providerId;});if(filtered.length)cards=filtered;}
      if(cards.length===1)instrument=cards[0];if(instrument)account=accounts.find(a=>a.id===instrument.accountId)||null;
    }
    if(parsed.accountRef||parsed.accountSuffix){
      const matches=activeAccounts.filter(a=>accountRefs(a).some(ref=>refMatches(ref,parsed.accountRef,parsed.accountSuffix)));
      if(matches.length===1)fromAccount=matches[0];
    }
    if(!fromAccount&&activeAccounts.length===1)fromAccount=activeAccounts[0];
    if(parsed.kind==='purchase'||parsed.kind==='bill_payment'||parsed.kind==='mobile_recharge'){if((Number(parsed.fee)||0)+(Number(parsed.vat)||0)>0)return {status:'needs-review',reason:'fee-review-required',account,instrument,confidence:0};if(account)return {status:'routed',account,instrument,confidence:instrument?0.99:0.80};if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:parsed.providerId?0.92:0.75};return {status:'needs-review',reason:'payment-source-not-found',confidence:0};}
    if(parsed.kind==='deposit'||parsed.kind==='salary'||parsed.kind==='refund'||parsed.kind==='incoming_transfer'){
      if(parsed.kind==='refund'&&account)return {status:'routed',account,instrument,confidence:instrument?0.99:0.90};
      if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:parsed.accountRef?0.95:(parsed.providerId?0.92:0.78)};
      return {status:'needs-review',reason:'account-not-found',confidence:0};
    }
    if(parsed.kind==='card_repayment'){targetAccount=account;if(fromAccount&&targetAccount&&targetAccount.type==='credit')return {status:'routed',fromAccount,targetAccount,instrument,confidence:0.99};return {status:'needs-review',reason:'repayment-route-not-found',fromAccount,targetAccount,instrument,confidence:0};}
    if(parsed.kind==='outgoing_transfer'){
      if(fromAccount)return {status:'routed',fromAccount,confidence:parsed.accountRef?0.97:(parsed.providerId?0.95:0.80)};
      return {status:'needs-review',reason:'transfer-source-not-found',confidence:0};
    }
    if(parsed.kind==='cash_withdrawal'){
      if(!fromAccount)return {status:'needs-review',reason:'withdrawal-source-not-found',confidence:0};
      const cash=accounts.filter(a=>a&&!a.archived&&a.country===fromAccount.country&&a.currency===parsed.currency&&a.type==='cash');
      if(cash.length===1)return {status:'routed',fromAccount,targetAccount:cash[0],confidence:0.98};
      return {status:'needs-review',reason:'cash-destination-required',fromAccount,confidence:0.95};
    }
    return {status:'needs-review',reason:'unsupported-kind',confidence:0};
  }
  function dedupeKey(parsed){
    let timeKey='time?';
    const ts=Number(parsed&&parsed.postedAt);
    if(Number.isFinite(ts)&&ts>0){
      try{timeKey=new Date(ts).toISOString().slice(0,16);}catch(_){}
    }
    const eventKey=parsed&&parsed.transactionRef?('ref:'+String(parsed.transactionRef)):(parsed&&parsed.eventId?('event:'+String(parsed.eventId)):timeKey);
    return [eventKey,parsed.bankId||parsed.providerId||'source?',parsed.kind||'kind?',parsed.currency||'AED',Number(parsed.amount||0).toFixed(2),parsed.cardLast4||parsed.accountRef||parsed.accountSuffix||'instrument?',String(parsed.merchant||parsed.beneficiaryName||'').toLowerCase().replace(/\s+/g,' ').trim()].join('|');
  }
  function buildTransaction(parsed,route,options){
    const opts=options||{},date=opts.date||parsed.transactionDate||new Date(parsed.postedAt||Date.now()).toISOString().slice(0,10),id=typeof opts.uid==='function'?opts.uid('t'):('bank_'+Date.now()),key=dedupeKey(parsed);
    if(!route||route.status!=='routed')return {ok:false,reason:(route&&route.reason)||'route-required'};
    if(['purchase','bill_payment','mobile_recharge','deposit','salary','refund','incoming_transfer'].includes(parsed.kind)){
      const account=route.account;if(!account)return {ok:false,reason:'account-required'};if(account.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      const type=['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)?'expense':'income';
      return {ok:true,transaction:{id,type,amount:parsed.amount,currency:parsed.currency,accountId:account.id,instrumentId:route.instrument?route.instrument.id:null,walletAmount:parsed.amount,fxRate:1,cat:type==='income'?(parsed.kind==='salary'?'salary':'other'):(parsed.category||'other'),note:parsed.merchant||'',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='card_repayment'){
      const from=route.fromAccount,to=route.targetAccount;if(!from||!to)return {ok:false,reason:'repayment-route-required'};if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'سداد بطاقة '+(parsed.cardLast4||''),tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='outgoing_transfer'){
      const from=route.fromAccount;if(!from)return {ok:false,reason:'transfer-source-required'};if(from.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'external_transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,beneficiaryId:null,receivedAmount:parsed.amount,receivedCurrency:parsed.currency,fxRate:1,fee:0,note:parsed.beneficiaryName?('تحويل إلى '+parsed.beneficiaryName):'تحويل بنكي',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='cash_withdrawal'){
      const from=route.fromAccount,to=route.targetAccount;
      if(!from||!to)return {ok:false,reason:'cash-destination-required'};
      if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'سحب نقدي',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    return {ok:false,reason:'manual-review-required'};
  }
  return Object.freeze({parse,resolveRoute,buildTransaction,dedupeKey,categoryForMerchant,ignoredReason,suffix,normalizeRef});
});
