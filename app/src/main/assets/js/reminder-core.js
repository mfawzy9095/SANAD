(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadReminderCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function num(v,fallback){
    const n=Number(v);
    return Number.isFinite(n)?n:fallback;
  }

  function reminderDaysOf(r){
    if(r&&r.reminderDays===0)return 0;
    return num(r&&r.reminderDays,3);
  }

  function normalizedDay(r){
    return Math.min(28,Math.max(1,num(r&&r.day,1)));
  }

  function normalizedMonth(r){
    return Math.min(11,Math.max(0,num(r&&r.month,0)));
  }

  function daysUntilNextOccurrence(r,now){
    const today=new Date(now==null?Date.now():now);
    today.setHours(0,0,0,0);
    const day=normalizedDay(r);
    if(r&&r.frequency==='yearly'){
      const m=normalizedMonth(r);
      let target=new Date(today.getFullYear(),m,day);
      if(target<today)target=new Date(today.getFullYear()+1,m,day);
      return Math.round((target-today)/86400000);
    }
    const target=new Date(today.getFullYear(),today.getMonth(),day);
    if(target<today)target.setMonth(target.getMonth()+1);
    return Math.round((target-today)/86400000);
  }

  function nativeReminderSpecs(recurring,options){
    const opts=options||{};
    const hideAmounts=!!opts.hideAmounts;
    const isValid=typeof opts.isValidSource==='function'?opts.isValidSource:function(){return true;};
    const formatAmount=typeof opts.formatAmount==='function'?opts.formatAmount:String;
    const currencySymbol=typeof opts.currencySymbol==='function'?opts.currencySymbol:function(c){return c;};

    return (Array.isArray(recurring)?recurring:[])
      .filter(r=>r&&r.active&&isValid(r))
      .map(r=>{
        const cur=r.currency||'EGP';
        const body=hideAmounts?'المبلغ مخفي':(formatAmount(r.amount)+' '+currencySymbol(cur));
        return {
          id:String(r.id),
          title:String(r.name||'SANAD'),
          body,
          frequency:r.frequency==='yearly'?'yearly':'monthly',
          day:normalizedDay(r),
          month:normalizedMonth(r),
          reminderDays:Math.min(30,Math.max(0,reminderDaysOf(r)))
        };
      });
  }

  function dueNotifications(recurring,options){
    const opts=options||{};
    const now=opts.now==null?Date.now():opts.now;
    const hideAmounts=!!opts.hideAmounts;
    const isValid=typeof opts.isValidSource==='function'?opts.isValidSource:function(){return true;};
    const formatAmount=typeof opts.formatAmount==='function'?opts.formatAmount:String;
    const currencySymbol=typeof opts.currencySymbol==='function'?opts.currencySymbol:function(c){return c;};
    const out=[];

    for(const r of (Array.isArray(recurring)?recurring:[])){
      if(!r||!r.active||!isValid(r))continue;
      const d=daysUntilNextOccurrence(r,now);
      if(d<0||d>reminderDaysOf(r))continue;
      const when=d===0?'اليوم':d===1?'غداً':'بعد '+d+' أيام';
      const cur=r.currency||'EGP';
      const name=String(r.name||'SANAD');
      const body=hideAmounts
        ? (name+' '+when+' — مبلغ مخفي')
        : (formatAmount(r.amount)+' '+currencySymbol(cur));
      out.push({id:String(r.id),title:name+' '+when,body,daysUntil:d});
    }
    return out;
  }

  return Object.freeze({
    reminderDaysOf,
    normalizedDay,
    normalizedMonth,
    daysUntilNextOccurrence,
    nativeReminderSpecs,
    dueNotifications
  });
});
