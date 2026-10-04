(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadStateCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function stableStringify(obj){
    if(obj===null||obj===undefined)return JSON.stringify(obj);
    if(typeof obj!=='object')return JSON.stringify(obj);
    if(Array.isArray(obj)){
      const allHaveId=obj.length>0&&obj.every(x=>x&&typeof x==='object'&&'id' in x);
      const arr=allHaveId?[...obj].sort((a,b)=>String(a.id).localeCompare(String(b.id))):obj;
      return '['+arr.map(stableStringify).join(',')+']';
    }
    const keys=Object.keys(obj).sort();
    return '{'+keys.map(k=>JSON.stringify(k)+':'+stableStringify(obj[k])).join(',')+'}';
  }

  function stateFingerprint(st){
    if(!st)return '';
    try{
      return stableStringify({
        schemaVersion:st.schemaVersion,
        institutions:st.institutions||[],
        accounts:st.accounts||[],
        paymentInstruments:st.paymentInstruments||[],
        transactions:st.transactions||[],
        beneficiaries:st.beneficiaries||[],
        categories:st.categories||{},
        tags:st.tags||[],
        recurring:st.recurring||[],
        settings:st.settings||{}
      });
    }catch(e){
      return 'fp-error:'+(e&&e.message?e.message:'unknown');
    }
  }

  function isValidIsoDate(v){
    if(typeof v!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;
    const parts=v.split('-').map(Number),y=parts[0],m=parts[1],d=parts[2];
    const dt=new Date(y,m-1,d);
    return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;
  }

  function txTimeValue(t){
    if(t&&isValidIsoDate(t.date)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.transactionTime||'')){
      const [y,m,d]=t.date.split('-').map(Number),[h,mi]=t.transactionTime.split(':').map(Number);
      return new Date(y,m-1,d,h,mi,0,0).getTime();
    }
    const c=Number(t&&t.created);
    if(Number.isFinite(c))return c;
    if(t&&isValidIsoDate(t.date)){
      const [y,m,d]=t.date.split('-').map(Number);
      return new Date(y,m-1,d,12,0,0,0).getTime();
    }
    return 0;
  }

  function compareTxDesc(a,b){
    const dc=String((b&&b.date)||'').localeCompare(String((a&&a.date)||''));
    if(dc)return dc;
    const tc=txTimeValue(b)-txTimeValue(a);
    if(tc)return tc;
    return String((b&&b.id)||'').localeCompare(String((a&&a.id)||''));
  }

  return Object.freeze({
    stableStringify,
    stateFingerprint,
    isValidIsoDate,
    txTimeValue,
    compareTxDesc
  });
});

