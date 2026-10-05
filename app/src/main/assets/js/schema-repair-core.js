(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadSchemaRepairCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createSchemaRepairCore(options){
    const opts=options||{};
    const finance=opts.financeCore;
    const now=typeof opts.now==='function'?opts.now:Date.now;
    if(!finance||typeof finance.accountBalance!=='function'||typeof finance.isLiabilityAccount!=='function'){
      throw new Error('finance-core-required');
    }

    function normalizeRepaymentFees(state){
      const accounts=state.accounts||[];
      const transactions=state.transactions||[];
      for(const t of transactions){
        if(!t||t.type!=='transfer')continue;
        const toAcc=accounts.find(a=>a.id===t.toAccountId);
        if(!toAcc||!finance.isLiabilityAccount(toAcc))continue;
        const legacyFee=Number(t.fee)||0;
        if(legacyFee<=0)continue;
        const linkedExists=transactions.some(x=>x&&x.linkedTransferId===t.id&&x.type==='expense'&&x.cat==='debtInterest');
        if(!linkedExists){
          transactions.push({
            id:'lf_'+t.id,
            type:'expense',
            amount:legacyFee,
            currency:t.fromCurrency||toAcc.currency||'EGP',
            accountId:t.fromAccountId,
            walletAmount:legacyFee,
            fxRate:1,
            cat:'debtInterest',
            note:'فوائد / رسوم سداد',
            tags:['سداد'],
            date:t.date,
            linkedTransferId:t.id,
            created:(t.created||now())+1
          });
        }
        t.fee=0;
      }
    }

    function repairPrepaidOwnedAccounts(state){
      const accounts=state.accounts||[];
      const instruments=state.paymentInstruments||[];
      for(const inst of instruments){
        if(!inst||inst.type!=='prepaid_card')continue;
        const acc=accounts.find(a=>a.id===inst.accountId);
        if(!acc)continue;
        if(acc.type!=='prepaid'){
          inst.accountId=null;
          continue;
        }
        acc.ownedByInstrumentId=inst.id;
        acc.archived=!!inst.archived;
      }
      accounts.forEach(a=>{
        if(!a.ownedByInstrumentId)return;
        const inst=instruments.find(i=>i.id===a.ownedByInstrumentId&&i.type==='prepaid_card');
        if(!inst||inst.accountId!==a.id||a.type!=='prepaid')delete a.ownedByInstrumentId;
      });
    }

    function schemaAccountBalance(state,accountId){
      return finance.accountBalance(state,accountId);
    }

    function repairCreditArchiveConsistency(state){
      const accounts=state.accounts||[];
      const instruments=state.paymentInstruments||[];
      const byCreditAcc={};
      instruments.forEach(inst=>{
        if(!inst||inst.type!=='credit_card'||!inst.accountId)return;
        const acc=accounts.find(a=>a.id===inst.accountId);
        if(!acc||acc.type!=='credit')return;
        (byCreditAcc[acc.id]=byCreditAcc[acc.id]||[]).push(inst);
      });
      Object.keys(byCreditAcc).forEach(accId=>{
        const cards=byCreditAcc[accId];
        const acc=accounts.find(a=>a.id===accId);
        if(!acc)return;
        if(cards.some(c=>!c.archived)){
          acc.archived=false;
          return;
        }
        const rawBal=schemaAccountBalance(state,acc.id);
        acc.archived=(rawBal!==null&&Math.abs(rawBal)<=0.01);
      });
    }

    return Object.freeze({
      normalizeRepaymentFees,
      repairPrepaidOwnedAccounts,
      schemaAccountBalance,
      repairCreditArchiveConsistency
    });
  }

  return Object.freeze({createSchemaRepairCore});
});
