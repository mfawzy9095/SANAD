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

  function evaluateBudgetAlerts(dataset,options){
    const ds=dataset||{};
    const o=options||{};
    const month=o.month;
    const country=o.country;
    const overallSpendingLimits=o.overallSpendingLimits||{};
    const categoryBudgets=o.categoryBudgets||{};
    const budgetAlerts=o.budgetAlerts||{};
    const spendingByCur=ds.spendingByCur||{};
    const categoryByCur=ds.categoryByCur||{};
    const evaluated=[];

    const overallByCur=(overallSpendingLimits[month]&&overallSpendingLimits[month][country])||{};
    Object.entries(overallByCur).forEach(([cur,limit])=>{
      const lim=Number(limit)||0;
      if(lim<=0)return;
      const spent=spendingByCur[cur]||0;
      const st=computeBudgetStatus(spent,lim);
      evaluated.push({type:'overall',month,country,currency:cur,level:st.level,spent,limit:lim,pct:st.pct});
    });

    const catByCur=(categoryBudgets[month]&&categoryBudgets[month][country])||{};
    Object.entries(catByCur).forEach(([cur,cats])=>{
      Object.entries(cats||{}).forEach(([catId,limit])=>{
        const lim=Number(limit)||0;
        if(lim<=0)return;
        const spent=(categoryByCur[cur]&&categoryByCur[cur][catId])||0;
        const st=computeBudgetStatus(spent,lim);
        evaluated.push({type:'category',month,country,currency:cur,category:catId,level:st.level,spent,limit:lim,pct:st.pct});
      });
    });

    const newAlerts=[];
    for(const al of evaluated){
      const key=al.type+'|'+al.month+'|'+al.country+'|'+al.currency+'|'+(al.category||'_');
      const stored=budgetAlerts[key]||{warned80:false,warned95:false,warned100:false};
      const pct=al.pct||0;
      if(pct<80){
        stored.warned80=false;stored.warned95=false;stored.warned100=false;
      }else if(pct<95){
        stored.warned95=false;stored.warned100=false;
      }else if(pct<100){
        stored.warned100=false;
      }

      let trigger=false;
      if(al.level==='warn'&&!stored.warned80){stored.warned80=true;trigger=true;}
      else if(al.level==='strong'&&!stored.warned95){stored.warned80=true;stored.warned95=true;trigger=true;}
      else if(al.level==='over'&&!stored.warned100){stored.warned80=true;stored.warned95=true;stored.warned100=true;trigger=true;}

      budgetAlerts[key]=stored;
      if(trigger)newAlerts.push(al);
    }
    return newAlerts;
  }

  function transferCurrencyTotals(state,list,useFrom){
    const totals={};
    const rows=Array.isArray(list)?list:[];
    rows.forEach(t=>{
      if(!t)return;
      const accountId=useFrom?t.fromAccountId:t.toAccountId;
      const acc=getAccount(state,accountId);
      const cur=(useFrom?t.fromCurrency:t.toCurrency)||(acc?acc.currency:'AED');
      const amount=useFrom?(Number(t.fromAmount)||0):(Number(t.toAmount)||0);
      totals[cur]=(totals[cur]||0)+amount;
    });
    return totals;
  }

  function creditPeriodActivity(state,accountId,range){
    const r=range||{};
    let purchases=0,repaymentPrincipal=0;
    for(const t of (state&&state.transactions)||[]){
      if(!t||!t.date||t.date<r.start||t.date>r.end)continue;
      if(t.type==='expense'&&t.accountId===accountId){
        purchases+=Number(t.walletAmount!=null?t.walletAmount:t.amount)||0;
      }
      if(t.type==='transfer'&&t.toAccountId===accountId){
        repaymentPrincipal+=Number(t.toAmount)||0;
      }
    }
    return {purchases,repaymentPrincipal};
  }

  function categoryPieBuckets(categoryTotals){
    const all=Object.entries(categoryTotals||{}).sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0));
    if(all.length<=6)return all.map(([id,value])=>({id,value:Number(value)||0,other:false}));
    const top5=all.slice(0,5).map(([id,value])=>({id,value:Number(value)||0,other:false}));
    const rest=all.slice(5).reduce((sum,[,value])=>sum+(Number(value)||0),0);
    top5.push({id:null,value:rest,other:true});
    return top5;
  }

  function distinctSourceTransactionCount(entries,currency){
    const list=Array.isArray(entries)?entries:[];
    return new Set(list.filter(e=>e&&(!currency||e.currency===currency)).map(e=>e.sourceTxId)).size;
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
    evaluateBudgetAlerts,
    transferCurrencyTotals,
    creditPeriodActivity,
    categoryPieBuckets,
    distinctSourceTransactionCount,
    computeBudgetStatus
  });
});
