(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadReportCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const pad=n=>String(n).padStart(2,'0');
  function localIso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function ymKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1);}
  function getAccount(state,id){
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    return accounts.find(a=>a&&a.id===id)||null;
  }

  function periodRange(period,monthKey,now){
    const today=new Date(now==null?Date.now():now);
    today.setHours(0,0,0,0);
    const mk=monthKey||ymKey(today);
    const [Y,M]=mk.split('-').map(Number);
    if(period==='today'){
      const iso=localIso(today);
      return {start:iso,end:iso};
    }
    if(period==='week'){
      const start=new Date(today);
      start.setDate(start.getDate()-6);
      return {start:localIso(start),end:localIso(today)};
    }
    if(period==='month'){
      const s=new Date(Y,M-1,1),e=new Date(Y,M,0);
      return {start:localIso(s),end:localIso(e)};
    }
    if(period==='6months'){
      const s=new Date(Y,M-6,1),e=new Date(Y,M,0);
      return {start:localIso(s),end:localIso(e)};
    }
    const iso=localIso(today);
    return {start:iso,end:iso};
  }

  function reportExpenseEntries(state,options){
    const o=options||{};
    const range=periodRange(o.period,o.month,o.now);
    const out=[];
    const push=entry=>{
      if(o.accountId&&entry.accountId!==o.accountId)return;
      if(o.currency&&entry.currency!==o.currency)return;
      out.push(entry);
    };
    for(const t of (state&&state.transactions)||[]){
      if(!t||!t.date||t.date<range.start||t.date>range.end)continue;
      if(t.type==='expense'){
        const acc=getAccount(state,t.accountId);
        if(!acc||acc.country!==o.country)continue;
        const amount=Number(t.walletAmount!=null?t.walletAmount:t.amount)||0;
        if(amount<=0)continue;
        push({
          id:t.id+':exp',sourceTxId:t.id,sourceType:'expense',
          amount,currency:acc.currency,category:t.cat||'other',
          date:t.date,accountId:t.accountId,instrumentId:t.instrumentId||null,note:t.note||''
        });
      }
      if(t.type==='transfer'){
        const fee=Number(t.fee)||0;
        if(fee<=0)continue;
        const fromAcc=getAccount(state,t.fromAccountId);
        if(!fromAcc||fromAcc.country!==o.country)continue;
        push({
          id:t.id+':fee',sourceTxId:t.id,sourceType:'transfer_fee',
          amount:fee,currency:fromAcc.currency,category:'transferFee',
          date:t.date,accountId:t.fromAccountId,instrumentId:t.instrumentId||null,note:t.note||''
        });
      }
      if(t.type==='external_transfer'){
        const fromAcc=getAccount(state,t.fromAccountId);
        if(!fromAcc||fromAcc.country!==o.country)continue;
        const principal=Number(t.fromAmount)||0;
        if(principal>0){
          push({
            id:t.id+':principal',sourceTxId:t.id,sourceType:'external_transfer_principal',
            amount:principal,currency:fromAcc.currency,category:'externalTransfer',
            date:t.date,accountId:t.fromAccountId,instrumentId:t.instrumentId||null,note:t.note||''
          });
        }
        const fee=Number(t.fee)||0;
        if(fee>0){
          push({
            id:t.id+':fee',sourceTxId:t.id,sourceType:'external_transfer_fee',
            amount:fee,currency:fromAcc.currency,category:'transferFee',
            date:t.date,accountId:t.fromAccountId,note:t.note||''
          });
        }
      }
    }
    return out;
  }

  function reportIncomeEntries(state,options){
    const o=options||{};
    const range=periodRange(o.period,o.month,o.now);
    const out=[];
    for(const t of (state&&state.transactions)||[]){
      if(!t||t.type!=='income'||!t.date||t.date<range.start||t.date>range.end)continue;
      const acc=getAccount(state,t.accountId);
      if(!acc||acc.country!==o.country)continue;
      if(o.accountId&&t.accountId!==o.accountId)continue;
      if(o.currency&&acc.currency!==o.currency)continue;
      const amount=Number(t.walletAmount!=null?t.walletAmount:t.amount)||0;
      out.push({
        id:t.id+':inc',sourceTxId:t.id,amount,currency:acc.currency,
        category:t.cat||'other',date:t.date,accountId:t.accountId,note:t.note||''
      });
    }
    return out;
  }

  function reportTransferEntries(state,options){
    const o=options||{};
    const range=periodRange(o.period,o.month,o.now);
    const internalOut=[],internalIn=[],crossOut=[],crossIn=[];
    const allInternal=[],allOutbound=[],allInbound=[];
    for(const t of (state&&state.transactions)||[]){
      if(!t||t.type!=='transfer'||!t.date||t.date<range.start||t.date>range.end)continue;
      const fromAcc=getAccount(state,t.fromAccountId),toAcc=getAccount(state,t.toAccountId);
      if(!fromAcc||!toAcc)continue;
      const fromIn=fromAcc.country===o.country,toIn=toAcc.country===o.country;
      if(!fromIn&&!toIn)continue;
      if(fromIn&&toIn)allInternal.push(t);
      else if(fromIn&&!toIn)allOutbound.push(t);
      else if(!fromIn&&toIn)allInbound.push(t);
      if(o.accountId){
        if(t.fromAccountId===o.accountId){
          if(toIn)internalOut.push(t);else crossOut.push(t);
        }else if(t.toAccountId===o.accountId){
          if(fromIn)internalIn.push(t);else crossIn.push(t);
        }
      }else{
        if(fromIn&&toIn)internalOut.push(t);
        else if(fromIn&&!toIn)crossOut.push(t);
        else if(!fromIn&&toIn)crossIn.push(t);
      }
    }
    return {
      internal:allInternal,outbound:allOutbound,inbound:allInbound,
      internalOut,internalIn,crossOut,crossIn
    };
  }

  function chartBuckets(period,expenses,month,now){
    const today=new Date(now==null?Date.now():now);
    today.setHours(0,0,0,0);
    const mk=month||ymKey(today),[Y,M]=mk.split('-').map(Number);
    const list=Array.isArray(expenses)?expenses:[];
    if(period==='today'){
      return [{label:'اليوم',val:list.reduce((s,e)=>s+(Number(e.amount)||0),0),hi:true}];
    }
    if(period==='week'){
      const days=[];
      for(let i=6;i>=0;i--){
        const d=new Date(today);d.setDate(d.getDate()-i);
        const key=localIso(d);
        const val=list.filter(e=>e.date===key).reduce((s,e)=>s+(Number(e.amount)||0),0);
        days.push({label:d.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'short'}),val,hi:i===0});
      }
      return days;
    }
    if(period==='month'){
      const last=new Date(Y,M,0).getDate(),nWeeks=Math.ceil(last/7),weeks=[];
      for(let i=0;i<nWeeks;i++){
        const start=i*7+1,end=Math.min((i+1)*7,last),dateSet=new Set();
        for(let d=start;d<=end;d++)dateSet.add(Y+'-'+pad(M)+'-'+pad(d));
        const val=list.filter(e=>dateSet.has(e.date)).reduce((sum,e)=>sum+(Number(e.amount)||0),0);
        weeks.push({label:'أ'+(i+1),val,hi:false});
      }
      return weeks;
    }
    if(period==='6months'){
      const months=[];
      for(let i=5;i>=0;i--){
        const d=new Date(Y,M-1-i,1),key=ymKey(d);
        const val=list.filter(e=>String(e.date||'').slice(0,7)===key).reduce((sum,e)=>sum+(Number(e.amount)||0),0);
        months.push({label:d.toLocaleDateString('ar-EG-u-nu-latn',{month:'short'}),val,hi:i===0});
      }
      return months;
    }
    return [];
  }

  function buildReportDataset(state,options){
    const o=options||{};
    const expenses=reportExpenseEntries(state,o);
    const incomes=reportIncomeEntries(state,o);
    const transfers=reportTransferEntries(state,o);
    const spendingByCur={},incomeByCur={},categoryByCur={};
    expenses.forEach(e=>{
      spendingByCur[e.currency]=(spendingByCur[e.currency]||0)+e.amount;
      if(!categoryByCur[e.currency])categoryByCur[e.currency]={};
      categoryByCur[e.currency][e.category]=(categoryByCur[e.currency][e.category]||0)+e.amount;
    });
    incomes.forEach(e=>{incomeByCur[e.currency]=(incomeByCur[e.currency]||0)+e.amount;});
    return {
      country:o.country,
      period:o.period,
      accountId:o.accountId,
      currency:o.currency,
      month:o.month,
      expenses,incomes,transfers,spendingByCur,incomeByCur,categoryByCur,
      chartBuckets:chartBuckets(o.period,expenses,o.month,o.now)
    };
  }

  function getCategoryBudget(categoryBudgets,month,country,currency,category){
    const mb=categoryBudgets&&categoryBudgets[month];
    if(!mb||!mb[country]||!mb[country][currency])return 0;
    return Number(mb[country][currency][category])||0;
  }

  function setCategoryBudget(categoryBudgets,month,country,currency,category,amount){
    if(!categoryBudgets[month])categoryBudgets[month]={};
    if(!categoryBudgets[month][country])categoryBudgets[month][country]={};
    if(!categoryBudgets[month][country][currency])categoryBudgets[month][country][currency]={};
    if(amount>0)categoryBudgets[month][country][currency][category]=amount;
    else delete categoryBudgets[month][country][currency][category];
  }

  function getOverallLimit(overallSpendingLimits,month,country,currency){
    const ol=overallSpendingLimits&&overallSpendingLimits[month];
    if(!ol||!ol[country])return 0;
    return Number(ol[country][currency])||0;
  }

  function setOverallLimit(overallSpendingLimits,month,country,currency,amount){
    if(!overallSpendingLimits[month])overallSpendingLimits[month]={};
    if(!overallSpendingLimits[month][country])overallSpendingLimits[month][country]={};
    if(amount>0)overallSpendingLimits[month][country][currency]=amount;
    else delete overallSpendingLimits[month][country][currency];
  }

  function computeBudgetStatus(spent,budget){
    const b=Number(budget)||0,s=Number(spent)||0;
    if(b<=0)return {level:'none',pct:0};
    const pct=(s/b)*100;
    if(pct>=100)return {level:'over',pct};
    if(pct>=95)return {level:'strong',pct};
    if(pct>=80)return {level:'warn',pct};
    return {level:'normal',pct};
  }

  return Object.freeze({
    periodRange,
    reportExpenseEntries,
    reportIncomeEntries,
    reportTransferEntries,
    chartBuckets,
    buildReportDataset,
    getCategoryBudget,
    setCategoryBudget,
    getOverallLimit,
    setOverallLimit,
    computeBudgetStatus
  });
});
