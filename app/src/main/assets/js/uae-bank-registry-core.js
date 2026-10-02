(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadUaeBankRegistryCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SOURCE=Object.freeze({authority:'Central Bank of the UAE (CBUAE)',licenceType:'Bank',asOf:'2026-10-01',url:'https://centralbank.ae/en/licensing'});
  const BANKS=Object.freeze([
  {
    "id": "hsbc-middle-east",
    "name": "HSBC Bank Middle East Limited",
    "aliases": [
      "HSBC",
      "HSBC UAE"
    ],
    "popular": true
  },
  {
    "id": "standard-chartered",
    "name": "Standard Chartered Bank",
    "aliases": [
      "Standard Chartered",
      "SCB UAE"
    ],
    "popular": true
  },
  {
    "id": "emirates-nbd",
    "name": "Emirates NBD Bank P.J.S.C",
    "aliases": [
      "Emirates NBD",
      "EmiratesNBD",
      "ENBD",
      "بنك الإمارات دبي الوطني",
      "الإمارات دبي الوطني"
    ],
    "popular": true
  },
  {
    "id": "citibank",
    "name": "CitiBank N.A.",
    "aliases": [
      "Citibank",
      "Citi UAE"
    ],
    "popular": false
  },
  {
    "id": "mashreq",
    "name": "Mashreq Bank P.S.C.",
    "aliases": [
      "Mashreq",
      "Mashreqbank",
      "المشرق"
    ],
    "popular": true
  },
  {
    "id": "habib-bank-ltd",
    "name": "Habib Bank Ltd.",
    "aliases": [
      "Habib Bank"
    ],
    "popular": false
  },
  {
    "id": "united-bank-ltd",
    "name": "United Bank Ltd.",
    "aliases": [
      "United Bank Limited",
      "UBL"
    ],
    "popular": false
  },
  {
    "id": "fab",
    "name": "First Abu Dhabi Bank P.J.S.C",
    "aliases": [
      "First Abu Dhabi Bank",
      "FAB",
      "بنك أبوظبي الأول"
    ],
    "popular": true
  },
  {
    "id": "bank-saderat-iran",
    "name": "Bank Saderat Iran",
    "aliases": [],
    "popular": false
  },
  {
    "id": "cbd",
    "name": "Commercial Bank of Dubai P.J.S.C",
    "aliases": [
      "Commercial Bank of Dubai",
      "CBD"
    ],
    "popular": true
  },
  {
    "id": "abk",
    "name": "Al Ahli Bank of Kuwait",
    "aliases": [
      "ABK"
    ],
    "popular": false
  },
  {
    "id": "aaib",
    "name": "Arab African International Bank",
    "aliases": [
      "AAIB"
    ],
    "popular": false
  },
  {
    "id": "banque-misr",
    "name": "Banque Misr",
    "aliases": [
      "بنك مصر"
    ],
    "popular": false
  },
  {
    "id": "bank-of-sharjah",
    "name": "Bank of Sharjah P.J.S.C",
    "aliases": [
      "Bank of Sharjah"
    ],
    "popular": true
  },
  {
    "id": "arab-bank",
    "name": "Arab Bank PLC",
    "aliases": [
      "Arab Bank"
    ],
    "popular": false
  },
  {
    "id": "bnp-paribas",
    "name": "BNP Paribas",
    "aliases": [],
    "popular": false
  },
  {
    "id": "al-khaliji-france",
    "name": "Al Khaliji (France) S. A.",
    "aliases": [
      "Al Khaliji"
    ],
    "popular": false
  },
  {
    "id": "rafidain-bank",
    "name": "Rafidain Bank",
    "aliases": [],
    "popular": false
  },
  {
    "id": "bank-of-baroda",
    "name": "Bank of Baroda",
    "aliases": [
      "BOB UAE"
    ],
    "popular": false
  },
  {
    "id": "janata-bank",
    "name": "Janata Bank PLC",
    "aliases": [
      "Janata Bank"
    ],
    "popular": false
  },
  {
    "id": "habib-bank-ag-zurich",
    "name": "Habib Bank A.G Zurich",
    "aliases": [
      "Habib Bank AG Zurich",
      "HBZ"
    ],
    "popular": false
  },
  {
    "id": "banorient",
    "name": "Banque Banorient France",
    "aliases": [
      "Banorient"
    ],
    "popular": false
  },
  {
    "id": "dib",
    "name": "Dubai Islamic Bank P.J.S.C",
    "aliases": [
      "Dubai Islamic Bank",
      "DIB",
      "بنك دبي الإسلامي"
    ],
    "popular": true
  },
  {
    "id": "sib",
    "name": "Sharjah Islamic Bank P.J.S.C.",
    "aliases": [
      "Sharjah Islamic Bank",
      "SIB",
      "مصرف الشارقة الإسلامي"
    ],
    "popular": true
  },
  {
    "id": "uab",
    "name": "United Arab Bank P.J.S.C",
    "aliases": [
      "United Arab Bank",
      "UAB"
    ],
    "popular": true
  },
  {
    "id": "investbank",
    "name": "InvestBank P.J.S.C",
    "aliases": [
      "InvestBank",
      "Invest Bank"
    ],
    "popular": true
  },
  {
    "id": "credit-agricole-cib",
    "name": "Credit Agricole-Corporate and Investment Bank",
    "aliases": [
      "Credit Agricole",
      "CACIB"
    ],
    "popular": false
  },
  {
    "id": "al-masraf",
    "name": "Arab Bank for Inv.& Foreign Trade",
    "aliases": [
      "Al Masraf",
      "Arab Bank for Investment and Foreign Trade"
    ],
    "popular": true
  },
  {
    "id": "emirates-islamic",
    "name": "Emirates Islamic Bank P.J.S.C.",
    "aliases": [
      "Emirates Islamic",
      "EI",
      "مصرف الإمارات الإسلامي"
    ],
    "popular": true
  },
  {
    "id": "rakbank",
    "name": "National Bank of R.A.K P.J.S.C",
    "aliases": [
      "RAKBANK",
      "National Bank of Ras Al Khaimah"
    ],
    "popular": true
  },
  {
    "id": "emirates-investment-bank",
    "name": "Emirates Investment Bank (PJSC)",
    "aliases": [
      "Emirates Investment Bank"
    ],
    "popular": false
  },
  {
    "id": "el-nilein-bank",
    "name": "El Nilein Bank",
    "aliases": [],
    "popular": false
  },
  {
    "id": "national-bank-oman",
    "name": "National Bank of Oman S.A.O.G.",
    "aliases": [
      "National Bank of Oman",
      "NBO"
    ],
    "popular": false
  },
  {
    "id": "nbq",
    "name": "National Bank of U.A.Q PSC",
    "aliases": [
      "National Bank of Umm Al Qaiwain",
      "NBQ"
    ],
    "popular": true
  },
  {
    "id": "national-bank-bahrain",
    "name": "National Bank of Bahrain",
    "aliases": [
      "NBB"
    ],
    "popular": false
  },
  {
    "id": "nbf",
    "name": "National Bank of Fujairah PSC",
    "aliases": [
      "National Bank of Fujairah",
      "NBF"
    ],
    "popular": true
  },
  {
    "id": "adcb",
    "name": "Abu Dhabi Commercial Bank P.J.S.C",
    "aliases": [
      "Abu Dhabi Commercial Bank",
      "ADCB",
      "بنك أبوظبي التجاري"
    ],
    "popular": true
  },
  {
    "id": "cbi",
    "name": "Commercial Bank International P.J.S.C",
    "aliases": [
      "Commercial Bank International",
      "CBI"
    ],
    "popular": true
  },
  {
    "id": "adib",
    "name": "Abu Dhabi Islamic Bank P.J.S.C",
    "aliases": [
      "Abu Dhabi Islamic Bank",
      "ADIB",
      "مصرف أبوظبي الإسلامي"
    ],
    "popular": true
  },
  {
    "id": "al-hilal",
    "name": "Al Hilal Bank P.J.S.C",
    "aliases": [
      "Al Hilal Bank",
      "Al Hilal",
      "الهلال"
    ],
    "popular": true
  },
  {
    "id": "doha-bank",
    "name": "Doha Bank",
    "aliases": [],
    "popular": false
  },
  {
    "id": "snb",
    "name": "The Saudi National Bank",
    "aliases": [
      "Saudi National Bank",
      "SNB"
    ],
    "popular": false
  },
  {
    "id": "ajman-bank",
    "name": "Ajman Bank P.J.S.C",
    "aliases": [
      "Ajman Bank",
      "مصرف عجمان"
    ],
    "popular": true
  },
  {
    "id": "nbk",
    "name": "National Bank of Kuwait",
    "aliases": [
      "NBK"
    ],
    "popular": false
  },
  {
    "id": "icbc",
    "name": "Industrial & Commercial Bank of China",
    "aliases": [
      "ICBC"
    ],
    "popular": false
  },
  {
    "id": "deutsche-bank",
    "name": "Deutsche Bank AG",
    "aliases": [
      "Deutsche Bank"
    ],
    "popular": false
  },
  {
    "id": "keb-hana",
    "name": "KEB Hana Bank",
    "aliases": [
      "Hana Bank"
    ],
    "popular": false
  },
  {
    "id": "barclays",
    "name": "Barclays Bank PLC",
    "aliases": [
      "Barclays"
    ],
    "popular": false
  },
  {
    "id": "bank-of-china",
    "name": "Bank of China Limited",
    "aliases": [
      "Bank of China",
      "BOC"
    ],
    "popular": false
  },
  {
    "id": "gib",
    "name": "Gulf International Bank B.S.C",
    "aliases": [
      "Gulf International Bank",
      "GIB"
    ],
    "popular": false
  },
  {
    "id": "mcb-bank",
    "name": "MCB Bank Limited",
    "aliases": [
      "MCB"
    ],
    "popular": false
  },
  {
    "id": "intesa-sanpaolo",
    "name": "Intesa Sanpaolo S.P.A.",
    "aliases": [
      "Intesa Sanpaolo"
    ],
    "popular": false
  },
  {
    "id": "agricultural-bank-china",
    "name": "Agricultural Bank of China Ltd.",
    "aliases": [
      "Agricultural Bank of China",
      "ABC Bank China"
    ],
    "popular": false
  },
  {
    "id": "bank-alfalah",
    "name": "Bank Al Falah Limited",
    "aliases": [
      "Bank Alfalah",
      "Alfalah"
    ],
    "popular": false
  },
  {
    "id": "bok-international",
    "name": "BOK International Bank",
    "aliases": [
      "BOK"
    ],
    "popular": false
  },
  {
    "id": "mbank",
    "name": "Al Maryah Community Bank L.L.C.",
    "aliases": [
      "Al Maryah Community Bank",
      "Mbank",
      "M Bank"
    ],
    "popular": true
  },
  {
    "id": "wio",
    "name": "WIO Bank P.J.S.C",
    "aliases": [
      "Wio Bank",
      "Wio"
    ],
    "popular": true
  },
  {
    "id": "zand",
    "name": "Zand Bank P.J.S.C",
    "aliases": [
      "Zand Bank",
      "Zand"
    ],
    "popular": true
  },
  {
    "id": "idb-uae",
    "name": "International Development Bank for Investment & Finance",
    "aliases": [
      "International Development Bank",
      "IDB Iraq"
    ],
    "popular": false
  },
  {
    "id": "ruya",
    "name": "Ruya Community Islamic Bank L.L.C",
    "aliases": [
      "Ruya Bank",
      "Ruya",
      "رؤيا"
    ],
    "popular": true
  },
  {
    "id": "reem-community-bank",
    "name": "Reem Community Bank P.S.C",
    "aliases": [
      "Reem Community Bank",
      "Reem Bank"
    ],
    "popular": true
  },
  {
    "id": "iraqi-islamic-bank",
    "name": "Iraqi Islamic Bank for Investment & Development",
    "aliases": [
      "Iraqi Islamic Bank"
    ],
    "popular": false
  }
].map(x=>Object.freeze(x)));
  const BANK_LOCALIZATION=Object.freeze({
    'hsbc-middle-east':{ar:'إتش إس بي سي الشرق الأوسط',short:'HSBC'},
    'standard-chartered':{ar:'ستاندرد تشارترد',short:'SCB'},
    'emirates-nbd':{ar:'الإمارات دبي الوطني',short:'ENBD'},
    'citibank':{ar:'سيتي بنك',short:'Citi'},
    'mashreq':{ar:'المشرق',short:'Mashreq'},
    'habib-bank-ltd':{ar:'حبيب بنك',short:'HBL'},
    'united-bank-ltd':{ar:'يونايتد بنك ليمتد',short:'UBL'},
    'fab':{ar:'بنك أبوظبي الأول',short:'FAB'},
    'bank-saderat-iran':{ar:'بنك صادرات إيران',short:'BSI'},
    'cbd':{ar:'بنك دبي التجاري',short:'CBD'},
    'abk':{ar:'البنك الأهلي الكويتي',short:'ABK'},
    'aaib':{ar:'البنك العربي الأفريقي الدولي',short:'AAIB'},
    'banque-misr':{ar:'بنك مصر',short:'Banque Misr'},
    'bank-of-sharjah':{ar:'بنك الشارقة',short:'BOS'},
    'arab-bank':{ar:'البنك العربي',short:'Arab Bank'},
    'bnp-paribas':{ar:'بي إن بي باريبا',short:'BNP Paribas'},
    'al-khaliji-france':{ar:'الخليجي فرنسا',short:'Al Khaliji'},
    'rafidain-bank':{ar:'مصرف الرافدين',short:'Rafidain'},
    'bank-of-baroda':{ar:'بنك أوف بارودا',short:'BOB'},
    'janata-bank':{ar:'بنك جاناتا',short:'Janata'},
    'habib-bank-ag-zurich':{ar:'حبيب بنك إيه جي زيورخ',short:'HBZ'},
    'banorient':{ar:'بنك بان أورينت',short:'Banorient'},
    'dib':{ar:'بنك دبي الإسلامي',short:'DIB'},
    'sib':{ar:'مصرف الشارقة الإسلامي',short:'SIB'},
    'uab':{ar:'البنك العربي المتحد',short:'UAB'},
    'investbank':{ar:'إنفست بنك',short:'InvestBank'},
    'credit-agricole-cib':{ar:'كريدي أجريكول للاستثمار',short:'CACIB'},
    'al-masraf':{ar:'المصرف',short:'Al Masraf'},
    'emirates-islamic':{ar:'مصرف الإمارات الإسلامي',short:'EI'},
    'rakbank':{ar:'راك بنك',short:'RAKBANK'},
    'emirates-investment-bank':{ar:'بنك الإمارات للاستثمار',short:'EIB'},
    'el-nilein-bank':{ar:'بنك النيلين',short:'El Nilein'},
    'national-bank-oman':{ar:'البنك الوطني العماني',short:'NBO'},
    'nbq':{ar:'بنك أم القيوين الوطني',short:'NBQ'},
    'national-bank-bahrain':{ar:'بنك البحرين الوطني',short:'NBB'},
    'nbf':{ar:'بنك الفجيرة الوطني',short:'NBF'},
    'adcb':{ar:'بنك أبوظبي التجاري',short:'ADCB'},
    'cbi':{ar:'البنك التجاري الدولي',short:'CBI'},
    'adib':{ar:'مصرف أبوظبي الإسلامي',short:'ADIB'},
    'al-hilal':{ar:'مصرف الهلال',short:'Al Hilal'},
    'doha-bank':{ar:'بنك الدوحة',short:'Doha Bank'},
    'snb':{ar:'البنك الأهلي السعودي',short:'SNB'},
    'ajman-bank':{ar:'مصرف عجمان',short:'Ajman Bank'},
    'nbk':{ar:'بنك الكويت الوطني',short:'NBK'},
    'icbc':{ar:'البنك الصناعي والتجاري الصيني',short:'ICBC'},
    'deutsche-bank':{ar:'دويتشه بنك',short:'Deutsche'},
    'keb-hana':{ar:'بنك هانا',short:'Hana'},
    'barclays':{ar:'باركليز',short:'Barclays'},
    'bank-of-china':{ar:'بنك الصين',short:'BOC'},
    'gib':{ar:'بنك الخليج الدولي',short:'GIB'},
    'mcb-bank':{ar:'إم سي بي بنك',short:'MCB'},
    'intesa-sanpaolo':{ar:'إنتيسا سان باولو',short:'Intesa'},
    'agricultural-bank-china':{ar:'البنك الزراعي الصيني',short:'ABC China'},
    'bank-alfalah':{ar:'بنك الفلاح',short:'Bank Alfalah'},
    'bok-international':{ar:'بنك بي أو كي الدولي',short:'BOK'},
    'mbank':{ar:'إم بنك',short:'Mbank'},
    'wio':{ar:'بنك ويو',short:'Wio'},
    'zand':{ar:'بنك زند',short:'Zand'},
    'idb-uae':{ar:'البنك الدولي للتنمية',short:'IDB'},
    'ruya':{ar:'مصرف رؤيا المجتمعي الإسلامي',short:'Ruya'},
    'reem-community-bank':{ar:'بنك ريم المجتمعي',short:'Reem'},
    'iraqi-islamic-bank':{ar:'المصرف العراقي الإسلامي',short:'IIB'}
  });
  const PAYMENT_PROVIDERS=Object.freeze([
    {id:'e-money',name:'e& money',nameAr:'إي آند موني',short:'e& money',aliases:['e& money','eandmoney','e money','Digital Financial Services LLC','المحفظة e& money'],type:'digital_wallet',country:'UAE',legalName:'Digital Financial Services L.L.C.',logoDomain:'eandmoney.com',popular:true},
    {id:'botim-money',name:'BOTIM Money',nameAr:'بوتيم موني',short:'BOTIM Money',aliases:['BOTIM Money','Botim Money','Botim wallet','PayBy','Botim Money Technology LLC'],type:'digital_wallet',country:'UAE',legalName:'Botim Money Technology L.L.C',logoDomain:'botim.me',popular:true},
    {id:'noqodi',name:'noqodi',nameAr:'نقودي',short:'noqodi',aliases:['noqodi','noqodi wallet','نقودي','Noqodi LLC'],type:'digital_wallet',country:'UAE',legalName:'Noqodi LLC',logoDomain:'noqodi.com',popular:true},
    {id:'myzoi',name:'myZoi',nameAr:'ماي زوي',short:'myZoi',aliases:['myZoi','myZoi wallet','MyZoi Financial Inclusion Technologies'],type:'digital_wallet',country:'UAE',legalName:'MyZoi Financial Inclusion Technologies L.L.C.',logoDomain:'myzoi.com',popular:false},
    {id:'whizmo',name:'Whizmo',nameAr:'ويزمو',short:'Whizmo',aliases:['Whizmo','Whizpay','Whizpay Technology','ويزمو'],type:'digital_wallet',country:'UAE',legalName:'Whizpay Technology L.L.C.',logoDomain:'whizmo.ae',popular:true},
    {id:'du-pay',name:'du Pay',nameAr:'دو باي',short:'du Pay',aliases:['du Pay','duPay','du Pay wallet','duPay wallet','dupay.ae','EITC Financial Services'],type:'digital_wallet',country:'UAE',legalName:'EITC Financial Services L.L.C',logoDomain:'dupay.ae',popular:true},
    {id:'ziina',name:'Ziina',nameAr:'زينة',short:'Ziina',aliases:['Ziina','Ziina Wallet','Ziina Payments','زينة'],type:'digital_wallet',country:'UAE',legalName:'Ziina Payments L.L.C',logoDomain:'ziina.com',popular:true},
    {id:'comera-pay',name:'Comera Pay',nameAr:'كوميرا باي',short:'Comera Pay',aliases:['Comera Pay','ComeraPay','Comera Pay LLC'],type:'digital_wallet',country:'UAE',legalName:'Comera Pay L.L.C',logoDomain:'comerapay.com',popular:false},
    {id:'pay10',name:'Pay10',nameAr:'باي 10',short:'Pay10',aliases:['Pay10','Pay 10','Pay Ten','Pay Ten Payment Services Provider'],type:'digital_wallet',country:'UAE',legalName:'Pay Ten Payment Services Provider L.L.C.',logoDomain:'pay10.ae',popular:false},
    {id:'huru',name:'Huru',nameAr:'هورو',short:'Huru',aliases:['Huru','Huru Money','Huru Payment Services Provider'],type:'digital_wallet',country:'UAE',legalName:'Huru Payment Services Provider L.L.C',logoDomain:'huru.co',popular:false},
    {id:'al-ansari-wallet',name:'Al Ansari Wallet',nameAr:'محفظة الأنصاري',short:'Al Ansari',aliases:['Al Ansari Wallet','Al Ansari Digital Pay','الأنصاري','محفظة الأنصاري'],type:'digital_wallet',country:'UAE',legalName:'Al Ansari Digital Pay L.L.C',logoDomain:'alansariwallet.com',popular:true},
    {id:'wise',name:'Wise',nameAr:'وايز',short:'Wise',aliases:['Wise','Wise Fintech Network'],type:'digital_wallet',country:'UAE',legalName:'Wise Fintech Network L.L.C',logoDomain:'wise.com',popular:true},
    {id:'revolut',name:'Revolut',nameAr:'ريفولوت',short:'Revolut',aliases:['Revolut','Revolut Stored Value Services'],type:'digital_wallet',country:'UAE',legalName:'Revolut Stored Value Services L.L.C',logoDomain:'revolut.com',popular:true},
    {id:'beyon-money',name:'Beyon Money',nameAr:'بيون موني',short:'Beyon Money',aliases:['Beyon Money','BeyonMoney','Beyon Money Financial Services'],type:'digital_wallet',country:'UAE',legalName:'Beyon Money Financial Services L.L.C',logoDomain:'beyonmoney.ae',popular:false},
    {id:'kamelpay',name:'KamelPay',nameAr:'كامل باي',short:'KamelPay',aliases:['KamelPay','Kamel Pay','H A Q Kamel Pay Services'],type:'digital_wallet',country:'UAE',legalName:'H A Q Kamel Pay Services L.L.C',logoDomain:'kamelpay.com',popular:false},
    {id:'payit-fab',name:'Payit',nameAr:'باييت',short:'Payit',aliases:['Payit','Payit Wallet','FAB Payit','باييت'],type:'bank_wallet',country:'UAE',legalName:'First Abu Dhabi Bank P.J.S.C',bankId:'fab',logoDomain:'payit.ae',popular:true},
    {id:'noon-digital-pay',name:'Noon Digital Pay',nameAr:'نون ديجيتال باي',short:'Noon Pay',aliases:['Noon Digital Pay','Noon Pay'],type:'stored_value_provider',country:'UAE',legalName:'Noon Digital Pay L.L.C',logoDomain:null,popular:false}
  ].map(x=>Object.freeze(x)));
  const LOGO_DOMAINS=Object.freeze({
    'hsbc-middle-east':'hsbc.ae',
    'standard-chartered':'sc.com',
    'emirates-nbd':'emiratesnbd.com',
    'mashreq':'mashreq.com',
    'fab':'bankfab.com',
    'cbd':'cbd.ae',
    'banque-misr':'banquemisr.com',
    'bank-of-sharjah':'bankofsharjah.com',
    'arab-bank':'arabbank.com',
    'dib':'dib.ae',
    'sib':'sib.ae',
    'uab':'uab.ae',
    'investbank':'investbank.ae',
    'al-masraf':'almasraf.ae',
    'emirates-islamic':'emiratesislamic.ae',
    'rakbank':'rakbank.ae',
    'nbq':'nbq.ae',
    'nbf':'nbf.ae',
    'adcb':'adcb.com',
    'cbi':'cbiuae.com',
    'adib':'adib.ae',
    'al-hilal':'alhilalbank.ae',
    'ajman-bank':'ajmanbank.ae',
    'mbank':'mbank.ae',
    'wio':'wio.io',
    'zand':'zand.ae'
  });
  function normalize(value){
    return String(value==null?'':value).toLowerCase()
      .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'')
      .replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
      .replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function escapeRegExp(s){return s.replace(/[.*+?^$()|[\]\\]/g,'\\$&');}
  function containsAlias(haystack,alias){
    const h=' '+normalize(haystack)+' ',a=normalize(alias);
    if(!a)return false;
    if(a.length<=4&&!a.includes(' '))return new RegExp('(?:^|\\s)'+escapeRegExp(a)+'(?:$|\\s)','i').test(normalize(haystack));
    return h.includes(' '+a+' ');
  }
  function bankMeta(bankOrId){
    const bank=typeof bankOrId==='string'?get(bankOrId):bankOrId;
    return bank?(BANK_LOCALIZATION[bank.id]||{}):{};
  }
  function aliasesFor(bank){
    const meta=bankMeta(bank);
    return [bank.name,meta.ar,meta.short].concat(bank.aliases||[]).filter(Boolean);
  }
  function providerAliases(provider){
    return [provider&&provider.name,provider&&provider.nameAr,provider&&provider.short,provider&&provider.legalName].concat(provider&&provider.aliases||[]).filter(Boolean);
  }
  function get(id){return BANKS.find(b=>b.id===id)||null;}
  function getProvider(id){return PAYMENT_PROVIDERS.find(p=>p.id===id)||null;}
  function bankDisplayName(bankOrId,lang){
    const bank=typeof bankOrId==='string'?get(bankOrId):bankOrId;
    if(!bank)return '';
    const meta=bankMeta(bank);
    return String(lang||'en').toLowerCase().startsWith('ar')?(meta.ar||bank.name):bank.name;
  }
  function bankShortName(bankOrId){
    const bank=typeof bankOrId==='string'?get(bankOrId):bankOrId;
    if(!bank)return '';
    return bankMeta(bank).short||bank.name;
  }
  function providerDisplayName(providerOrId,lang){
    const p=typeof providerOrId==='string'?getProvider(providerOrId):providerOrId;
    if(!p)return '';
    return String(lang||'en').toLowerCase().startsWith('ar')?(p.nameAr||p.name):p.name;
  }
  function providerShortName(providerOrId){
    const p=typeof providerOrId==='string'?getProvider(providerOrId):providerOrId;
    return p?(p.short||p.name):'';
  }
  function list(){return BANKS.slice().sort((a,b)=>{if(!!a.popular!==!!b.popular)return a.popular?-1:1;return a.name.localeCompare(b.name,'en');});}
  function listProviders(){return PAYMENT_PROVIDERS.slice().sort((a,b)=>{if(!!a.popular!==!!b.popular)return a.popular?-1:1;return a.name.localeCompare(b.name,'en');});}
  function search(query){
    const q=normalize(query);
    if(!q)return list();
    return list().filter(bank=>aliasesFor(bank).some(alias=>normalize(alias).includes(q)));
  }
  function searchProviders(query){
    const q=normalize(query);
    if(!q)return listProviders();
    return listProviders().filter(provider=>providerAliases(provider).some(alias=>normalize(alias).includes(q)));
  }
  function logoDomain(id){
    const key=String(id||'');
    if(LOGO_DOMAINS[key])return LOGO_DOMAINS[key];
    const p=getProvider(key);
    return p&&p.logoDomain?p.logoDomain:null;
  }
  function initials(value){
    const words=normalize(value).split(' ').filter(Boolean).filter(w=>!['bank','pjsc','psc','llc','limited'].includes(w));
    if(!words.length)return '🏦';
    return words.slice(0,2).map(w=>w.charAt(0).toUpperCase()).join('');
  }
  function detect(text){
    let best=null;
    for(const bank of BANKS)for(const alias of aliasesFor(bank)){
      if(!containsAlias(text,alias))continue;
      const score=normalize(alias).length+(bank.popular?2:0);
      if(!best||score>best.score)best={bank,alias,score};
    }
    return best;
  }
  function detectProvider(text){
    let best=null;
    for(const provider of PAYMENT_PROVIDERS)for(const alias of providerAliases(provider)){
      if(!containsAlias(text,alias))continue;
      const score=normalize(alias).length;
      if(!best||score>best.score)best={provider,alias,score};
    }
    return best;
  }
  return Object.freeze({SOURCE,BANKS,BANK_LOCALIZATION,PAYMENT_PROVIDERS,LOGO_DOMAINS,list,listProviders,search,searchProviders,get,getProvider,detect,detectProvider,normalize,logoDomain,initials,bankDisplayName,bankShortName,providerDisplayName,providerShortName});
});
