# SANAD V25 — Android UI Integration Workbench (NOT ACTIVE)

Status: **Isolated integration preparation only. No production UI or Android runtime changes committed yet.**

## Branches and non-negotiable boundaries

- **Working functional Android source:** `feature-v9.2-ui-features` (observed baseline `5b4f7e26677a276c85b307ac736da0965caf5518`). Never edit it as part of prototype work.
- **Approved visual prototype:** `prototype/v25-approved` at `prototypes/approved-v25/index.html`. This is the V25 visual source of truth.
- **Android UI workbench:** `ui/v25-android-integration` (this branch), rooted at the same functional baseline. All future visual porting happens **here only**.
- **Release/stable branches and tags:** `main`, `checkpoint-v9.0.10-device-stable`, `checkpoint-v9.1.0-architecture-stable`: leave unchanged. No merge without user approval.

## Three distinct layers

1. **Prototype:** Static independent browser UX and synthetic data; must never read real transactions, SMS, backup, or biometric credentials.
2. **Android UI shell:** A separately implemented set of screens/assets/components. When implementation begins, isolate it behind an explicitly OFF-by-default UI switch or separate build variant until tests and device sign-off. No substitution of core finance logic.
3. **Functional SANAD runtime:** Existing Room/state storage, SMS scanner/parser, reconciliation, review, backups, biometrics, deduplication, and finance domain logic are authoritative; they must not be copied from browser demo data or rewritten to fit the UI.

## Implementation gates (FUTURE)

1. Record a passing build and existing test result on original working branch.
2. Port approved original shield and splash into Android resources with appropriate sizing, and preserve Tajawal UI typography; do not substitute generated SVG or Cairo.
3. Port country > provider > account > cards with tap selection and finger-tracking swipes; preserve accessibility and native performance.
4. Wire screens exclusively via typed presentation adapters/viewmodels to the existing state/data sources; never mutate financial balances from card-color editing.
5. Keep real biometric/PIN checks for sensitive edit operations; never use demo PIN `2468` in Android.
6. No Google/email/phone login flow; launch should follow approved V25 direct-entry design subject to existing real local app security policy.
7. Validate AED/EGP/MAD and foreign-currency transactions, debit vs credit limits, transfer classification, deduplication, read-only recovery, importer behavior, account/card edits and backup/restore.
8. Gate screenshots, unit tests, on-device regression, performance, and CI. Only then propose a review; no automatic merge.

## Baseline

This branch was created 2026-10-09 from functional commit `5b4f7e26677a276c85b307ac736da0965caf5518`, and initially adds **only this documentation file**. Any later Android implementation must be independently reviewed and must not be mistaken for the approved V25 prototype itself.

## Rollback

Switch to `feature-v9.2-ui-features` for the unchanged functional source. Do not reset/force-push protected/stable refs. Workbench experiments may be abandoned by discarding this branch; data migration must not occur before approval.
