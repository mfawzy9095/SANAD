# SANAD functional recovery — 2026-10-13

## Decision

**Frozen functional checkpoint**: `checkpoint-v9.2.14-restored-20261013` at
`5b4f7e26677a276c85b307ac736da0965caf5518`.

**Clean development branch**: `recovery/v9.2.14-clean-dev-20261013`,
forked directly from exactly that checkpoint. Subsequent CI-only changes on
the development branch do not alter the frozen checkpoint.

This deliberately **discards the V25/V25.2 UI integration from the clean
development lineage**. Do not cherry-pick V25 scripts, CSS, Android WebView
changes, SMS-service changes, or generated APKs from UI branches.

## Evidence and reason

- User accepted the functional app on physical phone 2026-10-09.
- Source checkpoint: `5b4f7e2`, versionCode 92014.
- Original passing CI: installable QA `37897922901`, local release gate
  `37897922942`. These are automated results and **do not verify the
  user's currently stored finance database**.
- Rejected UI branch `ui/v25.2-stability-hotfix-20261013` is 134
  commits ahead of this checkpoint and alters app assets, Android entry
  point and SMS service. It is not a finance-trusted release.
- User supplied screenshots of overlaid bank-card sheet and progress panel
  and reported incorrect account arithmetic / results.

## Non-negotiable safety gates

1. Do not overwrite or force-push `main`, any pre-existing checkpoint,
   `feature-v9.2-ui-features`, or the new frozen restore checkpoint.
2. **Do not downgrade or reinstall over a populated user app.** Android
   versionCode/signature and database compatibility are not proven.
   Never clear app data, uninstall a populated original app, or merge
   databases automatically.
3. Before any user-data recovery, export a full backup through the
   currently installed app (if possible), preserve a second offline copy,
   confirm backup integrity and receipt, and document transaction counts,
   per-account balances and currency basis. Read-only export preferred.
4. Keep CI on `*.forensicqa.ci`, an isolated Android package and
   synthetic test data; never use production signing credentials in CI.
5. Revalidate deposits, withdrawals, pending/review items, salary
   deduplication, card debt/available credit, transfers between accounts,
   multi-currency conversion, and balance invariants **before** any UI
   re-introduction. Compare before/after state fingerprints and backups.
6. Never claim the calculations are fixed based only on a successful
   build, emulator test, or the old stable commit. User's live data
   may already be inconsistent. Diagnose on a sanitized backup copy only.
7. A future UI must be a separate branch, built incrementally and held
   behind original financial tests and user sign-off. No merge without
   explicit approval.

## Branch roles

| Ref | Purpose |
| --- | --- |
| `checkpoint-v9.2.14-restored-20261013` | Frozen full source tree from the verified pre-UI baseline |
| `recovery/v9.2.14-clean-dev-20261013` | Clean finance-first work, QA config allowed |
| `ui/v25.2-stability-hotfix-20261013` | Rejected UI work retained for diagnostics only |
| `main` | Untouched |

## Acceptance

This recovery is complete at the **source checkpoint level** when both
branches exist, all non-CI app files match `5b4f7e2`, and branch CI
passes. **Real device and real finance balances remain unapproved until
user-side verification**; never conflate those two statuses.
