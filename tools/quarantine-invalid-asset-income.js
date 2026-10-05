'use strict';
// Offline, copy-only repair for an unambiguous contract violation. No destination is guessed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const Backup=require('../app/src/main/assets/js/backup-core'),State=require('../app/src/main/assets/js/state-core'),F=require('../app/src/main/assets/js/finance-core');
const {validateReferences}=require('./repair-full-backup');
const clone=v=>JSON.parse(JSON.stringify(v)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function dryRun(bytes){
 const b=JSON.parse(bytes);Backup.validateFullEnvelope(b,State.stateFingerprint);validateReferences(b.finance);
 const proposals=[];
 for(const t of b.finance.transactions){
  const a=b.finance.accounts.find(a=>a.id===t.accountId),kind=t.bankImportEvidence&&t.bankImportEvidence.kind;
  if(t.type!=='income'||!t.bankImportKey||!t.bankImportEventId||!a||!['credit','debt'].includes(a.type)||!['salary','deposit','incoming_transfer'].includes(kind))continue;
  proposals.push({id:t.id,action:'quarantine-invalid-asset-income',confidence:'confirmed',reason:'Imported asset income was routed onto a liability. Financial destination remains unresolved; no bank account is chosen.',before:clone(t),accountId:a.id,eventId:t.bankImportEventId,reportedIncomeChange:{currency:t.currency,amount:-Number(t.walletAmount==null?t.amount:t.walletAmount)}});
 }
 return {sourceSha256:sha(bytes),proposals,copyOnly:true};
}
function apply(bytes,plan){
 assert.equal(sha(bytes),plan.sourceSha256,'source-changed');assert(plan.proposals.length,'no-confirmed-repairs');
 const fresh=dryRun(bytes);assert.deepEqual(plan,fresh,'proposal-changed');
 const b=JSON.parse(bytes),before=clone(b);
 b.features=b.features||{};b.features.bankImportAudit=b.features.bankImportAudit||{};
 const audit=b.features.bankImportAudit;
 audit.smsReviewEvents=Array.isArray(audit.smsReviewEvents)?audit.smsReviewEvents:[];
 const effects=[];
 for(const p of plan.proposals){
  const t=p.before,a=b.finance.accounts.find(a=>a.id===p.accountId);
  b.finance.transactions=b.finance.transactions.filter(t=>t.id!==p.id);
  const decisions=b.finance.settings.bankEventDecisions||{};
  for(const [id,d] of Object.entries(decisions)){if(id===p.eventId||d.transactionId===p.id)delete decisions[id];}
  const native={id:p.eventId,postedAt:Number(t.smsReceivedAt||t.created),text:t.bankImportEvidence.text,packageName:'repair:'+String(t.bankId||t.providerId||'unknown'),title:t.bankImportEvidence.sourceHint||'',repairReason:p.reason,repairTransactionId:p.id};
  if(!audit.smsReviewEvents.some(e=>e.id===native.id))audit.smsReviewEvents.push(native);
  // Remove the misrouted bank-balance observation only if it is proven to come from this evidence.
  if(Number(a.observedBalanceAt)===Number(t.created)&&Number(a.observedBalance)===Number(t.bankImportEvidence.availableBalance)){
   delete a.observedBalance;delete a.observedBalanceAt;
   if(a.balanceReconciliation&&Number(a.balanceReconciliation.at)===Number(t.created))delete a.balanceReconciliation;
  }
  effects.push({id:p.id,accountId:a.id,currency:a.currency,partialDebt:a.baselinePartial===true,beforeCalculatedDebt:F.accountDebt(before.finance,a.id),afterCalculatedDebt:F.accountDebt(b.finance,a.id),incomeChange:p.reportedIncomeChange,reviewEventId:native.id,bankAccountBalanceUnchanged:true});
 }
 b.finance.integrity={version:1,fingerprint:State.stateFingerprint(b.finance)};
 validateReferences(b.finance);Backup.validateFullEnvelope(b,State.stateFingerprint);
 const repaired=Buffer.from(JSON.stringify(b,null,2)+'\n');
 const journal={version:1,sourceSha256:sha(bytes),repairedSha256:sha(repaired),originalBase64:Buffer.from(bytes).toString('base64'),proposals:plan.proposals,effects,copyOnly:true};
 assert.deepEqual(rollback(repaired,journal),Buffer.from(bytes));
 return {repaired,journal};
}
function rollback(repaired,journal){assert.equal(sha(repaired),journal.repairedSha256,'repaired-copy-changed');const original=Buffer.from(journal.originalBase64,'base64');assert.equal(sha(original),journal.sourceSha256,'rollback-journal-corrupt');return original;}
if(require.main===module){const [input,out,mode]=process.argv.slice(2);assert(input&&out,'Usage: original.json NEW-output-directory [apply-copy]');assert(!fs.existsSync(out),'output-exists');const bytes=fs.readFileSync(input),plan=dryRun(bytes);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'dry-run.json'),JSON.stringify(plan,null,2));if(mode==='apply-copy'&&plan.proposals.length){const r=apply(bytes,plan);fs.writeFileSync(path.join(out,'SANAD-REPAIRED-COPY.json'),r.repaired);fs.writeFileSync(path.join(out,'rollback-journal-PRIVATE.json'),JSON.stringify(r.journal,null,2));console.log(JSON.stringify({changed:plan.proposals.length,effects:r.journal.effects,rollback:'byte-exact verified',sourceUnchanged:sha(fs.readFileSync(input))===plan.sourceSha256}));}else console.log(JSON.stringify({proposals:plan.proposals.length,readOnly:true}));}
module.exports={dryRun,apply,rollback};
