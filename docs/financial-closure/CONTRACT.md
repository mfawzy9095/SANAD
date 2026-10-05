# Financial posting contract — 2026-10-05

Status: implementation and acceptance in progress; not a stable checkpoint.

1. Bank/cash/wallet accounts are assets; credit accounts are liabilities. A salary or bank deposit cannot route to a liability. Identity requires source, type, currency and a nonconflicting identifier. A sole account is not identity evidence. Last-four matches are candidates, not proof of a complete account identity.
2. Credit purchases increase debt. Repayment transfers assets to the liability and is not another purchase expense. Unknown opening debt/limit remain partial; available credit is a separate observation.
3. Same-currency own transfers preserve total assets except separately confirmed fees. Cash withdrawal requires both source and cash destination. Incoming money does not establish external income or salary; generic deposits/incoming transfers always require per-event origin confirmation, even when account identity or a learned route is exact. Origin confirmation never grants the same origin to a later message.
4. Refund, reversal, cancellation, authorization, pending and failed postings are distinct. Negation/failure wins over a salary/purchase keyword. Reversals and cancellations require original-operation review.
5. Available bank balance is not proven ledger balance. Unknown opening balance is not zero. Holds, missing history, exchange and fees may explain discrepancies; observations never authorize balancing adjustments.
6. Currency totals stay separate. Automatic posting uses the existing ledger only for validated two-decimal currencies. Other currency precision must be extracted exactly but remains review-only until the entire ledger/report/mutation path supports it. Never silently round a three-decimal currency.
7. Extraction uses decimal strings and bounded integer minor units; reject unsafe, overprecision and ambiguous numbers. Generic ambiguous dates require review. Evidence arrival time and operation time remain separate.
8. Same evidence identity is idempotent. Strong source-scoped transaction reference may link only with matching operation kind, route, currency and amount. Similar amount/time/text/observations are review candidates, never deletion authority. Manual entries and either transfer leg participate in candidate search in both entry orders. Distinct-operation confirmation is bound to the exact candidate set and must be rechecked before durable save. A user-confirmed same-operation link appends evidence only; no monetary fields change.
9. Existing financial transaction and its durable terminal evidence decision commit together. Native acknowledgement follows verified durable save. Failure must retain/recover evidence, roll back the financial mutation and expose an error. Parser updates propose reinterpretation and preserve dismissals/manual edits.
10. Data repair operates on a separate copy, records before/after and effects, validates references/integrity and verifies byte-exact rollback. Unresolved economic identity or destination is not silently repaired.

## Pipeline
Capture evidence → extract fields → interpret financial meaning → resolve account → find existing operation → validate → durable posting/decision → acknowledge evidence.

## Support boundary and remaining release gates
Android manifest floor 26 / target 35 is a build boundary, not a validated device matrix. Real Samsung S25 FE, biometric hardware, notification loss under process death, update signature continuity and cross-device restores require actual tests. No worldwide bank/language/device claim. Acceptance labels are independent human-written synthetic expectations, not outputs of the previous parser. Broader independent review is required before stability.


## Balance certainty and exact ledger amendment (9.2.6)

An available balance is an observation, never a certified opening ledger balance. Auto-discovered assets carry `openingBalanceKnown:false`; partial liabilities return unknown final debt while recorded movement remains available independently. Legacy manually declared numeric opening values remain compatible; omitted values acquire an explicit unknown flag during migration. Existing auto-discovered or partial records do not acquire certainty from zero defaults.

Opening confirmation means the value immediately before the first recorded transaction. It requires the explicit account/card form checkbox, preserves original bank observations, and does not generate a balancing adjustment. Unknown balances cannot be settled, hidden by archiving, used as sufficient prepaid funds, or summed as zero in country totals. Confirmation is not evidence of complete historical coverage.

Ledger terms and totals use bounded integer minor units with currency-specific precision. Supported precision table is explicit; invalid precision, currency contradictions and cumulative overflow block changed financial writes before safety snapshot/durable write. Mixed currencies have no implicit exchange rate. Unknown FX suggestions return null. UI/manual conversion and full report calculations require their own separate validation and are not certified by this ledger change.
