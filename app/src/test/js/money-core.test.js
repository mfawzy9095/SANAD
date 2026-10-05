'use strict';
const assert=require('assert/strict'),M=require('../../main/assets/js/money-core');
for(const [token,cur,minor] of [['1.234,56','EUR','123456'],['1,234.56','AED','123456'],['١٢٣٫٤٥','EGP','12345'],['500','JPY','500'],['1.234','KWD','1234'],['-4.001','BHD','-4001']])assert.equal(M.decimal(token,cur).minorUnits,minor,token);
for(const [token,cur] of [['1,234','AED'],['1.234.56','AED'],['1.234','AED'],['1.2','JPY'],['1.1234','KWD'],['900719925474099.99','AED'],['1','XXX']])assert.equal(M.decimal(token,cur).ok,false,token);
assert.equal(M.ledgerValue('1.234','KWD').ok,false);
for(let n=0;n<10000;n+=37){const value=(n/100).toFixed(2);assert.equal(M.decimal(value,'AED').minorUnits,String(n));}
console.log('PASS money exact extraction, precision boundaries and round trip');
