# SANAD V9.1 Architecture Audit

Audit target: `refactor-v9.1-architecture`  
Stable behavior baseline: V9.0.10  
Schema: 16  
Cloud/Family: disabled in local-stable behavior

## Decision

The refactor is ready to move to device regression testing. Do not widen the architecture refactor before device validation.

The financial write path is now protected by state validation, safety snapshots, verified durable writes, and rollback. The major runtime logic extracted during the refactor is covered by Node/JVM regression tests and the Android APK gate.

## Blockers found and fixed during the audit

### Receipt post-save race

Receipt attachment previously ran after `saveTx` / `saveTransfer` without an explicit success result. On a failed edit, the existing transaction id could still be selected for the pending receipt.

Fixed by:
- making successful transaction/transfer saves return `true`;
- routing receipt target selection through `ReceiptCore.resolveAttachmentAfterSave`;
- refusing attachment unless the financial save completed successfully;
- adding regression coverage for failed edits and failed creates.

### Feature storage silent memory fallback

Feature storage contains receipts, security configuration, and feature metadata. An IndexedDB failure could previously fall back to session memory and report successful writes that would disappear after restart.

Fixed by:
- adding strict feature-storage initialization mode;
- keeping intentional no-IDB preview behavior as memory mode;
- treating actual IndexedDB initialization failures as `error`;
- failing writes/deletes closed in error mode;
- surfacing receipt/full-backup storage failures to the UI;
- preserving the security marker behavior so a storage failure cannot silently bypass an enabled lock.

### Failed receipt deletion reporting

Receipt deletion previously marked cloud metadata dirty and the UI could report success even when feature storage rejected the delete.

Fixed by:
- returning `false` when `delReceipt` fails;
- avoiding dirty-state mutation on failed delete;
- surfacing the failure to the UI.

## Architecture state

### Financial core

Separated modules now own financial calculations, state fingerprinting, schema/migration/repair, persistence verification, mutation rollback, reminders, reporting, backup preparation, receipt decisions, security decisions, theme, and i18n decisions.

Critical financial mutations continue to pass through the verified mutation path. The audit did not find a financial write path that bypasses the validation/rollback boundary.

### Browser/runtime shell

`index.html` remains the orchestration and DOM layer. It is still large, but most high-risk financial decisions have been moved into testable core modules.

Further splitting of DOM/rendering code is intentionally deferred until after device regression because it would add regression risk without improving current financial integrity.

### Android shell

`MainActivity` still owns WebView setup, file chooser/export, notification bridge, device authentication, lifecycle forwarding, and navigation bridging.

The current security baseline is guarded in CI:
- app content is loaded from `appassets.androidplatform.net`;
- file/content access is disabled;
- universal/file URL access is disabled;
- mixed content is disabled;
- Safe Browsing remains enabled;
- JavaScript bridge add/remove lifecycle is asserted;
- Android backup and cleartext traffic remain disabled.

## Deferred findings

These are not checkpoint blockers and should be handled after device validation:

1. `MainActivity` is still broad and should eventually be split into bridge/file/auth responsibilities.
2. Android `saveDataUrl` still duplicates export data in memory; a bounded/streamed export path would improve robustness for unusually large full backups.
3. The Android WebView can still request remote font resources. A later local-only/network policy pass can reduce the WebView network surface, but changing it now may affect presentation and future Cloud work.
4. `index.html` remains a large UI/orchestration file. Further extraction should be incremental and behavior-driven.
5. The CI architecture gate is intentionally strict but grep-heavy. It should eventually be replaced partly by structural tests.
6. Android coverage is JVM/static-gate heavy; there are no instrumentation/device tests in CI.

## Required next stage

Run a focused device regression on the APK from the latest successful architecture gate before creating a new stable checkpoint.

Minimum device coverage:
- cold start and reopen;
- automatic biometric/device-lock prompt;
- background for less than 30 seconds and more than 30 seconds;
- add/edit/delete income and expense;
- transfer and repayment;
- prepaid insufficient-balance rejection;
- attach/view/delete receipt;
- restart and confirm receipt persistence;
- finance backup export/import;
- full backup with receipt export/import;
- notification permission and reminder scheduling;
- Android back navigation;
- file chooser/camera receipt flow.

If device regression passes, the next action is to create the new stable checkpoint/tag from this branch without changing schema or backup format.
