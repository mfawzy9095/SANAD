(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadFinanceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const LIABILITY_TYPES=new Set(['credit','debt']);

  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function round2(v){return Math.round(num(v)*100)/100;}
  function isLiabilityAccount(account){return !!(account&&LIABILITY_TYPES.has(account.type));}
  function getAccount(state,id){
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    return accounts.find(a=>a&&a.id===id)||null;
  }

  function accountBalance(state,accountId,asOf){
    const a=getAccount(state,accountId);
    if(!a)return 0;
    const cutoff=asOf==null?Infinity:Number(asOf);
    const baseline=a.bankBalanceBaseline;
    const baselineAt=baseline&&Number(baseline.at)>0?Number(baseline.at):0;
    if(baselineAt&&cutoff<baselineAt)return null;
    const txs=(state&&Array.isArray(state.transactions)?state.transactions:[]).filter(t=>{
      if(!t)return false;
      const at=Number(t.created)||0;
      return (!baselineAt||at>=baselineAt)&&at<=cutoff;
    });

    if(isLiabilityAccount(a)){
      let debt=num(a.openingDebt);
      for(const t of txs){
        if(!t)continue;
        if(t.accountId===accountId){
          if(t.type==='expense')debt+=num(t.walletAmount!=null?t.walletAmount:t.amount);
          if(t.type==='income')debt-=num(t.walletAmount!=null?t.walletAmount:t.amount);
          if(t.type==='adjustment')debt-=num(t.walletAmount);
        }
        if(t.type==='transfer'){
          if(t.toAccountId===accountId)debt-=num(t.toAmount);
          if(t.fromAccountId===accountId){
            debt+=num(t.fromAmount);
            if(num(t.fee)>0)debt+=num(t.fee);
          }
        }
      }
      return -round2(debt);
    }

    let bal=baselineAt?num(baseline.balance):num(a.openingBalance);
    for(const t of txs){
      if(!t)continue;
      if(t.accountId===accountId){
        if(t.type==='expense')bal-=num(t.walletAmount!=null?t.walletAmount:t.amount);
        if(t.type==='income')bal+=num(t.walletAmount!=null?t.walletAmount:t.amount);
        if(t.type==='adjustment')bal+=num(t.walletAmount);
      }
      if(t.type==='transfer'){
        if(t.fromAccountId===accountId){
          bal-=num(t.fromAmount);
          if(num(t.fee)>0)bal-=num(t.fee);
        }
        if(t.toAccountId===accountId)bal+=num(t.toAmount);
      }
      if(t.type==='external_transfer'&&t.fromAccountId===accountId){
        bal-=num(t.fromAmount);
        if(num(t.fee)>0)bal-=num(t.fee);
      }
    }
    return round2(bal);
  }

  function accountBalanceAt(state,accountId,at){
    if(at==null||!Number.isFinite(Number(at)))return null;
    return accountBalance(state,accountId,Number(at));
  }

  function accountBalancePresentation(state,accountId){
    const a=getAccount(state,accountId);
    const calculated=round2(accountBalance(state,accountId));
    if(!a)return {calculated,observed:null,display:calculated,observedAt:0,latestActivityAt:0,observedIsCurrent:false,mismatch:false,difference:null};
    const hasObserved=a.observedBalance!==null&&a.observedBalance!==undefined&&a.observedBalance!==''&&Number.isFinite(Number(a.observedBalance));
    const observed=hasObserved?round2(Number(a.observedBalance)):null;
    const observedAt=Number(a.observedBalanceAt)||0;
    const txs=state&&Array.isArray(state.transactions)?state.transactions:[];
    let latestActivityAt=0;
    for(const t of txs){
      if(!t)continue;
      const touches=t.accountId===accountId||t.fromAccountId===accountId||t.toAccountId===accountId;
      if(!touches)continue;
      const at=Number(t.created)||0;
      if(at>latestActivityAt)latestActivityAt=at;
    }
    const observedIsCurrent=observed!==null&&observedAt>0&&(latestActivityAt<=0||observedAt>=latestActivityAt);
    const difference=observed===null?null:round2(observed-calculated);
    return {
      calculated,
      observed,
      display:observedIsCurrent?observed:calculated,
      observedAt,
      latestActivityAt,
      observedIsCurrent,
      mismatch:observedIsCurrent&&difference!==null&&Math.abs(difference)>0.01,
      difference
    };
  }

  function accountDebt(state,accountId){
    const bal=accountBalance(state,accountId);
    return bal<0?-bal:0;
  }

  function creditAvailable(state,accountId){
    const a=getAccount(state,accountId);
    if(!a||a.type!=='credit')return null;
    const limit=num(a.creditLimit);
    if(limit<=0)return null;
    return Math.max(0,round2(limit-accountDebt(state,accountId)));
  }

  function capturePrepaidBalances(state){
    const out=new Map();
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    for(const a of accounts){
      if(a&&a.type==='prepaid')out.set(a.id,accountBalance(state,a.id));
    }
    return out;
  }

  function checkPrepaidInvariant(before,state){
    const prepaidBefore=before instanceof Map?before:new Map(before||[]);
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    for(const a of accounts){
      if(!a||a.type!=='prepaid')continue;
      const afterBal=accountBalance(state,a.id);
      const hadBefore=prepaidBefore.has(a.id);
      const beforeBal=hadBefore?num(prepaidBefore.get(a.id)):null;
      if(!hadBefore){
        if(afterBal<-0.01)return 'prepaid-insufficient';
        continue;
      }
      if(beforeBal>=-0.01&&afterBal<-0.01)return 'prepaid-insufficient';
      if(beforeBal<-0.01&&afterBal<beforeBal-0.01)return 'prepaid-insufficient';
    }
    return null;
  }

  function suggestRate(fromCur,toCur,lastFx,defaultFx){
    if(fromCur===toCur)return 1;
    const saved=lastFx&&num(lastFx[fromCur+'_'+toCur]);
    if(saved>0)return saved;
    const direct=defaultFx&&num(defaultFx[fromCur+'_'+toCur]);
    if(direct>0)return direct;
    const inverse=defaultFx&&num(defaultFx[toCur+'_'+fromCur]);
    if(inverse>0)return Math.round((1/inverse)*10000)/10000;
    return 1;
  }

  return Object.freeze({
    accountBalance,
    accountBalanceAt,
    accountBalancePresentation,
    accountDebt,
    capturePrepaidBalances,
    checkPrepaidInvariant,
    creditAvailable,
    getAccount,
    isLiabilityAccount,
    round2,
    suggestRate
  });
});
