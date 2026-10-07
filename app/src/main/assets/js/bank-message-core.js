(function(root,factory){
  let registry=null,money=null;
  if(typeof module==='object'&&module.exports){registry=require('./uae-bank-registry-core.js');money=require('./money-core.js');module.exports=factory(registry,money);}
  else{registry=root&&root.SanadUaeBankRegistryCore;if(root)root.SanadBankMessageCore=factory(registry,root.SanadMoneyCore);}
})(typeof globalThis!=='undefined'?globalThis:this,function(Banks,Money){
  'use strict';
  if(!Banks)throw new Error('bank-registry-required');
  function latinDigits(value){return String(value==null?'':value).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));}
  function cleanText(value){return latinDigits(value).replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/\s+/g,' ').trim();}
  function amount(value){const v=Money.decimal(String(value),'AED');return v.ok?v.value:null;}
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
    if(input&&input._sourceResolved)return input._resolvedBank||null;
    const metadata=((input&&input.title)||'')+' '+((input&&input.sender)||'');
    if(/^(?:\s*EI\s*SMS\s*)$/i.test(metadata))return 'emirates-islamic';
    const hit=Banks.detect(metadata);
    if(hit)return hit.bank.id;
    const pkg=input&&input.packageName;
    if(pkg&&Array.isArray(Banks.BANKS)){
      const byPkg=Banks.BANKS.find(b=>identifierMatch(pkg,b));
      if(byPkg)return byPkg.id;
    }
    return null;
  }
  function providerIdFrom(input,raw){
    if(input&&input._sourceResolved)return input._resolvedProvider||null;
    if(/^\s*e&\s*money\s*$/i.test((input&&input.title)||'')&&/ج\.?\s*م|جنيه|ج\./.test(raw))return 'e-cash-egypt';
    const hit=Banks.detectProvider?Banks.detectProvider(((input&&input.title)||'')+' '+((input&&input.sender)||'')):null;
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
    const verified=new Date(Date.UTC(y,mo-1,d));
    if(verified.getUTCFullYear()!==y||verified.getUTCMonth()!==mo-1||verified.getUTCDate()!==d)return null;
    return String(y)+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function categoryForMerchant(value){
    const x=String(value||'').toLowerCase();
    if(/pharmacy|medical|med cen|hospital|clinic|nmc|parla|صيدلي|مستشف/.test(x))return 'health';
    if(/taxi|uber|careem|metro|rta|fuel|petrol|eppco site|enoc/.test(x))return 'transport';
    if(/cafe|cafet|cafeteria|coffee|starbucks/.test(x))return 'cafe';
    if(/restaurant|restauran|chicken|caya|bakery|bakeires|mandi|burger|sweets|cake|noon food|albaik|tanor zaman pastry|talabat|deliveroo|careem food|food/.test(x))return 'food';
    if(/grocery|union coop|carrefour|viva|mini mart|hyperma|hypermarket|noon minutes|nownow|souq al madina/.test(x))return 'grocery';
    if(/du google|etisalat|e&|telecom|internet|contabo/.test(x))return 'bills';
    if(/adidas|temu|alibaba|xpressions|day to day|amazon|shopping|brands for less|discounts cen/.test(x))return 'shopping';
    if(/platinumlist|cinema|entertainment/.test(x))return 'fun';
    if(/laundry/.test(x))return 'home';
    return 'other';
  }
  function ignoredReason(raw){
    const x=cleanText(raw).toLowerCase();
    if(!x)return 'empty';
    if(/\bfailed\b|\bunsuccessful\b|\bnot\s+(?:credited|completed|processed|successful|paid)\b|no\s+funds\s+(?:were\s+)?credited|لم\s+يتم|فشل|غير\s+ناجح|ملغا|الغاء|cancelled|canceled|\bpending\b/.test(x))return 'non-completed-status';
    if(/دفعة بطاقة تتطلب موافقتك|requires your approval|pending approval|authorization required/.test(x))return 'authorization-pending';
    if(/\botp\b|one time password|verification code|رمز التحقق|كلمة مرور لمرة/.test(x))return 'security-code';
    if(/تم استبدال.+nol payment|rewards? redemption|تم استبدال.+بنجاح/.test(x))return 'rewards-redemption';
    if(/credit card mini statement|minimum amount due|amount to be paid to avoid charges/.test(x))return 'card-statement';
    if(/was declined|declined due to|transaction declined|has been declined|تم رفض|عملية مرفوض|رفض معاملة|تعذر اتمام/.test(x))return 'declined-transaction';
    if(/نود تاكيد\s+استلام\s+دفعة.+عن\s+البطاقة\s+الائتمانية/.test(x))return 'card-payment-ack';
    if(/has been suspended|has been resumed|request to freeze|successfully reactivated|registered.+google pay|suspended from google pay|resumed to google pay|suspended from merchant|resumed to merchant|تم تسجيل بطاقتك.+google pay/.test(x))return 'card-status';
    if(/convert now|pay as low as.+per month|convert.+(?:purchase|transaction).+installment/i.test(x))return 'marketing-offer';
    if(/is being processed|is processing|قيد المعالجة|طلب.+(?:قيد|بانتظار)/i.test(x))return 'processing-status';
    if(
      /\b(?:offer|promotion|promo|enroll|enrol|register\s+to\s+avail|avail\s+the\s+offer|t&cs?\s+apply|terms\s+and\s+conditions\s+apply|to\s+opt\s+out)\b/i.test(x) ||
      /\b(?:make|complete)\s+\d+\s+(?:purchases?|transactions?)\s+or\s+more\b/i.test(x) ||
      /\bpay\s+abroad\s+and\s+receive\s+\d+(?:\.\d+)?%\s+cashback\b/i.test(x) ||
      /\bsms\s+['"]?[a-z0-9]+['"]?\s+to\s+\d{3,6}\s+to\s+(?:enroll|enrol|activate)\b/i.test(x) ||
      /(?:عرض|عرض\s+ترويجي|للاشتراك\s+في\s+العرض|للتسجيل\s+في\s+العرض|تطبق\s+الشروط\s+والاحكام|تسري\s+الشروط\s+والاحكام)/.test(x)
    )return 'marketing-offer';
    return null;
  }
  function countryForCurrency(value){
    const code=String(value||'').toUpperCase();
    if(code==='AED')return 'UAE';
    if(code==='EGP')return 'EGY';
    if(code==='MAD')return 'MAR';
    return null;
  }
  function result(base,input,raw){
    const resolvedCurrency=String(base.currency||'AED').toUpperCase();
    const resolvedBank=base.bankId||bankIdFrom(input,raw),resolvedProvider=base.providerId||providerIdFrom(input,raw);
    const institution=resolvedBank?Banks.get(resolvedBank):(resolvedProvider&&Banks.getProvider?Banks.getProvider(resolvedProvider):null);
    const issuerCountry=base.country||(resolvedBank==='emirates-nbd'&&resolvedCurrency==='EGP'?'EGY':(institution&&(institution.country||'UAE')))||countryForCurrency(resolvedCurrency);

    return Object.assign({recognized:true,ignored:false,eventId:input&&input.id?String(input.id):null,postedAt:Number(input&&input.postedAt)||Date.now(),
      bankId:resolvedBank,providerId:resolvedProvider,kind:base.kind,direction:base.direction||null,amount:Number(base.amount),
      currency:resolvedCurrency,country:issuerCountry,transactionCountry:null,merchant:base.merchant||'',category:base.category||'other',
      cardFirst4:base.cardFirst4||null,cardLast4:base.cardLast4||null,cardNetwork:base.cardNetwork||null,accountRef:base.accountRef||null,accountSuffix:base.accountSuffix||suffix(base.accountRef),
      fromAccountRef:base.fromAccountRef||null,toAccountRef:base.toAccountRef||null,
      transactionRef:base.transactionRef||null,transactionDate:base.transactionDate||null,beneficiaryName:base.beneficiaryName||null,
      transferChannel:base.transferChannel||null,
      sourceHint:base.sourceHint||[input&&input.title,input&&input.sender,input&&input.packageName].filter(Boolean).join(' ').trim(),
      fee:base.fee==null?0:Number(base.fee),vat:base.vat==null?0:Number(base.vat),
      availableBalanceCurrency:base.availableBalanceCurrency||resolvedCurrency,availableCreditCurrency:base.availableCreditCurrency||resolvedCurrency,
      availableBalance:base.availableBalance==null?null:Number(base.availableBalance),availableCredit:base.availableCredit==null?null:Number(base.availableCredit),
      raw:String(raw),confidence:Number(base.confidence||0.95)},base);
  }
  function humanizeCompactName(value){
    return String(value||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim();
  }
  function remittanceDetailsFromMerchant(value){
    const merchant=String(value||'').replace(/\s+/g,' ').trim();
    if(!merchant)return {channel:null,beneficiaryName:null};
    const known=[
      {re:/^(?:TAPT|TAPTAP(?:\s+SEND)?)(?:\*+(.+))?$/i,channel:'Taptap Send'},
      {re:/^REMITLY(?:\*+(.+))?$/i,channel:'Remitly'},
      {re:/^WISE(?:\*+(.+))?$/i,channel:'Wise'},
      {re:/^AL\s*ANSARI(?:\s+EXCHANGE)?(?:\*+(.+))?$/i,channel:'Al Ansari Exchange'},
      {re:/^WESTERN\s+UNION(?:\*+(.+))?$/i,channel:'Western Union'},
      {re:/^MONEYGRAM(?:\*+(.+))?$/i,channel:'MoneyGram'},
      {re:/^LULU(?:\s+EXCHANGE|\s+MONEY)?(?:\*+(.+))?$/i,channel:'LuLu Exchange'}
    ];
    for(const k of known){
      const m=merchant.match(k.re);
      if(m)return {channel:k.channel,beneficiaryName:m[1]?humanizeCompactName(m[1]):null};
    }
    return {channel:merchant,beneficiaryName:null};
  }
  function parseEnbd(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/(?:لقد\s+)?تم\s+اعادة\s+مبلغ\s+عملية\s+شراء\s+بقيمة\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?).*?لدى\s+(.+?)\s+بواسطة\s+بطاقة\s+(الخصم|الائتمان).*?(\d{4}).*?(الرصيد\s+المتوفر\s+هو|الحد\s+المتوفر\s+هو)\s+(?:([A-Za-z]{3})\s*)?(-?[\d,]+(?:\.\d+)?)(?:\s*([A-Za-z]{3}))?/i);
    if(m){const credit=m[4]==='الائتمان',base={bankId:'emirates-nbd',kind:'refund',direction:'credit',currency:m[1],amount:amount(m[2]),merchant:m[3].trim(),cardLast4:m[5],cardType:credit?'credit_card':'debit_card',confidence:0.99};base[credit?'availableCredit':'availableBalance']=amount(m[8]);base[credit?'availableCreditCurrency':'availableBalanceCurrency']=m[7]||m[9]||m[1];return result(base,input,raw);}
    m=x.match(/تم\s+خصم\s+مبلغ\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتسديد\s+مستحقات\s+بطاقتك\s+الائتمانية\s*(\d{4})/i);
    if(m)return result({bankId:'emirates-nbd',kind:'card_repayment',direction:'transfer',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),cardLast4:m[4],confidence:0.99},input,raw);
    m=x.match(/تمت\s+عملية\s+شراء\s+في\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+(.+?)\s+على\s+البطاقة\s+(\d{4})\s+الائتمان\s+المتوفر\s+([A-Za-z]{3})?\s*(-?[\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],cardType:'credit_card',availableCredit:amount(m[6]),availableCreditCurrency:m[5]||m[1],confidence:0.99},input,raw);}
    m=x.match(/تمت\s+عملية\s+شراء\s+بقيمة\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+لدى\s+(.+?)\s+باستخدام\s+بطاقة\s+خصم\s+تنتهي\s+ارقامها\s+ب[ـ]?\s*(\d{4}).*?الرصيد\s+المتوفر\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){const merchant=m[3].replace(/\s+/g,' ').trim();return result({bankId:'emirates-nbd',kind:'purchase',direction:'debit',currency:m[1],amount:amount(m[2]),merchant,category:categoryForMerchant(merchant),cardLast4:m[4],cardType:'debit_card',availableBalance:amount(m[6]),availableBalanceCurrency:m[5],confidence:0.99},input,raw);}
    // Same ENBD posting contract, with ISO currency before rather than after the amount.
    const remittanceText=x.replace(/((?:لقد\s+)?تم\s+تحويل\s+مبلغ\s+)([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i,'$1$3$2');
    m=remittanceText.match(/(?:لقد\s+)?تم\s+تحويل\s+مبلغ\s+([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})\s+باستخدام\s+بطاقة\s+الخصم.+?(\d{4})\s+لدى\s+(.+?)\.\s*رصيدك\s+الحالي\s+هو\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)/i);
    if(m){
      const merchant=m[4].replace(/\s+/g,' ').trim();
      const remittance=remittanceDetailsFromMerchant(merchant);
      return result({bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',currency:m[2],amount:amount(m[1]),merchant,beneficiaryName:remittance.beneficiaryName,transferChannel:remittance.channel,category:'externalTransfer',cardLast4:m[3],cardType:'debit_card',availableBalance:amount(m[6]),confidence:0.98},input,raw);
    }
    m=x.match(/تم\s+ايداع\s+الراتب\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'salary',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),availableBalance:availableBalanceFromText(x),category:'salary',confidence:0.99},input,raw);
    m=x.match(/(?:لقد\s+)?تم\s+ايداع\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+في\s+(?:رقم\s+)?حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'deposit',direction:'credit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),availableBalance:availableBalanceFromText(x),category:'other',confidence:0.98},input,raw);
    m=x.match(/تم\s+خصم\s+(?:مبلغ\s+)?([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\.?\s*([A-Za-z0-9Xx*]+)\s+لتحويل\s+الاموال/i);
    if(m)return result({bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),category:'externalTransfer',confidence:0.97},input,raw);
    m=x.match(/(?:لقد\s+)?تم\s+عكس\s+عملية\s+تحويل.*?([\d,]+(?:\.\d+)?)\s*(AED|EGP).*?(\d{4}).*?(?:رصيدك\s+الحالي\s+هو|الرصيد\s+المتوفر\s+هو)\s*(AED|EGP)\s*([\d,]+(?:\.\d+)?)/i);
    if(m)return result({bankId:'emirates-nbd',kind:'refund',direction:'credit',currency:m[2],amount:amount(m[1]),cardLast4:m[3],cardType:'debit_card',availableBalance:amount(m[5]),confidence:0.98},input,raw);
    m=x.match(/تم\s+خصم\s+مبلغ\s+(AED|EGP)\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+(?:رقم\s+)?([A-Za-z0-9Xx*]+)\s+(.+?)(?:\.|$)/i);
    if(m&&/تحويل\s+تلغرافي|لاصدارتحويل/.test(m[4]))return result({bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),availableBalance:availableBalanceFromText(x),category:'externalTransfer',transferChannel:'Bank telegraphic transfer',confidence:0.98},input,raw);
    if(m&&/دفع|سداد|تعبئة|فاتورة/.test(m[4]))return result({bankId:'emirates-nbd',kind:'bill_payment',direction:'debit',currency:m[1],amount:amount(m[2]),accountRef:normalizeRef(m[3]),merchant:m[4],availableBalance:availableBalanceFromText(x),category:'bills',confidence:0.98},input,raw);
    return null;
  }
  function parseArabicCreditCard(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/عملية\s+دفع\s+ببطاقة\s+الائتمان\s+المنتهية\s+بالرقم\s*:\s*(\d{4})\s+لدى\s*:\s*(.+?)\s+المبلغ\s*:\s*([A-Za-z]{3})\s*(-?[\d,]+(?:\.\d+)?)\s+التاريخ\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2})\s+الحد\s+المتوفر\s*:\s*(-?[\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})/i);
    if(m){
      const merchant=m[2].replace(/\s+/g,' ').trim();
      return result({kind:'purchase',direction:'debit',cardLast4:m[1],cardType:'credit_card',merchant,category:categoryForMerchant(merchant),
        currency:m[3],amount:amount(m[4]),transactionDate:isoDateFromDmy(m[5]),transactionTime:m[6],
        availableCredit:amount(m[7]),availableCreditCurrency:m[8],confidence:0.99},input,raw);
    }
    return null;
  }
  function parseDuPay(input,raw){
    const x=cleanText(raw); let m;
    m=x.match(/your\s+request\s+to\s+transfer\s+([A-Za-z]{3})\s*([\d,]+(?:\.\d+)?)\s+to\s+(.+?)\s+is\s+successfully\s+processed.+?\bTID\s*:\s*([A-Za-z0-9_-]+)/i);
    if(m)return result({providerId:'du-pay',kind:'outgoing_transfer',direction:'debit',currency:m[1],amount:amount(m[2]),beneficiaryName:m[3].trim(),transferChannel:'du Pay',transactionRef:m[4],category:'externalTransfer',confidence:0.99},input,raw);
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
  function parseWalletFamilies(input,raw){
    const x=cleanText(raw),providerId=providerIdFrom(input,raw);let m;
    if(providerId==='e-money'){
      m=x.match(/(AED)\s*([\d,]+(?:\.\d+)?)\s+added\s+to\s+your\s+e&\s*money[\s\S]*?updated\s+balance\s+is\s+AED\s*([\d,]+(?:\.\d+)?)[\s\S]*?transaction\s+id\s*:\s*([A-Za-z0-9-]+)/i);
      if(m)return result({providerId,kind:'deposit',direction:'credit',currency:'AED',amount:amount(m[2]),availableBalance:amount(m[3]),transactionRef:m[4],confidence:0.99},input,raw);
      m=x.match(/saved\s+AED\s*([\d,]+(?:\.\d+)?)\s+in\s+gold[\s\S]*?transaction\s+id\s+is\s+(\w+)[\s\S]*?([\d.eE+-]+)\s*gm\s+gold\s+balance/i);
      if(m)return result({providerId,kind:'investment_purchase',direction:'debit',currency:'AED',amount:amount(m[1]),transactionRef:m[2],goldGrams:Number(m[3]),confidence:0.99},input,raw);
      if(/just\s+sold\s+[\d.eE+-]+\s*gm\s+of\s+gold/i.test(x))return {recognized:true,ignored:false,kind:'investment_sale',amount:null,currency:'AED',country:'UAE',providerId,raw,eventId:input.id||null,postedAt:Number(input.postedAt)||Date.now(),confidence:0.99};
      return null;
    }
    if(providerId!=='e-cash-egypt')return null;
    const money='(?:ج\\.?\\s*م\\.?|جم|جنيه|جنية|EGP)';
    const value='([\\d,]+(?:\\.\\d+)?)';
    const balance=(x.match(new RegExp('رصيد\\s+محفظتك\\s+الحال[يى]\\s*[.:-]?\\s*'+value,'i'))||[])[1];
    const ref=(x.match(/(?:رقم\s+العملية|الرقم\s+المرجعي)\s*:\s*([A-Za-z0-9-]+)/)||[])[1]||null;
    const base={providerId,country:'EGY',currency:'EGP',availableBalance:balance==null?null:amount(balance),transactionRef:ref,confidence:0.99};
    // A fee formula with exemptions is evidence for review, not a guessed fee.
    const feeMatch=x.match(new RegExp('(?:رسوم\\s+(?:التحويل|العملية))\\s*'+value+'\\s*'+money));
    if(feeMatch)base.fee=amount(feeMatch[1]);
    if(/رسوم.+%|%[\d.]+.+(?:المبلغ|حد)/.test(x))base.feeFormula=x;
    m=x.match(new RegExp('^تم\\s+ايداع\\s+مبلغ\\s*'+value+'\\s*'+money,'i'));
    if(m)return result(Object.assign(base,{kind:'deposit',direction:'credit',amount:amount(m[1])}),input,raw);
    m=x.match(new RegExp('^تم\\s+استلام\\s+مبلغ\\s*'+value+'\\s*'+money+'\\s+من\\s+رقم\\s*(\\d+)','i'));
    if(m)return result(Object.assign(base,{kind:'incoming_transfer',direction:'credit',amount:amount(m[1]),beneficiaryName:m[2]}),input,raw);
    m=x.match(new RegExp('^تم\\s+تحويل\\s+مبلغ\\s*'+value+'\\s*'+money+'\\s+(?:الى|الي)\\s+رقم\\s*(\\d+)','i'));
    if(m)return result(Object.assign(base,{kind:'outgoing_transfer',direction:'debit',amount:amount(m[1]),beneficiaryName:m[2],transferChannel:'e& Cash Egypt'}),input,raw);
    m=x.match(new RegExp('^تم\\s+سحب\\s+مبلغ\\s*'+value+'\\s*'+money,'i'));
    if(m)return result(Object.assign(base,{kind:'cash_withdrawal',direction:'debit',amount:amount(m[1])}),input,raw);
    m=x.match(new RegExp('^تم\\s+شحن\\s*'+value+'\\s*'+money+'\\s+لرقمك\\s*(\\d+)','i'));
    if(m)return result(Object.assign(base,{kind:'mobile_recharge',direction:'debit',amount:amount(m[1]),merchant:'Mobile recharge',category:'bills'}),input,raw);
    m=x.match(new RegExp('^تم\\s+دفع\\s*'+value+'\\s*'+money+'\\s+بنجاح\\s+ل\\s+(.+?)(?=\\s+تاريخ\\s+العملية|$)','i'));
    if(m)return result(Object.assign(base,{kind:'purchase',direction:'debit',amount:amount(m[1]),merchant:m[2].trim(),category:categoryForMerchant(m[2])}),input,raw);
    m=x.match(new RegExp('^(?:الرصيد\\s+المتاح\\s+بمحفظة)[\\s\\S]*?'+value+'\\s*(?:'+money+'|ج\\.)','i'));
    if(m)return result(Object.assign(base,{kind:'balance_observation',direction:null,amount:null,availableBalance:amount(m[1])}),input,raw);
    return null;
  }
  function parseEgyptBank(input,raw){
    const bankId=bankIdFrom(input,raw),bank=Banks.get(bankId);
    if(!bank||bank.country!=='EGY')return null;
    const x=cleanText(raw).replace(/((?:EGP|USD|EUR|SAR|MAD|AED)\s*\d{1,3})\s+(\d{3}(?:\.\d+)?)/gi,'$1$2');let m;
    const local='(?:جم|ج\\.?\\s*م\\.?|جنيه|EGP)';
    const value='([\\d,]+(?:\\.\\d+)?)';
    const base={bankId,country:'EGY',currency:'EGP',confidence:0.99};
    m=x.match(/Your\s+Card\s*\*+\s*(\d{4})\s+was\s+debited\s+with\s+(EGP|USD|EUR|SAR|MAD|AED)\s*([\d,]+(?:\.\d+)?)\s+at\s+(.+?)\s+on\s+[\d/ :]+\.\s*Available\s+limit\s+is\s+(EGP|USD)\s*([\d,]+(?:\.\d+)?)/i);
    if(m)return result(Object.assign(base,{kind:'purchase',direction:'debit',cardLast4:m[1],cardType:'credit_card',currency:m[2],amount:amount(m[3]),merchant:m[4].trim(),category:categoryForMerchant(m[4]),availableCredit:amount(m[6]),availableCreditCurrency:m[5]}),input,raw);
    m=x.match(new RegExp('تم\\s+خصم\\s*(?:مبلغ\\s*)?(?:([A-Za-z]{3})\\s*)?'+value+'\\s*(?:([A-Za-z]{3})|'+local+')?\\s+من\\s+(بطاقة\\s+الائتمان|بطاقة\\s+الخصم\\s+المباشر|البطاقه|البطاقة).*?(\\d{4})\\s+عند\\s+(.+?)\\s+يوم[\\s\\S]*?المتاح\\s*'+value+'(?:\\s*'+local+')?(?![\\d.,])','i'));
    if(m){const credit=m[4].includes('الائتمان'),debit=m[4].includes('المباشر');const b=Object.assign(base,{kind:/\bATM(?:\b|(?=\d))/i.test(m[6])?'cash_withdrawal':'purchase',direction:'debit',currency:m[1]||m[3]||'EGP',amount:amount(m[2]),cardLast4:m[5],cardType:credit?'credit_card':debit?'debit_card':null,merchant:m[6].trim(),category:categoryForMerchant(m[6])});if(credit){b.availableCredit=amount(m[7]);b.availableCreditCurrency='EGP';}else if(debit){b.availableBalance=amount(m[7]);b.availableBalanceCurrency='EGP';}return result(b,input,raw);}
    m=x.match(new RegExp('تم\\s+(تنفيذ|اضافة)\\s+تحويل\\s+لحظي\\s+(?:من\\s+حسابكم\\s+(?:رقم|المنتهي\\s+ب)|لحسابكم\\s+(?:رقم|المنتهي\\s+ب))\\s*(\\d+)\\s+بمبلغ\\s*'+value+'\\s*'+local,'i'));
    if(m){const ref=(x.match(/(?:رقم\s+مرجعي|الرقم\s+المرجعي)\s*([A-Za-z0-9-]+)/)||[])[1]||null;return result(Object.assign(base,{kind:m[1]==='اضافة'?'incoming_transfer':'outgoing_transfer',direction:m[1]==='اضافة'?'credit':'debit',accountRef:m[2],amount:amount(m[3]),transactionRef:ref}),input,raw);}
    m=x.match(new RegExp('نشكركم\\s+عل[يى]\\s+سداد\\s+مبلغ\\s*'+value+'\\s*'+local+'\\s+لبطاقة\\s+رقم\\s*(\\d{4})','i'));
    if(m)return result(Object.assign(base,{kind:'card_payment_received',direction:'credit',amount:amount(m[1]),cardLast4:m[2],cardType:'credit_card'}),input,raw);
    return null;
  }
  function parseGeneric(input,raw){
    const x=cleanText(raw).replace(/((?:AED|EGP|USD|EUR|MAD|SAR|GBP)\s*\d{1,3})\s+(\d{3}(?:\.\d+)?)/gi,'$1$2'),bankId=bankIdFrom(input,raw),providerId=providerIdFrom(input,raw);
    const sourceKnown=!!(bankId||providerId);
    let m=x.match(/(AED|USD|EUR|GBP|SAR|EGP|MAD)\s*([\d,]+(?:\.\d+)?)/i);
    let currency=null,value=null;
    if(m){currency=m[1].toUpperCase();value=amount(m[2]);}
    else{m=x.match(/([\d,]+(?:\.\d+)?)\s*(AED|USD|EUR|GBP|SAR|EGP|MAD)/i);if(m){value=amount(m[1]);currency=m[2].toUpperCase();}}
    // Explicit paid principal wins over an earlier balance or amount-due observation.
    const paid=x.match(/(?:total\s+paid|amount\s+paid)\s*:?\s*(?:(AED|USD|EUR|GBP|SAR|EGP|MAD)\s*)?([\d,]+(?:\.\d+)?)\s*(AED|USD|EUR|GBP|SAR|EGP|MAD)?/i);
    if(paid&&(paid[1]||paid[3])){currency=(paid[1]||paid[3]).toUpperCase();value=amount(paid[2]);}
    if(!value||!currency)return null;
    const masked=x.match(/\b(\d{4})\s*(?:x{4}|\*{4})\s*(?:x{4}|\*{4})\s*(\d{4})\b/i);
    const startMatch=x.match(/(?:card|بطاق\S*)[^\n]{0,70}?(?:starting\s+with|starts\s+with|beginning\s+with|تبدأ\s+ب|يبدا\s+ب|يبدأ\s+ب)\s*[:#-]?\s*(\d{4,8})/i);
    const endMatch=x.match(/(?:card|بطاق\S*)[^\n]{0,70}?(?:ending\s+(?:in|with)|ends\s+with|last\s+4|المنته(?:ية|ي)\s+(?:بالرقم|ب)?|تنتهي\s+(?:ارقامها|أرقامها)?\s*ب?)\s*[:#-]?\s*(\d{4})/i);
    const fallbackCard=x.match(/(?:card|بطاق\S*)\D{0,40}(\d{4})/i);
    const cardFirst4=(masked&&masked[1])||(startMatch?String(startMatch[1]).slice(0,4):null);
    const card=(masked&&masked[2])||(endMatch&&endMatch[1])||(!startMatch&&fallbackCard?fallbackCard[1]:null);
    let cardNetwork=null;
    if(/\bvisa\b/i.test(x))cardNetwork='visa';
    else if(/\bmaster\s*card\b|\bmastercard\b/i.test(x))cardNetwork='mastercard';
    else if(/\bdiscover\b/i.test(x))cardNetwork='discover';
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
    let incomingFrom='';
    let im=x.match(/\b(?:received|credited|transferred)\b[\s\S]{0,80}?\bfrom\s+(.+?)(?=\s+(?:(?:to|into)\s+(?:your\s+)?(?:account|wallet)|reference|ref\b|transaction\s+id|available\s+balance|balance\b)|[.;]|$)/i);
    if(!im)im=x.match(/\bfrom\s+(.+?)\s+(?:to|into)\s+(?:your\s+)?(?:account|wallet)\b/i);
    if(!im)im=x.match(/(?:تم\s+)?(?:تحويل|ايداع|إيداع)[\s\S]{0,80}?\sمن\s+(.+?)(?=\s+(?:الى|إلى)\s+(?:حسابك|محفظتك)|\s+(?:الرصيد|مرجع|الرقم\s+المرجعي)|[.;]|$)/i);
    if(im)incomingFrom=im[1].replace(/\s+/g,' ').trim();
    let transactionRef=null,transactionDate=null;
    const refMatch=x.match(/\b(?:transaction\s*(?:id|reference)|reference(?:\s+number)?|ref|tid)\b\s*[:#-]?\s*([A-Za-z0-9-]{4,40})/i);
    if(refMatch)transactionRef=refMatch[1];
    const dateMatch=x.match(/(?:date\s*[:.-]?\s*|\bon\s+)?(\d{1,2}\/\d{1,2}\/\d{4})\b/i);
    if(dateMatch)transactionDate=isoDateFromDmy(dateMatch[1]);
    const base={bankId,providerId,amount:value,currency,availableBalanceCurrency:(balMatch&&balMatch[1])||currency,availableCreditCurrency:(creditMatch&&creditMatch[1])||currency,cardFirst4,cardLast4:card,cardNetwork,cardType,accountRef:acc?normalizeRef(acc):null,merchant,availableBalance,availableCredit,beneficiaryName,transactionRef,transactionDate};
    const paidBill=/bill\s+payment\s+(?:AED|USD|EUR|GBP|SAR|EGP|MAD)|paid\s+bill|bill\s+(?:payment\s+)?(?:is\s+|was\s+)?(?:paid|successful)|payment[\s\S]{0,160}?\bis\s+successful|تم\s+(?:سداد|دفع)\s+(?:الفاتور|فاتور)/i.test(x);
    if(/refund\s+request|request\s+(?:for\s+)?(?:a\s+)?refund|طلب\s+استرداد/i.test(x))return result(Object.assign(base,{kind:'refund_request',executionStatus:'requested',reviewReason:'refund-not-completed',confidence:0.90}),input,raw);
    if(/(?:تعبئة|شحن)[\s\S]{0,80}?(?:محفظ|نول)|(?:wallet|nol)[\s-]*(?:top.?up|funding)|top.?up[\s\S]{0,40}(?:wallet|nol)/i.test(x))return result(Object.assign(base,{kind:'wallet_topup',direction:'debit',executionStatus:'purpose-unconfirmed',reviewReason:'wallet-funding-purpose-unconfirmed',confidence:0.90}),input,raw);
    if(/\bbill\b|\binvoice\b|فاتور/i.test(x)&&!paidBill&&!/purchase|refund|شراء|استرداد/i.test(x))return result(Object.assign(base,{kind:'bill_notice',executionStatus:'notice',reviewReason:'bill-not-payment',confidence:0.90}),input,raw);
    if(paidBill&&!/refund|refunded|استرداد|مرتجع|salary|payroll|راتب/i.test(x))return result(Object.assign(base,{kind:'bill_payment',direction:'debit',category:'bills',confidence:sourceKnown?0.90:0.75}),input,raw);
    const ownTransfer=x.match(/(?:from\s+(?:your\s+)?account|من\s+حساب(?:ك)?)\s*[:.]?\s*([A-Za-z0-9Xx*]{2,30}).{0,100}?(?:to\s+(?:your\s+)?account|الى\s+حساب(?:ك)?|إلى\s+حساب(?:ك)?)\s*[:.]?\s*([A-Za-z0-9Xx*]{2,30})/i);
    if(ownTransfer&&/[0-9Xx*]/.test(ownTransfer[1])&&/[0-9Xx*]/.test(ownTransfer[2])){
      const fromRef=normalizeRef(ownTransfer[1]),toRef=normalizeRef(ownTransfer[2]);
      return result(Object.assign(base,{kind:'internal_transfer',direction:'transfer',accountRef:fromRef,fromAccountRef:fromRef,toAccountRef:toRef,category:'other',confidence:0.99}),input,raw);
    }
    if(/credited\s+to\s+your\s+(?:credit\s+)?card/i.test(x))return result(Object.assign(base,{kind:'card_payment_received',direction:'credit',confidence:sourceKnown?0.95:0.75}),input,raw);
    if(/salary|payroll|راتب/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'salary',direction:'credit',category:'salary',confidence:sourceKnown?0.90:0.76}),input,raw);
    if(/refund|refunded|reversal|reversed|استرداد|مرتجع/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'refund',direction:'credit',category:'other',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/recharge|mobile\s+top.?up|airtime|شحن\s+رصيد/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'mobile_recharge',direction:'debit',category:'bills',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/bill\s+payment|paid\s+bill|تم\s+سداد\s+فاتور/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'bill_payment',direction:'debit',category:'bills',confidence:sourceKnown?0.90:0.75}),input,raw);
    if(/cash\s+withdraw|withdrawn|atm|سحب\s+نقد|(?:قمت\s+بسحب|تم\s+سحب)\s+مبلغ/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'cash_withdrawal',direction:'debit',category:'other',confidence:sourceKnown?0.90:0.75}),input,raw);
    const incomingTransfer=/تحويل[\s\S]{0,120}الى\s+(?:حسابك|محفظتك)|transferred[\s\S]{0,120}to\s+your\s+(?:account|wallet)/i.test(x)||!!incomingFrom||/\breceived\b[\s\S]{0,120}\bfrom\b|\bfrom\b[\s\S]{0,120}\b(?:to|into)\s+(?:your\s+)?(?:account|wallet)\b|(?:تم\s+)?تحويل[\s\S]{0,120}\sمن\s+.+(?:الى|إلى)\s+(?:حسابك|محفظتك)/i.test(x);
    if(incomingTransfer)return result(Object.assign(base,{kind:'incoming_transfer',direction:'credit',merchant:incomingFrom||merchant,beneficiaryName:incomingFrom||beneficiaryName,category:'other',confidence:sourceKnown?0.92:0.78}),input,raw);
    if(/deposit|credited|ايداع|اودع/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'deposit',direction:'credit',category:'other',confidence:sourceKnown?0.88:0.75}),input,raw);
    if(/transfer.+to|transfer.+debited|sent\s+to|transferred\s+to|تحويل.+الى|تحويل.+إلى/.test(x.toLowerCase()))return result(Object.assign(base,{kind:'outgoing_transfer',direction:'debit',category:'externalTransfer',confidence:sourceKnown?0.88:0.74}),input,raw);
    if(/purchase|pos|شراء|merchant|paid\s+at|card.+debited\s+with/.test(x.toLowerCase())&&(card||cardFirst4||/you\s+have\s+made\s+a\s+purchase\s+for\s+(?:EGP|AED|USD|EUR|MAD|SAR|GBP)\b/i.test(x)))return result(Object.assign(base,{kind:'purchase',direction:'debit',category:categoryForMerchant(merchant),confidence:sourceKnown?0.86:0.72}),input,raw);
    if(/تم\s+خصم\s+مبلغ[\s\S]{0,100}?من\s+حسابك/i.test(x))return result(Object.assign(base,{kind:'debit_notice',direction:'debit',reviewReason:'debit-purpose-required',confidence:0.90}),input,raw);
    return null;
  }
  function parse(input){
    const raw=String((input&&input.text)||input||'').trim();
    if(raw.length>4000||input&&input.truncated)return {recognized:false,ignored:false,reason:'evidence-truncated-or-too-long',raw};
    const ignored=ignoredReason(raw);
    if(ignored)return {recognized:false,ignored:true,reason:ignored,raw};
    const obj=input&&typeof input==='object'?Object.assign({},input):{};
    delete obj._sourceResolved;delete obj._resolvedBank;delete obj._resolvedProvider;
    const bank=bankIdFrom(obj,raw),provider=providerIdFrom(obj,raw);
    obj._sourceResolved=true;obj._resolvedBank=bank;obj._resolvedProvider=provider;
    const review=reason=>({recognized:false,ignored:false,reason,raw});
    if(/reversal|reversed|عكس\s+عملية|الغاء|إلغاء/i.test(cleanText(raw)))return review('reversal-original-required');
    let numericError=null;
    const normalized=cleanText(raw).replace(/\b(AED|EGP|USD|EUR|MAD|SAR|GBP|JPY|KWD|BHD|OMR|TND)\s*(-?\d[\d.,]*)|(-?\d[\d.,]*)\s*\b(AED|EGP|USD|EUR|MAD|SAR|GBP|JPY|KWD|BHD|OMR|TND)\b/gi,(token,c1,n1,n2,c2)=>{
      const currency=(c1||c2).toUpperCase(),v=Money.decimal((n1||n2).replace(/[.,]$/,''),currency);
      if(!v.ok){numericError=v.reason;return token;}
      if(v.scale!==2)numericError='ledger-currency-review';
      const punctuation=c1&&/[.,]$/.test(n1)?n1.slice(-1):'';
      return c1?currency+' '+v.decimal+punctuation:v.decimal+' '+currency;
    });
    if(numericError)return review(numericError);
    let parsed=null,family=null;
    if(/refund\s+request|request\s+(?:for\s+)?(?:a\s+)?refund|طلب\s+استرداد|فاتور|\bbill\b|\binvoice\b|تعبئة|\bnol\b/i.test(normalized)){
      parsed=parseGeneric(obj,normalized);if(parsed)family='generic';
    }
    for(const [name,fn,enabled] of [['wallet',parseWalletFamilies,true],['egypt-bank',parseEgyptBank,true],['enbd',parseEnbd,bank==='emirates-nbd'],['arabic-credit',parseArabicCreditCard,true],['du-pay',parseDuPay,provider==='du-pay'],['generic',parseGeneric,true]]){
      if(parsed)break;
      if(enabled){parsed=fn(obj,normalized);if(parsed){family=name;break;}}
    }
    if(!parsed)return review('unrecognized');
    if(!parsed.transactionRef){const ref=normalized.match(/\b(?:TR\s+REF|transaction\s+(?:id|reference)|reference|TID|ref)\s*[:#-]?\s*([A-Za-z0-9_-]{4,40})/i);if(ref)parsed.transactionRef=ref[1];}
    parsed.formatFamily=family;parsed.raw=raw;parsed.parserVersion='9.2.11-financial-contract';parsed.executionStatus=parsed.executionStatus||'completed';
    // Card-acquiring language also describes wallet funding; ownership/purpose is not in the merchant label.
    if(parsed.kind==='purchase'&&/^(?:e\s*(?:&|and)\s*money|du\s*pay)(?:\s*[,;]|\s*$)/i.test(parsed.merchant||''))parsed.reviewReason='wallet-funding-purpose-unconfirmed';
    if(parsed.kind==='investment_sale'){parsed.reviewReason='investment-non-money-review';return parsed;}
    const monetary=Money.ledgerValue(parsed.kind==='balance_observation'?parsed.availableBalance:parsed.amount,parsed.currency);
    if(!monetary.ok||parsed.amount<=0&&parsed.kind!=='balance_observation')return review(monetary.reason||'invalid-amount');
    parsed.money={currency:monetary.currency,scale:monetary.scale,minorUnits:monetary.minorUnits};
    if(family==='egypt-bank'&&!parsed.transactionDate){
      const dated=normalized.match(/يوم\s+(\d{1,2}\/\d{1,2}\/\d{4})(?!\d)/);
      if(dated)parsed.transactionDate=isoDateFromDmy(dated[1]);
    }
    // Generic slash dates have no authoritative source-specific day/month contract.
    if(/\d{1,2}\/\d{1,2}\/\d{4}/.test(normalized)){if(!parsed.transactionDate)parsed.reviewReason='invalid-operation-date';else if(family==='generic')parsed.reviewReason='ambiguous-date';}
    return parsed;
  }
  function institutionBankId(inst){if(!inst)return null;if(inst.bankRegistryId&&Banks.get(inst.bankRegistryId))return inst.bankRegistryId;const hit=Banks.detect(inst.name||'');return hit?hit.bank.id:null;}
  function institutionProviderId(inst){if(!inst)return null;if(inst.providerRegistryId&&Banks.getProvider&&Banks.getProvider(inst.providerRegistryId))return inst.providerRegistryId;const hit=Banks.detectProvider?Banks.detectProvider(inst.name||''):null;return hit?hit.provider.id:null;}
  function accountProviderId(account,institutions){if(!account)return null;const inst=(institutions||[]).find(i=>i.id===account.institutionId);const fromInst=institutionProviderId(inst);if(fromInst)return fromInst;const hit=Banks.detectProvider?Banks.detectProvider(account.name||''):null;return hit?hit.provider.id:null;}
  function refMatches(candidateRef,parsedRef,parsedSuffix){
    if(!candidateRef)return false;const c=normalizeRef(candidateRef),p=normalizeRef(parsedRef||'');if(p&&c===p)return true;const cs=suffix(c);
    // A suffix is a candidate only; exact stored identity is required for posting.
    return false;
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
    const country=(parsed&&parsed.country)||countryForCurrency(parsed&&parsed.currency)||'UAE';
    const institutionIds=new Set(institutions.filter(i=>{if(parsed.bankId&&institutionBankId(i)!==parsed.bankId)return false;if(parsed.providerId&&institutionProviderId(i)!==parsed.providerId)return false;return true;}).map(i=>i.id));
    const activeAccounts=accounts.filter(a=>{if(!a||a.archived||a.country!==country||a.currency!==parsed.currency)return false;if(parsed.bankId&&!institutionIds.has(a.institutionId))return false;if(parsed.providerId&&!institutionIds.has(a.institutionId)&&accountProviderId(a,institutions)!==parsed.providerId)return false;return true;});
    let instrument=null,account=null,fromAccount=null,targetAccount=null;
    if(parsed.cardLast4||parsed.cardFirst4){
      let cards=instruments.filter(i=>{
        if(!i||i.archived)return false;
        if(parsed.cardType&&i.type!==parsed.cardType)return false;
        const linkedAccount=accounts.find(a=>a&&a.id===i.accountId);
        if(!linkedAccount||linkedAccount.archived||linkedAccount.country!==country)return false;
        if(parsed.cardLast4&&String(i.last4||'')!==String(parsed.cardLast4))return false;
        if(parsed.cardFirst4&&String(i.first4||'')!==String(parsed.cardFirst4))return false;
        if(parsed.cardNetwork&&i.network&&i.network!=='other'&&String(i.network)!==String(parsed.cardNetwork))return false;
        return true;
      });
      if(parsed.bankId||parsed.providerId){const filtered=cards.filter(i=>{const linked=accounts.find(a=>a.id===i.accountId)||null;if(institutionIds.has(i.institutionId)||institutionIds.has(linked&&linked.institutionId))return true;return parsed.providerId&&accountProviderId(linked,institutions)===parsed.providerId;});if(filtered.length||parsed.kind!=='card_repayment')cards=filtered;}
      if(cards.length===1)instrument=cards[0];if(instrument)account=accounts.find(a=>a.id===instrument.accountId)||null;
    }
    if(parsed.accountRef||parsed.accountSuffix){
      const bindingMatches=a=>(Array.isArray(a.bankIdentityBindings)?a.bankIdentityBindings:[]).filter(b=>b&&b.enabled!==false&&b.bankId===parsed.bankId&&b.country===a.country&&b.currency===a.currency&&b.accountType===a.type&&b.reference===normalizeRef(parsed.accountRef));
      const matches=activeAccounts.filter(a=>a.type!=='credit'&&(accountRefs(a).some(ref=>refMatches(ref,parsed.accountRef,parsed.accountSuffix))||bindingMatches(a).some(b=>Number(parsed.postedAt)>=Number(b.confirmedAt))));
      if(!matches.length&&activeAccounts.some(a=>bindingMatches(a).some(b=>Number(parsed.postedAt)<Number(b.confirmedAt))))return {status:'needs-review',reason:'account-identity-history-review',confidence:0};
      if(matches.length===1)fromAccount=matches[0];
    }
    if(!fromAccount&&!parsed.accountRef&&!parsed.accountSuffix&&parsed.providerId){const wallets=activeAccounts.filter(a=>a.type==='ewallet');if(wallets.length===1)fromAccount=wallets[0];}
    if(parsed.kind==='internal_transfer'){
      const allActive=accounts.filter(a=>a&&!a.archived&&a.country===country&&(!parsed.currency||a.currency===parsed.currency));
      const fromMatches=allActive.filter(a=>accountRefs(a).some(ref=>refMatches(ref,parsed.fromAccountRef||parsed.accountRef,suffix(parsed.fromAccountRef||parsed.accountRef))));
      const toMatches=allActive.filter(a=>accountRefs(a).some(ref=>refMatches(ref,parsed.toAccountRef,suffix(parsed.toAccountRef))));
      if(fromMatches.length===1&&toMatches.length===1&&fromMatches[0].id!==toMatches[0].id)
        return {status:'routed',fromAccount:fromMatches[0],targetAccount:toMatches[0],confidence:0.99};
      return {status:'needs-review',reason:'internal-transfer-route-not-found',confidence:0};
    }
    if(parsed.kind==='purchase'||parsed.kind==='bill_payment'||parsed.kind==='mobile_recharge'){if((Number(parsed.fee)||0)+(Number(parsed.vat)||0)>0)return {status:'needs-review',reason:'fee-review-required',account,instrument,confidence:0};if(account)return {status:'routed',account,instrument,confidence:instrument?0.99:0.80};if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:parsed.providerId?0.92:0.75};return {status:'needs-review',reason:'payment-source-not-found',confidence:0};}
    if(parsed.kind==='deposit'||parsed.kind==='salary'||parsed.kind==='refund'||parsed.kind==='incoming_transfer'){
      if(parsed.kind==='refund'&&account)return {status:'routed',account,instrument,confidence:instrument?0.99:0.90};
      if(fromAccount)return {status:'routed',account:fromAccount,instrument:null,confidence:parsed.accountRef?0.95:(parsed.providerId?0.92:0.78)};
      return {status:'needs-review',reason:'account-not-found',confidence:0};
    }
    if(parsed.kind==='card_repayment'){targetAccount=account;if(fromAccount&&targetAccount&&targetAccount.type==='credit')return {status:'routed',fromAccount,targetAccount,instrument,confidence:0.99};return {status:'needs-review',reason:'repayment-route-not-found',fromAccount,targetAccount,instrument,confidence:0};}
    if(parsed.kind==='outgoing_transfer'){
      if(account)return {status:'routed',fromAccount:account,instrument,confidence:instrument?0.99:0.90};
      if(fromAccount)return {status:'routed',fromAccount,confidence:parsed.accountRef?0.97:(parsed.providerId?0.95:0.80)};
      return {status:'needs-review',reason:'transfer-source-not-found',confidence:0};
    }
    if(parsed.kind==='cash_withdrawal'){
      // A uniquely matched issuer/card identifies the debit source, not the cash destination.
      if(account&&fromAccount&&account.id!==fromAccount.id)return {status:'needs-review',reason:'withdrawal-source-conflict',confidence:0};
      fromAccount=fromAccount||account;
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
  function buildTransactionBase(parsed,route,options){
    const d=new Date(parsed.postedAt||Date.now()),localDate=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const opts=options||{},date=opts.date||parsed.transactionDate||localDate,id=typeof opts.uid==='function'?opts.uid('t'):('bank_'+Date.now()),key=dedupeKey(parsed);
    if(!route||route.status!=='routed')return {ok:false,reason:(route&&route.reason)||'route-required'};
    if(['salary','deposit','incoming_transfer'].includes(parsed.kind)&&route.account&&['credit','debt'].includes(route.account.type))return {ok:false,reason:'asset-account-required'};
    if(['purchase','bill_payment','mobile_recharge','deposit','salary','refund','incoming_transfer'].includes(parsed.kind)){
      const account=route.account;if(!account)return {ok:false,reason:'account-required'};const foreign=account.currency!==parsed.currency;
      const settlement=foreign?Money.ledgerValue(opts.confirmedSettlementAmount,account.currency):null;
      if(foreign&&(!['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)||opts.confirmedSettlementAmount==null||!settlement.ok||settlement.value<=0))return {ok:false,reason:'fx-review-required'};
      const type=['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)?'expense':'income';
      const merchantName=['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)&&parsed.merchant?String(parsed.merchant).trim():null;
      return {ok:true,transaction:{id,type,amount:parsed.amount,currency:parsed.currency,accountId:account.id,instrumentId:route.instrument?route.instrument.id:null,walletAmount:foreign?settlement.value:parsed.amount,fxRate:foreign?settlement.value/parsed.amount:1,bankSettlementEvidence:foreign?{amount:settlement.value,currency:account.currency,source:'user-confirmation',at:Date.now(),eventId:parsed.eventId||null}:null,cat:type==='income'?(parsed.kind==='salary'?'salary':'other'):(parsed.category||'other'),merchantName,note:parsed.merchant||parsed.beneficiaryName||'',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='internal_transfer'){
      const from=route.fromAccount,to=route.targetAccount;if(!from||!to)return {ok:false,reason:'internal-transfer-route-required'};if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'تحويل بين الحسابات',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='card_repayment'){
      const from=route.fromAccount,to=route.targetAccount;if(!from||!to)return {ok:false,reason:'repayment-route-required'};if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'سداد بطاقة '+(parsed.cardLast4||''),tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='outgoing_transfer'){
      const from=route.fromAccount;if(!from)return {ok:false,reason:'transfer-source-required'};if(from.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      const channel=parsed.transferChannel?String(parsed.transferChannel).trim():'';
      const note=parsed.beneficiaryName
        ? ('تحويل'+(channel?' عبر '+channel:'')+' إلى '+parsed.beneficiaryName)
        : (channel?'تحويل خارجي عبر '+channel:'تحويل بنكي');
      return {ok:true,transaction:{id,type:'external_transfer',fromAccountId:from.id,instrumentId:route.instrument?route.instrument.id:null,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,beneficiaryId:null,receivedAmount:parsed.amount,receivedCurrency:parsed.currency,receivedAmountKnown:false,fxRate:1,fee:0,transferChannel:channel||null,note,tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    if(parsed.kind==='cash_withdrawal'){
      const from=route.fromAccount,to=route.targetAccount;
      if(!from||!to)return {ok:false,reason:'cash-destination-required'};
      if(from.currency!==parsed.currency||to.currency!==parsed.currency)return {ok:false,reason:'fx-review-required'};
      return {ok:true,transaction:{id,type:'transfer',fromAccountId:from.id,fromAmount:parsed.amount,fromCurrency:from.currency,fromCountry:from.country,toAccountId:to.id,toAmount:parsed.amount,toCurrency:to.currency,toCountry:to.country,fxRate:1,fee:0,note:'سحب نقدي',tags:[],date,created:Number(parsed.postedAt)||Date.now(),bankImportKey:key,bankImportEventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,bankTransactionRef:parsed.transactionRef||null}};
    }
    return {ok:false,reason:'manual-review-required'};
  }
  function buildTransaction(parsed,route,options){
    const opts=options||{};
    if(['deposit','incoming_transfer'].includes(parsed.kind)&&opts.confirmedIncomingOrigin!=='external-income')return {ok:false,reason:'incoming-origin-unconfirmed'};
    const feeEvidence=!!parsed.feeFormula||Number(parsed.fee||0)>0||Number(parsed.vat||0)>0;
    const feeConfirmed=opts.confirmedFee!==null&&opts.confirmedFee!==undefined&&opts.confirmedFee!=='';
    if(feeEvidence&&!feeConfirmed)return {ok:false,reason:'fee-confirmation-required'};
    const fee=feeConfirmed?Number(opts.confirmedFee):0;
    if(!Number.isFinite(fee)||fee<0)return {ok:false,reason:'invalid-confirmed-fee'};
    if(fee>0&&!['purchase','bill_payment','mobile_recharge','outgoing_transfer','internal_transfer','card_repayment','cash_withdrawal'].includes(parsed.kind))return {ok:false,reason:'fee-direction-review-required'};
    if(parsed.reviewReason&&!(parsed.reviewReason==='ambiguous-date'&&/^\d{4}-\d{2}-\d{2}$/.test(opts.date||'')))return {ok:false,reason:parsed.reviewReason};
    if(parsed.kind==='outgoing_transfer'&&opts.confirmedOutgoingDestination!=='external')return {ok:false,reason:'outgoing-destination-unconfirmed'};
    const money=Money.ledgerValue(parsed.amount,parsed.currency);if(!money.ok||Number(parsed.amount)<=0)return {ok:false,reason:money.reason||'invalid-amount'};
    const built=buildTransactionBase(parsed,route,options);
    if(built.ok&&built.transaction&&parsed.kind==='outgoing_transfer')built.transaction.economicOrigin={kind:'external-destination',source:'user-confirmation',eventId:parsed.eventId||null};
    if(built.ok&&built.transaction&&['deposit','incoming_transfer'].includes(parsed.kind))built.transaction.economicOrigin={kind:'external-income',source:'user-confirmation',eventId:parsed.eventId||null};
    if(built.ok&&built.transaction&&feeConfirmed){
      const tx=built.transaction;
      if(tx.type==='expense'){
        const accountCurrency=route.account.currency,principal=tx.walletAmount;
        const total=Money.sum([principal,fee],accountCurrency);
        if(!Money.ledgerValue(fee,accountCurrency).ok||!total.ok)return {ok:false,reason:'invalid-confirmed-fee'};
        tx.bankPrincipalAmount=principal;tx.walletAmount=total.value;
        if(tx.currency===accountCurrency)tx.amount=total.value;
      }
      else if(tx.type==='transfer'||tx.type==='external_transfer')tx.fee=Math.round(fee*100)/100;
      tx.bankFeeEvidence={amount:Math.round(fee*100)/100,currency:route.account?route.account.currency:parsed.currency,confirmed:true,source:'manual-review'};
    }
    if(built.ok&&built.transaction){const clock=/^(\d{1,2}):([0-5]\d)$/.exec(parsed.transactionTime||'');built.transaction.transactionTime=clock&&Number(clock[1])<24?String(clock[1]).padStart(2,'0')+':'+clock[2]:null;built.transaction.timeSource=built.transaction.transactionTime?'bank-message':'sms-received';built.transaction.smsReceivedAt=Number(parsed.postedAt)||Date.now();}
    if(built.ok&&built.transaction)built.transaction.bankImportEvidence={
      text:cleanText(parsed.raw||'').toLowerCase(),
      availableBalance:parsed.availableBalance==null?null:Number(parsed.availableBalance),
      availableCredit:parsed.availableCredit==null?null:Number(parsed.availableCredit),
      sourceHint:parsed.sourceHint||'',kind:parsed.kind,parserVersion:parsed.parserVersion||'legacy',executionStatus:parsed.executionStatus||'unknown',money:parsed.money||null
    };
    return built;
  }
  return Object.freeze({parse,resolveRoute,buildTransaction,dedupeKey,categoryForMerchant,ignoredReason,suffix,normalizeRef,countryForCurrency});
});
