# SANAD Web V8.9.1 — Stable Product Checkpoint

This branch is a protected development checkpoint for the SANAD personal-finance web app.

## Checkpoint file
- `checkpoints/web-v8.9.1/SANAD_V8.9.1_PRODUCT_CHECKPOINT.html`
- Local SHA-256: `d33aee9fd93fde55bec645d2ab400a4b04fa940676cf6d936603451f5dc3256b`

## Verified at checkpoint
- JavaScript syntax check passed.
- Core financial regression after SANAD rebranding: 20/20 passed.
- Previous product-release regression suite: 368/368 checks passed across finance, validation, UI, backup/import, legacy migration, reports, and repeated stability runs.
- GitHub upload was read back and matched the uploaded source content exactly.

## Deliberately NOT included in this checkpoint
- Google sign-in
- Cloud sync
- Family/shared finance
- Biometric/passkey app lock
- Receipt photo capture/sync
- SMS/bank-message ingestion

Those features must be developed on a separate branch so this checkpoint remains a safe rollback point.
