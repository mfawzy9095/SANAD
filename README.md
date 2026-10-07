# SANAD 9.2.12 — Financial review QA batch

Local Android personal finance app with accounts, cards, income/expenses,
transfers, receipts, reminders, biometric/device lock and bank-message import.

Financial stability phase remains OPEN. See [9.2.12 pending FX settlement](docs/financial-closure/9.2.12-pending-settlement.md). See [9.2.11 SMS template variants](docs/financial-closure/9.2.11-sms-variants.md), [9.2.10 review-reason follow-up](docs/financial-closure/9.2.10-review-reasons.md) and [9.2.9 evidence and remaining blockers](docs/financial-closure/9.2.9-review-batch.md). See [financial contract](docs/financial-closure/CONTRACT.md) and [defect register](docs/financial-closure/DEFECTS.md). CI emulator uses a distinct `.forensicqa.ci` debug-signed harness; delivered `.forensicqa.stable` must use the existing private QA certificate.

## Current delivery
- Development: `feature-v9.2-ui-features` only.
- Schema: 16. Existing finance/full-backup envelopes remain compatible.
- Latest signed delivery uses `com.sanad.v9test.forensicqa.stable` and the private
  QA signing key. It installs beside the original app; it never replaces its data.
- Updating the original package requires its original signing key. Do not
  uninstall the existing app or erase its storage to install this candidate.
- Cloud/Family remain disabled. No automatic merge to `main` or stable checkpoint.

## Daily use
Use **+ → SMS refresh** to scan recent transactions. Settings provides historical
SMS import. The first refresh scans 30 days; later scans start from the last
completed scan with one day of overlap. A full review queue stops the historical
scan without discarding messages. Review pending items before continuing.

Transfers between owned accounts, unsettled FX and uncertain fees require explicit
review. Source-reported balances, estimates and calculated ledger balances are
shown separately. Available credit alone does not establish card debt.

## Verification
- Run JS regressions: `for f in app/src/test/js/*.test.js; do node "$f" || exit; done`.
- Android: `gradle :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleForensicQa`.
- Browser integration: `npm ci --prefix tools/e2e`, install its Chromium, serve
  `app/src/main/assets` on 127.0.0.1:8765, then run `node tools/e2e/browser-smoke.js`.
- Android emulator integration: `node tools/e2e/android-smoke.js` after installing
  the isolated APK on an API 35 emulator with adb available. The workflow handles
  the emulator, native SMS permission, synthetic provider messages and bridge callbacks.
- GitHub Actions verifies these gates and packaged assets. Browser tests use
  synthetic data and a simulated Android bridge; no private SMS/backup/key is uploaded.

A passing CI result is not a physical-device test. READ_SMS permission, real
Notification Listener delivery, Android background behavior and device biometrics
require a device regression before accepting a new stable checkpoint. Historic
financial completeness must be reconciled against account statements.
