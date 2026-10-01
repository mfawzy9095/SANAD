'use strict';
const assert=require('assert');
const Core=require('../../main/assets/js/i18n-core.js');

const I=Core.createI18nCore();

(function arabicPassthrough(){
  I.lang='ar';
  assert.strictEqual(I.text('الرئيسية'),'الرئيسية');
  assert.strictEqual(I.text('3 حسابات'),'3 حسابات');
})();

(function exactEnglish(){
  I.lang='en';
  assert.strictEqual(I.text('الرئيسية'),'Home');
  assert.strictEqual(I.text('الإعدادات'),'Settings');
  assert.strictEqual(I.text('قفل بالبصمة / الجهاز'),'Biometric / device lock');
  assert.strictEqual(I.text('إعادة ضبط البيانات المالية'),'Reset financial data');
})();

(function dynamicEnglish(){
  I.lang='en';
  assert.strictEqual(I.text('3 حسابات'),'3 accounts');
  assert.strictEqual(I.text('2 بطاقة'),'2 cards');
  assert.strictEqual(I.text('المصروفات (AED)'),'Expenses (AED)');
  assert.strictEqual(I.text('لا توجد حسابات في الإمارات'),'No accounts in UAE');
  assert.strictEqual(I.text('بعد 4 أيام'),'In 4 days');
  assert.strictEqual(I.text('يوم 12'),'Day 12');
})();

(function whitespacePreserved(){
  I.lang='en';
  assert.strictEqual(I.text('  الرئيسية  '),'  Home  ');
})();

(function languageDecisions(){
  assert.strictEqual(Core.isValidLanguage('ar'),true);
  assert.strictEqual(Core.isValidLanguage('en'),true);
  assert.strictEqual(Core.isValidLanguage('fr'),false);
  assert.strictEqual(Core.normalizeLanguage('en'),'en');
  assert.strictEqual(Core.normalizeLanguage('ar'),'ar');
  assert.strictEqual(Core.normalizeLanguage('fr'),'ar');
  assert.strictEqual(Core.normalizeLanguage(null),'ar');
  assert.strictEqual(Core.directionForLanguage('en'),'ltr');
  assert.strictEqual(Core.directionForLanguage('ar'),'rtl');
  assert.strictEqual(Core.directionForLanguage('bad'),'rtl');
})();

console.log('i18n-core regression tests: PASS');
