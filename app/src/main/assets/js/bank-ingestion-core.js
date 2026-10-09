(function(root,factory){
  let MessageCore=null,Registry=null,Money=null;
  if(typeof module==='object'&&module.exports){
    MessageCore=require('./bank-message-core.js');
    Registry=require('./uae-bank-registry-core.js');
    Money=require('./money-core.js');
    module.exports=factory(MessageCore,Registry,Money);
  }else{
    MessageCore=root&&root.SanadBankMessageCore;
    Registry=root&&root.SanadUaeBankRegistryCore;
    if(root)root.SanadBankIngestionCore=factory(MessageCore,Registry,root.SanadMoneyCore);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(MessageCore,Registry,Money){
  'use strict';
  if(!MessageCore)throw new Error('bank-message-core-required');
  if(!Registry)throw new Error('bank-registry-required');

  function num(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function round2(v){const n=num(v);return n==null?null:Math.round(n*100)/100;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function arr(v){return Array.isArray(v)?v:[];}
  function countryForParsed(parsed){
    return (parsed&&parsed.country)||
      (MessageCore.countryForCurrency?MessageCore.countryForCurrency(parsed&&parsed.currency):null)||
      'UAE';
  }
  function idFactory(options){
    if(options&&typeof options.uid==='function')return options.uid;
    let seq=0;
    return p=>String(p||'auto')+'_auto_'+(++seq);
  }
  function institutionBankId(inst){
    if(!inst)return null;
    if(inst.bankRegistryId&&Registry.get(inst.bankRegistryId))return inst.bankRegistryId;
    const hit=Registry.detect(inst.name||'');
    return hit?hit.bank.id:null;
  }
  function institutionProviderId(inst){
    if(!inst||!Registry.getProvider)return null;
    if(inst.providerRegistryId&&Registry.getProvider(inst.providerRegistryId))return inst.providerRegistryId;
    const hit=Registry.detectProvider?Registry.detectProvider(inst.name||''):null;
    return hit?hit.provider.id:null;
  }
  function normalizeSource(value){
    return String(value==null?'':value).toLowerCase()
      .replace(/[إأآ]/g,'ا').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function institutionAliases(inst){
    return [inst&&inst.name].concat(arr(inst&&inst.notificationAliases))
      .map(normalizeSource)
      .filter(x=>x&&x.length>=3&&!arr(inst&&inst.disabledNotificationAliases).map(normalizeSource).includes(x)&&!['bank','wallet','finance','payments','message','messages'].includes(x));
  }
  function findCustomInstitutionByHint(state,parsed){
    const hint=normalizeSource(parsed&&parsed.sourceHint);
    if(!hint)return null;
    const country=countryForParsed(parsed);
    const hintCompact=hint.replace(/\s+/g,'');
    const matches=arr(state&&state.institutions).filter(inst=>inst&&inst.country===country&&institutionAliases(inst).some(alias=>{
      const aliasCompact=alias.replace(/\s+/g,'');
      return hint===alias||hint.includes(alias)||(hint.length>=4&&alias.includes(hint))||
        (aliasCompact.length>=5&&hintCompact.includes(aliasCompact));
    }));
    return matches.length===1?matches[0]:null;
  }
  function findInstitution(state,parsed){
    const institutions=arr(state&&state.institutions);
    const country=countryForParsed(parsed);
    if(parsed.bankId){
      return institutions.find(i=>i&&i.country===country&&institutionBankId(i)===parsed.bankId)||null;
    }
    if(parsed.providerId){
      return institutions.find(i=>i&&i.country===country&&institutionProviderId(i)===parsed.providerId)||null;
    }
    return null;
  }
  function sourceDisplay(parsed){
    if(parsed.bankId){
      const b=Registry.get(parsed.bankId);
      return b?b.name:parsed.bankId;
    }
    if(parsed.providerId&&Registry.getProvider){
      const p=Registry.getProvider(parsed.providerId);
      return p?p.name:parsed.providerId;
    }
    return 'Financial source';
  }
  function sortNotifications(events){
    return arr(events).slice().sort((a,b)=>{
      const at=Number(a&&a.postedAt)||0,bt=Number(b&&b.postedAt)||0;
      if(at!==bt)return at-bt;
      return String((a&&a.id)||'').localeCompare(String((b&&b.id)||''));
    });
  }
  function normalizedText(value){
    return String(value||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function expectedTxType(kind){
    if(['purchase','bill_payment','mobile_recharge'].includes(kind))return 'expense';
    if(['deposit','salary','refund','incoming_transfer'].includes(kind))return 'income';
    if(kind==='outgoing_transfer')return 'external_transfer';
    if(['internal_transfer','card_repayment','cash_withdrawal'].includes(kind))return 'transfer';
    return null;
  }
  function semanticDuplicateOf(parsed,state,probable){
    const expected=expectedTxType(parsed&&parsed.kind);
    const ts=Number(parsed&&parsed.postedAt);
    if(!expected||!Number.isFinite(ts)||ts<=0)return null;
    const amount=round2(parsed.amount),currency=String(parsed.currency||'').toUpperCase();
    const merchantKey=normalizedText(parsed.merchant||parsed.beneficiaryName||'');
    const instruments=arr(state&&state.paymentInstruments),accounts=arr(state&&state.accounts);
    return arr(state&&state.transactions).find(t=>{
      if(!t||t.type!==expected||!t.bankImportKey)return false;
      if(parsed.transactionRef&&t.bankTransactionRef&&parsed.transactionRef!==t.bankTransactionRef)return false;
      const created=Number(t.created);
      if(!Number.isFinite(created)||Math.abs(created-ts)>5*60*1000)return false;
      if(parsed.bankId&&String(t.bankId||'')!==String(parsed.bankId))return false;
      if(parsed.providerId&&String(t.providerId||'')!==String(parsed.providerId))return false;
      const txAmount=round2(expected==='expense'||expected==='income'?t.amount:t.fromAmount);
      const txCurrency=String(expected==='expense'||expected==='income'?t.currency:t.fromCurrency||'').toUpperCase();
      if(txAmount!==amount||txCurrency!==currency)return false;
      if(parsed.cardLast4||parsed.cardFirst4){
        const inst=instruments.find(i=>i&&i.id===t.instrumentId);
        if(!inst)return false;
        if(parsed.cardLast4&&String(inst.last4||'')!==String(parsed.cardLast4))return false;
        if(parsed.cardFirst4&&String(inst.first4||'')!==String(parsed.cardFirst4))return false;
      }
      if(parsed.accountRef){
        const accountId=t.accountId||t.fromAccountId||null;
        const account=accounts.find(a=>a&&a.id===accountId);
        const refs=account?[].concat(account.bankRefs||[],account.bankRef||[],account.accountRef||[],account.accountLast4||[]):[];
        const wanted=String(parsed.accountRef||'').replace(/[^A-Za-z0-9Xx*]/g,'').toUpperCase();
        if(wanted&&!refs.some(r=>String(r||'').replace(/[^A-Za-z0-9Xx*]/g,'').toUpperCase()===wanted))return false;
      }
      if(merchantKey){
        const noteKey=normalizedText(t.note||'');
        if(!noteKey||(!noteKey.includes(merchantKey)&&!merchantKey.includes(noteKey)))return false;
      }
      const e=t.bankImportEvidence;
      const balance=num(parsed.availableBalance),credit=num(parsed.availableCredit);
      if(e){
        if(balance!=null&&num(e.availableBalance)!=null&&balance!==num(e.availableBalance))return false;
        if(credit!=null&&num(e.availableCredit)!=null&&credit!==num(e.availableCredit))return false;
        const sameText=normalizedText(e.text)===normalizedText(parsed.raw);
        const sameObservation=(balance!=null&&balance===num(e.availableBalance))||(credit!=null&&credit===num(e.availableCredit));
        if(sameText&&sameObservation)return true;
      }
      return probable===true;
    })||null;
  }
  function manualDuplicateCandidates(parsed,state){
    const route=MessageCore.resolveRoute(parsed,state||{}),account=route&&(route.account||route.fromAccount);
    if(!account)return [];
    const ts=Number(parsed.postedAt),currency=parsed.currency,expected=expectedTxType(parsed.kind);
    return arr(state&&state.transactions).filter(t=>{
      if(!t||hasImportEvidence(t)||!Number.isFinite(Number(t.created))||Math.abs(Number(t.created)-ts)>30*60000)return false;
      if(t.type===expected){
        const id=t.accountId||t.fromAccountId;
        return id===account.id&&(t.currency||t.fromCurrency)===currency&&round2(t.amount==null?t.fromAmount:t.amount)===round2(parsed.amount);
      }
      if(t.type!=='transfer')return false;
      const incoming=['deposit','salary','incoming_transfer'].includes(parsed.kind);
      const outgoing=['outgoing_transfer','cash_withdrawal','card_repayment'].includes(parsed.kind);
      return (incoming&&t.toAccountId===account.id&&t.toCurrency===currency&&round2(t.toAmount)===round2(parsed.amount))||
        (outgoing&&t.fromAccountId===account.id&&t.fromCurrency===currency&&round2(t.fromAmount)===round2(parsed.amount));
    });
  }
  function manualDuplicateCandidate(parsed,state){return manualDuplicateCandidates(parsed,state)[0]||null;}
  function linkManualConfirmation(parsed,state,options){
    const o=options||{};
    if(o.confirmedSameOperation!==true)return {ok:false,reason:'confirmation-required'};
    const existing=manualDuplicateCandidates(parsed,state).find(t=>t.id===o.transactionId);
    if(!existing)return {ok:false,reason:'manual-candidate-changed'};
    const route=MessageCore.resolveRoute(parsed,state),account=route.account||route.fromAccount;
    const linked=clone(existing);
    linked.bankLinkedImportEvents=arr(linked.bankLinkedImportEvents).concat({key:MessageCore.dedupeKey(parsed),eventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,currency:parsed.currency,amount:parsed.amount,ref:parsed.transactionRef||null,kind:parsed.kind,accountId:account.id,postedAt:Number(parsed.postedAt),text:parsed.raw||'',availableBalance:parsed.availableBalance,decisionSource:'user-confirmed-same-operation'});
    return {ok:true,transaction:linked,before:clone(existing),replacesTransactionId:existing.id};
  }
  function hasImportEvidence(t){return !!(t&&(t.bankImportEventId||t.bankImportKey||arr(t.bankLinkedImportEvents).length));}
  function operationAt(t,side){
    const posting=side&&t.bankPostingTimes&&Number(t.bankPostingTimes[side]);
    if(posting>0)return posting;
    if(/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t.transactionTime||''))return new Date(t.date+'T'+t.transactionTime+':00').getTime();
    return Number(t.created);
  }
  function transactionLegs(t,state){
    if(!t)return [];
    const legs=[];
    const add=(id,direction,value,currency,side)=>{
      const account=arr(state&&state.accounts).find(a=>a&&a.id===id);
      const cur=currency||(account&&account.currency);
      const money=Money&&Money.decimal(String(value),cur);
      if(id&&money&&money.ok&&BigInt(money.minorUnits)>0n)legs.push({accountId:id,direction,currency:cur,minor:money.minorUnits,at:operationAt(t,side)});
    };
    if(t.type==='income'||t.type==='expense'){
      add(t.accountId,t.type==='income'?'credit':'debit',t.walletAmount==null?t.amount:t.walletAmount,(arr(state&&state.accounts).find(a=>a&&a.id===t.accountId)||{}).currency||t.currency);
      if(t.bankPrincipalAmount!=null)add(t.accountId,'debit',t.bankPrincipalAmount,t.currency);
    }
    if(t.type==='transfer'||t.type==='external_transfer')add(t.fromAccountId,'debit',t.fromAmount,t.fromCurrency,'from');
    if(t.type==='transfer')add(t.toAccountId,'credit',t.toAmount,t.toCurrency,'to');
    return legs;
  }
  function manualImportCandidates(transaction,state){
    const legs=transactionLegs(transaction,state);
    return arr(state&&state.transactions).filter(t=>t&&t.id!==transaction.id&&hasImportEvidence(t)&&transactionLegs(t,state).some(b=>legs.some(a=>
      a.accountId===b.accountId&&a.direction===b.direction&&a.currency===b.currency&&a.minor===b.minor&&Number.isFinite(a.at)&&Number.isFinite(b.at)&&Math.abs(a.at-b.at)<=30*60000)));
  }
  function validateManualImportChanges(candidate,before){
    const previous=new Map(arr(before&&before.transactions).map(t=>[t.id,t]));
    const financialFields=['type','accountId','fromAccountId','toAccountId','amount','walletAmount','fromAmount','toAmount','currency','fromCurrency','toCurrency','fee','created','date','transactionTime'];
    for(const t of arr(candidate&&candidate.transactions)){
      const old=previous.get(t.id);
      if(old&&hasImportEvidence(old)&&!hasImportEvidence(t))return {reason:'import-evidence-loss',transactionId:t.id};
      if(hasImportEvidence(t)||(old&&financialFields.every(k=>old[k]===t[k])&&JSON.stringify(old.manualImportResolution)===JSON.stringify(t.manualImportResolution)))continue;
      const ids=manualImportCandidates(t,candidate).map(x=>x.id).sort();
      if(!ids.length)continue;
      const approval=t.manualImportResolution;
      if(!approval||approval.decision!=='distinct-operation'||approval.source!=='user-confirmation'||JSON.stringify(arr(approval.candidateIds).slice().sort())!==JSON.stringify(ids))return {reason:'possible-bank-duplicate',transactionId:t.id,candidateIds:ids};
    }
    return null;
  }
  function preserveImportAudit(old,next,at){
    if(!hasImportEvidence(old))return next;
    const out=Object.assign({},next);
    for(const [key,value] of Object.entries(old))if(key.startsWith('bank')||['providerId','smsReceivedAt','economicOrigin','manualImportResolution'].includes(key))out[key]=value===undefined?undefined:clone(value);
    out.userFinancialOverride={source:'user-edit',at:Number(at)||Date.now(),previous:{type:old.type,accountId:old.accountId||null,fromAccountId:old.fromAccountId||null,toAccountId:old.toAccountId||null,amount:old.amount==null?null:old.amount,walletAmount:old.walletAmount==null?null:old.walletAmount,fromAmount:old.fromAmount==null?null:old.fromAmount,toAmount:old.toAmount==null?null:old.toAmount,currency:old.currency||null,fromCurrency:old.fromCurrency||null,toCurrency:old.toCurrency||null},prior:old.userFinancialOverride||null};
    out.userCategoryConfirmed=old.cat!==out.cat||old.userCategoryConfirmed===true;
    return out;
  }
  // A source reference is scoped evidence, not a globally unique posting ID.
  const REFERENCE_WINDOW_MS=24*60*60*1000;
  function sourceMatches(parsed,e){
    return e.bankId===(parsed.bankId||null)&&e.providerId===(parsed.providerId||null);
  }
  function referenceCompatible(parsed,e,accountId){
    if(!sourceMatches(parsed,e)||!accountId||e.accountId!==accountId||e.kind!==parsed.kind)return false;
    if(e.currency!==parsed.currency||round2(e.amount)!==round2(parsed.amount))return false;
    if(parsed.transactionDate&&e.transactionDate!==parsed.transactionDate)return false;
    const a=Number(parsed.postedAt),b=Number(e.postedAt);
    return Number.isFinite(a)&&a>0&&Number.isFinite(b)&&b>0&&Math.abs(a-b)<=REFERENCE_WINDOW_MS;
  }
  function primaryEvidence(t){
    return {
      bankId:t.bankId||null,providerId:t.providerId||null,
      eventId:t.bankImportEventId||null,key:t.bankImportKey||null,ref:t.bankTransactionRef||null,
      kind:(t.bankImportEvidence||{}).kind||String(t.bankImportKey||'').split('|')[2]||null,
      currency:t.currency||t.fromCurrency,amount:t.amount==null?t.fromAmount:t.amount,
      accountId:t.accountId||t.fromAccountId,postedAt:t.smsReceivedAt||t.created,transactionDate:t.date||null
    };
  }
  function evidenceRows(t){
    return [primaryEvidence(t)].concat(arr(t.bankLinkedImportEvents).map(e=>Object.assign({},e,{
      transactionDate:e.transactionDate||t.date||null,
      accountId:e.accountId||(t.type==='transfer'?(['deposit','incoming_transfer'].includes(e.kind)?t.toAccountId:t.fromAccountId):(t.accountId||t.fromAccountId))
    })));
  }
  function duplicateOf(parsed,state){
    const route=MessageCore.resolveRoute(parsed,state||{});
    const accountId=route&&(route.account||route.fromAccount||{}).id,key=MessageCore.dedupeKey(parsed);
    return arr(state&&state.transactions).find(t=>t&&evidenceRows(t).some(e=>{
      if(!sourceMatches(parsed,e))return false;
      // Reprocessing the same evidence preserves user corrections to its financial fields.
      if(parsed.eventId&&e.eventId===parsed.eventId)return true;
      if(!referenceCompatible(parsed,e,accountId))return false;
      return !!((parsed.transactionRef&&e.ref===parsed.transactionRef)||(key&&e.key===key));
    }))||null;
  }
  function conflictingReferenceOf(parsed,state){
    if(!parsed.transactionRef)return null;
    const route=MessageCore.resolveRoute(parsed,state||{});
    const accountId=route&&(route.account||route.fromAccount||{}).id;
    if(!accountId)return null;
    return arr(state&&state.transactions).find(t=>t&&evidenceRows(t).some(e=>
      sourceMatches(parsed,e)&&e.accountId===accountId&&e.ref===parsed.transactionRef
    ))||null;
  }
  function observedAfter(parsed){
    if(num(parsed.availableBalance)!=null)return round2(parsed.availableBalance);
    if(num(parsed.availableCredit)!=null)return round2(parsed.availableCredit);
    return null;
  }
  function openingBalanceForObserved(parsed){
    const observed=num(parsed.availableBalance);
    const amount=num(parsed.amount);
    if(observed==null||amount==null)return null;
    if(parsed.kind==='purchase'||parsed.kind==='outgoing_transfer'||parsed.kind==='cash_withdrawal'||parsed.kind==='bill_payment'||parsed.kind==='mobile_recharge'){
      return round2(observed+amount+(num(parsed.fee)||0));
    }
    if(parsed.kind==='deposit'||parsed.kind==='salary'||parsed.kind==='refund'||parsed.kind==='incoming_transfer'){
      return round2(observed-amount);
    }
    return null;
  }
  function makeInstitution(parsed,uid){
    const country=countryForParsed(parsed);
    if(parsed.bankId){
      const b=Registry.get(parsed.bankId);
      if(!b)return null;
      return {id:uid('inst'),name:b.name,country,type:'bank',bankRegistryId:b.id,autoDiscovered:true};
    }
    if(parsed.providerId&&Registry.getProvider){
      const p=Registry.getProvider(parsed.providerId);
      if(!p)return null;
      return {id:uid('inst'),name:p.name,country:parsed.country||p.country||country,type:'wallet_provider',providerRegistryId:p.id,autoDiscovered:true};
    }
    return null;
  }
  function makeAssetAccount(parsed,institutionId,uid,kind,sourceInstitution){
    const opening=openingBalanceForObserved(parsed);
    if(opening==null)return null;
    const provider=!!parsed.providerId||!!(sourceInstitution&&sourceInstitution.type==='wallet_provider');
    const accountType=provider?'ewallet':'bank';
    const ref=parsed.accountRef||parsed.accountSuffix||null;
    const display=sourceInstitution&&sourceInstitution.name?sourceInstitution.name:sourceDisplay(parsed);
    const name=provider
      ? display+' Wallet'
      : display+(ref?' • '+String(ref):' Account');
    const out={
      id:uid('a'),institutionId:institutionId||null,country:countryForParsed(parsed),name,
      type:accountType,currency:parsed.currency||'AED',
      openingBalance:0,openingBalanceKnown:false,openingDebt:0,creditLimit:0,defaultRepaymentAccountId:null,
      icon:provider?'📱':'🏦',color:'#00695C',archived:false,created:new Date(parsed.postedAt||Date.now()).toISOString().slice(0,10),
      autoDiscovered:true,autoDiscoverySource:parsed.bankId||parsed.providerId||(sourceInstitution&&sourceInstitution.id)||null,
      observedBalance:num(parsed.availableBalance),observedBalanceType:'available_balance',observedBalanceAt:Number(parsed.postedAt)||Date.now()
    };
    if(ref)out.bankRefs=[String(ref)];
    return out;
  }
  function makeCreditAccount(parsed,institutionId,uid){
    if(!parsed.cardLast4)return null;
    return {
      id:uid('a'),institutionId:institutionId||null,country:countryForParsed(parsed),
      name:sourceDisplay(parsed)+' • Credit ****'+parsed.cardLast4,
      type:'credit',currency:parsed.availableCreditCurrency||parsed.currency||'AED',
      openingBalance:0,openingDebt:0,creditLimit:0,defaultRepaymentAccountId:null,
      icon:'💠',color:'#6A1B9A',archived:false,created:new Date(parsed.postedAt||Date.now()).toISOString().slice(0,10),
      autoDiscovered:true,autoDiscoverySource:parsed.bankId||null,baselinePartial:true,
      observedAvailableCredit:num(parsed.availableCredit),observedAvailableCreditAt:Number(parsed.postedAt)||Date.now()
    };
  }
  function makeInstrument(parsed,account,institutionId,uid){
    if(!parsed.cardLast4||!parsed.cardType||!account)return null;
    const type=parsed.cardType;
    if(!['credit_card','debit_card','wallet_card'].includes(type))return null;
    return {
      id:uid('card'),accountId:account.id,institutionId:institutionId||account.institutionId||null,
      country:account.country||'UAE',type,first4:parsed.cardFirst4?String(parsed.cardFirst4):null,last4:String(parsed.cardLast4),
      network:parsed.cardNetwork||'other',
      name:(type==='credit_card'?'Credit':type==='debit_card'?'Debit':'Wallet')+' ****'+parsed.cardLast4,
      icon:type==='credit_card'?'💠':type==='wallet_card'?'📱':'💳',
      color:account.color||'#00695C',archived:false,autoDiscovered:true
    };
  }
  function resolveCustomRoute(parsed,state,baseRoute){
    if(baseRoute&&baseRoute.status==='routed'&&Number(baseRoute.confidence||0)>=0.90)return baseRoute;
    const inst=findCustomInstitutionByHint(state,parsed);
    if(!inst)return baseRoute;
    const country=countryForParsed(parsed);
    const accounts=arr(state&&state.accounts).filter(a=>a&&!a.archived&&a.institutionId===inst.id&&a.country===country&&(!parsed.currency||a.currency===parsed.currency));
    const instruments=arr(state&&state.paymentInstruments).filter(i=>i&&!i.archived);
    if(parsed.cardLast4){
      const cards=instruments.filter(i=>(!parsed.cardType||i.type===parsed.cardType)&&String(i.last4||'')===String(parsed.cardLast4)&&
        (i.institutionId===inst.id||accounts.some(a=>a.id===i.accountId)));
      if(cards.length===1){
        const account=arr(state&&state.accounts).find(a=>a.id===cards[0].accountId)||null;
        if(account)return {status:'routed',account,instrument:cards[0],confidence:0.99,customSourceMatch:true,institution:inst};
      }
    }
    if(accounts.length!==1||inst.type!=='wallet_provider'||parsed.accountRef||parsed.accountSuffix)return baseRoute;
    const account=accounts[0];
    if(['purchase','bill_payment','mobile_recharge'].includes(parsed.kind))
      return {status:'routed',account,instrument:null,confidence:0.96,customSourceMatch:true,institution:inst};
    if(['deposit','salary','refund','incoming_transfer'].includes(parsed.kind))
      return {status:'routed',account,instrument:null,confidence:0.97,customSourceMatch:true,institution:inst};
    if(parsed.kind==='outgoing_transfer')
      return {status:'routed',fromAccount:account,confidence:0.97,customSourceMatch:true,institution:inst};
    if(parsed.kind==='cash_withdrawal'){
      const cash=arr(state&&state.accounts).filter(a=>a&&!a.archived&&a.type==='cash'&&a.country===account.country&&a.currency===parsed.currency);
      if(cash.length===1)return {status:'routed',fromAccount:account,targetAccount:cash[0],confidence:0.98,customSourceMatch:true,institution:inst};
    }
    return baseRoute;
  }
  function updateObservation(parsed,route){
    const target=(route&&route.account)||(route&&route.fromAccount)||null;
    if(!target)return [];
    const updates=[];
    if(num(parsed.availableBalance)!=null&&(!parsed.availableBalanceCurrency||parsed.availableBalanceCurrency===target.currency)){
      updates.push({accountId:target.id,field:'observedBalance',value:round2(parsed.availableBalance),at:Number(parsed.postedAt)||Date.now()});
    }
    if(num(parsed.availableCredit)!=null&&(!parsed.availableCreditCurrency||parsed.availableCreditCurrency===target.currency)){
      updates.push({accountId:target.id,field:'observedAvailableCredit',value:round2(parsed.availableCredit),at:Number(parsed.postedAt)||Date.now()});
    }
    return updates;
  }
  function normalizedMerchant(value){
    return String(value||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function merchantLearningId(t){return JSON.stringify([t.accountId,t.currency,normalizedMerchant(t.note||t.merchantName)]);}
  function learningEntries(state){
    const rows=arr(state?.settings?.bankLearningRules).map(r=>({type:'template',id:r.id,enabled:r.enabled!==false,source:r.sourceKey,accountId:r.accountId||r.fromAccountId,currency:r.currency,country:r.country,kind:r.kind,template:r.templateSignature,at:r.updatedAt||r.createdAt}));
    for(const i of arr(state?.institutions))for(const alias of arr(i.notificationAliases))rows.push({type:'source',id:JSON.stringify([i.id,alias]),institutionId:i.id,enabled:!arr(i.disabledNotificationAliases).includes(alias),source:alias,country:i.country});
    for(const a of arr(state?.accounts))for(const b of arr(a.bankIdentityBindings))rows.push({type:'identity',id:JSON.stringify([a.id,b.bankId,b.accountType,b.currency,b.reference,b.confirmedAt]),enabled:b.enabled!==false,source:b.bankId,accountId:a.id,currency:b.currency,country:b.country,reference:b.reference,at:b.confirmedAt});
    const seen=new Set(),disabled=arr(state?.settings?.bankMerchantLearningDisabled);
    for(const t of arr(state?.transactions).slice().reverse()){
      if(t.type!=='expense'||!t.cat||t.cat==='other'||!normalizedMerchant(t.note||t.merchantName))continue;
      if(hasImportEvidence(t)&&!t.userCategoryConfirmed)continue;
      const id=merchantLearningId(t);if(seen.has(id))continue;seen.add(id);
      rows.push({type:'merchant',id,enabled:!disabled.includes(id),accountId:t.accountId,currency:t.currency,merchant:t.note||t.merchantName,category:t.cat,at:t.created});
    }
    return rows;
  }
  function setLearningEnabled(state,type,id,enabled,options){
    const row=learningEntries(state).find(r=>r.type===type&&r.id===id);if(!row||typeof enabled!=='boolean')return {ok:false,reason:'learning-not-found'};
    const at=Number(options?.now)||Date.now();
    if(!state.settings)state.settings={};
    if(type==='template'){
      const r=state.settings.bankLearningRules.find(r=>r.id===id);r.enabled=enabled;r.updatedAt=at;if(enabled)r.effectiveFrom=at;
    }else if(type==='identity'){
      const a=state.accounts.find(a=>a.id===row.accountId),b=a.bankIdentityBindings.find(b=>JSON.stringify([a.id,b.bankId,b.accountType,b.currency,b.reference,b.confirmedAt])===id);
      if(enabled){const trial=clone(state),check=confirmAccountIdentity(trial,{bankId:b.bankId,accountRef:b.reference,currency:b.currency,country:b.country},a.id,{confirmed:true,now:at});if(!check.ok)return check;b.confirmedAt=at;}
      b.enabled=enabled;b.updatedAt=at;
    }else if(type==='source'){
      const inst=state.institutions.find(i=>i.id===row.institutionId),disabled=new Set(arr(inst.disabledNotificationAliases));if(enabled)disabled.delete(row.source);else disabled.add(row.source);inst.disabledNotificationAliases=Array.from(disabled);
    }else if(type==='merchant'){
      const disabled=new Set(arr(state.settings.bankMerchantLearningDisabled));if(enabled)disabled.delete(id);else disabled.add(id);state.settings.bankMerchantLearningDisabled=Array.from(disabled);
    }else return {ok:false,reason:'learning-type-invalid'};
    state.settings.bankLearningAudit=arr(state.settings.bankLearningAudit).concat([{type,id,enabled,at,source:'user-confirmation'}]).slice(-500);
    return {ok:true};
  }
  function learnedMerchantCategory(parsed,state,accountId){
    if(!parsed||!parsed.merchant)return null;
    const key=normalizedMerchant(parsed.merchant);
    if(!key)return null;
    if(!accountId)accountId=MessageCore.resolveRoute(parsed,state).account?.id;
    if(!accountId)return null;
    const txs=arr(state&&state.transactions).slice().reverse();
    const hit=txs.find(t=>t&&t.type==='expense'&&t.accountId===accountId&&t.currency===parsed.currency&&(!hasImportEvidence(t)||t.userCategoryConfirmed)&&t.cat&&t.cat!=='other'&&normalizedMerchant(t.note||t.merchantName)===key&&!arr(state?.settings?.bankMerchantLearningDisabled).includes(merchantLearningId(t)));
    return hit?hit.cat:null;
  }
  function applyLearnedCategory(parsed,state,built){
    if(!built||!built.ok||!built.transaction||built.transaction.type!=='expense')return built;
    const learned=learnedMerchantCategory(parsed,state,built.transaction.accountId);
    if(learned)built.transaction.cat=learned;
    return built;
  }
  function normalizedPerson(value){
    return String(value||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function learningSourceKey(parsed){
    if(!parsed)return null;
    if(parsed.bankId)return 'bank:'+String(parsed.bankId);
    if(parsed.providerId)return 'provider:'+String(parsed.providerId);
    const hint=normalizeSource(parsed.sourceHint||'');
    return hint?'hint:'+hint:null;
  }
  function templateSignature(parsed){
    if(!parsed)return '';
    let x=String(parsed.raw||'').toLowerCase().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    x=x.replace(/(aed|egp|mad|usd|eur|gbp|sar)\s*-?[0-9][0-9,.]*/gi,'$1 AMOUNT');
    x=x.replace(/-?[0-9][0-9,.]*\s*(aed|egp|mad|usd|eur|gbp|sar)/gi,'AMOUNT $1');
    x=normalizeSource(x);
    if(!x)return '';
    const dynamic=[
      [parsed.transactionRef,'<ref>'],
      [parsed.beneficiaryName,'<beneficiary>'],
      [parsed.merchant,'<merchant>'],
      [parsed.fromAccountRef,'<fromaccount>'],
      [parsed.toAccountRef,'<toaccount>'],
      [parsed.accountRef,'<account>'],
      [parsed.cardLast4,'<card>']
    ].map(([value,token])=>[normalizeSource(value||''),token])
      .filter(([value])=>value&&value.length>=2)
      .sort((a,b)=>b[0].length-a[0].length);
    for(const [value,token] of dynamic)x=x.split(value).join(token);
    x=x.replace(/\b(aed|egp|mad|usd|eur|gbp|sar)\s*-?[0-9][0-9,.]*/g,'$1 <amount>');
    x=x.replace(/\b[0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}\b/g,'<date>');
    x=x.replace(/\b[0-9]{1,2}:[0-9]{2}\b/g,'<time>');
    x=x.replace(/\b[0-9][0-9,.]{3,}\b/g,'<number>');
    return x.replace(/\s+/g,' ').trim().slice(0,800);
  }
  function learningRules(state){
    return arr(state&&state.settings&&state.settings.bankLearningRules).filter(r=>r&&r.enabled!==false);
  }
  function matchLearnedRule(parsed,state){
    const sourceKey=learningSourceKey(parsed),signature=templateSignature(parsed);
    if(!sourceKey||signature.length<8)return null;
    const country=countryForParsed(parsed),currency=String(parsed.currency||'').toUpperCase();
    const cardFirst=String(parsed.cardFirst4||''),card=String(parsed.cardLast4||''),account=String(parsed.accountRef||'');
    const instruments=arr(state&&state.paymentInstruments);
    const matches=learningRules(state).filter(r=>{
      if(Number(r.effectiveFrom||r.createdAt)>Number(parsed.postedAt))return false;
      if(r.sourceKey!==sourceKey||r.templateSignature!==signature)return false;
      if(r.country&&r.country!==country)return false;
      if(r.currency&&String(r.currency).toUpperCase()!==currency)return false;
      const linkedInstrument=r.instrumentId?instruments.find(i=>i&&i.id===r.instrumentId&&!i.archived)||null:null;
      if(cardFirst){
        const learnedFirst=String(r.cardFirst4||(linkedInstrument&&linkedInstrument.first4)||'');
        if(!learnedFirst||learnedFirst!==cardFirst)return false;
      }
      if(card){
        const learnedLast=String(r.cardLast4||(linkedInstrument&&linkedInstrument.last4)||'');
        if(!learnedLast||learnedLast!==card)return false;
      }
      if(r.accountRef&&String(r.accountRef)!==account)return false;
      return true;
    });
    if(!matches.length)return null;
    return matches.sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0))[0];
  }
  function routeFromLearnedRule(parsed,state,rule){
    if(!rule)return null;
    const accounts=arr(state&&state.accounts),instruments=arr(state&&state.paymentInstruments),institutions=arr(state&&state.institutions);
    const account=rule.accountId?accounts.find(a=>a&&a.id===rule.accountId&&!a.archived)||null:null;
    const fromAccount=rule.fromAccountId?accounts.find(a=>a&&a.id===rule.fromAccountId&&!a.archived)||null:null;
    const targetAccount=rule.targetAccountId?accounts.find(a=>a&&a.id===rule.targetAccountId&&!a.archived)||null:null;
    const instrument=rule.instrumentId?instruments.find(i=>i&&i.id===rule.instrumentId&&!i.archived)||null:null;
    const country=countryForParsed(parsed),currency=String(parsed.currency||'');
    const accountOk=a=>!a||(a.country===country&&(!currency||a.currency===currency));
    const sourceInstitutionOk=inst=>{
      if(!inst)return true;
      const bank=institutionBankId(inst),provider=institutionProviderId(inst);
      if(parsed.bankId&&(bank||provider))return bank===parsed.bankId;
      if(parsed.providerId&&(provider||bank))return provider===parsed.providerId;
      return true;
    };
    const accountSourceOk=a=>{
      if(!a)return true;
      const inst=a.institutionId?institutions.find(i=>i&&i.id===a.institutionId)||null:null;
      return sourceInstitutionOk(inst);
    };
    if(!accountOk(account)||!accountOk(fromAccount)||!accountOk(targetAccount))return null;
    if(instrument){
      const linked=accounts.find(a=>a&&a.id===instrument.accountId&&!a.archived)||null;
      if(!linked||linked.country!==country||(!currency||linked.currency!==currency))return null;
      const instrumentInstitution=instrument.institutionId?institutions.find(i=>i&&i.id===instrument.institutionId)||null:null;
      if(!accountSourceOk(linked)||!sourceInstitutionOk(instrumentInstitution))return null;
      if(parsed.cardFirst4&&String(instrument.first4||'')!==String(parsed.cardFirst4))return null;
      if(parsed.cardLast4&&String(instrument.last4||'')!==String(parsed.cardLast4))return null;
    }
    const kind=parsed.kind;
    if(['purchase','bill_payment','mobile_recharge','deposit','salary','refund','incoming_transfer'].includes(kind)){
      const a=account||(instrument?accounts.find(x=>x&&x.id===instrument.accountId&&!x.archived):null);
      if(!a||!accountSourceOk(a))return null;
      return {status:'routed',account:a,instrument:instrument||null,confidence:0.995,learnedRule:true,learningRuleId:rule.id};
    }
    if(kind==='outgoing_transfer'){
      if(!fromAccount||!accountSourceOk(fromAccount))return null;
      return {status:'routed',fromAccount,confidence:0.995,learnedRule:true,learningRuleId:rule.id};
    }
    if(['internal_transfer','card_repayment','cash_withdrawal'].includes(kind)){
      if(!fromAccount||!targetAccount||!accountSourceOk(fromAccount))return null;
      return {status:'routed',fromAccount,targetAccount,instrument:instrument||null,confidence:0.995,learnedRule:true,learningRuleId:rule.id};
    }
    return null;
  }
  function routeFromManualChoice(parsed,state,choice){
    const c=choice||{},accounts=arr(state&&state.accounts),instruments=arr(state&&state.paymentInstruments);
    const country=countryForParsed(parsed),currency=String(parsed&&parsed.currency||'').toUpperCase();
    let account=null,instrument=null;
    if(c.sourceType==='instrument'){
      instrument=instruments.find(i=>i&&i.id===c.sourceId&&!i.archived)||null;
      account=instrument?accounts.find(a=>a&&a.id===instrument.accountId&&!a.archived)||null:null;
    }else if(c.sourceType==='account'){
      account=accounts.find(a=>a&&a.id===c.sourceId&&!a.archived)||null;
    }
    if(instrument){
      const institution=arr(state&&state.institutions).find(i=>i&&i.id===(instrument.institutionId||(account&&account.institutionId)));
      if((parsed.bankId&&institution&&institutionBankId(institution)!==parsed.bankId)||
         (parsed.providerId&&institution&&institutionProviderId(institution)!==parsed.providerId)||
         (parsed.cardType&&instrument.type!==parsed.cardType)||
         (parsed.cardFirst4&&String(instrument.first4||'')!==String(parsed.cardFirst4))||
         (parsed.cardNetwork&&instrument.network&&instrument.network!=='other'&&instrument.network!==parsed.cardNetwork))
        return {status:'needs-review',reason:'manual-card-mismatch',confidence:0};
    }
    const target=c.targetAccountId?accounts.find(a=>a&&a.id===c.targetAccountId&&!a.archived)||null:null;
    const valid=a=>!!a&&a.country===country&&(!currency||String(a.currency||'').toUpperCase()===currency||(['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)&&!!instrument));
    const kind=parsed&&parsed.kind;
    if(['purchase','bill_payment','mobile_recharge','deposit','salary','refund','incoming_transfer'].includes(kind)){
      if(!valid(account))return {status:'needs-review',reason:'manual-source-invalid',confidence:0};
      if(['purchase','bill_payment','mobile_recharge'].includes(kind)&&parsed.cardLast4&&!instrument)
        return {status:'needs-review',reason:'manual-card-required',confidence:0};
      if(instrument&&parsed.cardLast4&&String(instrument.last4||'')!==String(parsed.cardLast4))
        return {status:'needs-review',reason:'manual-card-mismatch',confidence:0};
      return {status:'routed',account,instrument,confidence:1,manualCorrection:true};
    }
    if(kind==='outgoing_transfer'){
      if(!valid(account))return {status:'needs-review',reason:'manual-source-invalid',confidence:0};
      return {status:'routed',fromAccount:account,confidence:1,manualCorrection:true};
    }
    if(kind==='internal_transfer'){
      if(!valid(account)||!valid(target)||account.id===target.id)return {status:'needs-review',reason:'manual-transfer-invalid',confidence:0};
      return {status:'routed',fromAccount:account,targetAccount:target,confidence:1,manualCorrection:true};
    }
    if(kind==='card_repayment'){
      if(!valid(account)||!valid(target)||target.type!=='credit'||account.id===target.id)return {status:'needs-review',reason:'manual-repayment-invalid',confidence:0};
      const targetInstrument=instruments.find(i=>i&&!i.archived&&i.accountId===target.id&&i.type==='credit_card'&&(!parsed.cardLast4||String(i.last4||'')===String(parsed.cardLast4)))||null;
      // A repayment carrying the repaid card's suffix cannot be bound to another credit account.
      if(parsed.cardLast4&&!targetInstrument)return {status:'needs-review',reason:'manual-repayment-card-mismatch',confidence:0};
      return {status:'routed',fromAccount:account,targetAccount:target,instrument:targetInstrument,confidence:1,manualCorrection:true};
    }
    if(kind==='cash_withdrawal'){
      if(!valid(account)||!valid(target)||target.type!=='cash'||account.id===target.id)return {status:'needs-review',reason:'manual-cash-route-invalid',confidence:0};
      return {status:'routed',fromAccount:account,targetAccount:target,confidence:1,manualCorrection:true};
    }
    return {status:'needs-review',reason:'manual-kind-unsupported',confidence:0};
  }
  function rebindAccountInstitution(state,accountId,institutionId){
    if(!state)return {ok:false,reason:'state-required'};
    const accounts=arr(state.accounts),institutions=arr(state.institutions),instruments=arr(state.paymentInstruments);
    const account=accounts.find(a=>a&&a.id===accountId&&!a.archived)||null;
    if(!account)return {ok:false,reason:'account-not-found'};
    let institution=null;
    if(institutionId){
      institution=institutions.find(i=>i&&i.id===institutionId)||null;
      if(!institution)return {ok:false,reason:'institution-not-found'};
      if(institution.country&&institution.country!==account.country)return {ok:false,reason:'institution-country-mismatch'};
    }
    const oldInstitutionId=account.institutionId||null;
    account.institutionId=institutionId||null;
    let updatedInstruments=0;
    for(const instrument of instruments){
      if(!instrument||instrument.accountId!==account.id)continue;
      instrument.institutionId=institutionId||null;
      instrument.country=account.country;
      updatedInstruments++;
    }
    return {ok:true,changed:oldInstitutionId!==(institutionId||null),oldInstitutionId,newInstitutionId:institutionId||null,updatedInstruments};
  }
  function rebindInstrumentAccount(state,instrumentId,targetAccountId){
    if(!state)return {ok:false,reason:'state-required'};
    const instruments=arr(state.paymentInstruments),accounts=arr(state.accounts);
    const instrument=instruments.find(i=>i&&i.id===instrumentId&&!i.archived)||null;
    const target=accounts.find(a=>a&&a.id===targetAccountId&&!a.archived)||null;
    if(!instrument||!target)return {ok:false,reason:'instrument-or-account-not-found'};
    if(!['debit_card','wallet_card'].includes(instrument.type))return {ok:false,reason:'instrument-rebind-unsupported'};
    const current=accounts.find(a=>a&&a.id===instrument.accountId)||null;
    if(!current)return {ok:false,reason:'current-account-not-found'};
    if(current.id===target.id)return {ok:true,changed:false,movedTransactions:0,movedRecurring:0};
    if(current.country!==target.country||current.currency!==target.currency)return {ok:false,reason:'country-or-currency-mismatch'};
    if(instrument.type==='debit_card'&&target.type!=='bank')return {ok:false,reason:'debit-target-must-be-bank'};
    if(instrument.type==='wallet_card'&&target.type!=='ewallet')return {ok:false,reason:'wallet-target-must-be-wallet'};
    let movedTransactions=0,movedRecurring=0;
    for(const tx of arr(state.transactions)){
      if(tx&&tx.instrumentId===instrument.id&&tx.accountId===current.id){tx.accountId=target.id;movedTransactions++;}
    }
    for(const rec of arr(state.recurring)){
      if(rec&&rec.instrumentId===instrument.id&&rec.accountId===current.id){rec.accountId=target.id;movedRecurring++;}
    }
    instrument.accountId=target.id;
    instrument.institutionId=target.institutionId||null;
    instrument.country=target.country;
    for(const rule of arr(state.settings&&state.settings.bankLearningRules)){
      if(rule&&rule.instrumentId===instrument.id&&rule.accountId===current.id){rule.accountId=target.id;rule.updatedAt=Date.now();}
    }
    return {ok:true,changed:true,fromAccountId:current.id,toAccountId:target.id,movedTransactions,movedRecurring};
  }
  function sameInstitutionSource(state,a,b){
    if(!a||!b)return false;
    if(a.id===b.id)return true;
    const ab=institutionBankId(a),bb=institutionBankId(b);
    if(ab&&bb)return ab===bb;
    const ap=institutionProviderId(a),bp=institutionProviderId(b);
    if(ap&&bp)return ap===bp;
    return false;
  }
  function mergeDuplicateAccount(state,fromAccountId,toAccountId){
    if(!state||fromAccountId===toAccountId)return {ok:false,reason:'invalid-merge'};
    const accounts=arr(state.accounts),instruments=arr(state.paymentInstruments),institutions=arr(state.institutions);
    const from=accounts.find(a=>a&&a.id===fromAccountId&&!a.archived)||null;
    const to=accounts.find(a=>a&&a.id===toAccountId&&!a.archived)||null;
    if(!from||!to)return {ok:false,reason:'account-not-found'};
    if(!['bank','ewallet'].includes(from.type)||from.type!==to.type)return {ok:false,reason:'account-type-mismatch'};
    if(from.country!==to.country||from.currency!==to.currency)return {ok:false,reason:'country-or-currency-mismatch'};
    const fi=from.institutionId?institutions.find(i=>i&&i.id===from.institutionId)||null:null;
    const ti=to.institutionId?institutions.find(i=>i&&i.id===to.institutionId)||null:null;
    if(fi&&ti&&!sameInstitutionSource(state,fi,ti))return {ok:false,reason:'institution-mismatch'};
    const directTransfer=arr(state.transactions).find(t=>t&&t.type==='transfer'&&(
      (t.fromAccountId===from.id&&t.toAccountId===to.id)||
      (t.fromAccountId===to.id&&t.toAccountId===from.id)
    ));
    if(directTransfer)return {ok:false,reason:'direct-transfer-between-duplicates'};
    const targetHadHistory=arr(state.transactions).some(t=>t&&(t.accountId===to.id||t.fromAccountId===to.id||t.toAccountId===to.id))||
      arr(state.recurring).some(r=>r&&r.accountId===to.id);
    if(!targetHadHistory&&Math.abs(Number(to.openingBalance)||0)<=0.001&&Math.abs(Number(from.openingBalance)||0)>0.001){
      to.openingBalance=Number(from.openingBalance)||0;to.openingBalanceKnown=from.openingBalanceKnown===true||(!from.autoDiscovered&&from.openingBalanceKnown!==false);
    }
    const refs=Array.from(new Set([].concat(to.bankRefs||[],to.bankRef||[],from.bankRefs||[],from.bankRef||[]).filter(Boolean).map(String)));
    if(refs.length)to.bankRefs=refs.slice(0,12);
    const fromObsAt=Number(from.observedBalanceAt)||0,toObsAt=Number(to.observedBalanceAt)||0;
    if(from.observedBalance!=null&&(to.observedBalance==null||fromObsAt>=toObsAt)){
      to.observedBalance=from.observedBalance;
      to.observedBalanceAt=from.observedBalanceAt||null;to.observedBalanceType=from.observedBalanceType||'unclassified_balance';
    }
    if(from.autoDiscovered&&from.openingBalanceKnown!==true||from.openingBalanceKnown===false)to.openingBalanceKnown=false;
    let movedTransactions=0,movedRecurring=0,movedInstruments=0;
    for(const tx of arr(state.transactions)){
      if(!tx)continue;
      let touched=false;
      if(tx.accountId===from.id){tx.accountId=to.id;touched=true;}
      if(tx.fromAccountId===from.id){tx.fromAccountId=to.id;tx.fromCountry=to.country;tx.fromCurrency=to.currency;touched=true;}
      if(tx.toAccountId===from.id){tx.toAccountId=to.id;tx.toCountry=to.country;tx.toCurrency=to.currency;touched=true;}
      if(touched)movedTransactions++;
    }
    for(const rec of arr(state.recurring)){
      if(rec&&rec.accountId===from.id){rec.accountId=to.id;rec.currency=to.currency;movedRecurring++;}
    }
    for(const instrument of instruments){
      if(instrument&&instrument.accountId===from.id){
        instrument.accountId=to.id;
        instrument.institutionId=to.institutionId||instrument.institutionId||null;
        instrument.country=to.country;
        movedInstruments++;
      }
    }
    for(const rule of arr(state.settings&&state.settings.bankLearningRules)){
      if(!rule)continue;
      if(rule.accountId===from.id)rule.accountId=to.id;
      if(rule.fromAccountId===from.id)rule.fromAccountId=to.id;
      if(rule.targetAccountId===from.id)rule.targetAccountId=to.id;
      rule.updatedAt=Date.now();
    }
    if(state.settings){
      for(const key of ['defaultAccountByCountry','primaryAccountByCountry']){
        const map=state.settings[key];
        if(map&&typeof map==='object'){
          for(const c of Object.keys(map))if(map[c]===from.id)map[c]=to.id;
        }
      }
    }
    state.accounts=accounts.filter(a=>a&&a.id!==from.id);
    return {ok:true,fromAccountId:from.id,toAccountId:to.id,movedTransactions,movedRecurring,movedInstruments};
  }
  function cardIdentity4(value){
    const x=String(value||'');
    return /^\d{4}$/.test(x)?x:'';
  }
  function cardIdentityCompatible(a,b){
    if(!a||!b)return false;
    const af=cardIdentity4(a.first4),al=cardIdentity4(a.last4);
    const bf=cardIdentity4(b.first4),bl=cardIdentity4(b.last4);
    const aFull=!!(af&&al),bFull=!!(bf&&bl);
    if(aFull&&bFull)return af===bf&&al===bl;
    if(af&&bf)return af===bf;
    if(al&&bl&&al===bl)return true;
    // Legacy SANAD could store a "starting with" prefix as last4. Allow only
    // when that side has no first4, so two fully identified cards can never
    // match merely because one card's first4 equals the other's last4.
    if(!af&&al&&bf&&al===bf)return true;
    if(!bf&&bl&&af&&bl===af)return true;
    return false;
  }
  function mergeDuplicateInstrument(state,fromInstrumentId,toInstrumentId){
    if(!state||fromInstrumentId===toInstrumentId)return {ok:false,reason:'invalid-merge'};
    const instruments=arr(state.paymentInstruments),accounts=arr(state.accounts),institutions=arr(state.institutions);
    const from=instruments.find(i=>i&&i.id===fromInstrumentId&&!i.archived)||null;
    const to=instruments.find(i=>i&&i.id===toInstrumentId&&!i.archived)||null;
    if(!from||!to)return {ok:false,reason:'instrument-not-found'};
    if(from.type!==to.type||from.country!==to.country)return {ok:false,reason:'instrument-type-country-mismatch'};
    if(!cardIdentityCompatible(from,to))return {ok:false,reason:'instrument-identity-mismatch'};
    if(from.network&&to.network&&from.network!=='other'&&to.network!=='other'&&from.network!==to.network)
      return {ok:false,reason:'instrument-network-mismatch'};
    const fromAcc=accounts.find(a=>a&&a.id===from.accountId)||null,toAcc=accounts.find(a=>a&&a.id===to.accountId)||null;
    if(!fromAcc||!toAcc||fromAcc.currency!==toAcc.currency)return {ok:false,reason:'account-currency-mismatch'};
    const fromInst=institutions.find(i=>i&&i.id===(from.institutionId||fromAcc.institutionId))||null;
    const toInst=institutions.find(i=>i&&i.id===(to.institutionId||toAcc.institutionId))||null;
    if(fromInst&&toInst&&!sameInstitutionSource(state,fromInst,toInst))return {ok:false,reason:'institution-mismatch'};
    const dedicated=['credit_card','prepaid_card'].includes(from.type);
    if(!dedicated&&fromAcc.id!==toAcc.id)return {ok:false,reason:'shared-card-account-mismatch'};
    const targetHadHistory=dedicated&&(
      arr(state.transactions).some(t=>t&&(t.accountId===toAcc.id||t.fromAccountId===toAcc.id||t.toAccountId===toAcc.id))||
      arr(state.recurring).some(r=>r&&r.accountId===toAcc.id)
    );
    if(dedicated){
      const siblings=instruments.filter(i=>i&&!i.archived&&i.id!==from.id&&i.accountId===fromAcc.id);
      if(siblings.length)return {ok:false,reason:'source-account-shared'};
      if(!targetHadHistory){
        if(Math.abs(Number(toAcc.openingBalance)||0)<=0.001&&Math.abs(Number(fromAcc.openingBalance)||0)>0.001)
          toAcc.openingBalance=Number(fromAcc.openingBalance)||0;
        if(Math.abs(Number(toAcc.openingDebt)||0)<=0.001&&Math.abs(Number(fromAcc.openingDebt)||0)>0.001)
          toAcc.openingDebt=Number(fromAcc.openingDebt)||0;
      }
      if((Number(toAcc.creditLimit)||0)<=0&&(Number(fromAcc.creditLimit)||0)>0)
        toAcc.creditLimit=Number(fromAcc.creditLimit)||0;
      if(!toAcc.defaultRepaymentAccountId&&fromAcc.defaultRepaymentAccountId)
        toAcc.defaultRepaymentAccountId=fromAcc.defaultRepaymentAccountId;
    }
    let movedTransactions=0,movedRecurring=0;
    for(const tx of arr(state.transactions)){
      if(!tx)continue;
      let touched=false;
      if(tx.instrumentId===from.id){tx.instrumentId=to.id;touched=true;}
      if(dedicated){
        if(tx.accountId===fromAcc.id){tx.accountId=toAcc.id;touched=true;}
        if(tx.fromAccountId===fromAcc.id){tx.fromAccountId=toAcc.id;tx.fromCountry=toAcc.country;tx.fromCurrency=toAcc.currency;touched=true;}
        if(tx.toAccountId===fromAcc.id){tx.toAccountId=toAcc.id;tx.toCountry=toAcc.country;tx.toCurrency=toAcc.currency;touched=true;}
      }
      if(touched)movedTransactions++;
    }
    for(const rec of arr(state.recurring)){
      if(!rec)continue;
      let touched=false;
      if(rec.instrumentId===from.id){rec.instrumentId=to.id;touched=true;}
      if(dedicated&&rec.accountId===fromAcc.id){rec.accountId=toAcc.id;rec.currency=toAcc.currency;touched=true;}
      if(touched)movedRecurring++;
    }
    if(dedicated){
      const refs=Array.from(new Set([].concat(toAcc.bankRefs||[],fromAcc.bankRefs||[]).filter(Boolean).map(String)));
      if(refs.length)toAcc.bankRefs=refs.slice(0,12);
      if(toAcc.observedBalance==null&&fromAcc.observedBalance!=null){toAcc.observedBalance=fromAcc.observedBalance;toAcc.observedBalanceAt=fromAcc.observedBalanceAt||null;}
      if(toAcc.observedAvailableCredit==null&&fromAcc.observedAvailableCredit!=null){toAcc.observedAvailableCredit=fromAcc.observedAvailableCredit;toAcc.observedAvailableCreditAt=fromAcc.observedAvailableCreditAt||null;}
    }
    if(!to.first4&&from.first4)to.first4=from.first4;
    if(!to.last4&&from.last4)to.last4=from.last4;
    if((!to.network||to.network==='other')&&from.network)to.network=from.network;
    for(const rule of arr(state.settings&&state.settings.bankLearningRules)){
      if(!rule)continue;
      if(rule.instrumentId===from.id)rule.instrumentId=to.id;
      if(dedicated&&rule.accountId===fromAcc.id)rule.accountId=toAcc.id;
      if(dedicated&&rule.fromAccountId===fromAcc.id)rule.fromAccountId=toAcc.id;
      if(dedicated&&rule.targetAccountId===fromAcc.id)rule.targetAccountId=toAcc.id;
      rule.updatedAt=Date.now();
    }
    if(state.settings&&state.settings.defaultInstrumentByCountry){
      for(const c of Object.keys(state.settings.defaultInstrumentByCountry)){
        if(state.settings.defaultInstrumentByCountry[c]===from.id)state.settings.defaultInstrumentByCountry[c]=to.id;
      }
    }
    state.paymentInstruments=instruments.filter(i=>i&&i.id!==from.id);
    let removedAccount=false;
    if(dedicated){
      const accountStillReferenced=state.paymentInstruments.some(i=>i&&i.accountId===fromAcc.id)||
        arr(state.transactions).some(t=>t&&(t.accountId===fromAcc.id||t.fromAccountId===fromAcc.id||t.toAccountId===fromAcc.id))||
        arr(state.recurring).some(r=>r&&r.accountId===fromAcc.id);
      if(!accountStillReferenced){state.accounts=accounts.filter(a=>a&&a.id!==fromAcc.id);removedAccount=true;}
    }
    return {ok:true,fromInstrumentId:from.id,toInstrumentId:to.id,movedTransactions,movedRecurring,removedAccount};
  }
  function confirmAccountIdentity(state,parsed,accountId,options){
    const opts=options||{},account=arr(state&&state.accounts).find(a=>a&&a.id===accountId&&!a.archived);
    const ref=MessageCore.normalizeRef(parsed&&parsed.accountRef||'');
    if(!opts.confirmed||!account||!['bank','ewallet'].includes(account.type)||!ref||!parsed.bankId||account.currency!==parsed.currency||account.country!==countryForParsed(parsed))return {ok:false,reason:'account-identity-invalid'};
    const inst=arr(state.institutions).find(i=>i&&i.id===account.institutionId);
    if(institutionBankId(inst)!==parsed.bankId)return {ok:false,reason:'account-identity-source-conflict'};
    const sameScope=a=>a&&a.institutionId===account.institutionId&&a.type===account.type&&a.country===account.country&&a.currency===account.currency;
    const conflict=arr(state.accounts).some(a=>a.id!==account.id&&sameScope(a)&&(
      arr(a.bankIdentityBindings).some(b=>b&&b.enabled!==false&&b.bankId===parsed.bankId&&b.reference===ref)||
      arr(a.bankRefs).concat(a.bankRef||[],a.accountRef||[]).some(r=>MessageCore.normalizeRef(r)===ref)));
    if(conflict)return {ok:false,reason:'account-identity-reference-conflict'};
    if(!Array.isArray(account.bankIdentityBindings))account.bankIdentityBindings=[];
    if(!account.bankIdentityBindings.some(b=>b&&b.enabled!==false&&b.bankId===parsed.bankId&&b.reference===ref))account.bankIdentityBindings.push({bankId:parsed.bankId,accountType:account.type,currency:account.currency,country:account.country,reference:ref,enabled:true,confirmedAt:Number(opts.now)||Date.now(),source:'user-confirmation',eventId:parsed.eventId||null});
    return {ok:true,accountId:account.id};
  }
  function learnFromApproval(state,parsed,route,options){
    if(!state||!parsed||!route||route.status!=='routed')return null;
    if(!state.settings||typeof state.settings!=='object')state.settings={};
    if(!Array.isArray(state.settings.bankLearningRules))state.settings.bankLearningRules=[];
    const sourceKey=learningSourceKey(parsed),signature=templateSignature(parsed);
    if(!sourceKey||signature.length<8)return null;
    const opts=options||{},now=Number(opts.now)||Date.now();
    const kind=String(opts.kind||parsed.kind||'');
    const spec={
      sourceKey,templateSignature:signature,country:countryForParsed(parsed),currency:String(parsed.currency||'').toUpperCase(),
      cardFirst4:parsed.cardFirst4?String(parsed.cardFirst4):null,cardLast4:parsed.cardLast4?String(parsed.cardLast4):null,accountRef:parsed.accountRef?String(parsed.accountRef):null,
      kind,
      accountId:route.account&&route.account.id||null,
      fromAccountId:route.fromAccount&&route.fromAccount.id||null,
      targetAccountId:route.targetAccount&&route.targetAccount.id||null,
      instrumentId:route.instrument&&route.instrument.id||null
    };
    const key=r=>[
      r.sourceKey,r.templateSignature,r.country||'',String(r.currency||'').toUpperCase(),
      r.cardFirst4||'',r.cardLast4||'',r.accountRef||''
    ].join('|');
    const wantedKey=key(spec);
    let rule=state.settings.bankLearningRules.find(r=>r&&key(r)===wantedKey)||null;
    if(rule){
      if(rule.enabled===false)return clone(rule);
      Object.assign(rule,spec,{enabled:true,updatedAt:now,approvals:(Number(rule.approvals)||0)+1});
    }else{
      const makeId=typeof opts.uid==='function'?opts.uid:(p=>String(p||'rule')+'_'+now);
      rule=Object.assign({id:makeId('bankrule'),enabled:true,createdAt:now,updatedAt:now,approvals:1},spec);
      state.settings.bankLearningRules.push(rule);
      if(state.settings.bankLearningRules.length>200)state.settings.bankLearningRules.splice(0,state.settings.bankLearningRules.length-200);
    }
    return clone(rule);
  }
  function attachBeneficiary(parsed,state,built,create,uid){
    if(!built||!built.ok||!built.transaction||built.transaction.type!=='external_transfer')return built;
    const name=String(parsed&&parsed.beneficiaryName||'').trim();
    if(!name)return built;
    const key=normalizedPerson(name);
    let bene=arr(state&&state.beneficiaries).find(b=>b&&normalizedPerson(b.name)===key)||null;
    if(!bene){
      bene={
        id:uid('bene'),name,country:parsed.beneficiaryCountry||'OTHER',defaultCurrency:parsed.receivedCurrency||null,
        note:'Auto-discovered from financial notification',type:'person',archived:false,
        created:new Date(parsed.postedAt||Date.now()).toISOString().slice(0,10),autoDiscovered:true
      };
      create.beneficiaries.push(bene);
    }
    built.transaction.beneficiaryId=bene.id;
    return built;
  }
  function autoEligible(parsed,route){
    if(!parsed||!parsed.recognized)return {ok:false,reason:'unrecognized'};
    if(parsed.ignored)return {ok:false,reason:parsed.reason||'ignored'};
    if(parsed.reviewReason)return {ok:false,reason:parsed.reviewReason};
    if(['deposit','incoming_transfer'].includes(parsed.kind))return {ok:false,reason:'incoming-origin-unconfirmed'};
    if(parsed.kind==='outgoing_transfer')return {ok:false,reason:'outgoing-destination-unconfirmed'};
    if(['salary','deposit','incoming_transfer'].includes(parsed.kind)&&route&&route.account&&['credit','debt'].includes(route.account.type))return {ok:false,reason:'asset-account-required'};
    if(parsed.feeFormula)return {ok:false,reason:'fee-review-required'};
    if(parsed.kind==='refund'&&route&&route.account){
      const a=route.account,credit=a.type==='credit',value=num(credit?parsed.availableCredit:parsed.availableBalance);
      const previous=num(credit?a.observedAvailableCredit:a.observedBalance);
      const previousAt=Number(credit?a.observedAvailableCreditAt:a.observedBalanceAt)||0;
      const elapsed=Number(parsed.postedAt)-previousAt;
      if(value!=null&&previous!=null&&previousAt>0&&elapsed>0&&elapsed<=86400000&&value<previous)
        return {ok:false,reason:'refund-balance-review'};
    }
    if(!route||route.status!=='routed')return {ok:false,reason:(route&&route.reason)||'route-required'};
    if(Number(route.confidence||0)<0.90)return {ok:false,reason:'route-confidence-low'};
    const exactInstrument=!!(route.instrument&&parsed.cardLast4&&String(route.instrument.last4||'')===String(parsed.cardLast4));
    const exactAccountRef=!!(parsed.accountRef&&Number(route.confidence||0)>=0.95);
    const exactCustomSource=!!(route.customSourceMatch&&Number(route.confidence||0)>=0.96);
    const learnedRoute=route.learnedRule===true;
    const minParsedConfidence=learnedRoute?0.70:(exactInstrument?0.70:(exactAccountRef?0.74:(exactCustomSource?0.72:0.95)));
    if(Number(parsed.confidence||0)<minParsedConfidence)return {ok:false,reason:'low-confidence'};
    if(parsed.cardLast4&&parsed.cardType&&['purchase','bill_payment','mobile_recharge'].includes(parsed.kind)&&!route.instrument)return {ok:false,reason:'instrument-missing'};
    if((num(parsed.fee)||0)+(num(parsed.vat)||0)>0)return {ok:false,reason:'fee-review-required'};
    if(parsed.kind==='refund'&&parsed.cardLast4&&!route.instrument)return {ok:false,reason:'refund-instrument-required'};
    if(parsed.kind==='cash_withdrawal'&&!route.targetAccount)return {ok:false,reason:'cash-destination-required'};
    return {ok:true};
  }
  function planBalanceObservation(parsed,state,uid){
    if(num(parsed.availableBalance)==null||!parsed.providerId)return {action:'review',reason:'balance-source-required',confidence:0};
    const country=countryForParsed(parsed);
    let institution=findInstitution(state,parsed);
    const create={institutions:[],accounts:[],instruments:[],beneficiaries:[]};
    if(!institution){institution=makeInstitution(parsed,uid);if(!institution)return {action:'review',reason:'source-not-identified',confidence:0};create.institutions.push(institution);}
    const accounts=arr(state.accounts).filter(a=>a&&!a.archived&&a.institutionId===institution.id&&a.country===country&&a.currency===parsed.currency&&a.type==='ewallet');
    if(accounts.length>1)return {action:'review',reason:'ambiguous-existing-accounts',confidence:0};
    let account=accounts[0];
    if(!account){
      account=makeAssetAccount(Object.assign({},parsed,{kind:'deposit',amount:0}),institution.id,uid,'deposit',institution);
      account.openingBalanceKnown=false;
      create.accounts.push(account);
    }
    if(Number(account.observedBalanceAt)>Number(parsed.postedAt))return {action:'duplicate',reason:'older-observation',confidence:1};
    if(!create.accounts.length&&Number(account.observedBalanceAt)===Number(parsed.postedAt)&&num(account.observedBalance)===num(parsed.availableBalance))return {action:'duplicate',reason:'observation-already-imported',confidence:1};
    return {action:'observe',create,observations:updateObservation(parsed,{account}),reason:'reported-wallet-balance',confidence:0.99,discovered:create.accounts.length>0};
  }
  function plan(parsed,state,options){
    const uid=idFactory(options);
    const hold=parsed&&matchingReviewHold(state,parsed);
    if(hold)return {action:'review',reason:hold.reason,confidence:0};
    if(!parsed||!parsed.recognized)return {action:'review',reason:(parsed&&parsed.reason)||'unrecognized',confidence:0};
    if(parsed.reviewReason)return {action:'review',reason:parsed.reviewReason,confidence:0};
    if(!parsed.bankId&&!parsed.providerId&&!findCustomInstitutionByHint(state,parsed)&&!matchLearnedRule(parsed,state))return {action:'review',reason:'source-not-identified',confidence:0};
    if(parsed.kind==='purchase_settlement')return planPurchaseSettlement(parsed,state);
    if(parsed.kind==='balance_observation')return planBalanceObservation(parsed,state||{},uid);
    const manual=manualDuplicateCandidate(parsed,state);
    if(manual)return {action:'review',reason:'possible-manual-duplicate',existingTransactionId:manual.id,confidence:0};
    const learnedRule=matchLearnedRule(parsed,state);
    if(learnedRule&&learnedRule.kind&&learnedRule.kind!==parsed.kind&&!['deposit','incoming_transfer','outgoing_transfer'].includes(parsed.kind)){
      parsed=Object.assign({},parsed,{kind:learnedRule.kind});
    }
    const dup=duplicateOf(parsed,state);
    if(dup)return {action:'duplicate',reason:'already-imported',existingTransactionId:dup.id,confidence:1};
    const referenceConflict=conflictingReferenceOf(parsed,state);
    if(referenceConflict)return {action:'review',reason:'possible-duplicate',existingTransactionId:referenceConflict.id,confidence:0};
    const probable=semanticDuplicateOf(parsed,state,true);
    if(probable)return {action:'review',reason:'possible-duplicate',existingTransactionId:probable.id,confidence:0};
    const counterparts=transferCounterparts(parsed,state);
    if(counterparts.length)return {action:'review',reason:'possible-own-transfer',counterpartTransactionIds:counterparts.map(t=>t.id),confidence:0};
    if(['deposit','incoming_transfer'].includes(parsed.kind))return {action:'review',reason:'incoming-origin-unconfirmed',confidence:0};
    if(parsed.kind==='outgoing_transfer')return {action:'review',reason:'outgoing-destination-unconfirmed',confidence:0};

    // Planning only appends draft entities; never clone the complete historical ledger per SMS.
    let draft=Object.assign({},state||{});
    draft.institutions=arr(draft.institutions).slice();
    draft.accounts=arr(draft.accounts).slice();
    draft.paymentInstruments=arr(draft.paymentInstruments).slice();
    if(!Array.isArray(draft.institutions))draft.institutions=[];
    if(!Array.isArray(draft.accounts))draft.accounts=[];
    if(!Array.isArray(draft.paymentInstruments))draft.paymentInstruments=[];
    if(!Array.isArray(draft.transactions))draft.transactions=[];

    let route=routeFromLearnedRule(parsed,draft,learnedRule)||resolveCustomRoute(parsed,draft,MessageCore.resolveRoute(parsed,draft));
    const identityRoute=MessageCore.resolveRoute(parsed,draft);
    if(identityRoute.reason==='account-identity-history-review')return {action:'review',reason:identityRoute.reason,confidence:0};
    const initialRoute=route;
    const direct=autoEligible(parsed,route);
    if(direct.reason==='fee-review-required'&&route&&route.account&&route.instrument)return {action:'review',reason:direct.reason,confidence:0};
    if(['refund-balance-review','refund-instrument-required'].includes(direct.reason))return {action:'review',reason:direct.reason,confidence:0};
    if(direct.ok){
      const create={institutions:[],accounts:[],instruments:[],beneficiaries:[]};
      let built=applyLearnedCategory(parsed,state,MessageCore.buildTransaction(parsed,route,{uid}));
      if(!built.ok)return {action:'review',reason:built.reason||'build-failed',confidence:0};
      built=attachBeneficiary(parsed,state,built,create,uid);
      return {action:'auto-save',reason:route&&route.learnedRule?'learned-rule':'exact-route',confidence:Math.min(1,Number(parsed.confidence||0)),transaction:built.transaction,create,observations:updateObservation(parsed,route),learningRuleId:route&&route.learningRuleId||null};
    }

    const create={institutions:[],accounts:[],instruments:[],beneficiaries:[]};
    const customInstitution=parsed.bankId||parsed.providerId?null:findCustomInstitutionByHint(draft,parsed);
    const registeredSource=!!(parsed.bankId||parsed.providerId);
    const discoveryMinConfidence=customInstitution?0.72:(registeredSource?0.86:0.95);
    if(Number(parsed.confidence||0)<discoveryMinConfidence)return {action:'review',reason:'low-confidence',confidence:Number(parsed.confidence||0)};
    if(!parsed.bankId&&!parsed.providerId&&!customInstitution)return {action:'review',reason:'source-not-identified',confidence:0};

    let institution=findInstitution(draft,parsed)||customInstitution;
    if(!institution){
      institution=makeInstitution(parsed,uid);
      if(!institution)return {action:'review',reason:'source-not-identified',confidence:0};
      create.institutions.push(institution);draft.institutions.push(institution);
    }

    if(parsed.kind==='purchase'&&parsed.cardLast4&&parsed.cardType){
      const institutionBank=institutionBankId(institution);
      const institutionProvider=institutionProviderId(institution);
      const equivalentExisting=draft.paymentInstruments.filter(inst=>{
        if(!inst||inst.archived||String(inst.last4||'')!==String(parsed.cardLast4))return false;
        const linked=draft.accounts.find(a=>a&&a.id===inst.accountId)||null;
        if(linked&&linked.country!==countryForParsed(parsed))return false;
        const sourceInst=draft.institutions.find(i=>i&&i.id===(inst.institutionId||(linked&&linked.institutionId)))||null;
        if(!sourceInst)return inst.institutionId===institution.id||(linked&&linked.institutionId===institution.id);
        const sourceBank=institutionBankId(sourceInst),sourceProvider=institutionProviderId(sourceInst);
        if(institutionBank&&sourceBank)return institutionBank===sourceBank;
        if(institutionProvider&&sourceProvider)return institutionProvider===sourceProvider;
        return sourceInst.id===institution.id;
      });
      if(equivalentExisting.length){
        return {
          action:'review',
          reason:equivalentExisting.length===1?'existing-instrument-conflict':'ambiguous-existing-instruments',
          confidence:0,
          existingInstrumentIds:equivalentExisting.map(x=>x.id),
          create
        };
      }
      if(parsed.cardType==='credit_card'){
        const acc=makeCreditAccount(parsed,institution.id,uid);
        if(!acc)return {action:'review',reason:'credit-discovery-incomplete',confidence:0};
        if(customInstitution&&!parsed.bankId&&!parsed.providerId){
          acc.name=customInstitution.name+' • Credit ****'+parsed.cardLast4;
          acc.autoDiscoverySource=customInstitution.id;
        }
        const card=makeInstrument(parsed,acc,institution.id,uid);
        create.accounts.push(acc);create.instruments.push(card);
        draft.accounts.push(acc);draft.paymentInstruments.push(card);
      }else if(parsed.cardType==='debit_card'||parsed.cardType==='wallet_card'){
        const expectedType=parsed.cardType==='wallet_card'?'ewallet':'bank';
        let acc=initialRoute&&initialRoute.account&&initialRoute.account.type===expectedType?draft.accounts.find(a=>a.id===initialRoute.account.id):null;
        const sameSourceAccounts=draft.accounts.filter(a=>a&&!a.archived&&a.type===expectedType&&a.institutionId===institution.id);
        if(!acc&&sameSourceAccounts.length===1)return {action:'review',reason:'card-account-link-required',confidence:0};
        if(!acc&&sameSourceAccounts.length>1){
          return {action:'review',reason:'ambiguous-existing-accounts',confidence:0,create};
        }
        if(!acc){
          acc=makeAssetAccount(parsed,institution.id,uid,'purchase',institution);
          if(!acc)return {action:'review',reason:'observed-balance-required',confidence:0};
          acc.type=expectedType;
          acc.icon=expectedType==='ewallet'?'📱':'🏦';
          create.accounts.push(acc);draft.accounts.push(acc);
        }
        const card=makeInstrument(parsed,acc,institution.id,uid);
        if(!card)return {action:'review',reason:'instrument-discovery-failed',confidence:0};
        create.instruments.push(card);draft.paymentInstruments.push(card);
      }
    }else if(['deposit','salary','refund','incoming_transfer'].includes(parsed.kind)){
      const expectedType=(parsed.providerId||institution.type==='wallet_provider')?'ewallet':'bank';
      const sameSourceAccounts=draft.accounts.filter(a=>a&&!a.archived&&a.type===expectedType&&a.institutionId===institution.id&&a.country===countryForParsed(parsed)&&(!parsed.currency||a.currency===parsed.currency));
      if(sameSourceAccounts.length===1){
        if(!parsed.providerId||parsed.accountRef||parsed.accountSuffix)return {action:'review',reason:'account-identity-required',confidence:0};
        route={status:'routed',account:sameSourceAccounts[0],instrument:null,confidence:0.98,sameSourceUnique:true};
      }else if(sameSourceAccounts.length>1){
        return {action:'review',reason:'ambiguous-existing-accounts',confidence:0,create};
      }else{
        const acc=makeAssetAccount(parsed,institution.id,uid,parsed.kind,institution);
        if(!acc)return {action:'review',reason:'observed-balance-required',confidence:0};
        create.accounts.push(acc);draft.accounts.push(acc);
      }
    }else{
      return {action:'review',reason:direct.reason||'existing-source-required',confidence:0};
    }

    if(!route||!route.sameSourceUnique)route=resolveCustomRoute(parsed,draft,MessageCore.resolveRoute(parsed,draft));
    const eligible=autoEligible(parsed,route);
    if(!eligible.ok)return {action:'review',reason:eligible.reason,confidence:0,create};
    let built=applyLearnedCategory(parsed,state,MessageCore.buildTransaction(parsed,route,{uid}));
    if(!built.ok)return {action:'review',reason:built.reason||'build-failed',confidence:0,create};
    built=attachBeneficiary(parsed,state,built,create,uid);
    return {
      action:'auto-save',reason:'safe-auto-discovery',confidence:Math.min(0.99,Number(parsed.confidence||0)),
      transaction:built.transaction,create,observations:updateObservation(parsed,route),discovered:true
    };
  }
  function applyPlan(state,plan){
    if(!state||!plan||!['auto-save','observe'].includes(plan.action))return false;
    if(plan.replacesTransactionId){
      const index=arr(state.transactions).findIndex(t=>t.id===plan.replacesTransactionId);
      if(index<0||JSON.stringify(state.transactions[index])!==JSON.stringify(plan.before))return false;
      state.transactions[index]=clone(plan.transaction);return true;
    }
    const create=plan.create||{};
    arr(create.institutions).forEach(x=>state.institutions.push(clone(x)));
    arr(create.accounts).forEach(x=>state.accounts.push(clone(x)));
    arr(create.instruments).forEach(x=>state.paymentInstruments.push(clone(x)));
    if(!Array.isArray(state.beneficiaries))state.beneficiaries=[];
    arr(create.beneficiaries).forEach(x=>state.beneficiaries.push(clone(x)));
    if(plan.transaction)state.transactions.push(clone(plan.transaction));
    for(const o of arr(plan.observations)){
      const a=state.accounts.find(x=>x&&x.id===o.accountId);
      if(!a)continue;
      const incomingAt=Number(o.at)||0;
      const existingAt=Number(a[o.field+'At'])||0;
      if(existingAt>0&&incomingAt>0&&incomingAt<existingAt)continue;
      a[o.field]=o.value;
      a[o.field+'At']=o.at;
      if(o.field==='observedBalance')a.observedBalanceType='available_balance';
    }
    return true;
  }
  function reconciliation(parsed,state,plan,accountBalanceFn){
    if(!parsed||!plan||plan.action!=='auto-save'||typeof accountBalanceFn!=='function'||parsed.balanceType!=='ledger_balance')return null;
    const observed=num(parsed.availableBalance);
    if(observed==null)return null;
    const tx=plan.transaction||{};
    const accountId=tx.accountId||tx.fromAccountId||null;
    if(!accountId)return null;
    const currency=arr(state&&state.accounts).find(a=>a&&a.id===accountId)?.currency||parsed.currency;
    const rawCalculated=accountBalanceFn(state,accountId);if(rawCalculated==null)return null;
    const actual=Money.decimal(observed,currency),expected=Money.decimal(rawCalculated,currency);
    if(!actual.ok||!expected.ok)return null;
    const diff=Money.sum([actual.value,-expected.value],currency);if(!diff.ok)return null;
    return {accountId,observed:actual.value,calculated:expected.value,difference:diff.value,matched:diff.minorUnits==='0'};
  }

  function recentScanStart(previous,now,floor){
    const end=Number(now);
    if(!Number.isFinite(end)||end<=0)throw new Error('valid-scan-time-required');
    const checkpoint=Number(previous&&previous.scannedThrough)||0;
    if(Number.isFinite(Number(floor))&&Number(floor)>0)return Math.max(Number(floor),checkpoint>0?Math.min(checkpoint,end)-300000:Number(floor));
    // Legacy callers retain their historical default. Explicit UI ranges never use it.
    // A one-day overlap covers late SMS delivery. Financial evidence handles repeats.
    return Math.max(0,checkpoint>0?Math.min(checkpoint,end)-86400000:end-30*86400000);
  }

  const EVENT_DECISION_LIMIT=50000;
  function eventDecision(state,id){
    const decisions=state&&state.settings&&state.settings.bankEventDecisions;
    return decisions&&Object.prototype.hasOwnProperty.call(decisions,String(id))?decisions[String(id)]:null;
  }
  function reviewHold(state,id){
    const holds=state&&state.settings&&state.settings.bankReviewHolds;
    return holds&&Object.prototype.hasOwnProperty.call(holds,String(id))?holds[String(id)]:null;
  }
  function matchingReviewHold(state,parsed){
    const exact=reviewHold(state,parsed&&parsed.eventId);if(exact)return exact;
    if(!parsed||(!parsed.bankId&&!parsed.providerId))return null;
    for(const [id,hold] of Object.entries((state&&state.settings&&state.settings.bankReviewHolds)||{})){
      const e=hold.evidence;if(!e)continue;
      if((e.bankId||null)!==(parsed.bankId||null)||(e.providerId||null)!==(parsed.providerId||null)||e.kind!==parsed.kind||e.currency!==parsed.currency||round2(e.amount)!==round2(parsed.amount))continue;
      const close=Number(e.postedAt)>0&&Number(parsed.postedAt)>0&&Math.abs(Number(e.postedAt)-Number(parsed.postedAt))<=30*60000;
      const reference=!!(e.ref&&parsed.transactionRef&&e.ref===parsed.transactionRef);
      const date=!!(e.date&&parsed.transactionDate&&e.date===parsed.transactionDate);
      if(close||reference||date)return Object.assign({},hold,{reason:'repair-evidence-match-review',heldEventId:id});
    }
    return null;
  }
  function auditWithDurableDecisions(audit,state){
    const old=audit||{},rows=new Map(arr(old.rows).filter(r=>r&&r.id).map(r=>[String(r.id),clone(r)]));
    for(const [id,d] of Object.entries((state&&state.settings&&state.settings.bankEventDecisions)||{})){
      const row=rows.get(id)||{id};
      rows.set(id,Object.assign({},row,d,{durable:true,reason:row.action===d.action?row.reason:'durable-'+d.action}));
    }
    for(const [id,hold] of Object.entries((state&&state.settings&&state.settings.bankReviewHolds)||{})){
      rows.set(id,Object.assign({},rows.get(id)||{id},hold,{action:'review',transactionId:null,durable:true}));
    }
    const combined=Array.from(rows.values()).sort((a,b)=>Number(a.at||0)-Number(b.at||0)),drop=Math.max(0,combined.length-1000);
    return Object.assign({},old,{version:2,limit:1000,rows:combined.slice(drop),omitted:Number(old.omitted||0)+drop,authority:'finance.settings.bankEventDecisions'});
  }
  function rememberEventDecision(state,id,action,at,transactionId,options){
    if(!state||!state.settings||typeof id!=='string'||!id||id.length>240||['__proto__','constructor','prototype'].includes(id))throw Error('invalid-event-identity');
    if(!['saved','observed','ignored','duplicate','dismissed'].includes(action)||!Number.isFinite(Number(at))||Number(at)<=0)throw Error('invalid-event-decision');
    const decisionSource=(options&&options.decisionSource)||(action==='dismissed'?'user-dismissal':'deterministic-contract');
    if(!['deterministic-contract','user-confirmation','user-dismissal'].includes(decisionSource))throw Error('invalid-decision-source');
    if(reviewHold(state,id)&&decisionSource!=='user-confirmation'&&decisionSource!=='user-dismissal')throw Error('review-confirmation-required');
    const decisions=state.settings.bankEventDecisions||(state.settings.bankEventDecisions={});
    // Never evict decisions: an eviction could resurrect an old transaction.
    if(!Object.prototype.hasOwnProperty.call(decisions,id)&&Object.keys(decisions).length>=EVENT_DECISION_LIMIT)throw Error('event-decision-capacity');
    decisions[id]={action,at:Number(at),transactionId:transactionId||null,parserVersion:'9.2.8-financial-contract',decisionSource};
    if(reviewHold(state,id))delete state.settings.bankReviewHolds[id];
    return true;
  }
  function compatibleScanCheckpoint(previous,floor){
    return previous&&Number(previous.configuredStartAt)===Number(floor)?previous:null;
  }
  function transferCounterparts(parsed,state){
    if(!parsed||!['deposit','incoming_transfer','outgoing_transfer'].includes(parsed.kind))return [];
    const outgoing=parsed.kind==='outgoing_transfer';
    const route=MessageCore.resolveRoute(parsed,state||{}),current=route&&(outgoing?route.fromAccount:route.account);
    if(!route||route.status!=='routed'||!current||current.type==='credit')return [];
    const at=Number(parsed.postedAt);
    if(!Number.isFinite(at)||at<=0)return [];
    return arr(state&&state.transactions).filter(t=>{
      if(!t||!t.bankImportKey)return false;
      if(outgoing){
        const kind=t.bankImportEvidence&&t.bankImportEvidence.kind||String(t.bankImportKey).split('|')[2];
        if(t.type!=='income'||!['deposit','incoming_transfer'].includes(kind))return false;
      }else if(t.type!=='external_transfer')return false;
      const otherId=outgoing?t.accountId:t.fromAccountId;
      if(otherId===current.id)return false;
      const other=arr(state&&state.accounts).find(a=>a&&a.id===otherId&&!a.archived);
      return other&&other.type!=='credit'&&other.currency===current.currency&&parsed.currency===current.currency&&
        round2(outgoing?t.amount:t.fromAmount)===round2(parsed.amount)&&Math.abs(Number(t.created)-at)<=30*60000;
    });
  }
  function pairOwnTransfer(parsed,state,choice,options){
    const c=choice||{},opts=options||{};
    const old=transferCounterparts(parsed,state).find(t=>t.id===c.counterpartTransactionId);
    const outgoing=parsed.kind==='outgoing_transfer',route=MessageCore.resolveRoute(parsed,state||{});
    const receiver=outgoing?old&&arr(state&&state.accounts).find(a=>a&&a.id===old.accountId&&!a.archived):route.account;
    const from=outgoing?route.fromAccount:old&&arr(state&&state.accounts).find(a=>a&&a.id===old.fromAccountId&&!a.archived);
    if(!old||!receiver||!from||c.fromAccountId!==from.id||c.toAccountId!==receiver.id)return {ok:false,reason:'pair-route-mismatch'};
    if(opts.confirmedFee==null||opts.confirmedFee==='')return {ok:false,reason:'fee-confirmation-required'};
    const corrected=Object.assign({},parsed,{kind:'internal_transfer'});
    const built=MessageCore.buildTransaction(corrected,{status:'routed',fromAccount:from,targetAccount:receiver},opts);
    if(!built.ok)return built;
    const tx=built.transaction;
    tx.id=old.id;tx.created=old.created;tx.date=old.date;tx.note='تحويل بين حساباتي — تم تأكيد طرفَي الرسالة';
    tx.bankImportKey=old.bankImportKey;tx.bankImportEventId=old.bankImportEventId||null;
    tx.bankId=old.bankId||null;tx.providerId=old.providerId||null;tx.bankTransactionRef=old.bankTransactionRef||null;
    tx.bankImportEvidence=clone(old.bankImportEvidence||null);
    tx.bankPostingTimes={from:Number(outgoing?parsed.postedAt:old.created),to:Number(outgoing?old.created:parsed.postedAt)};
    tx.bankLinkedImportEvents=[
      {key:old.bankImportKey,eventId:old.bankImportEventId||null,bankId:old.bankId||null,providerId:old.providerId||null,currency:old.currency||old.fromCurrency,amount:old.amount==null?old.fromAmount:old.amount,ref:old.bankTransactionRef||null,kind:old.bankImportEvidence&&old.bankImportEvidence.kind||(outgoing?'deposit':'outgoing_transfer'),postedAt:Number(old.created),text:old.bankImportEvidence&&old.bankImportEvidence.text||'',availableBalance:old.bankImportEvidence&&old.bankImportEvidence.availableBalance},
      {key:MessageCore.dedupeKey(parsed),eventId:parsed.eventId||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,currency:parsed.currency,amount:parsed.amount,ref:parsed.transactionRef||null,kind:parsed.kind,postedAt:Number(parsed.postedAt),text:parsed.raw||'',availableBalance:parsed.availableBalance}
    ];
    tx.bankPairingBeforeImage=clone(old);
    return {ok:true,transaction:tx,replacesTransactionId:old.id,before:clone(old),observationAccountId:outgoing?from.id:receiver.id};
  }
  function planPurchaseSettlement(parsed,state){
    const review=reason=>({action:'review',reason,confidence:0});
    if(!parsed.bankId||parsed.executionStatus!=='completed'||!parsed.eventId||!parsed.originalPurchaseRef||!parsed.originalPurchaseDate||parsed.settlementFee==null||parsed.settlementFeeCurrency!==parsed.currency)return review('settlement-evidence-incomplete');
    const route=MessageCore.resolveRoute(parsed,state);
    if(route.status!=='routed'||!route.account||!route.instrument||route.account.currency!==parsed.currency)return review('settlement-identity-conflict');
    const candidates=arr(state.transactions).filter(t=>t.type==='expense'&&t.accountId===route.account.id&&t.instrumentId===route.instrument.id&&t.bankId===parsed.bankId&&t.bankTransactionRef===parsed.originalPurchaseRef&&t.date===parsed.originalPurchaseDate&&t.currency===parsed.originalPurchaseCurrency&&Money.decimal(t.amount,t.currency).ok&&Money.decimal(parsed.originalPurchaseAmount,t.currency).ok&&Money.decimal(t.amount,t.currency).minorUnits===Money.decimal(parsed.originalPurchaseAmount,t.currency).minorUnits);
    if(candidates.length!==1)return review(candidates.length?'settlement-original-ambiguous':'settlement-original-required');
    const old=candidates[0],e=old.bankSettlementEvidence;
    if(old.settlementStatus!=='pending'){
      if(e?.source==='bank-message'&&e.amount===parsed.amount&&e.currency===parsed.currency&&old.bankFeeEvidence?.amount===parsed.settlementFee)return {action:'duplicate',reason:'settlement-already-linked',existingTransactionId:old.id,confidence:1};
      return review('settlement-confirmation-conflict');
    }
    const proposal=settlePendingPurchase(state,{transactionId:old.id,amount:parsed.amount,fee:parsed.settlementFee,confirmed:true,now:parsed.postedAt});
    if(!proposal.ok)return review(proposal.reason);
    Object.assign(proposal.transaction.bankSettlementEvidence,{source:'bank-message',settlementEventId:parsed.eventId,originalReference:parsed.originalPurchaseRef,originalDate:parsed.originalPurchaseDate,raw:parsed.raw,sourceHint:parsed.sourceHint,parserVersion:parsed.parserVersion});
    const audit=proposal.transaction.bankSettlementAudit.at(-1);audit.source='bank-message';audit.eventId=parsed.eventId;
    proposal.transaction.bankFeeEvidence.source='bank-message';
    return {action:'auto-save',reason:'strong-settlement-link',confidence:1,transaction:proposal.transaction,before:proposal.before,replacesTransactionId:old.id};
  }
  function settlePendingPurchase(state,options){
    const o=options||{},old=arr(state&&state.transactions).find(t=>t.id===o.transactionId);
    if(!old||old.settlementStatus!=='pending'||o.confirmed!==true)return {ok:false,reason:'pending-settlement-confirmation-required'};
    const account=arr(state.accounts).find(a=>a.id===old.accountId),instrument=arr(state.paymentInstruments).find(i=>i.id===old.instrumentId);
    if(!account||!instrument||instrument.accountId!==account.id)return {ok:false,reason:'settlement-identity-conflict'};
    const amount=Money.ledgerValue(o.amount,account.currency),fee=Money.ledgerValue(o.fee==null?0:o.fee,account.currency);
    if(!amount.ok||amount.value<=0||!fee.ok||fee.value<0)return {ok:false,reason:'invalid-settlement-amount'};
    const total=Money.sum([amount.value,fee.value],account.currency);if(!total.ok)return {ok:false,reason:total.reason};
    const at=Number(o.now)||Date.now();
    const transaction=clone(old);
    Object.assign(transaction,{settlementStatus:'confirmed',walletAmount:total.value,walletCurrency:account.currency,bankPrincipalAmount:amount.value,fxRate:amount.value/old.amount,fxRateSource:'bank-settlement',bankSettlementEvidence:{amount:amount.value,currency:account.currency,source:'user-confirmation',at,eventId:old.bankImportEventId},bankFeeEvidence:{amount:fee.value,currency:account.currency,confirmed:true,source:'manual-review'}});
    transaction.bankSettlementAudit=arr(old.bankSettlementAudit).concat([{action:'settlement-confirmed',at,source:'user-confirmation',originalAmount:old.amount,originalCurrency:old.currency,settlementAmount:amount.value,settlementCurrency:account.currency,fee:fee.value}]);
    return {ok:true,transaction,before:clone(old),replacesTransactionId:old.id};
  }
  return Object.freeze({
    manualImportCandidates,manualDuplicateCandidates,linkManualConfirmation,validateManualImportChanges,preserveImportAudit,auditWithDurableDecisions,
    recentScanStart,compatibleScanCheckpoint,eventDecision,reviewHold,matchingReviewHold,rememberEventDecision,EVENT_DECISION_LIMIT,transferCounterparts,pairOwnTransfer,
    learningEntries,setLearningEnabled,settlePendingPurchase,confirmAccountIdentity,autoEligible,duplicateOf,conflictingReferenceOf,semanticDuplicateOf,openingBalanceForObserved,plan,applyPlan,reconciliation,sourceDisplay,learnedMerchantCategory,findCustomInstitutionByHint,sortNotifications,learningSourceKey,templateSignature,matchLearnedRule,routeFromLearnedRule,routeFromManualChoice,rebindAccountInstitution,rebindInstrumentAccount,mergeDuplicateAccount,cardIdentityCompatible,mergeDuplicateInstrument,learnFromApproval
  });
});
