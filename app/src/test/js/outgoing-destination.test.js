'use strict';
const assert=require('assert'),I=require('../../main/assets/js/bank-ingestion-core'),M=require('../../main/assets/js/bank-message-core');
const state=()=>({institutions:[{id:'i',name:'Emirates NBD',bankRegistryId:'emirates-nbd',country:'UAE'}],accounts:[{id:'a',type:'bank',currency:'AED',country:'UAE',institutionId:'i',openingBalance:500,bankRefs:['1234']}],paymentInstruments:[],transactions:[],settings:{}});
const parsed={recognized:true,bankId:'emirates-nbd',kind:'outgoing_transfer',direction:'debit',accountRef:'1234',currency:'AED',amount:20,confidence:0.99,eventId:'out',postedAt:1791010000000,raw:'Transfer AED 20 to named beneficiary',beneficiaryName:'Example Person'};
const s=state();assert.equal(I.plan(parsed,s).reason,'outgoing-destination-unconfirmed');
const route={status:'routed',fromAccount:s.accounts[0],confidence:0.99};assert.equal(M.buildTransaction(parsed,route,{}).reason,'outgoing-destination-unconfirmed');
const built=M.buildTransaction(parsed,route,{uid:()=> 'x',confirmedOutgoingDestination:'external'});assert.equal(built.ok,true);assert.equal(built.transaction.type,'external_transfer');assert.equal(built.transaction.economicOrigin.kind,'external-destination');
console.log('Outgoing direction cannot prove economic ownership: PASS');
