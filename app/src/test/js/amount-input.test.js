'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../../main/assets/index.html'),'utf8');
const a=html.indexOf('function normalizeAmountInput('),b=html.indexOf('function dispAmount(',a),ctx={};vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
for(const [raw,expected] of [['1,000.50','1000.50'],['١٬٠٠٠٫٥٠','1000.50'],['۱۲۳٫۴۵','123.45'],['1 000,50','1000.50'],['25,50','25.50'],['-5','-5'],['5..2','5..2'],['12abc','12abc'],['1234567891','1234567891'],['1.234','1.234']])assert.strictEqual(ctx.normalizeAmountInput(raw),expected,raw);
for(const raw of ['-5','−5','abc5','5abc','5..2','1.234','Infinity','1e3','','0','1000000000','1,00,0'])assert.strictEqual(ctx.validTransactionAmount(raw),false,raw);
for(const raw of ['١٬٠٠٠٫٥٠','1,000.50','25,50','0.01','25.','999999999.99'])assert.strictEqual(ctx.validTransactionAmount(raw),true,raw);
assert(html.includes('if (!validTransactionAmount(f.amount))'),'actual save path enforces validation');
console.log('Amount input: Arabic digits, grouping, decimal separators and rejection without silent amount changes: PASS');
