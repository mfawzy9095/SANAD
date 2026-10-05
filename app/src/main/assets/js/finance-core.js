(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./money-core.js'):root.SanadMoneyCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadFinanceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Money){
  'use strict';

  const LIABILITY_TYPES=new Set(['credit','debt']);

  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function round2(v){return Math.round(num(v)*100)/100;}
  function isLiabilityAccount(account){return !!(account&&LIABILITY_TYPES.has(account.type));}
  function getAccount(state,id){
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    return accounts.find(a=>a&&a.id===id)||null;
  }

  function openingKnown(a){
    if(!a)return false;
    const flag=isLiabilityAccount(a)?a.openingDebtKnown:a.openingBalanceKnown;
    if(flag===false||a.baselinePartial===true)return false;
    if(a.autoDiscovered===true&&flag!==true)return false;
    const value=isLiabilityAccount(a)?a.openingDebt:a.openingBalance;
    return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  }
  function balanceTerms(state,accountId,asOf){
    const a=getAccount(state,accountId);if(!a)return null;
    const cutoff=asOf==null?Infinity:Number(asOf),terms=[];
    for(const t of (state&&state.transactions)||[]){
      if(!t)continue;
      const side=t.type==='transfer'?(t.fromAccountId===accountId?'from':t.toAccountId===accountId?'to':null):null;
      const posting=side&&t.bankPostingTimes&&Number(t.bankPostingTimes[side]);
      const at=posting>0?posting:Number(t.created)||0;if(at>cutoff)continue;
      if(t.accountId===accountId&&['expense','income','adjustment'].includes(t.type)){
        const hasWallet=t.walletAmount!==null&&t.walletAmount!==undefined;
        const currency=hasWallet?(t.walletCurrency||a.currency):(t.currency||a.currency);
        if(currency!==a.currency)return null;
        const amount=hasWallet?t.walletAmount:t.amount;
        const parsed=Money.decimal(amount,a.currency);if(!parsed.ok)return null;
        if(t.type!=='adjustment'&&parsed.value<0)return null;
        terms.push(t.type==='expense'?-parsed.value:parsed.value);
      }
      if((t.type==='transfer'||t.type==='external_transfer')&&t.fromAccountId===accountId){
        if(t.fromCurrency&&t.fromCurrency!==a.currency)return null;
        const principal=Money.decimal(t.fromAmount,a.currency),fee=Money.decimal(t.fee==null?0:t.fee,a.currency);
        if(!principal.ok||!fee.ok||principal.value<0||fee.value<0)return null;
        terms.push(-principal.value,-fee.value);
      }
      if(t.type==='transfer'&&t.toAccountId===accountId){
        if(t.toCurrency&&t.toCurrency!==a.currency)return null;
        const principal=Money.decimal(t.toAmount,a.currency);if(!principal.ok||principal.value<0)return null;
        terms.push(principal.value);
      }
    }
    return terms;
  }
  function accountMovement(state,accountId,asOf){
    const a=getAccount(state,accountId),terms=balanceTerms(state,accountId,asOf);if(!a||!terms)return null;
    const total=Money.sum(terms,a.currency);return total.ok?total.value:null;
  }
  function hasUnconfirmedEvidence(t,account){
    if(!t)return false;
    const kind=(t.bankImportEvidence||{}).kind||String(t.bankImportKey||'').split('|')[2]||null;
    if(t.type==='income'&&isLiabilityAccount(account)&&kind!=='refund'&&t.financialEvent!=='purchase-refund')return true;
    if(!t.bankImportKey&&!t.bankImportEventId&&!t.bankImportEvidence)return false;
    const origin=t.economicOrigin||{};
    const userConfirmed=origin.source==='user-confirmation'&&(!t.bankImportEventId||origin.eventId===t.bankImportEventId);
    if(t.type==='income'&&!['salary','refund'].includes(kind))return !(userConfirmed&&origin.kind==='external-income');
    if(t.type==='external_transfer')return !(userConfirmed&&origin.kind==='external-destination');
    return false;
  }
  function accountBalance(state,accountId,asOf){
    const a=getAccount(state,accountId);if(!openingKnown(a))return null;
    const cutoff=asOf==null?Infinity:Number(asOf);
    for(const t of (state&&state.transactions)||[]){
      if(!t||!(t.accountId===accountId||t.fromAccountId===accountId||t.toAccountId===accountId))continue;
      const side=t.type==='transfer'?(t.fromAccountId===accountId?'from':'to'):null;
      const posting=side&&t.bankPostingTimes&&Number(t.bankPostingTimes[side]);
      if((posting>0?posting:Number(t.created)||0)>cutoff)continue;
      if(hasUnconfirmedEvidence(t,a))return null;
    }
    const terms=balanceTerms(state,accountId,asOf);if(!terms)return null;
    terms.unshift(isLiabilityAccount(a)?-Number(a.openingDebt):a.openingBalance);
    const total=Money.sum(terms,a.currency);return total.ok?total.value:null;
  }
  function setOpeningBalance(account,value){
    const parsed=Money.decimal(value,account.currency);if(!parsed.ok)return false;
    account.openingBalance=parsed.value;account.openingBalanceKnown=true;
    return true;
  }

  function validateMoneyChanges(candidate,before){
    const previous=new Map(((before&&before.transactions)||[]).map(t=>[t.id,t]));
    const touched=new Set();
    const reject=reason=>({reason});
    const check=(value,currency)=>{const x=Money.decimal(value,currency);return x.ok?null:reject(x.reason);};
    for(const t of (candidate&&candidate.transactions)||[]){
      const old=previous.get(t.id);if(old&&JSON.stringify(old)===JSON.stringify(t))continue;
      const ids=[t.accountId,t.fromAccountId,t.toAccountId].filter(Boolean);ids.forEach(id=>touched.add(id));
      if(t.accountId){
        const a=getAccount(candidate,t.accountId);if(!a)return reject('transaction-account-required');
        if(t.type==='income'&&isLiabilityAccount(a)&&!(t.financialEvent==='purchase-refund'||t.bankImportEvidence&&t.bankImportEvidence.kind==='refund'))return reject('liability-income-review');
        const wallet=t.walletAmount!==null&&t.walletAmount!==undefined;
        if((t.walletCurrency&&t.walletCurrency!==a.currency)||(!wallet&&t.currency&&t.currency!==a.currency))return reject('transaction-currency-mismatch');
        let error=check(wallet?t.walletAmount:t.amount,a.currency);if(error)return error;
        if(t.amount!=null){error=check(t.amount,t.currency||a.currency);if(error)return error;}
        if(t.currency&&t.currency!==a.currency){
          if(!wallet||!(Number(t.fxRate)>0)||t.fxRateSource!=='user-entry')return reject('transaction-fx-required');
          const converted=Money.convert(t.amount,t.currency,a.currency,t.fxRate);if(!converted.ok)return reject(converted.reason);
          if(Money.decimal(t.walletAmount,a.currency).minorUnits!==converted.minorUnits)return reject('transaction-fx-amount-mismatch');
        }
      }
      if(t.type==='transfer'&&t.fromCurrency&&t.toCurrency&&t.fromCurrency!==t.toCurrency){
        if(!['user-entry','user-received-amounts'].includes(t.fxRateSource))return reject('transaction-fx-required');
        if(t.fxRateSource==='user-entry'){
        const converted=Money.convert(t.fromAmount,t.fromCurrency,t.toCurrency,t.fxRate);if(!converted.ok)return reject(converted.reason);
        const received=Money.decimal(t.toAmount,t.toCurrency);if(!received.ok)return reject(received.reason);
        if(received.minorUnits!==converted.minorUnits)return reject('transaction-fx-amount-mismatch');
        }
      }
      for(const side of ['from','to']){
        const a=getAccount(candidate,t[side+'AccountId']);if(!a)continue;
        if(t[side+'Currency']&&t[side+'Currency']!==a.currency)return reject('transaction-currency-mismatch');
        const error=check(t[side+'Amount'],a.currency);if(error)return error;
        if(side==='from'&&t.fee!=null){const feeError=check(t.fee,a.currency);if(feeError)return feeError;}
      }
    }
    const oldAccounts=new Map(((before&&before.accounts)||[]).map(a=>[a.id,a]));
    for(const a of (candidate&&candidate.accounts)||[]){
      const old=oldAccounts.get(a.id);
      if(!old||a.currency!==old.currency||a.openingBalance!==old.openingBalance||a.openingDebt!==old.openingDebt){
        touched.add(a.id);const error=check(isLiabilityAccount(a)?a.openingDebt:a.openingBalance,a.currency);if(error)return error;
      }
    }
    for(const id of touched){
      const a=getAccount(candidate,id),terms=balanceTerms(candidate,id);if(!a||!terms)return reject('ledger-fields-unresolved');
      if(openingKnown(a))terms.unshift(isLiabilityAccount(a)?-Number(a.openingDebt):a.openingBalance);
      const total=Money.sum(terms,a.currency);if(!total.ok)return reject(total.reason);
    }
    return null;
  }

  function accountBalanceAt(state,accountId,at){
    if(at==null||!Number.isFinite(Number(at)))return null;
    return accountBalance(state,accountId,Number(at));
  }

  function accountBalancePresentation(state,accountId){
    const a=getAccount(state,accountId);
    const calculated=accountBalance(state,accountId);
    if(!a)return {calculated,observed:null,display:calculated,observedAt:0,latestActivityAt:0,observedIsCurrent:false,mismatch:false,difference:null};
    const hasObserved=a.observedBalance!==null&&a.observedBalance!==undefined&&a.observedBalance!==''&&Number.isFinite(Number(a.observedBalance));
    const observedMoney=hasObserved?Money.decimal(a.observedBalance,a.currency):null;
    const observed=observedMoney&&observedMoney.ok?observedMoney.value:null;
    const observedAt=Number(a.observedBalanceAt)||0;
    const txs=state&&Array.isArray(state.transactions)?state.transactions:[];
    let latestActivityAt=0;
    for(const t of txs){
      if(!t)continue;
      const touches=t.accountId===accountId||t.fromAccountId===accountId||t.toAccountId===accountId;
      if(!touches)continue;
      const side=t.type==='transfer'?(t.fromAccountId===accountId?'from':t.toAccountId===accountId?'to':null):null;
      const posting=side&&t.bankPostingTimes&&Number(t.bankPostingTimes[side]);
      const at=posting>0?posting:Number(t.created)||0;
      if(at>latestActivityAt)latestActivityAt=at;
    }
    const observedIsCurrent=observed!==null&&observedAt>0&&(latestActivityAt<=0||observedAt>=latestActivityAt);
    // Available money, holds and ledger balance are independent observations.
    const projected=null;
    const observedType=a.observedBalanceType||'unclassified_balance';
    const comparable=observedType==='ledger_balance'&&calculated!==null;
    const difference=comparable&&observed!==null?Money.sum([observed,-calculated],a.currency).value:null;
    return {
      calculated,
      observed,
      display:calculated,
      openingKnown:openingKnown(a),
      movement:accountMovement(state,accountId),
      observedType,
      projected,
      observedAt,
      latestActivityAt,
      observedIsCurrent,
      mismatch:observedIsCurrent&&difference!==null&&Math.abs(difference)>0.01,
      difference
    };
  }

  function accountDebt(state,accountId){
    const bal=accountBalance(state,accountId);
    return bal===null?null:bal<0?-bal:0;
  }

  function creditAvailableCalculated(state,accountId){
    const a=getAccount(state,accountId);
    if(!a||a.type!=='credit'||!openingKnown(a))return null;
    const limit=num(a.creditLimit);
    if(limit<=0)return null;
    const debt=accountDebt(state,accountId);if(debt===null)return null;
    const total=Money.sum([limit,-debt],a.currency);return total.ok?Math.max(0,total.value):null;
  }

  function creditAvailable(state,accountId){
    const a=getAccount(state,accountId);
    if(!a||a.type!=='credit')return null;
    const value=a.observedAvailableCredit,at=Number(a.observedAvailableCreditAt)||0;
    const known=value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
    const later=(state&&Array.isArray(state.transactions)?state.transactions:[]).some(t=>t&&(t.accountId===accountId||t.fromAccountId===accountId||t.toAccountId===accountId)&&Number(t.created)>at);
    if(known&&at>0&&!later){const observed=Money.decimal(value,a.currency);return observed.ok?observed.value:null;}
    return creditAvailableCalculated(state,accountId);
  }

  function capturePrepaidBalances(state){
    const out=new Map();out.movements=new Map();
    const accounts=state&&Array.isArray(state.accounts)?state.accounts:[];
    for(const a of accounts){
      if(a&&a.type==='prepaid')out.set(a.id,accountBalance(state,a.id));out.movements.set(a.id,accountMovement(state,a.id));
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
      const beforeBal=hadBefore?prepaidBefore.get(a.id):null;
      if(afterBal===null){
        const previous=prepaidBefore.movements&&prepaidBefore.movements.get(a.id);
        const movement=accountMovement(state,a.id);
        if(movement===null||movement<(previous==null?0:previous))return 'prepaid-balance-unknown';
        continue;
      }
      if(!hadBefore){
        if(afterBal<-0.01)return 'prepaid-insufficient';
        continue;
      }
      if(beforeBal>=-0.01&&afterBal<-0.01)return 'prepaid-insufficient';
      if(beforeBal<-0.01&&afterBal<beforeBal-0.01)return 'prepaid-insufficient';
    }
    return null;
  }

  function suggestRate(fromCur,toCur,lastFx){
    if(fromCur===toCur)return 1;
    const saved=lastFx&&lastFx[fromCur+'_'+toCur];
    if(saved&&typeof saved==='object'&&saved.source==='user-entry'&&Number(saved.recordedAt)>0&&num(saved.rate)>0)return Number(saved.rate);
    return null;
  }

  return Object.freeze({
    accountBalance,
    accountMovement,
    openingKnown,
    hasUnconfirmedEvidence,
    validateMoneyChanges,
    accountBalanceAt,
    setOpeningBalance,
    accountBalancePresentation,
    accountDebt,
    capturePrepaidBalances,
    checkPrepaidInvariant,
    creditAvailable,
    creditAvailableCalculated,
    getAccount,
    isLiabilityAccount,
    round2,
    suggestRate
  });
});
