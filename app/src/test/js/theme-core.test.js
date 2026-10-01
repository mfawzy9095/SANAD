'use strict';
const assert=require('assert');
const T=require('../../main/assets/js/theme-core.js');

assert.deepStrictEqual(Array.from(T.MODES),['light','dark','system']);
assert.strictEqual(T.isValidMode('light'),true);
assert.strictEqual(T.isValidMode('dark'),true);
assert.strictEqual(T.isValidMode('system'),true);
assert.strictEqual(T.isValidMode('sepia'),false);

assert.strictEqual(T.normalizeMode('dark'),'dark');
assert.strictEqual(T.normalizeMode('bad'),'light');
assert.strictEqual(T.normalizeMode('bad','system'),'system');
assert.strictEqual(T.normalizeMode('bad','bad2'),'light');

assert.strictEqual(T.resolveMode('light',true),'light');
assert.strictEqual(T.resolveMode('dark',false),'dark');
assert.strictEqual(T.resolveMode('system',true),'dark');
assert.strictEqual(T.resolveMode('system',false),'light');
assert.strictEqual(T.resolveMode('bad',true),'light');

assert.strictEqual(T.metaThemeColor('dark'),'#0B1110');
assert.strictEqual(T.metaThemeColor('light'),'#F6F9F8');

console.log('theme-core regression tests: PASS');
