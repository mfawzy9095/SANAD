# SANAD — Worldwide Readiness & Release Gates

**Status:** OPEN / QA ONLY. This specification is not certification, does not imply zero defects, and does not authorize merge to `main` or a production APK.

## 0. Constraints and provenance

- Supported historical checkpoint, protected `main`, and user-owned backups MUST NOT be overwritten by QA work.
- All test fixtures committed publicly are synthetic/anonymized. Never commit real messages, OTPs, account numbers, addresses, receipts, keys or unredacted diagnostics.
- User device data are evidence, not ground truth for economic correctness. Reconcile with an independent bank/card statement before certifying real balances.
- SANAD 9.2.8 exported backups on 2026-10-08 show a sample with UAE and Egyptian accounts. Snapshot #1: 1,100 transactions / 6 accounts / 262 review events. Snapshot #2: 1,288 transactions / 9 accounts / 1,570 review events. The historical import was cancelled with 14,540 SMS scanned, 188 newly posted and 1,308 newly reviewed. These are *aggregate counts*, not raw data; no scan-complete claim.
- Latest source is 9.2.14 financial QA, NOT a signed validated consumer release.

## 1. Financial correctness gates — P0

1. **Issuer identity:** Institution key = (legal/registry ID, jurisdiction, product); Emirates NBD Egypt and Emirates NBD UAE are **distinct issuers**, irrespective of a common brand or SMS sender. Never infer issuer jurisdiction solely from message spending currency, phone locale, current device country or merchant country. Ambiguous issuer/account/card -> review.
2. **Account identities:** Match sender authorization + issuing institution + country + account reference (or exact, user-confirmed alias) + instrument suffix. A four-digit suffix is a candidate only, not proof of ownership. Allow a user to correct an uncertain association with a scoped, revocable, auditable confirmation.
3. **Currency:** Original transaction currency and amount are immutable evidence; account currency principal, posted final settlement and fees have separately typed fields. Report pending settlement as unknown in account-currency balances and budgets. Never use a hard-coded display FX rate for bank posting.
4. **Precision:** Replace 2-decimal-only ledger contracts before claiming worldwide money support. Follow ISO 4217 supported code metadata and Unicode CLDR currency fraction digits. Persist integer minor units (or equivalent exact decimal) with scale; test 0, 2, 3 and 4 minor-digit currencies, negatives, reversals, truncation, cash rounding, and conversion with explicit provenance.
5. **Economic postings:** Transfer between own accounts and credit-card repayment do not create duplicate spending/income. Refunds, cash withdrawals, cash location, debit transactions, holds, settlement updates, fees, returns and salary are separate typed events with explicit attribution.
6. **Idempotency:** Same SMS imported twice, captured notification + historical SMS, process death + retry, duplicate statement/ref, and manual-before-/after-auto import all result in exactly one economic entry or an explicit review. No silent merge solely on amount, merchant, short time window.
7. **Conservation:** Every persisted mutation has durable atomic persistence, rollback on failure, audit decision, restart/restore support and reproducible report totals. Unknown opening balance remains unknown, not invented 0.

**Gate:** 0 unexplained ledger mutations in all deterministic fixtures; 100% economically ambiguous cases withheld for review; all included reference-bank statement cases reconciled to minor units. Unsupported country/currency/provider is visibly labelled, never silently converted.

## 2. Ingestion and review — P0

- Support import from Android SMS inbox, live permitted notification source, and validated user-selected files. Do not confuse arbitrary XML SMS backup with bank CSV/OFX/QFX/CAMT.22 or PDF; each format needs its own importer and validation.
- Every discovered candidate must have durable provenance and one traceable decision: posted, linked to existing, observed-only, review, safely ignored with reason, or failure + retry. Distinguish scan-complete from finance-reviewed.
- Show real `scanned/total` only when total is measured; otherwise an indeterminate indicator. Count reviewed/postable/ignored/duplicate separately and explain full scan scope/date. Support pause, resume, cancel and survival of app HOME/restart without writing a partial duplicate batch.
- Reviews must offer **Edit / choose transaction type / amount / original currency / posting amount / fee / issuer and country / source & destination account / instrument / merchant / category / date / memo / related transfer / duplicate link / ignore**. Unrecognized text is *still manually editable*, never auto-posted. For uncertain cash/payment context require human evidence and explicit confirmation. No silent learning from unknown or conflicting origin.
- Add pagination and filters for 1,000+ review events; virtualize if necessary. Never render the entire queue at once or clear on restore.
- Mobile UI loading is independent from parser completion: the user can leave and return, see current stage, and be told if the scan has stopped.
- Run import coverage against real private corpus ONLY offline, on a throwaway encrypted test copy; commit redacted synthetic cases derived from defect classes, never from private raw text.

**Gate:** import a synthetic 25,000-message fixture, kill/restart app at page boundaries, scan twice, verify all retained decisions and exact financial fingerprint; real user verifies representative cases without modifying originals.

## 3. UI, identity, accessibility — P1

- Unified icon design system (e.g. locally bundled Apache-licensed Material Symbols) with consistent 20–24px strokes for actions: bank account, wallet, credit, debit, transfer, income, outflow, refunds, salary, FX, review, safety, import. Avoid emoji used as product icons.
- Official bank and payment-provider marks only from a verified brand source with actual permitted app-use rights; keep an asset manifest: jurisdiction, registry ID, brand owner, source URL, attribution/license, version/hash, last review. Package vetted SVG/PNG locally; offline render and neutral vector monogram when logo absent. Never invent scheme/network from an unknown card, or silently use website favicons as bank logos.
- Dark and light theme, RTL/LTR, scaled text, screenreader labels, accessible contrast and touch targets. Name + mask + account country must remain legible without relying on color or logo alone.
- Separate banks with same trade name in different countries; **do not share their exact logo variant unless it genuinely belongs to the same brand**. Brand visual doesn't establish legal entity identity.
- Review accessible at 360px/393px and larger, no hidden action, all fields readable and keyboard navigable.
- Financial loading states: scan progress, durable-save confirmation, pending sync, last-success timestamp, understandable failure with retry.

## 4. Architecture and privacy — P0/P1

- Android local source of truth with consistent transactional writes (candidate for staged Room/SQLite design if existing IndexedDB persistence cannot meet durable invariants). Offline first; network must not be required to view or manually record a transaction.
- User consent and least-privilege SMS/notification access; Google Play `READ_SMS` financial money management exception is subject to declaration and review, **not guaranteed approval**; publish with disclosures, data deletion/export and a no-SMS manual/file mode.
- No real SMS or OTP contents in analytics, crash reports, GitHub Actions, automated issue reports or external logo requests.
- Encrypt backups at rest where supported, test wrong key/corrupt restore, rollback, storage-full, schema migration, power loss, process kill. Confirm biometric authentication on the actual phone, not just a mocked browser.
- Security review against OWASP MASVS STORAGE, CRYPTO, AUTH, PLATFORM, CODE and PRIVACY controls; least-privilege export/share intents.
- Scope of first release should be transparent: worldwide **manual** ledger and file intake (validated formats) can be supported incrementally; bank-specific **automatic** parsers require explicit regional certification. Claim neither all-world-bank support nor error-free operation.

## 5. Release acceptance pipeline

1. CI: syntax / JS tests / ledger contracts / browser integration / Android emulator all green on **the same commit**. A build-only pass is insufficient.
2. Privately reconcile latest anonymized bank-review corpus and independent statements, including salary, EGP NBD, card vs account identity, foreign purchase, late settlement, duplicates, transfers, stale observed balances and historic import.
3. Complete physical Samsung S25 FE test matrix: genuine SMS, Android notifications while foreground/background, app reboot, import pause/resume/cancel, biometric hide/reveal and relock, backup/restore, storage exhausted, malformed data, signed QA installation.
4. Verify all shipped official asset sources/licenses, fallback, Arabic+English rendering and 360px usability.
5. Produce a **signed QA APK** with authorized key, install alongside protected checkpoint if possible, non-destructively migrate/restore a cloned backup. Keep clear rollback path. Only after P0=0 open and device owner acceptance seek approval to merge.
6. Do not equate no known bug with zero possible financial errors. Clearly mark unsupported issuers/currencies/formats as manual review.

### External source baselines

- Google Play SMS/Call Log restricted permissions — https://support.google.com/googleplay/android-developer/answer/10208820
- Android offline-first architecture — https://developer.android.com/topic/architecture/data-layer/offline-first
- Unicode CLDR currency fraction metadata — https://github.com/unicode-org/cldr/blob/main/common/supplemental/supplementalData.xml
- Android progress indicators — https://developer.android.com/develop/ui/compose/components/progress
- Google Material Icons licensing — https://developers.google.com/fonts/docs/material_icons
- Simple Icons license/trademark caveats — https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
- OWASP MASVS — https://mas.owasp.org/MASVS/
