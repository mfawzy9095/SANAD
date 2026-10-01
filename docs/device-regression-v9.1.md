# SANAD V9.1 Device Regression Record

Date: 2026-10-01  
Branch: `refactor-v9.1-architecture`  
Device-tested production HEAD: `f1e9b8212184b344d37ab234bb80394269dcafd4`  
Compatibility-test HEAD before this record: `44f95d95b1800b0288045292a211c8d6a3e2971b`

## Manual device results

The following checks were executed on the real Android device and passed:

- cold start / reopen;
- automatic fingerprint / device-lock prompt on launch;
- no unwanted intermediate page before successful unlock;
- background for less than 30 seconds does not relock;
- background for more than 30 seconds relocks and prompts automatically;
- cancelled biometric does not bypass the lock.

The commit after the device-tested production HEAD changed only
`app/src/test/js/backup-core.test.js`; no production source changed.

## Backup compatibility review

A user-observed old-backup import failure was reviewed before freezing the architecture refactor.

Findings:

- schema remains version 16;
- finance-backup envelope is unchanged from V9.0.10;
- full-backup envelope remains `SANAD_FULL_BACKUP` version 1;
- the deterministic financial fingerprint algorithm is unchanged from V9.0.10;
- current UI still has two distinct restore paths: finance backup and full backup with receipts;
- using the wrong restore path can legitimately reject an otherwise valid backup as the wrong backup kind.

A V9.0.10 compatibility regression test was added. It reconstructs the V9.0.10
fingerprint algorithm plus both legacy finance and full-backup envelopes, and
asserts that the current backup core accepts and prepares them successfully.

The exact user backup file/error text was not available for reproduction, so no
backup format or schema change was made.

## CI evidence

For compatibility-test HEAD `44f95d95b1800b0288045292a211c8d6a3e2971b`:

- Push Run #227: SUCCESS
- PR Run #228: SUCCESS
- JavaScript regression tests: SUCCESS
- JVM regression tests: SUCCESS
- Android lint: SUCCESS
- debug APK build and APK verification: SUCCESS

## Freeze decision

V9.1 architecture work is frozen here as a rollback anchor. Do not merge to
`main` automatically. New feature/UI work should start from this checkpoint on
a separate development branch.

This record does not claim that every optional UI/device checklist item was
manually re-executed; it records the real-device security gate plus automated
financial/storage/backup regression coverage that was actually completed.
