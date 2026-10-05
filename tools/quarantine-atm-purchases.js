'use strict';
// Copy-only correction of proven cash debits recorded as consumption. No destination inference.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const B=require('../app/src/main/assets/js/backup-core'),S=require('../app/src/main/assets/js/state-core'),I=require('../app/src/main/assets/js/bank-ingestion-core');
const {validateReferences}=require('./repair-full-backup');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=v=>JSON.parse(JSON.stringify(v));
function dryRun(bytes){
 const b=JSON.parse(bytes);B.validateFullEnvelope(b,S.stateFingerprint);validateReferences(b.finance);
 const proposals=[],unresolved=[];
 for(const t of b.finance.transactions){
  // Independent source contract: explicit debit card debit at an identified bank ATM terminal.
  const e=t.bankImportEvidence||{};
  if(t.type!=='expense'||t.bankId!=='nbe-egypt'||e.kind!=='purchase'||!t.bankImportEventId||!t.bankImportKey||!/^تم\s+خصم\s*[\d,.]+\s*EGP\s+من\s+بطاقة\s+الخصم\s+المباشر\s+رقم\s+\d{4}\s+عند\s+(?:NBE\s+|HDB[-\s]+)ATM\s*[-]?\s*\d+\s+يوم\s/i.test(e.text||''))continue;
  if(t.userFinancialOverride){unresolved.push({id:t.id,reason:'user-correction-preserved'});continue;}
  proposals.push({id:t.id,eventId:t.bankImportEventId,before:clone(t),reason:'ATM cash withdrawal was recorded as a purchase; cash destination requires review.',expectedKind:'cash_withdrawal',action:'quarantine',currency:t.currency,expenseChangeMinor:-Math.round(t.amount*100)});
 }
 return {sourceSha256:sha(bytes),proposals,unresolved,copyOnly:true};
}
function apply(bytes,plan){
 assert.equal(sha(bytes),plan.sourceSha256,'source-changed');assert.deepEqual(plan,dryRun(bytes),'proposal-changed');assert(plan.proposals.length,'no-confirmed-repairs');
 const b=JSON.parse(bytes),settings=b.finance.settings,audit=b.features.bankImportAudit||(b.features.bankImportAudit={});
 const holds=settings.bankReviewHolds||(settings.bankReviewHolds={});assert(!Array.isArray(holds),'invalid-review-holds');
 for(const p of plan.proposals){
  const t=p.before;assert(p.eventId&&!['__proto__','constructor','prototype'].includes(p.eventId),'invalid-event-id');
  assert(Object.keys(holds).length<50000||holds[p.eventId],'review-hold-capacity');
  b.finance.transactions=b.finance.transactions.filter(t=>t.id!==p.id);
  for(const [id,d] of Object.entries(settings.bankEventDecisions||{}))if(id===p.eventId||d.transactionId===p.id)delete settings.bankEventDecisions[id];
  holds[p.eventId]={reason:'repair-destination-unconfirmed',quarantinedTransactionId:p.id,at:Date.now(),parserVersion:'9.2.8-financial-contract',decisionSource:'deterministic-contract',evidence:{bankId:t.bankId,providerId:null,kind:'cash_withdrawal',currency:t.currency,amount:t.amount,postedAt:t.smsReceivedAt||t.created,date:t.date||null,ref:t.bankTransactionRef||null}};
  const event={id:p.eventId,title:t.bankImportEvidence.sourceHint||'BanK-AlAhly',packageName:'repair:nbe-egypt',text:t.bankImportEvidence.text,postedAt:t.smsReceivedAt||t.created,repairReason:p.reason,repairTransactionId:t.id};
  for(const field of ['smsReviewEvents','pendingEvents']){audit[field]=audit[field]||[];if(!audit[field].some(e=>e.id===p.eventId))audit[field].push(event);}
 }
 audit.decisions=I.auditWithDurableDecisions(audit.decisions,b.finance);
 // Diagnostics describe the original device snapshot; retain them intact, identified as original.
 b.repairMetadata={copyOnly:true,sourceSha256:plan.sourceSha256,originalDiagnosticReportPreserved:true,quarantined:plan.proposals.map(p=>p.id)};
 b.finance.integrity={version:1,fingerprint:S.stateFingerprint(b.finance)};validateReferences(b.finance);B.validateFullEnvelope(b,S.stateFingerprint);
 const repaired=Buffer.from(JSON.stringify(b,null,2)+'\n'),journal={sourceSha256:sha(bytes),repairedSha256:sha(repaired),originalBase64:Buffer.from(bytes).toString('base64'),proposals:plan.proposals,copyOnly:true};
 assert.deepEqual(rollback(repaired,journal),Buffer.from(bytes));return {repaired,journal};
}
function rollback(repaired,journal){assert.equal(sha(repaired),journal.repairedSha256,'repaired-copy-changed');const bytes=Buffer.from(journal.originalBase64,'base64');assert.equal(sha(bytes),journal.sourceSha256,'corrupt-journal');return bytes;}
if(require.main===module){const [input,out,mode]=process.argv.slice(2);assert(input&&out&&!fs.existsSync(out),'new-output-directory-required');const bytes=fs.readFileSync(input),p=dryRun(bytes);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'dry-run-PRIVATE.json'),JSON.stringify(p,null,2));if(mode==='apply-copy'){const r=apply(bytes,p);fs.writeFileSync(path.join(out,'SANAD-REPAIRED-COPY.json'),r.repaired);fs.writeFileSync(path.join(out,'rollback-journal-PRIVATE.json'),JSON.stringify(r.journal,null,2));}console.log(JSON.stringify({proposals:p.proposals.length,unresolved:p.unresolved.length,copyOnly:true}));}
module.exports={dryRun,apply,rollback};
