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
  function normalize(value){
    return String(value==null?'':value).toLowerCase()
      .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
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
  function aliasesFor(bank){return [bank.name].concat(bank.aliases||[]);}
  function get(id){return BANKS.find(b=>b.id===id)||null;}
  function list(){return BANKS.slice().sort((a,b)=>{if(!!a.popular!==!!b.popular)return a.popular?-1:1;return a.name.localeCompare(b.name,'en');});}
  function detect(text){
    let best=null;
    for(const bank of BANKS)for(const alias of aliasesFor(bank)){
      if(!containsAlias(text,alias))continue;
      const score=normalize(alias).length+(bank.popular?2:0);
      if(!best||score>best.score)best={bank,alias,score};
    }
    return best;
  }
  return Object.freeze({SOURCE,BANKS,list,get,detect,normalize});
});
