# Minor-unit guard repair after 9.2.8

Scope: calculated balance presentation, central prepaid mutation invariant,
import-core reconciliation, and the actual inbox balance/available-credit
reconciliation method. No historical records or opening balances are changed.

Before: a fixed 0.01 tolerance hid a one-fils discrepancy and allowed a
one-fils prepaid overdraft in AED. KWD ledger/credit observations were rounded
to two places, losing valid 0.001 differences.

After: supported currency precision comes from MoneyCore. Every nonzero exact
minor-unit difference is a discrepancy. Prepaid mutations cannot create or
worsen a negative balance, including a single minor unit. Available bank
balances still remain separate from ledger balances. Unknown opening balances
remain unknown; no adjustment or opening amount is invented.

Regression evidence: tests failed before fixing both the core and actual
inbox method. AED (0.01), KWD (0.001), and JPY (1) cover discrepancies,
overdrafts, worsening legacy negative prepaid balances and credit observations.
Equal core observations are matched. All 39 JavaScript test files pass locally.
bank-durable-import executes the actual HTML inbox method in a VM; it is not
Android device evidence. CI browser/native results must be reported separately.

Release status: source repair batch only. No new signed APK or version bump in
this batch. 9.2.8 binaries do not include this change. Do not declare stability.
Other legacy UI/schema/archive thresholds still contain 0.01 comparisons and
need separate regression coverage before claiming end-to-end minor-unit closure.
Device update, biometric hardware, capture FULL/disk-failure/process-death,
mobile performance and historical financial ambiguity remain open gates.
