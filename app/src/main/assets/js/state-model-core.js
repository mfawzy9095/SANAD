(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadStateModelCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function fallbackClone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

  function createStateModel(options){
    const opts=options||{};
    const schemaVersion=Number(opts.schemaVersion)||1;
    const defaultCats=opts.defaultCats||{expense:[],income:[]};
    const countries=opts.countries||{UAE:true};
    const clone=typeof opts.deepClone==='function'?opts.deepClone:fallbackClone;

    function defaultSettings(){
      return {
        theme:'light',
        language:'ar',
        onboarded:false,
        hideAmounts:false,
        notificationsEnabled:false,
        budgets:{},
        saving:{amount:0,currency:'EGP',saved:0,targetDate:null},
        warnPct:80,
        alertPct:100,
        lastFx:{},
        dismissedReminders:{},
        defaultCountry:'UAE',
        primaryAccountByCountry:{},
        lastExpenseSourceByCountry:{},
        categoryBudgets:{},
        overallSpendingLimits:{},
        budgetAlerts:{},
        defaultAccountByCountry:{},
        defaultInstrumentByCountry:{}
      };
    }

    function defaultState(){
      return {
        schemaVersion,
        institutions:[],
        accounts:[],
        paymentInstruments:[],
        transactions:[],
        beneficiaries:[],
        categories:clone(defaultCats),
        tags:[],
        recurring:[],
        settings:defaultSettings()
      };
    }

    function snapshotState(runtime){
      return {
        schemaVersion:runtime.schemaVersion,
        institutions:clone(runtime.institutions),
        accounts:clone(runtime.accounts),
        paymentInstruments:clone(runtime.paymentInstruments),
        transactions:clone(runtime.transactions),
        beneficiaries:clone(runtime.beneficiaries),
        categories:clone(runtime.categories),
        tags:clone(runtime.tags),
        recurring:clone(runtime.recurring),
        settings:clone(runtime.settings)
      };
    }

    function loadStateInto(runtime,state){
      const incoming=state&&typeof state==='object'?state:{};
      const defaults=defaultState();
      runtime.schemaVersion=incoming.schemaVersion||schemaVersion;
      runtime.institutions=Array.isArray(incoming.institutions)?incoming.institutions:[];
      runtime.accounts=Array.isArray(incoming.accounts)?incoming.accounts:[];
      runtime.paymentInstruments=Array.isArray(incoming.paymentInstruments)?incoming.paymentInstruments:[];
      runtime.transactions=Array.isArray(incoming.transactions)?incoming.transactions:[];
      runtime.beneficiaries=Array.isArray(incoming.beneficiaries)?incoming.beneficiaries:[];
      runtime.categories=incoming.categories&&typeof incoming.categories==='object'
        ? {
            expense:Array.isArray(incoming.categories.expense)?incoming.categories.expense:[],
            income:Array.isArray(incoming.categories.income)?incoming.categories.income:[]
          }
        : clone(defaultCats);
      runtime.tags=Array.isArray(incoming.tags)?incoming.tags:[];
      runtime.recurring=Array.isArray(incoming.recurring)?incoming.recurring:[];
      runtime.settings=Object.assign({},defaults.settings,incoming.settings||{});

      const objectDefaults={
        budgets:{},
        lastFx:{},
        dismissedReminders:{},
        primaryAccountByCountry:{},
        lastExpenseSourceByCountry:{},
        categoryBudgets:{},
        overallSpendingLimits:{},
        budgetAlerts:{},
        defaultAccountByCountry:{},
        defaultInstrumentByCountry:{}
      };
      for(const [key,value] of Object.entries(objectDefaults)){
        if(!runtime.settings[key]||typeof runtime.settings[key]!=='object'||Array.isArray(runtime.settings[key])){
          runtime.settings[key]=clone(value);
        }
      }
      if(!runtime.settings.saving||typeof runtime.settings.saving!=='object'||Array.isArray(runtime.settings.saving)){
        runtime.settings.saving={amount:0,currency:'EGP',saved:0,targetDate:null};
      }
      if(!runtime.settings.defaultCountry||!countries[runtime.settings.defaultCountry]){
        runtime.settings.defaultCountry='UAE';
      }
      runtime.activeCountry=runtime.settings.defaultCountry;
      return runtime;
    }

    return Object.freeze({
      defaultSettings,
      defaultState,
      snapshotState,
      loadStateInto
    });
  }

  return Object.freeze({createStateModel});
});
