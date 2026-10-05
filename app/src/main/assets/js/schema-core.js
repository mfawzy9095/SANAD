(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadSchemaCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createSchema(options){
    const opts=options||{};
    const SCHEMA_VERSION=Number(opts.schemaVersion)||1;
    const deepClone=opts.deepClone;
    const DEFAULT_CATS=opts.defaultCats;
    const CURRENCIES=opts.currencies;
    const COUNTRIES=opts.countries;
    const ACCOUNT_TYPES=opts.accountTypes;
    const INSTRUMENT_TYPES=opts.instrumentTypes;
    const SUPPORTED_TX_TYPES=opts.supportedTxTypes;
    const accountTypeInfo=opts.accountTypeInfo;
    const isAssetAccount=opts.isAssetAccount;
    const isFiniteNumberLike=opts.isFiniteNumberLike;
    const isValidIsoDate=opts.isValidIsoDate;
    const isoToday=opts.isoToday;
    const SchemaRepair=opts.schemaRepair;

    if(typeof deepClone!=='function')throw new Error('deepClone-required');
    if(typeof accountTypeInfo!=='function')throw new Error('accountTypeInfo-required');
    if(typeof isAssetAccount!=='function')throw new Error('isAssetAccount-required');
    if(typeof isFiniteNumberLike!=='function')throw new Error('isFiniteNumberLike-required');
    if(typeof isValidIsoDate!=='function')throw new Error('isValidIsoDate-required');
    if(typeof isoToday!=='function')throw new Error('isoToday-required');
    if(!SchemaRepair)throw new Error('schemaRepair-required');

    return {
  CURRENT: SCHEMA_VERSION,
  normalizeRepaymentFees(state){ return SchemaRepair.normalizeRepaymentFees(state); },
  /* V8.8.4.3 FIX 10: never silently convert an existing asset account to prepaid */
  repairPrepaidOwnedAccounts(state){ return SchemaRepair.repairPrepaidOwnedAccounts(state); },
  /* V8.8.4.11: state-local balance (does not depend on global S). */
  _schemaAccountBalance(state, accountId){ return SchemaRepair.schemaAccountBalance(state, accountId); },

  /* V8.8.4.11: credit-card backing account archive consistency.
     Never hide a non-zero raw balance during migration. */
  repairCreditArchiveConsistency(state){ return SchemaRepair.repairCreditArchiveConsistency(state); },
  migrate(state){
    if (!state || typeof state !== 'object') return null;
    const filled = deepClone(state);
    const isV85 = Array.isArray(filled.wallets) && !Array.isArray(filled.accounts);
    if (isV85) return this.migrateV85(filled);
    if (!Array.isArray(filled.institutions)) filled.institutions = [];
    if (!Array.isArray(filled.accounts)) filled.accounts = [];
    if (!Array.isArray(filled.paymentInstruments)) filled.paymentInstruments = [];
    if (!Array.isArray(filled.transactions)) filled.transactions = [];
    if (!Array.isArray(filled.beneficiaries)) filled.beneficiaries = [];
    if (!Array.isArray(filled.tags)) filled.tags = [];
    if (!Array.isArray(filled.recurring)) filled.recurring = [];
    if (!filled.categories || typeof filled.categories !== 'object') filled.categories = {expense:[],income:[]};
    if (!Array.isArray(filled.categories.expense)) filled.categories.expense = [];
    if (!Array.isArray(filled.categories.income)) filled.categories.income = [];
    if (!filled.settings || typeof filled.settings !== 'object') filled.settings = {};

    const D = {
      theme:'light',onboarded:true,hideAmounts:false,notificationsEnabled:false,
      budgets:{},saving:{amount:0,currency:'EGP',saved:0,targetDate:null},
      warnPct:80,alertPct:100,lastFx:{},dismissedReminders:{},
      defaultCountry:'UAE',primaryAccountByCountry:{},lastExpenseSourceByCountry:{},
      categoryBudgets:{},overallSpendingLimits:{},budgetAlerts:{},
      defaultAccountByCountry:{}, defaultInstrumentByCountry:{}
    };
    for (const [k,def] of Object.entries(D)){
      if (filled.settings[k] === undefined) filled.settings[k] = deepClone(def);
    }
    if (!filled.settings.primaryAccountByCountry || typeof filled.settings.primaryAccountByCountry !== 'object') filled.settings.primaryAccountByCountry = {};
    if (!filled.settings.lastExpenseSourceByCountry || typeof filled.settings.lastExpenseSourceByCountry !== 'object') filled.settings.lastExpenseSourceByCountry = {};
    if (!filled.settings.categoryBudgets || typeof filled.settings.categoryBudgets !== 'object') filled.settings.categoryBudgets = {};
    if (!filled.settings.overallSpendingLimits || typeof filled.settings.overallSpendingLimits !== 'object') filled.settings.overallSpendingLimits = {};
    if (!filled.settings.budgetAlerts || typeof filled.settings.budgetAlerts !== 'object') filled.settings.budgetAlerts = {};
    if (!filled.settings.defaultAccountByCountry || typeof filled.settings.defaultAccountByCountry !== 'object'){
      filled.settings.defaultAccountByCountry = {};
    }
    if (Object.keys(filled.settings.defaultAccountByCountry).length === 0 &&
        Object.keys(filled.settings.primaryAccountByCountry).length > 0){
      filled.settings.defaultAccountByCountry = deepClone(filled.settings.primaryAccountByCountry);
    }
    if (!filled.settings.defaultInstrumentByCountry || typeof filled.settings.defaultInstrumentByCountry !== 'object'){
      filled.settings.defaultInstrumentByCountry = {};
    }

    const sysCats = [
      {id:'transferFee',n:'رسوم تحويل',i:'🏦',c:'#E65100'},
      {id:'externalTransfer',n:'تحويل لشخص',i:'👤',c:'#D32F2F'},
      {id:'debtInterest',n:'فوائد / رسوم دين',i:'📈',c:'#C62828'}
    ];
    for (const cat of sysCats){
      if (!filled.categories.expense.some(c => c.id === cat.id)) filled.categories.expense.push(cat);
    }
    if (!filled.categories.income.some(c => c.id === 'rent')){
      filled.categories.income.push({id:'rent',n:'إيجار مستلم',i:'🏠',c:'#0EA5E9'});
    }

    const instById = {};
    filled.institutions.forEach(i => { if (i && i.id) instById[i.id] = i; });

    filled.accounts.forEach(a => {
      if (!a.country) a.country = 'OTHER';
      if (a.openingBalance === undefined){ a.openingBalanceKnown=false; a.openingBalance = 0; }
      if (a.openingDebt === undefined){ a.openingDebtKnown=false; a.openingDebt = 0; }
      if (a.creditLimit === undefined) a.creditLimit = 0;
      if (a.defaultRepaymentAccountId === undefined) a.defaultRepaymentAccountId = null;
      if (a.archived === undefined) a.archived = false;
      if (!CURRENCIES[a.currency]) a.currency = 'EGP';
      if (a.institutionId){
        const inst = instById[a.institutionId];
        if (!inst || inst.country !== a.country) a.institutionId = null;
      }
    });
    filled.paymentInstruments.forEach(i => {
      if (i.archived === undefined) i.archived = false;
      const acc = filled.accounts.find(a => a.id === i.accountId);
      if (!i.country) i.country = acc ? acc.country : 'OTHER';
      if (acc) i.country = acc.country;
      if (i.type === 'debit_card' && acc){
        i.institutionId = acc.institutionId || null;
      }
      if (i.institutionId){
        const inst = instById[i.institutionId];
        if (!inst || inst.country !== i.country) i.institutionId = null;
      }
    });
    filled.transactions.forEach(t => {
      if (!t || typeof t !== 'object') return;
      if (t.type !== 'transfer' && t.type !== 'external_transfer' && t.type !== 'adjustment' && !t.accountId && t.walletId) t.accountId = t.walletId;
      if (t.type === 'transfer'){
        if (!t.fromAccountId && t.fromWalletId) t.fromAccountId = t.fromWalletId;
        if (!t.toAccountId && t.toWalletId) t.toAccountId = t.toWalletId;
        const fa = filled.accounts.find(a => a.id === t.fromAccountId);
        const ta = filled.accounts.find(a => a.id === t.toAccountId);
        if (fa){ if (!t.fromCurrency) t.fromCurrency = fa.currency; if (!t.fromCountry) t.fromCountry = fa.country; }
        if (ta){ if (!t.toCurrency) t.toCurrency = ta.currency; if (!t.toCountry) t.toCountry = ta.country; }
        if (t.fxRate == null && isFiniteNumberLike(t.fromAmount) && Number(t.fromAmount) > 0 && isFiniteNumberLike(t.toAmount)){
          t.fxRate = Math.round((Number(t.toAmount) / Number(t.fromAmount)) * 1000000) / 1000000;
        }
        if (t.fee == null) t.fee = 0;
      } else if (t.type === 'external_transfer'){
        if (!t.fromAccountId && t.walletId) t.fromAccountId = t.walletId;
        const fa = filled.accounts.find(a => a.id === t.fromAccountId);
        if (fa){ if (!t.fromCurrency) t.fromCurrency = fa.currency; if (!t.fromCountry) t.fromCountry = fa.country; }
        if (t.fxRate == null && isFiniteNumberLike(t.fromAmount) && Number(t.fromAmount) > 0 && isFiniteNumberLike(t.receivedAmount)){
          t.fxRate = Math.round((Number(t.receivedAmount) / Number(t.fromAmount)) * 1000000) / 1000000;
        }
        if (t.fee == null) t.fee = 0;
      } else if (t.type === 'expense' || t.type === 'income'){
        const acc = filled.accounts.find(a => a.id === t.accountId);
        if (!t.currency && acc) t.currency = acc.currency;
        if (t.walletAmount == null && isFiniteNumberLike(t.amount)){
          if (!acc || !t.currency || t.currency === acc.currency) t.walletAmount = Number(t.amount);
          else if (isFiniteNumberLike(t.fxRate) && Number(t.fxRate) > 0)
            t.walletAmount = Math.round(Number(t.amount) * Number(t.fxRate) * 100) / 100;
        }
        if (t.fxRate == null && acc && t.currency === acc.currency) t.fxRate = 1;
      } else if (t.type === 'adjustment'){
        const acc = filled.accounts.find(a => a.id === t.accountId);
        if (!t.currency && acc) t.currency = acc.currency;
        if (t.fxRate == null) t.fxRate = 1;
      }
      if (!Array.isArray(t.tags)) t.tags = [];
      if (!Number.isFinite(Number(t.created)) && isValidIsoDate(t.date)){
        const [yy,mm,dd] = t.date.split('-').map(Number);
        t.created = new Date(yy,mm-1,dd,12,0,0,0).getTime();
      }
      delete t.walletId; delete t.fromWalletId; delete t.toWalletId;
    });
    this.normalizeRepaymentFees(filled);
    this.repairPrepaidOwnedAccounts(filled);
    this.repairCreditArchiveConsistency(filled);
    filled.recurring.forEach(r => {
      if (!r || typeof r !== 'object') return;
      if (!r.accountId && r.walletId){ r.accountId = r.walletId; delete r.walletId; }
      const acc = filled.accounts.find(a => a.id === r.accountId);
      if (!r.currency && acc) r.currency = acc.currency;
      if (!r.type) r.type = 'expense';
      if (!r.frequency) r.frequency = 'monthly';
      if (r.day == null) r.day = 1;
      if (r.month == null) r.month = 0;
      if (r.reminderDays == null) r.reminderDays = 3;
      if (r.active == null) r.active = true;
    });
    delete filled.wallets;
    delete filled.settings.primaryWalletId;
    Object.keys(filled.settings.defaultAccountByCountry).forEach(k => {
      const id = filled.settings.defaultAccountByCountry[k];
      if (!id){ delete filled.settings.defaultAccountByCountry[k]; return; }
      const a = filled.accounts.find(x => x.id === id);
      if (!a || a.archived || !accountTypeInfo(a.type).asset || a.country !== k || a.ownedByInstrumentId){
        delete filled.settings.defaultAccountByCountry[k];
        const fb = filled.accounts.find(x => x.country === k && !x.archived && accountTypeInfo(x.type).asset && !x.ownedByInstrumentId);
        if (fb) filled.settings.defaultAccountByCountry[k] = fb.id;
      }
    });
    Object.keys(filled.settings.defaultInstrumentByCountry).forEach(k => {
      const id = filled.settings.defaultInstrumentByCountry[k];
      if (!id){ delete filled.settings.defaultInstrumentByCountry[k]; return; }
      const inst = filled.paymentInstruments.find(x => x.id === id);
      if (!inst || inst.archived){ delete filled.settings.defaultInstrumentByCountry[k]; return; }
      const acc = filled.accounts.find(x => x.id === inst.accountId);
      if (!acc || acc.archived || acc.country !== k){
        delete filled.settings.defaultInstrumentByCountry[k];
      }
    });
    /* V8.8.4.3 FIX 12: preserve valid primary; do NOT destructively overwrite from default */
    const existingPrimary = filled.settings.primaryAccountByCountry || {};
    const validPrimary = {};
    Object.keys(existingPrimary).forEach(c => {
      const id = existingPrimary[c];
      if (!id) return;
      const a = filled.accounts.find(x => x.id === id);
      if (a && !a.archived && accountTypeInfo(a.type).asset && a.country === c && !a.ownedByInstrumentId){
        validPrimary[c] = id;
      }
    });
    Object.keys(filled.settings.defaultAccountByCountry).forEach(c => {
      if (validPrimary[c]) return;
      const id = filled.settings.defaultAccountByCountry[c];
      if (!id) return;
      const a = filled.accounts.find(x => x.id === id);
      if (a && !a.archived && accountTypeInfo(a.type).asset && a.country === c && !a.ownedByInstrumentId){
        validPrimary[c] = id;
      } else {
        const fb = filled.accounts.find(x => x.country === c && !x.archived && accountTypeInfo(x.type).asset && !x.ownedByInstrumentId);
        if (fb) validPrimary[c] = fb.id;
      }
    });
    filled.settings.primaryAccountByCountry = validPrimary;
    filled.schemaVersion = SCHEMA_VERSION;
    return filled;
  },
  migrateV85(state){
    const out = {
      schemaVersion: SCHEMA_VERSION,
      institutions:[],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[],
      categories: state.categories || deepClone(DEFAULT_CATS),
      tags: Array.isArray(state.tags) ? state.tags : [],
      recurring: [],
      settings: Object.assign({
        theme:'light',onboarded:true,hideAmounts:false,notificationsEnabled:false,
        budgets:{},saving:{amount:0,currency:'EGP',saved:0,targetDate:null},
        warnPct:80,alertPct:100,lastFx:{},dismissedReminders:{},
        defaultCountry:'UAE',primaryAccountByCountry:{},lastExpenseSourceByCountry:{},
        categoryBudgets:{},overallSpendingLimits:{},budgetAlerts:{},
        defaultAccountByCountry:{}, defaultInstrumentByCountry:{}
      }, state.settings || {})
    };
    delete out.settings.primaryWalletId;
    if (!out.categories || typeof out.categories !== 'object') out.categories = deepClone(DEFAULT_CATS);
    if (!Array.isArray(out.categories.expense)) out.categories.expense = deepClone(DEFAULT_CATS.expense);
    if (!Array.isArray(out.categories.income)) out.categories.income = deepClone(DEFAULT_CATS.income);
    if (!out.settings.primaryAccountByCountry || typeof out.settings.primaryAccountByCountry !== 'object') out.settings.primaryAccountByCountry = {};
    if (!out.settings.defaultAccountByCountry || typeof out.settings.defaultAccountByCountry !== 'object') out.settings.defaultAccountByCountry = {};
    if (!out.settings.defaultInstrumentByCountry || typeof out.settings.defaultInstrumentByCountry !== 'object') out.settings.defaultInstrumentByCountry = {};
    if (!out.settings.lastExpenseSourceByCountry || typeof out.settings.lastExpenseSourceByCountry !== 'object') out.settings.lastExpenseSourceByCountry = {};
    if (!out.settings.categoryBudgets || typeof out.settings.categoryBudgets !== 'object') out.settings.categoryBudgets = {};
    if (!out.settings.overallSpendingLimits || typeof out.settings.overallSpendingLimits !== 'object') out.settings.overallSpendingLimits = {};
    if (!out.settings.budgetAlerts || typeof out.settings.budgetAlerts !== 'object') out.settings.budgetAlerts = {};
    if (!out.settings.lastFx || typeof out.settings.lastFx !== 'object') out.settings.lastFx = {};
    if (!out.settings.dismissedReminders || typeof out.settings.dismissedReminders !== 'object') out.settings.dismissedReminders = {};
    if (!out.settings.saving || typeof out.settings.saving !== 'object') out.settings.saving = {amount:0,currency:'EGP',saved:0,targetDate:null};

    const institutionIndex = {};
    function ensureInstitution(name,country,type){
      const key = (name||'unknown').toLowerCase()+'|'+(country||'OTHER')+'|'+(type||'bank');
      if (institutionIndex[key]) return institutionIndex[key];
      const id = 'inst_'+Math.random().toString(36).slice(2,10);
      out.institutions.push({id,name:name||'Other',country:country||'OTHER',type:type||'bank'});
      institutionIndex[key] = id;
      return id;
    }
    const oldWallets = Array.isArray(state.wallets) ? state.wallets : [];
    const walletIdToAccountId = {};
    oldWallets.forEach(w => {
      if (!w || !w.id) return;
      const country = w.country || 'OTHER';
      const currency = w.currency || 'EGP';
      const wtype = w.type || 'cash';
      const nameStr = w.name || 'Account';
      if (wtype === 'credit'){
        const accId = w.id;
        const instId = ensureInstitution(nameStr,country,'bank');
        out.accounts.push({id:accId,institutionId:instId,country,name:nameStr,type:'credit',currency,
          openingBalance:0,openingDebt:Number(w.openingDebt)||0,creditLimit:Number(w.creditLimit)||0,
          defaultRepaymentAccountId:null,icon:w.i||'💠',color:w.c||'#6A1B9A',
          archived:!!w.archived,created:w.openingDate||isoToday()});
        const piId = 'pi_'+Math.random().toString(36).slice(2,10);
        out.paymentInstruments.push({id:piId,accountId:accId,institutionId:instId,
          name:nameStr+' Credit',type:'credit_card',last4:null,country,
          icon:w.i||'💠',color:w.c||'#6A1B9A',archived:!!w.archived,created:isoToday()});
        walletIdToAccountId[w.id] = accId;
      } else if (wtype === 'debit'){
        const accId = w.id;
        const instId = ensureInstitution(nameStr,country,'bank');
        out.accounts.push({id:accId,institutionId:instId,country,name:nameStr,type:'bank',currency,
          openingBalance:Number(w.openingBalance)||0,openingDebt:0,creditLimit:0,
          defaultRepaymentAccountId:null,icon:w.i||'🏦',color:w.c||'#00695C',
          archived:!!w.archived,created:w.openingDate||isoToday()});
        const piId = 'pi_'+Math.random().toString(36).slice(2,10);
        out.paymentInstruments.push({id:piId,accountId:accId,institutionId:instId,
          name:nameStr+' Debit',type:'debit_card',last4:null,country,
          icon:w.i||'💳',color:w.c||'#00695C',archived:!!w.archived,created:isoToday()});
        walletIdToAccountId[w.id] = accId;
      } else if (wtype === 'debt'){
        const accId = w.id;
        const instId = ensureInstitution(nameStr,country,'other');
        out.accounts.push({id:accId,institutionId:instId,country,name:nameStr,type:'debt',currency,
          openingBalance:0,openingDebt:Number(w.openingDebt)||0,creditLimit:0,
          defaultRepaymentAccountId:null,icon:w.i||'📋',color:w.c||'#AD1457',
          archived:!!w.archived,creditor:w.creditor||'',dueDate:w.dueDate||null,created:w.openingDate||isoToday()});
        walletIdToAccountId[w.id] = accId;
      } else {
        const accId = w.id;
        let type = 'bank';
        if (wtype === 'cash') type = 'cash';
        else if (wtype === 'ewallet') type = 'ewallet';
        else if (wtype === 'other') type = 'other';
        const instId = ensureInstitution(nameStr,country,type === 'ewallet' ? 'wallet_provider' : 'bank');
        out.accounts.push({id:accId,institutionId:instId,country,name:nameStr,type,currency,
          openingBalance:Number(w.openingBalance)||0,openingDebt:0,creditLimit:0,
          defaultRepaymentAccountId:null,icon:w.i||'🏦',color:w.c||'#00695C',
          archived:!!w.archived,created:w.openingDate||isoToday()});
        walletIdToAccountId[w.id] = accId;
      }
    });
    (state.transactions||[]).forEach(t => {
      if (!t) return;
      const nt = deepClone(t);
      if (t.type === 'transfer'){
        nt.fromAccountId = walletIdToAccountId[t.fromWalletId] || t.fromWalletId;
        nt.toAccountId = walletIdToAccountId[t.toWalletId] || t.toWalletId;
        delete nt.fromWalletId; delete nt.toWalletId;
        const fa = out.accounts.find(a => a.id === nt.fromAccountId);
        const ta = out.accounts.find(a => a.id === nt.toAccountId);
        nt.fromCountry = fa ? fa.country : 'OTHER';
        nt.toCountry = ta ? ta.country : 'OTHER';
      } else if (t.type === 'adjustment'){
        nt.accountId = walletIdToAccountId[t.walletId] || t.walletId;
        delete nt.walletId;
      } else {
        nt.accountId = walletIdToAccountId[t.walletId] || t.walletId;
        nt.instrumentId = null;
        delete nt.walletId;
      }
      out.transactions.push(nt);
    });
    (state.recurring||[]).forEach(r => {
      if (!r) return;
      const nr = deepClone(r);
      nr.accountId = walletIdToAccountId[r.walletId] || r.walletId || r.accountId;
      nr.instrumentId = null;
      delete nr.walletId;
      const acc = out.accounts.find(a => a.id === nr.accountId);
      if (!nr.currency && acc) nr.currency = acc.currency;
      if (!nr.type) nr.type = 'expense';
      if (!nr.frequency) nr.frequency = 'monthly';
      if (nr.day == null) nr.day = 1;
      if (nr.month == null) nr.month = 0;
      if (nr.reminderDays == null) nr.reminderDays = 3;
      if (nr.active == null) nr.active = true;
      out.recurring.push(nr);
    });
    const oldPrimary = state.settings && state.settings.primaryWalletId;
    if (oldPrimary){
      const newAccId = walletIdToAccountId[oldPrimary];
      const newAcc = out.accounts.find(a => a.id === newAccId);
      if (newAcc && isAssetAccount(newAcc)){
        out.settings.primaryAccountByCountry[newAcc.country] = newAcc.id;
        out.settings.defaultAccountByCountry[newAcc.country] = newAcc.id;
      } else if (newAcc){
        const fallback = out.accounts.find(a => a.country === newAcc.country && isAssetAccount(a) && !a.ownedByInstrumentId);
        if (fallback){
          out.settings.primaryAccountByCountry[newAcc.country] = fallback.id;
          out.settings.defaultAccountByCountry[newAcc.country] = fallback.id;
        }
      }
    }
    out.accounts.forEach(a => {
      if (isAssetAccount(a) && !out.settings.primaryAccountByCountry[a.country]){
        out.settings.primaryAccountByCountry[a.country] = a.id;
      }
      if (isAssetAccount(a) && !out.settings.defaultAccountByCountry[a.country] && !a.ownedByInstrumentId){
        out.settings.defaultAccountByCountry[a.country] = a.id;
      }
    });
    for (const cat of [
      {id:'transferFee',n:'رسوم تحويل',i:'🏦',c:'#E65100'},
      {id:'externalTransfer',n:'تحويل لشخص',i:'👤',c:'#D32F2F'},
      {id:'debtInterest',n:'فوائد / رسوم دين',i:'📈',c:'#C62828'}
    ]){
      if (!out.categories.expense.some(c => c.id === cat.id)) out.categories.expense.push(cat);
    }
    if (!out.categories.income.some(c => c.id === 'rent')){
      out.categories.income.push({id:'rent',n:'إيجار مستلم',i:'🏠',c:'#0EA5E9'});
    }
    out.transactions.forEach(t => {
      if (!t || typeof t !== 'object') return;
      if (t.type === 'expense' || t.type === 'income'){
        const acc = out.accounts.find(a => a.id === t.accountId);
        if (!t.currency && acc) t.currency = acc.currency;
        if (t.walletAmount == null && isFiniteNumberLike(t.amount)){
          if (!acc || !t.currency || t.currency === acc.currency) t.walletAmount = Number(t.amount);
          else if (isFiniteNumberLike(t.fxRate) && Number(t.fxRate) > 0) t.walletAmount = Math.round(Number(t.amount) * Number(t.fxRate) * 100) / 100;
        }
        if (t.fxRate == null && acc && t.currency === acc.currency) t.fxRate = 1;
      } else if (t.type === 'transfer'){
        const fa = out.accounts.find(a => a.id === t.fromAccountId);
        const ta = out.accounts.find(a => a.id === t.toAccountId);
        if (fa){ if (!t.fromCurrency) t.fromCurrency = fa.currency; if (!t.fromCountry) t.fromCountry = fa.country; }
        if (ta){ if (!t.toCurrency) t.toCurrency = ta.currency; if (!t.toCountry) t.toCountry = ta.country; }
        if (t.fxRate == null && isFiniteNumberLike(t.fromAmount) && Number(t.fromAmount) > 0 && isFiniteNumberLike(t.toAmount)) t.fxRate = Math.round((Number(t.toAmount)/Number(t.fromAmount))*1000000)/1000000;
        if (t.fee == null) t.fee = 0;
      } else if (t.type === 'adjustment'){
        const acc = out.accounts.find(a => a.id === t.accountId);
        if (!t.currency && acc) t.currency = acc.currency;
        if (t.fxRate == null) t.fxRate = 1;
      }
      if (!Array.isArray(t.tags)) t.tags = [];
      if (!Number.isFinite(Number(t.created)) && isValidIsoDate(t.date)){
        const [yy,mm,dd] = t.date.split('-').map(Number);
        t.created = new Date(yy,mm-1,dd,12,0,0,0).getTime();
      }
    });
    this.normalizeRepaymentFees(out);
    this.repairPrepaidOwnedAccounts(out);
    return out;
  },
  validateForImport(state){
    const errors = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return ['الملف ليس كائن JSON صالح'];
    if (Array.isArray(state.wallets) && !Array.isArray(state.accounts)) return [];
    const accounts = Array.isArray(state.accounts) ? state.accounts : null;
    const txs = Array.isArray(state.transactions) ? state.transactions : null;
    const insts = Array.isArray(state.paymentInstruments) ? state.paymentInstruments : [];
    const institutions = Array.isArray(state.institutions) ? state.institutions : [];
    const recurring = Array.isArray(state.recurring) ? state.recurring : [];
    const beneficiaries = Array.isArray(state.beneficiaries) ? state.beneficiaries : [];
    if (!accounts) errors.push('accounts ليست مصفوفة');
    if (!txs) errors.push('transactions ليست مصفوفة');
    if (errors.length) return errors;
    const accIds = new Set();
    const instIds = new Set();
    const txIds = new Set();
    const beneIds = new Set();
    const institutionIds = new Set();
    const countries = new Set(Object.keys(COUNTRIES));
    const currencies = new Set(Object.keys(CURRENCIES));
    for (const i of institutions){
      if (!i || typeof i !== 'object' || !i.id){ errors.push('مؤسسة بدون id'); break; }
      if (institutionIds.has(i.id)){ errors.push('معرّف مؤسسة مكرر'); break; }
      institutionIds.add(i.id);
    }
    for (const a of accounts){
      if (!a || typeof a !== 'object' || !a.id){ errors.push('حساب بدون id'); break; }
      if (accIds.has(a.id)){ errors.push('معرّف حساب مكرر: ' + a.id); break; }
      accIds.add(a.id);
      if (a.country && !countries.has(a.country)) errors.push('بلد غير صالح: ' + a.country);
      if (a.currency && !currencies.has(a.currency)) errors.push('عملة غير صالحة: ' + a.currency);
      if (a.openingBalance != null && !isFiniteNumberLike(a.openingBalance)) errors.push('رصيد افتتاحي غير صالح');
      if (a.type === 'prepaid' && Number(a.openingBalance || 0) < -0.01) errors.push('رصيد افتتاحي سالب لحساب prepaid: ' + a.id);
      if (a.openingDebt != null && (!isFinite(a.openingDebt) || a.openingDebt < 0)) errors.push('دين افتتاحي غير صالح');
      if (a.creditLimit != null && (!isFinite(a.creditLimit) || a.creditLimit < 0)) errors.push('حد ائتمان غير صالح');
      if (a.institutionId){
        const inst = institutions.find(x => x.id === a.institutionId);
        if (!inst) errors.push('مؤسسة غير موجودة للحساب ' + a.id);
        else if (a.country && inst.country !== a.country) errors.push('مؤسسة من بلد مختلف للحساب ' + a.id);
      }
    }
    for (const i of insts){
      if (!i || typeof i !== 'object' || !i.id){ errors.push('بطاقة بدون id'); break; }
      if (instIds.has(i.id)){ errors.push('معرّف بطاقة مكرر: ' + i.id); break; }
      instIds.add(i.id);
      if (!i.accountId || !accIds.has(i.accountId)) errors.push('بطاقة مرتبطة بحساب غير موجود: ' + i.id);
      if (i.institutionId){
        const inst = institutions.find(x => x.id === i.institutionId);
        if (!inst) errors.push('مؤسسة غير موجودة للبطاقة ' + i.id);
      }
      if (i.type && !INSTRUMENT_TYPES.some(t => t.id === i.type)) errors.push('نوع بطاقة غير معروف: ' + i.type);
      const linkedAcc = accounts.find(a => a.id === i.accountId);
      if (linkedAcc){
        if (i.type === 'debit_card' && linkedAcc.type !== 'bank')
          errors.push('بطاقة ديبت مرتبطة بحساب غير بنكي: ' + i.id);
        if (i.type === 'credit_card' && linkedAcc.type !== 'credit')
          errors.push('بطاقة ائتمان مرتبطة بحساب غير credit: ' + i.id);
        if (i.type === 'prepaid_card' && linkedAcc.type !== 'prepaid')
          errors.push('بطاقة مدفوعة مرتبطة بحساب غير prepaid: ' + i.id);
        if (i.country && linkedAcc.country && i.country !== linkedAcc.country)
          errors.push('بلد البطاقة لا يطابق بلد الحساب: ' + i.id);
      }
      if (i.institutionId){
        const inst = institutions.find(x => x.id === i.institutionId);
        if (!inst) errors.push('مؤسسة غير موجودة للبطاقة ' + i.id);
        else if (i.country && inst.country !== i.country)
          errors.push('مؤسسة من بلد مختلف للبطاقة ' + i.id);
      }
    }
    for (const b of beneficiaries){
      if (!b || typeof b !== 'object' || !b.id){ errors.push('مستفيد بدون id'); break; }
      if (beneIds.has(b.id)){ errors.push('معرّف مستفيد مكرر'); break; }
      beneIds.add(b.id);
    }
    for (const t of txs){
      if (!t || typeof t !== 'object' || !t.id){ errors.push('معاملة بدون id'); break; }
      if (txIds.has(t.id)){ errors.push('معرّف معاملة مكرر: ' + t.id); break; }
      txIds.add(t.id);
      if (t.type && SUPPORTED_TX_TYPES.indexOf(t.type) === -1) errors.push('نوع معاملة غير معروف: ' + t.type);
      if (t.currency && !currencies.has(t.currency)) errors.push('عملة غير صالحة للمعاملة');
      if (t.type === 'expense' || t.type === 'income'){
        if (!t.accountId || !accIds.has(t.accountId)) errors.push('معاملة بحساب غير موجود: ' + t.id);
      }
      if (t.type === 'transfer'){
        if (!t.fromAccountId || !accIds.has(t.fromAccountId)) errors.push('تحويل من حساب غير موجود: ' + t.id);
        if (!t.toAccountId || !accIds.has(t.toAccountId)) errors.push('تحويل إلى حساب غير موجود: ' + t.id);
        if (t.fromAccountId === t.toAccountId) errors.push('تحويل من حساب إلى نفسه');
      }
      if (t.type === 'external_transfer'){
        if (!t.fromAccountId || !accIds.has(t.fromAccountId)) errors.push('تحويل خارجي بحساب غير موجود: ' + t.id);
        if (t.beneficiaryId && !beneIds.has(t.beneficiaryId)) errors.push('مستفيد غير موجود: ' + t.beneficiaryId);
      }
      if (t.type === 'adjustment'){
        if (!t.accountId || !accIds.has(t.accountId)) errors.push('تسوية بحساب غير موجود: ' + t.id);
      }
      if (t.date != null && !isValidIsoDate(t.date)) errors.push('تاريخ معاملة غير صالح: ' + t.id);
      if (t.amount != null && (!isFiniteNumberLike(t.amount) || Number(t.amount) < 0)) errors.push('مبلغ غير صالح: ' + t.id);
      if (t.walletAmount != null && (!isFiniteNumberLike(t.walletAmount) || ((t.type === 'expense' || t.type === 'income') && Number(t.walletAmount) <= 0))) errors.push('مبلغ الحساب غير صالح: ' + t.id);
      if (t.fromAmount != null && (!isFiniteNumberLike(t.fromAmount) || Number(t.fromAmount) < 0)) errors.push('مبلغ مرسل غير صالح: ' + t.id);
      if (t.toAmount != null && (!isFiniteNumberLike(t.toAmount) || Number(t.toAmount) < 0)) errors.push('مبلغ واصل غير صالح: ' + t.id);
      if (t.receivedAmount != null && (!isFiniteNumberLike(t.receivedAmount) || Number(t.receivedAmount) < 0)) errors.push('مبلغ مستلم غير صالح: ' + t.id);
      if (t.fee != null && (!isFiniteNumberLike(t.fee) || Number(t.fee) < 0)) errors.push('رسوم غير صالحة: ' + t.id);
      if (t.fxRate != null && (!isFiniteNumberLike(t.fxRate) || Number(t.fxRate) <= 0)) errors.push('سعر صرف غير صالح: ' + t.id);
    }
    for (const r of recurring){
      if (!r || typeof r !== 'object' || !r.id){ errors.push('التزام بدون id'); break; }
      if (!r.accountId || !accIds.has(r.accountId)) errors.push('التزام بحساب غير موجود: ' + r.id);
      if (r.instrumentId && !instIds.has(r.instrumentId)) errors.push('التزام ببطاقة غير موجودة: ' + r.id);
      if (!isFiniteNumberLike(r.amount) || Number(r.amount) <= 0) errors.push('مبلغ التزام غير صالح: ' + r.id);
      if (r.currency && !currencies.has(r.currency)) errors.push('عملة التزام غير صالحة: ' + r.id);
      if (r.type && r.type !== 'expense' && r.type !== 'income') errors.push('نوع التزام غير صالح: ' + r.id);
      if (r.frequency && !['monthly','yearly'].includes(r.frequency)) errors.push('تكرار غير صالح: ' + r.id);
      if (r.day != null && (!Number.isInteger(Number(r.day)) || Number(r.day) < 1 || Number(r.day) > 28)) errors.push('يوم التزام غير صالح: ' + r.id);
      if (r.frequency === 'yearly' && (r.month == null || !Number.isInteger(Number(r.month)) || Number(r.month) < 0 || Number(r.month) > 11)) errors.push('شهر التزام غير صالح: ' + r.id);
      if (r.reminderDays != null && (!isFiniteNumberLike(r.reminderDays) || Number(r.reminderDays) < 0 || Number(r.reminderDays) > 30)) errors.push('تذكير التزام غير صالح: ' + r.id);
    }
    if (state.settings && state.settings.primaryAccountByCountry){
      for (const [c, id] of Object.entries(state.settings.primaryAccountByCountry)){
        if (id && !accIds.has(id)) errors.push('حساب أساسي غير موجود: ' + c);
      }
    }
    if (state.settings && state.settings.defaultAccountByCountry){
      for (const [c, id] of Object.entries(state.settings.defaultAccountByCountry)){
        if (id && !accIds.has(id)) errors.push('حساب افتراضي غير موجود: ' + c);
      }
    }
    if (state.settings && state.settings.defaultInstrumentByCountry){
      for (const [c, id] of Object.entries(state.settings.defaultInstrumentByCountry)){
        if (id && !instIds.has(id)) errors.push('بطاقة افتراضية غير موجودة: ' + c);
      }
    }
    if (state.settings && state.settings.defaultAccountByCountry){
      for (const [c, id] of Object.entries(state.settings.defaultAccountByCountry)){
        if (!id) continue;
        const a = accounts.find(x => x.id === id);
        if (!a) errors.push('حساب افتراضي غير موجود: ' + c);
        else if (a.country !== c) errors.push('حساب افتراضي من بلد مختلف: ' + c);
      }
    }
    if (state.settings && state.settings.defaultInstrumentByCountry){
      for (const [c, id] of Object.entries(state.settings.defaultInstrumentByCountry)){
        if (!id) continue;
        const i = insts.find(x => x.id === id);
        if (!i) errors.push('بطاقة افتراضية غير موجودة: ' + c);
        else if (i.country !== c) errors.push('بطاقة افتراضية من بلد مختلف: ' + c);
      }
    }
    return errors.slice(0, 8);
  },
  /* V8.8.4.12: strict post-migration validator. It validates the exact canonical
     state that is about to be loaded or persisted. Never silently repairs money. */
  validateStateStrict(state){
    const errors = [];
    const push = msg => { if (errors.length < 30) errors.push(msg); };
    if (!state || typeof state !== 'object' || Array.isArray(state)) return ['الحالة المالية ليست كائنًا صالحًا'];
    const requiredArrays = ['institutions','accounts','paymentInstruments','transactions','beneficiaries','tags','recurring'];
    requiredArrays.forEach(k => { if (!Array.isArray(state[k])) push(k + ' ليست مصفوفة'); });
    if (errors.length) return errors;
    if (!state.categories || typeof state.categories !== 'object' || !Array.isArray(state.categories.expense) || !Array.isArray(state.categories.income)) push('فئات المعاملات غير صالحة');
    if (!state.settings || typeof state.settings !== 'object' || Array.isArray(state.settings)) push('الإعدادات غير صالحة');

    if(state.settings){
      if(state.settings.bankSmsStartAt!=null&&(!Number.isSafeInteger(state.settings.bankSmsStartAt)||state.settings.bankSmsStartAt<=0))push('بداية سحب الرسائل غير صالحة');
      const decisions=state.settings.bankEventDecisions;
      if(decisions!=null){
        if(typeof decisions!=='object'||Array.isArray(decisions)||Object.keys(decisions).length>50000)push('سجل قرارات الرسائل غير صالح');
        else for(const [id,row] of Object.entries(decisions)){
          if(!id||id.length>240||['__proto__','constructor','prototype'].includes(id)||!row||!['saved','observed','ignored','duplicate','dismissed'].includes(row.action)||!Number.isSafeInteger(row.at)||row.at<=0||(row.transactionId!=null&&typeof row.transactionId!=='string')){push('قرار رسالة غير صالح');break;}
        }
      }
    }

    const countries = new Set(Object.keys(COUNTRIES));
    const currencies = new Set(Object.keys(CURRENCIES));
    const accountTypes = new Set(ACCOUNT_TYPES.map(x => x.id));
    const instrumentTypes = new Set(INSTRUMENT_TYPES.map(x => x.id));
    const accById = new Map(), instById = new Map(), institutionById = new Map(), beneById = new Map();
    const seen = (map, id, label) => {
      if (!id || typeof id !== 'string'){ push(label + ' بدون id صالح'); return false; }
      if (map.has(id)){ push('معرّف ' + label + ' مكرر: ' + id); return false; }
      return true;
    };

    for (const x of state.institutions){
      if (!x || typeof x !== 'object'){ push('مؤسسة غير صالحة'); continue; }
      if (!seen(institutionById, x.id, 'مؤسسة')) continue;
      institutionById.set(x.id, x);
      if (x.country && !countries.has(x.country)) push('بلد مؤسسة غير صالح: ' + x.id);
    }
    for (const a of state.accounts){
      if (!a || typeof a !== 'object'){ push('حساب غير صالح'); continue; }
      if (!seen(accById, a.id, 'حساب')) continue;
      accById.set(a.id, a);
      if (!accountTypes.has(a.type)) push('نوع حساب غير صالح: ' + a.id);
      if (!countries.has(a.country)) push('بلد حساب غير صالح: ' + a.id);
      if (!currencies.has(a.currency)) push('عملة حساب غير صالحة: ' + a.id);
      if (!isFiniteNumberLike(a.openingBalance)) push('رصيد افتتاحي غير صالح: ' + a.id);
      if(a.bankBalanceBaseline!=null){
        const b=a.bankBalanceBaseline;
        if(typeof b!=='object'||Array.isArray(b)||!isFiniteNumberLike(b.at)||Number(b.at)<=0||!isFiniteNumberLike(b.balance)||(b.phase!=null&&!['before','after'].includes(b.phase)))push('نقطة رصيد البنك غير صالحة: '+a.id);
      }
      if (!isFiniteNumberLike(a.openingDebt) || Number(a.openingDebt) < 0) push('دين افتتاحي غير صالح: ' + a.id);
      if (!isFiniteNumberLike(a.creditLimit) || Number(a.creditLimit) < 0) push('حد ائتمان غير صالح: ' + a.id);
      if (a.type === 'prepaid' && Number(a.openingBalance) < -0.01) push('رصيد prepaid افتتاحي سالب: ' + a.id);
      if (a.institutionId){
        const ins = institutionById.get(a.institutionId);
        if (!ins) push('مؤسسة الحساب غير موجودة: ' + a.id);
        else if (ins.country && a.country && ins.country !== a.country) push('مؤسسة الحساب من بلد مختلف: ' + a.id);
      }
    }
    for (const i of state.paymentInstruments){
      if (!i || typeof i !== 'object'){ push('بطاقة غير صالحة'); continue; }
      if (!seen(instById, i.id, 'بطاقة')) continue;
      instById.set(i.id, i);
      if (!instrumentTypes.has(i.type)) push('نوع بطاقة غير صالح: ' + i.id);
      const a = accById.get(i.accountId);
      if (!a){ push('حساب البطاقة غير موجود: ' + i.id); continue; }
      if (i.type === 'debit_card' && a.type !== 'bank') push('بطاقة debit مرتبطة بحساب غير بنكي: ' + i.id);
      if (i.type === 'credit_card' && a.type !== 'credit') push('بطاقة credit مرتبطة بحساب غير credit: ' + i.id);
      if (i.type === 'prepaid_card' && a.type !== 'prepaid') push('بطاقة prepaid مرتبطة بحساب غير prepaid: ' + i.id);
      if (i.type === 'wallet_card' && a.type !== 'ewallet') push('بطاقة wallet مرتبطة بحساب غير ewallet: ' + i.id);
      if (i.country && i.country !== a.country) push('بلد البطاقة لا يطابق الحساب: ' + i.id);
      if (i.institutionId){
        const ins = institutionById.get(i.institutionId);
        if (!ins) push('مؤسسة البطاقة غير موجودة: ' + i.id);
        else if (i.country && ins.country && i.country !== ins.country) push('مؤسسة البطاقة من بلد مختلف: ' + i.id);
      }
    }
    for (const a of state.accounts){
      if (!a || !a.ownedByInstrumentId) continue;
      const i = instById.get(a.ownedByInstrumentId);
      if (!i || i.type !== 'prepaid_card' || i.accountId !== a.id || a.type !== 'prepaid') push('ربط prepaid غير متسق: ' + a.id);
    }
    for (const b of state.beneficiaries){
      if (!b || typeof b !== 'object'){ push('مستفيد غير صالح'); continue; }
      if (!seen(beneById, b.id, 'مستفيد')) continue;
      beneById.set(b.id, b);
      if (b.country && !countries.has(b.country)) push('بلد مستفيد غير صالح: ' + b.id);
      if (b.defaultCurrency && !currencies.has(b.defaultCurrency)) push('عملة مستفيد غير صالحة: ' + b.id);
    }

    const txIds = new Set();
    const pos = (v, label) => { if (!isFiniteNumberLike(v) || Number(v) <= 0) push(label); };
    const nonneg = (v, label) => { if (!isFiniteNumberLike(v) || Number(v) < 0) push(label); };
    for (const t of state.transactions){
      if (!t || typeof t !== 'object'){ push('معاملة غير صالحة'); continue; }
      if (!t.id || typeof t.id !== 'string'){ push('معاملة بدون id صالح'); continue; }
      if (txIds.has(t.id)){ push('معرّف معاملة مكرر: ' + t.id); continue; }
      txIds.add(t.id);
      if (!SUPPORTED_TX_TYPES.includes(t.type)){ push('نوع معاملة غير صالح: ' + t.id); continue; }
      if (!isValidIsoDate(t.date)) push('تاريخ معاملة غير صالح: ' + t.id);
      if (t.created != null && !isFiniteNumberLike(t.created)) push('وقت إنشاء معاملة غير صالح: ' + t.id);
      if(t.transactionTime!=null&&t.transactionTime!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.transactionTime))push('وقت معاملة غير صالح: '+t.id);
      if(t.bankPostingTimes!=null){
        if(t.type!=='transfer'||!isFiniteNumberLike(t.bankPostingTimes.from)||Number(t.bankPostingTimes.from)<=0||!isFiniteNumberLike(t.bankPostingTimes.to)||Number(t.bankPostingTimes.to)<=0)push('توقيت طرفي التحويل غير صالح: '+t.id);
      }
      if (t.type === 'expense' || t.type === 'income'){
        const a = accById.get(t.accountId);
        if (!a) push('حساب المعاملة غير موجود: ' + t.id);
        pos(t.amount, 'مبلغ المعاملة غير صالح: ' + t.id);
        pos(t.walletAmount, 'مبلغ الحساب غير صالح: ' + t.id);
        if (!currencies.has(t.currency)) push('عملة المعاملة غير صالحة: ' + t.id);
        if (a && t.currency === a.currency && Math.abs(Number(t.walletAmount) - Number(t.amount)) > 0.011) push('مبلغ الحساب لا يطابق المعاملة بنفس العملة: ' + t.id);
        pos(t.fxRate, 'سعر صرف المعاملة غير صالح: ' + t.id);
        if (t.instrumentId){
          const i = instById.get(t.instrumentId);
          if (!i) push('بطاقة المعاملة غير موجودة: ' + t.id);
          else if (i.accountId !== t.accountId) push('بطاقة المعاملة لا تطابق الحساب: ' + t.id);
        }
      } else if (t.type === 'adjustment'){
        const a = accById.get(t.accountId);
        if (!a) push('حساب التسوية غير موجود: ' + t.id);
        if (!isFiniteNumberLike(t.walletAmount) || Math.abs(Number(t.walletAmount)) < 0.000001) push('قيمة التسوية غير صالحة: ' + t.id);
        if (t.currency && !currencies.has(t.currency)) push('عملة التسوية غير صالحة: ' + t.id);
        if (a && t.currency && t.currency !== a.currency) push('عملة التسوية لا تطابق الحساب: ' + t.id);
      } else if (t.type === 'transfer'){
        const fa = accById.get(t.fromAccountId), ta = accById.get(t.toAccountId);
        if (!fa) push('حساب مصدر التحويل غير موجود: ' + t.id);
        if (!ta) push('حساب وجهة التحويل غير موجود: ' + t.id);
        if (t.fromAccountId === t.toAccountId) push('تحويل إلى نفس الحساب: ' + t.id);
        pos(t.fromAmount, 'مبلغ التحويل المرسل غير صالح: ' + t.id);
        pos(t.toAmount, 'مبلغ التحويل الواصل غير صالح: ' + t.id);
        pos(t.fxRate, 'سعر صرف التحويل غير صالح: ' + t.id);
        nonneg(t.fee == null ? 0 : t.fee, 'رسوم التحويل غير صالحة: ' + t.id);
        if (fa && t.fromCurrency && t.fromCurrency !== fa.currency) push('عملة مصدر التحويل لا تطابق الحساب: ' + t.id);
        if (ta && t.toCurrency && t.toCurrency !== ta.currency) push('عملة وجهة التحويل لا تطابق الحساب: ' + t.id);
      } else if (t.type === 'external_transfer'){
        const fa = accById.get(t.fromAccountId);
        if (!fa) push('حساب التحويل الخارجي غير موجود: ' + t.id);
        if (t.beneficiaryId && !beneById.has(t.beneficiaryId)) push('مستفيد التحويل غير موجود: ' + t.id);
        pos(t.fromAmount, 'مبلغ التحويل الخارجي غير صالح: ' + t.id);
        pos(t.receivedAmount, 'المبلغ المستلم في التحويل الخارجي غير صالح: ' + t.id);
        pos(t.fxRate, 'سعر صرف التحويل الخارجي غير صالح: ' + t.id);
        nonneg(t.fee == null ? 0 : t.fee, 'رسوم التحويل الخارجي غير صالحة: ' + t.id);
        if (!currencies.has(t.receivedCurrency)) push('عملة التحويل الخارجي المستلمة غير صالحة: ' + t.id);
        if (fa && t.fromCurrency && t.fromCurrency !== fa.currency) push('عملة التحويل الخارجي لا تطابق الحساب: ' + t.id);
      }
    }

    const recIds = new Set();
    for (const r of state.recurring){
      if (!r || typeof r !== 'object' || !r.id){ push('التزام غير صالح'); continue; }
      if (recIds.has(r.id)){ push('معرّف التزام مكرر: ' + r.id); continue; }
      recIds.add(r.id);
      const a = accById.get(r.accountId);
      if (!a) push('حساب الالتزام غير موجود: ' + r.id);
      pos(r.amount, 'مبلغ الالتزام غير صالح: ' + r.id);
      if (!currencies.has(r.currency)) push('عملة الالتزام غير صالحة: ' + r.id);
      if (r.type !== 'expense' && r.type !== 'income') push('نوع الالتزام غير صالح: ' + r.id);
      if (r.frequency !== 'monthly' && r.frequency !== 'yearly') push('تكرار الالتزام غير صالح: ' + r.id);
      if (!Number.isInteger(Number(r.day)) || Number(r.day) < 1 || Number(r.day) > 28) push('يوم الالتزام غير صالح: ' + r.id);
      if (r.frequency === 'yearly' && (!Number.isInteger(Number(r.month)) || Number(r.month) < 0 || Number(r.month) > 11)) push('شهر الالتزام غير صالح: ' + r.id);
      if (!isFiniteNumberLike(r.reminderDays) || Number(r.reminderDays) < 0 || Number(r.reminderDays) > 30) push('مدة تذكير غير صالحة: ' + r.id);
      if (r.instrumentId){
        const i = instById.get(r.instrumentId);
        if (!i) push('بطاقة الالتزام غير موجودة: ' + r.id);
        else if (i.accountId !== r.accountId) push('بطاقة الالتزام لا تطابق الحساب: ' + r.id);
      }
    }

    const st = state.settings || {};
    const saving = st.saving;
    if (saving && typeof saving === 'object'){
      nonneg(saving.amount == null ? 0 : saving.amount, 'هدف الادخار غير صالح');
      nonneg(saving.saved == null ? 0 : saving.saved, 'المدخر الحالي غير صالح');
      if (saving.currency && !currencies.has(saving.currency)) push('عملة الادخار غير صالحة');
      if (saving.targetDate && !isValidIsoDate(saving.targetDate)) push('تاريخ هدف الادخار غير صالح');
    }
    if (st.lastFx && typeof st.lastFx === 'object'){
      Object.entries(st.lastFx).forEach(([k,v]) => { if (!isFiniteNumberLike(v) || Number(v) <= 0) push('سعر صرف محفوظ غير صالح: ' + k); });
    }
    const validateAccountMap = (m,label,assetOnly) => {
      if (!m || typeof m !== 'object') return;
      Object.entries(m).forEach(([country,id]) => {
        if (!countries.has(country)) push(label + ' لبلد غير صالح: ' + country);
        if (!id) return;
        const a = accById.get(id);
        if (!a) push(label + ' غير موجود: ' + country);
        else if (a.country !== country) push(label + ' من بلد مختلف: ' + country);
        else if (assetOnly && !accountTypeInfo(a.type).asset) push(label + ' ليس حساب أصول: ' + country);
      });
    };
    validateAccountMap(st.primaryAccountByCountry, 'الحساب الأساسي', true);
    validateAccountMap(st.defaultAccountByCountry, 'الحساب الافتراضي', true);
    if (st.defaultInstrumentByCountry && typeof st.defaultInstrumentByCountry === 'object'){
      Object.entries(st.defaultInstrumentByCountry).forEach(([country,id]) => {
        if (!id) return;
        const i = instById.get(id);
        if (!i) push('البطاقة الافتراضية غير موجودة: ' + country);
        else {
          const a = accById.get(i.accountId);
          if (!a || a.country !== country) push('البطاقة الافتراضية من بلد مختلف: ' + country);
        }
      });
    }

    /* Financial invariant: stored-value accounts may never be negative in a
       canonical state. Credit/debt liabilities may be negative internally by design. */
    for (const a of state.accounts){
      if (!a || a.type !== 'prepaid') continue;
      const bal = this._schemaAccountBalance(state, a.id);
      if (bal < -0.01) push('رصيد prepaid سالب: ' + a.id);
    }
    return errors;
  }
    };
  }

  return Object.freeze({createSchema});
});
