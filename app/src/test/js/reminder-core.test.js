'use strict';
const assert=require('assert');
const R=require('../../main/assets/js/reminder-core.js');

function local(y,m0,d,h=12){
  return new Date(y,m0,d,h,0,0,0).getTime();
}

(function reminderDefaults(){
  assert.strictEqual(R.reminderDaysOf({}),3);
  assert.strictEqual(R.reminderDaysOf({reminderDays:0}),0);
  assert.strictEqual(R.reminderDaysOf({reminderDays:'5'}),5);
})();

(function monthlyDays(){
  assert.strictEqual(R.daysUntilNextOccurrence(
    {frequency:'monthly',day:20},
    local(2026,8,10)
  ),10);
  const d=R.daysUntilNextOccurrence({frequency:'monthly',day:1},local(2026,8,30));
  assert.ok(d>=1&&d<=2,'next monthly occurrence should be Oct 1 from Sep 30');
})();

(function yearlyDays(){
  assert.strictEqual(R.daysUntilNextOccurrence(
    {frequency:'yearly',month:10,day:7},
    local(2026,10,7)
  ),0);
  assert.ok(R.daysUntilNextOccurrence(
    {frequency:'yearly',month:0,day:1},
    local(2026,9,1)
  )>0);
})();

(function nativeSpecs(){
  const specs=R.nativeReminderSpecs([
    {id:1,name:'Rent',active:true,amount:1000,currency:'AED',frequency:'monthly',day:31,reminderDays:90},
    {id:2,name:'Off',active:false,amount:1},
    {id:3,name:'Bad source',active:true,amount:1}
  ],{
    hideAmounts:false,
    isValidSource:r=>r.id!==3,
    formatAmount:v=>'#'+v,
    currencySymbol:c=>c==='AED'?'د.إ':c
  });
  assert.strictEqual(specs.length,1);
  assert.deepStrictEqual(specs[0],{
    id:'1',title:'Rent',body:'#1000 د.إ',frequency:'monthly',
    day:28,month:0,reminderDays:30
  });
})();

(function dueVisibleAndHidden(){
  const recurring=[{
    id:'r1',name:'Bill',active:true,amount:50,currency:'AED',
    frequency:'monthly',day:10,reminderDays:3
  }];
  const visible=R.dueNotifications(recurring,{
    now:local(2026,8,8),
    formatAmount:v=>String(v),
    currencySymbol:()=> 'AED'
  });
  assert.strictEqual(visible.length,1);
  assert.strictEqual(visible[0].title,'Bill بعد 2 أيام');
  assert.strictEqual(visible[0].body,'50 AED');

  const hidden=R.dueNotifications(recurring,{
    now:local(2026,8,9),
    hideAmounts:true
  });
  assert.strictEqual(hidden[0].title,'Bill غداً');
  assert.strictEqual(hidden[0].body,'Bill غداً — مبلغ مخفي');
})();

(function outsideWindow(){
  const out=R.dueNotifications([{
    id:'r',name:'Bill',active:true,frequency:'monthly',day:20,reminderDays:3
  }],{now:local(2026,8,10)});
  assert.deepStrictEqual(out,[]);
})();

console.log('reminder-core regression tests: PASS');
