'use strict';
// Offline copy repair only. No access to the phone, inbox, or application store.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const State=require('../app/src/main/assets/js/state-core');
const Backup=require('../app/src/main/assets/js/backup-core');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const buckets=['institutions','accounts','paymentInstruments','transactions','beneficiaries'];
function validateReferences(finance){
 for(const bucket of buckets){
  assert(Array.isArray(finance[bucket]),'missing-'+bucket);
  const ids=finance[bucket].map(x=>x.id);
  assert(ids.every(Boolean)&&new Set(ids).size===ids.length,'duplicate-id-'+bucket);
 }
 const accounts=new Set(finance.accounts.map(x=>x.id)),instruments=new Set(finance.paymentInstruments.map(x=>x.id));
 for(const i of finance.paymentInstruments)assert(accounts.has(i.accountId),'orphan-instrument');
 for(const t of finance.transactions){
  for(const field of ['accountId','fromAccountId','toAccountId'])if(t[field])assert(accounts.has(t[field]),'orphan-account');
  if(t.instrumentId)assert(instruments.has(t.instrumentId),'orphan-card');
 }
 for(const field of ['bankImportKey','bankImportEventId']){
  const values=finance.transactions.map(t=>t[field]).filter(Boolean);
  assert(new Set(values).size===values.length,'duplicate-'+field);
 }
}
function applyRepair(originalBytes,plan,approvedIds){
 assert(Array.isArray(approvedIds)&&approvedIds.length>0,'explicit-approved-ids-required');
 assert(new Set(approvedIds).size===approvedIds.length,'duplicate-approval');
 assert(sha(originalBytes)===plan.sourceBackupSha256,'source-backup-changed');
 const original=JSON.parse(originalBytes),result=clone(original);
 Backup.validateFullEnvelope(original,State.stateFingerprint);
 assert(original.finance.schemaVersion===16,'schema-16-required');
 validateReferences(original.finance);
 const journal={version:1,sourceSha256:sha(originalBytes),originalBase64:Buffer.from(originalBytes).toString('base64'),entries:[]};
 const proposals=plan.proposals||[];
 assert(new Set(proposals.map(p=>p.id)).size===proposals.length,'duplicate-proposal');
 // Validate the complete approval list before changing even the private draft.
 const selected=approvedIds.map(id=>{
  const p=proposals.find(p=>p.id===id);assert(p,'proposal-not-found');
  assert(['confirmed','high'].includes(p.confidence),'confidence-required');
  assert(['correct-after-approval','quarantine-after-approval'].includes(p.action),'unresolved-proposal');
  const bucket=p.kind==='nonposting-promotion'||['refund-direction','source-identity','merchant-category'].includes(p.kind)?'transactions':'accounts';
  const index=result.finance[bucket].findIndex(x=>x.id===id);assert(index>=0,'record-not-found');
  assert.deepStrictEqual(result.finance[bucket][index],p.before,'before-image-changed');
  if(p.action==='quarantine-after-approval')assert(p.kind==='nonposting-promotion'&&p.after.transaction===null,'unsupported-quarantine');
  else assert(p.after&&p.after.id===id,'repair-id-change');
  return {p,bucket,index};
 });
 for(const {p,bucket} of selected){
  const index=result.finance[bucket].findIndex(x=>x.id===p.id);
  journal.entries.push({id:p.id,kind:p.kind,bucket,index,before:clone(p.before),after:clone(p.after),reason:p.reason,confidence:p.confidence});
  if(p.action==='quarantine-after-approval')result.finance[bucket].splice(index,1);
  else result.finance[bucket][index]=clone(p.after);
 }
 result.finance.integrity={version:1,fingerprint:State.stateFingerprint(result.finance)};
 validateReferences(result.finance);
 Backup.validateFullEnvelope(result,State.stateFingerprint);
 const repairedBytes=Buffer.from(JSON.stringify(result,null,2)+'\n');
 journal.repairedSha256=sha(repairedBytes);
 journal.executedOnCopyOnly=true;
 return {repairedBytes,journal};
}
function rollback(repairedBytes,journal){
 assert(sha(repairedBytes)===journal.repairedSha256,'repaired-copy-changed-stop-rollback');
 const original=Buffer.from(journal.originalBase64,'base64');
 assert(sha(original)===journal.sourceSha256,'journal-original-corrupt');
 return original;
}
if(require.main===module){
 const [input,planFile,approvalFile,output]=process.argv.slice(2);
 if(!output)throw Error('Usage: node tools/repair-full-backup.js original.json dry-run.json approved-ids.json NEW-output-directory');
 assert(!fs.existsSync(output),'output-already-exists');
 const result=applyRepair(fs.readFileSync(input),JSON.parse(fs.readFileSync(planFile)),JSON.parse(fs.readFileSync(approvalFile)));
 assert.deepStrictEqual(rollback(result.repairedBytes,result.journal),fs.readFileSync(input),'rollback-check');
 fs.mkdirSync(output,{recursive:false});
 fs.writeFileSync(path.join(output,'SANAD-REPAIRED-COPY.json'),result.repairedBytes,{flag:'wx'});
 fs.writeFileSync(path.join(output,'repair-journal.json'),JSON.stringify(result.journal,null,2),{flag:'wx'});
 console.log(JSON.stringify({changed:result.journal.entries.length,copyOnly:true,rollbackByteExact:true,sourceSha256:result.journal.sourceSha256,repairedSha256:result.journal.repairedSha256}));
}
module.exports={applyRepair,rollback,validateReferences,sha};
