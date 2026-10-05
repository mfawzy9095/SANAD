(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./money-core.js'):root.SanadMoneyCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadReportCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Money){
  'use strict';

  const pad=n=>String(n).padStart(2,'0');
  function localIso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function ymKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1);}
  function getAccount(state,id){
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    return accounts.find(a=>a&&a.id===id)||null;
  }

  function exactTotal(values,currency){const total=Money.sum(values,currency);return total.ok?total.value:null;}
  function reportMoney(value,currency){const parsed=Money.decimal(value,currency);return parsed.ok?parsed.value:null;}
  function isRefund(t){return !!(t&&(t.financialEvent==='purchase-refund'||t.bankImportEvidence&&t.bankImportEvidence.kind==='refund'));}
  function reportUncertainty(t,account){
    if(!account)return 'account-unresolved';
    const kind=(t.bankImportEvidence||{}).kind||String(t.bankImportKey||'').split('|')[2]||null;
    const imported=!!(t.bankImportKey||t.bankImportEventId||t.bankImportEvidence);
    const origin=t.economicOrigin||{};
    const confirmed=origin.source==='user-confirmation'&&(!t.bankImportEventId||origin.eventId===t.bankImportEventId);
    if(t.accountId&&t.currency&&t.currency!==account.currency&&t.walletAmount==null)return 'currency-unresolved';
    if(t.type==='expense'&&t.bankPrincipalAmount!=null&&t.bankFeeEvidence&&t.bankFeeEvidence.confirmed){
      if(t.bankFeeEvidence.currency!==account.currency||exactTotal([t.bankPrincipalAmount,t.bankFeeEvidence.amount],account.currency)!==reportMoney(t.walletAmount!=null?t.walletAmount:t.amount,account.currency))return 'fee-components-unresolved';
    }
    if(t.type==='income'&&!isRefund(t)){
      if(['credit','debt'].includes(account.type))return 'liability-income-review';
      if(imported&&kind!=='salary'&&!(confirmed&&origin.kind==='external-income'))return 'historical-incoming-origin-unconfirmed';
    }
    if(t.type==='external_transfer'&&imported&&!(confirmed&&origin.kind==='external-destination'))return 'historical-outgoing-destination-unconfirmed';
    return null;
  }

  function groupedTotals(entries,key){
    const groups={};for(const e of entries){const k=key(e);(groups[k]||(groups[k]=[])).push(e);}
    const out={};for(const [k,rows]of Object.entries(groups))out[k]=exactTotal(rows.map(e=>e.amount),rows[0].currency);
    return out;
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
    const byId=new Map(((state&&state.transactions)||[]).map(t=>[t.id,t]));
    const push=entry=>{
      if(o.accountId&&entry.accountId!==o.accountId)return;
      if(o.currency&&entry.currency!==o.currency)return;
      const source=byId.get(entry.sourceTxId);
      const reason=reportUncertainty(source,getAccount(state,entry.accountId));
      if(reason){entry.recordedAmount=entry.amount;entry.amount=null;entry.reviewReason=reason;}
      out.push(entry);
    };
    for(const t of (state&&state.transactions)||[]){
      if(!t||!t.date||t.date<range.start||t.date>range.end)continue;
      if(t.type==='expense'){
        const acc=getAccount(state,t.accountId);
        if(!acc||acc.country!==o.country)continue;
        const gross=reportMoney(t.walletAmount!=null?t.walletAmount:t.amount,acc.currency);
        const splitFee=t.bankPrincipalAmount!=null&&t.bankFeeEvidence&&t.bankFeeEvidence.confirmed&&t.bankFeeEvidence.currency===acc.currency&&exactTotal([t.bankPrincipalAmount,t.bankFeeEvidence.amount],acc.currency)===gross;
        const amount=splitFee?reportMoney(t.bankPrincipalAmount,acc.currency):gross;
        if(amount!==null&&amount<=0)continue;
        push({
          id:t.id+':exp',sourceTxId:t.id,sourceType:'expense',
          amount,currency:acc.currency,category:t.cat||'other',
          date:t.date,accountId:t.accountId,instrumentId:t.instrumentId||null,note:t.note||''
        });
        if(splitFee&&Number(t.bankFeeEvidence.amount)>0)push({id:t.id+':bank-fee',sourceTxId:t.id,sourceType:'purchase_fee',amount:reportMoney(t.bankFeeEvidence.amount,acc.currency),currency:acc.currency,category:'bankFee',date:t.date,accountId:t.accountId,note:t.note||''});
      }
      if(t.type==='income'&&isRefund(t)){
        const acc=getAccount(state,t.accountId);if(!acc||acc.country!==o.country)continue;
        const value=reportMoney(t.walletAmount!=null?t.walletAmount:t.amount,acc.currency);
        push({id:t.id+':refund',sourceTxId:t.id,sourceType:'refund',amount:value===null?null:-value,currency:acc.currency,category:'purchaseRefund',date:t.date,accountId:t.accountId,note:t.note||''});
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
      if(!t||t.type!=='income'||isRefund(t)||!t.date||t.date<range.start||t.date>range.end)continue;
      const acc=getAccount(state,t.accountId);
      if(!acc||acc.country!==o.country)continue;
      if(o.accountId&&t.accountId!==o.accountId)continue;
      if(o.currency&&acc.currency!==o.currency)continue;
      const value=reportMoney(t.walletAmount!=null?t.walletAmount:t.amount,acc.currency),reason=reportUncertainty(t,acc),amount=reason?null:value;
      out.push({
        id:t.id+':inc',recordedAmount:value,reviewReason:reason,sourceTxId:t.id,amount,currency:acc.currency,
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
    const currencies=new Set(list.map(e=>e.currency));if(currencies.size>1||currencies.has(undefined)||list.some(e=>e.amount===null))return [];
    const currency=list.length?list[0].currency:null;
    const total=rows=>rows.length?exactTotal(rows.map(e=>e.amount),currency):0;
    if(period==='today'){
      return [{label:'اليوم',val:total(list),hi:true}];
    }
    if(period==='week'){
      const days=[];
      for(let i=6;i>=0;i--){
        const d=new Date(today);d.setDate(d.getDate()-i);
        const key=localIso(d);
        const val=total(list.filter(e=>e.date===key));
        days.push({label:d.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'short'}),val,hi:i===0});
      }
      return days;
    }
    if(period==='month'){
      const last=new Date(Y,M,0).getDate(),nWeeks=Math.ceil(last/7),weeks=[];
      for(let i=0;i<nWeeks;i++){
        const start=i*7+1,end=Math.min((i+1)*7,last),dateSet=new Set();
        for(let d=start;d<=end;d++)dateSet.add(Y+'-'+pad(M)+'-'+pad(d));
        const val=total(list.filter(e=>dateSet.has(e.date)));
        weeks.push({label:'أ'+(i+1),val,hi:false});
      }
      return weeks;
    }
    if(period==='6months'){
      const months=[];
      for(let i=5;i>=0;i--){
        const d=new Date(Y,M-1-i,1),key=ymKey(d);
        const val=total(list.filter(e=>String(e.date||'').slice(0,7)===key));
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
    const spendingByCur=groupedTotals(expenses,e=>e.currency),incomeByCur=groupedTotals(incomes,e=>e.currency),categoryByCur={};
    for(const currency of new Set(expenses.map(e=>e.currency)))categoryByCur[currency]=groupedTotals(expenses.filter(e=>e.currency===currency),e=>e.category);
    const chartCurrencyRequired=new Set(expenses.map(e=>e.currency)).size>1;
    return {
      country:o.country,
      period:o.period,
      accountId:o.accountId,
      currency:o.currency,
      month:o.month,
      expenses,incomes,transfers,spendingByCur,incomeByCur,categoryByCur,chartCurrencyRequired,
      financialReviews:expenses.concat(incomes).filter(e=>e.reviewReason||e.amount===null).map(e=>({sourceTxId:e.sourceTxId,reason:e.reviewReason||'money-invalid',recordedAmount:e.recordedAmount,currency:e.currency})),
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
      const spent=spendingByCur[cur]===undefined?0:spendingByCur[cur];
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
      if(al.level==='unknown')continue;
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
    const rows=(Array.isArray(list)?list:[]).filter(Boolean).map(t=>{const acc=getAccount(state,useFrom?t.fromAccountId:t.toAccountId);return {currency:(useFrom?t.fromCurrency:t.toCurrency)||(acc&&acc.currency)||'UNKNOWN',amount:useFrom?t.fromAmount:t.toAmount};});
    return groupedTotals(rows,e=>e.currency);
  }
  function creditPeriodActivity(state,accountId,range){
    const r=range||{},purchases=[],repayment=[];const acc=getAccount(state,accountId);
    for(const t of (state&&state.transactions)||[]){
      if(!t||!t.date||t.date<r.start||t.date>r.end)continue;
      if(t.type==='expense'&&t.accountId===accountId)purchases.push(t.walletAmount!=null?t.walletAmount:t.amount);
      if(t.type==='income'&&t.accountId===accountId&&isRefund(t))purchases.push(-Number(t.walletAmount!=null?t.walletAmount:t.amount));
      if(t.type==='transfer'&&t.toAccountId===accountId)repayment.push(t.toAmount);
    }
    return {purchases:purchases.length?exactTotal(purchases,acc&&acc.currency):0,repaymentPrincipal:repayment.length?exactTotal(repayment,acc&&acc.currency):0};
  }

  function categoryPieBuckets(categoryTotals){
    const all=Object.entries(categoryTotals||{}).filter(([,value])=>value!==null&&Number(value)>0).sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0));
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
    if(spent===null)return {level:'unknown',pct:null};
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
