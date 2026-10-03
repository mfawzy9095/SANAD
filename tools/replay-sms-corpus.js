'use strict';
// Offline READ ONLY replay. Input: JSON array of SMS Backup & Restore attributes.
// Never writes to the input backup or a live SANAD store.
const fs=require('fs'),path=require('path');
const M=require('../app/src/main/assets/js/bank-message-core');
const I=require('../app/src/main/assets/js/bank-ingestion-core');
const F=require('../app/src/main/assets/js/finance-core');
const [input,output,backup]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node tools/replay-sms-corpus.js sms-attributes.json output-dir [full-backup.json]');
const bytes=fs.readFileSync(input),rows=JSON.parse(bytes);
const base=backup?JSON.parse(fs.readFileSync(backup)).finance:null;
const state={institutions:[],accounts:[],paymentInstruments:[],transactions:[],beneficiaries:[],settings:{}};
let sequence=0;const uid=p=>'replay_'+p+'_'+(++sequence);
const counts={},senderCounts={},results=[],salaries=[],remittances=[],reviews=[];
const add=(o,k)=>o[k]=(o[k]||0)+1;
const baselineCounts={};
for(const [index,r] of rows.map((r,index)=>[index,r]).sort((a,b)=>Number(a[1].date)-Number(b[1].date))){
 if(String(r.type)!=='1')continue;
 const inputEvent={id:'xml-row-'+index,title:r.address,postedAt:Number(r.date),text:r.body};
 const parsed=M.parse(inputEvent);
 const plan=parsed.ignored?{action:'ignored',reason:parsed.reason}:parsed.recognized?I.plan(parsed,state,{uid}):{action:'unrecognized',reason:parsed.reason};
 I.applyPlan(state,plan);
 add(counts,plan.action);add(senderCounts,r.address+'|'+plan.action);
 const result={xmlRow:index,sender:r.address,postedAt:Number(r.date),action:plan.action,reason:plan.reason,kind:parsed.kind||null,amount:parsed.amount==null?null:parsed.amount,currency:parsed.currency||null,bankId:parsed.bankId||null,providerId:parsed.providerId||null,issuerCountry:parsed.country||null,last4:parsed.cardLast4||null,ref:parsed.transactionRef||null,availableBalance:parsed.availableBalance==null?null:parsed.availableBalance,availableCredit:parsed.availableCredit==null?null:parsed.availableCredit,availableCreditCurrency:parsed.availableCreditCurrency||null,existingTransactionId:plan.existingTransactionId||null};
 results.push(result);
 if(parsed.kind==='salary')salaries.push(result);
 if(parsed.kind==='outgoing_transfer'&&parsed.cardType==='debit_card')remittances.push(result);
 if(plan.action==='review')reviews.push(result);
 if(base&&parsed.recognized){const pl=I.plan(parsed,base,{uid});add(baselineCounts,pl.action+':'+pl.reason);}
}
const crypto=require('crypto');
fs.mkdirSync(output,{recursive:true});
const write=(name,data)=>fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2));
write('summary.json',{readOnly:true,inputSha256:crypto.createHash('sha256').update(bytes).digest('hex'),smsRows:rows.length,receivedRows:results.length,counts,senderCounts,againstExistingBackup:baselineCounts,accounts:state.accounts.map(a=>({id:a.id,name:a.name,currency:a.currency,country:a.country,baseline:a.bankBalanceBaseline||null,calculated:F.accountBalance(state,a.id),observed:a.observedBalance==null?null:a.observedBalance,availableCredit:a.observedAvailableCredit==null?null:a.observedAvailableCredit,baselinePartial:a.baselinePartial===true})),salaries:salaries.length,cardRemittanceMessages:remittances.length});
write('message-results.json',results);write('salary-results.json',salaries);write('card-remittance-results.json',remittances);write('review-results.json',reviews);
console.log(JSON.stringify({smsRows:rows.length,counts,salaries:salaries.length,cardRemittanceMessages:remittances.length,accounts:state.accounts.length}));
