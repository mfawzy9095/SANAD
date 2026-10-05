# Defect register and release status

This is a reviewable repair batch, NOT closure of the financial stability phase.

| Severity | Finding | Status / evidence |
|---|---|---|
| P0 | Bank salary routed onto sole credit account; reference presence used as confidence | Fixed routing/type/reference checks; synthetic failing-before regression; offline separate-copy quarantine with rollback |
| P0 | Sole unrelated bank asset reused despite missing/conflicting identity | Fixed; account identity and card/account link require review |
| P0 | Manual own-transfer + incoming message silently become two economic entries | Manual-before and manual-after candidate guards implemented with explicit distinct-operation confirmation, central pre-write validation and a user-confirmed evidence-only link path. Import edits preserve evidence and override audit. CI/browser/native UI acceptance pending for 9.2.5; no deletion by similarity |
| P0 | General incoming deposit/transfer origin can still be own money rather than external income | Generic deposit/incoming transfer is review-only even with exact identity or learned kind mappings. Per-event external-income confirmation or explicit internal-transfer route is required; no generalization of origin confirmation. Existing historical origin classifications remain unresolved; UI acceptance pending for 9.2.5 |
| P0 | Available balance used as opening ledger baseline; missing opening balance falls back to zero | OPEN: the existing baseline model is not proof of opening ledger balance; cash/asset projections and historical reports require complete unknown-balance contract |
| P0 | Full financial ledger/report arithmetic uses two-decimal Number values | Extraction boundary fixed using bounded integer minor units with explicit per-currency precision; unsupported precision reviews. Complete ledger arithmetic and cumulative bounds remain OPEN |
| P1 | Arabic incoming transfer to own account classified outgoing | Fixed semantic extraction regression |
| P1 | EUR 1.234,56 truncated | Fixed exact extraction and invalid/ambiguous/unsafe amount review |
| P1 | Failed/negated salary treated as completed | Fixed common English/Arabic failure/pending/cancellation precedence; wider status semantics still need independent corpus review |
| P1 | Unknown sender assigned ENBD by body template | Fixed source-gated adapter; unknown source cannot auto-post from body alone |
| P1 | Different native events suppressed by same text/balance/time | Fixed: similarity only review; identical evidence remains idempotent |
| P1 | Native queue at 200 silently refuses further notification-only evidence | Added 2000-event overflow headroom, no eviction, capture failure/overflow diagnostics and actionable UI. Corrupt persisted inbox now fails closed and preserves original bytes instead of overwriting them with an empty queue. Finite hard capacity still exists; permanently vanished notifications without SMS require manual recovery. Runtime FULL/disk corruption/device process-death matrix still OPEN |
| P1 | Partial credit discovered at zero debt/limit misleading | Existing partial-debt UI and calculated-credit null behavior verified in code/tests. Full report treatment of refunds and partial balances still OPEN |
| P1 | Large evidence may be silently truncated before parser | Truncation metadata now reaches parser; long/truncated evidence reviews rather than posting |
| P1 | Snapshot/state copies per operation | Measured parse/plan only; storage latency, peak memory and UI frame timing on large ledger remain OPEN |
| Gate | QA update continuity | Private existing key found; expected certificate d3cf8c03964cee0efd6e474b5ae6f983e87c528b1e2cf6560e25de1c9f5bb377 enforced at final signing |
| Gate | Independent acceptance | 22 separately written synthetic cases: 9 automatic correct, 9 review, 4 noncompleted ignored, zero automatic errors. This is not external independent review nor global corpus ground truth |
| Gate | Device matrix | Manifest Android 26–35 build range. Actual Samsung S25 FE, biometric hardware, signature update, cross-device restore and WebView versions remain untested until executed |

Do not mark this branch/checkpoint stable. Passing CI does not close the OPEN financial defects above. Device APK is a limited QA batch; existing data is never silently migrated by a parser change. Protected branches stay unchanged.
