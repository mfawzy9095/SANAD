# Defect register and release status

This is a reviewable repair batch, NOT closure of the financial stability phase.

| Severity | Finding | Status / evidence |
|---|---|---|
| P0 | Bank salary routed onto sole credit account; reference presence used as confidence | Fixed routing/type/reference checks; synthetic failing-before regression; offline separate-copy quarantine with rollback |
| P0 | Sole unrelated bank asset reused despite missing/conflicting identity | Fixed; account identity and card/account link require review |
| P0 | Manual own-transfer + incoming message silently become two economic entries | Manual-before and manual-after candidate guards implemented with explicit distinct-operation confirmation, central pre-write validation and a user-confirmed evidence-only link path. Import edits preserve evidence and override audit. CI383 browser/native acceptance passed on 44afd2e for 9.2.5; no deletion by similarity |
| P0 | Generic outgoing transfer destination may belong to the user | 9.2.6 requires per-event external destination confirmation or explicit internal transfer; names and learned kind mappings cannot prove ownership. Legacy records remain for independent review |
| P0 | General incoming deposit/transfer origin can still be own money rather than external income | Generic deposit/incoming transfer is review-only even with exact identity or learned kind mappings. Per-event external-income confirmation or explicit internal-transfer route is required; no generalization of origin confirmation. Existing historical origin classifications remain unresolved; CI383 UI acceptance passed for 9.2.5 |
| P0 | Available balance used as opening ledger baseline; missing opening balance falls back to zero | 9.2.6: inferred opening removed; missing/discovered/partial opening remains unknown, bank available observation separate, explicit opening confirmation, adjustment/archive guards. Historical ambiguous evidence keeps final balance unknown even after opening confirmation; as-of cutoff remains respected. Browser/restore passed on 988012d, new dedicated CI regressions registered in this batch |
| P0 | Full financial ledger/report arithmetic uses two-decimal Number values | Extraction boundary fixed using bounded integer minor units with explicit per-currency precision; unsupported precision reviews. 9.2.6 ledger now uses per-currency minor units and cumulative pre-write bounds. 9.2.6 adds exact report totals, refund spending offsets, mixed-currency chart prevention and exact declared FX conversion. Full UI/storage and historical-origin acceptance is pending CI. |
| P1 | Arabic incoming transfer to own account classified outgoing | Fixed semantic extraction regression |
| P1 | EUR 1.234,56 truncated | Fixed exact extraction and invalid/ambiguous/unsafe amount review |
| P1 | Failed/negated salary treated as completed | Fixed common English/Arabic failure/pending/cancellation precedence; wider status semantics still need independent corpus review |
| P1 | Unknown sender assigned ENBD by body template | Fixed source-gated adapter; unknown source cannot auto-post from body alone |
| P0 | A reused reference can discard another salary, or confuse refund with earlier income | Reproduced on old code; financial kind, routed account, currency, amount and 24-hour evidence scope now required for cross-evidence linking. Conflicts remain review; identical evidence preserves corrections. Regression tests added; final CI pending. This does not establish reference uniqueness for every bank |
| P1 | Documented user exchange rate rejected by storage schema | CI385 reproduced rejection without durable posting; structured source/time/rate validation and restore round-trip fixed, actual FX browser scenario passed on 988012d |
| P1 | Different native events suppressed by same text/balance/time | Fixed: similarity only review; identical evidence remains idempotent |
| P1 | Native queue at 200 silently refuses further notification-only evidence | Added 2000-event overflow headroom, no eviction, capture failure/overflow diagnostics and actionable UI. Corrupt persisted inbox now fails closed and preserves original bytes instead of overwriting them with an empty queue. Finite hard capacity still exists; permanently vanished notifications without SMS require manual recovery. Runtime FULL/disk corruption/device process-death matrix still OPEN |
| P1 | Partial credit discovered at zero debt/limit misleading | Existing partial-debt UI and calculated-credit null behavior verified in code/tests. 9.2.6 unknown final debt and refund report offsets implemented; CI acceptance pending |
| P1 | Large evidence may be silently truncated before parser | Truncation metadata now reaches parser; long/truncated evidence reviews rather than posting |
| P1 | Snapshot/state copies per operation | Measured parse/plan only; storage latency, peak memory and UI frame timing on large ledger remain OPEN |
| Gate | QA update continuity | Private existing key found; expected certificate d3cf8c03964cee0efd6e474b5ae6f983e87c528b1e2cf6560e25de1c9f5bb377 enforced at final signing |
| Gate | Independent acceptance | 24 separately written synthetic cases: 9 automatic correct, 11 review, 4 noncompleted ignored, zero automatic errors. This is not external independent review nor global corpus ground truth |
| Gate | Device matrix | Manifest Android 26–35 build range. Actual Samsung S25 FE, biometric hardware, signature update, cross-device restore and WebView versions remain untested until executed |

Do not mark this branch/checkpoint stable. Passing CI does not close the OPEN financial defects above. Device APK is a limited QA batch; existing data is never silently migrated by a parser change. Protected branches stay unchanged.

## Current QA batch: 9.2.7 / 92007

CI37309481439 passed on fcf5552 for the preceding 9.2.6 source: 39 JavaScript files, 25 browser scenarios, JVM/lint/build and 8 native Android 35 scenarios. The temporary execution-workspace outage was resolved; the private original key was recovered without replacement. This 9.2.7 batch additionally includes exact-ledger optimization, separate purchase principal/fees, evidence-bound report confirmation, large-history browser performance measurement and WebView version recording. The 39 local test files pass. Final CI on the delivered commit and private APK signing are required before delivery; neither a stable checkpoint nor phase closure is authorized by these results alone.

The separate private repair copy quarantines one imported salary on a liability, keeps its evidence for review, leaves all other transactions unchanged, passes raw/migrated strict schema validation and restores the original bytes through the rollback journal. The ambiguous manual-transfer/incoming-SMS pair is retained; no new destination or wallet final balance is guessed.

Open gates: actual S25 FE/device update with the fixed certificate; physical biometric lock; notification-only FULL/disk-fault and process-death matrix; old-backup/cross-device restore on hardware; mobile large-history response and peak memory; externally reviewed corpus coverage. Old ambiguous financial records remain reviewable, and their totals/debt may remain unknown.

Copy repair now retains a durable review hold so the quarantined evidence cannot silently re-enter during rescan. Strict schema and backup migration validate/preserve the hold; explicit correction or dismissal clears it, and stale capture-audit rows are overridden by review status. Final CI must include the actual browser reload/rescan/correction scenario.
