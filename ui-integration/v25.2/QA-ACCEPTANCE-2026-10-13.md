# SANAD V25.2 — QA acceptance register (2026-10-13)

## Evidence baseline
- Branch: `ui/v25.2-qa-20261013` (isolated from `ui/v25.2-rebuild-candidate` at `b1feb5cfcd76fd8385e66a5997fb9d02e9715bb6`).
- Last *pre-change* CI: https://github.com/mfawzy9095/SANAD/actions/runs/38332713380 — green browser + Android 35, plus isolated QA APK; not proof for new edits.
- Target visual source `SANAD_V25_2_Icons_Restored_Interactive.html` absent from inspected branch / older V25 prototype. Do not claim 100% V25.2 parity.
- `financialInstitutionMark()` in `index.html` produces generated monograms. It does not load verified bank logo assets.

## Observed issues corrected here
1. Wallet CSS compact rules overrode multi-line bank/account labels with single-line ellipsis. Consolidated labels to 2-line clamping and relaxed compact tile heights; no second CSS override file.
2. Card editor now normalizes Eastern-Arabic / Persian digits to western digits **only in first/last four UI fields** before unchanged card saving validation. The preview pads partial entries with X (never suggests a full card number).
3. Browser QA tests verify computed two-line label styles on multiple viewports, localized 4-digit inputs, correct LTR direction, masked card preview; retains existing financial-state fingerprints.
4. Dedicated branch added to sandbox workflow; run and inspect new commit CI before accepting.

## Screen acceptance matrix
| Screen | Functional source | Open gap / evidence | Status |
|---|---|---|---|
| Home | Existing finance-backed UI and add action | Source V25.2 missing; visual/physical phone comparison | OPEN |
| Wallet banks | Finance institution groups | Two-line labels corrected; official logos still missing | PATCH; CI pending |
| Wallet accounts | Finance accountBalancePresentation & accountDebt | Two-line labels corrected; inspect long bilingual names | PATCH; CI pending |
| Wallet cards | Finance getCountryInstruments and account linking | Pointer drag & opaque neighbor automated previously | RECHECK new CI and Samsung |
| Account/card forms | Existing save actions | Localized first/last four and preview | PATCH; CI pending |
| Transactions | Existing finance transactions | Parity filters/actions and layout need visual inspection | OPEN |
| Reports | Finance reports by period/account/currency | No mixing unsupported currencies; contrast/graph parity | OPEN |
| Settings | Existing settings, locks and backups | Remaining legacy hierarchy and duplicate controls | OPEN |
| First run / lock | Existing boot/onboarding security | Reference missing, biometric on Samsung untested | OPEN |
| SMS import | Real Android bridge and counters | Android 35 prior CI passed; Samsung Android 16 notifications untested | OPEN |

## Do-not-release boundaries
No `finance-core.js`, Android SMS bridge, local storage migrations, default app ID, or protected branch changes. Preview package remains `com.sanad.v9test.v25uipreview` with ephemeral debug signature. A green CI verifies a specific test scope, **not visual parity, data integrity on a personal device, or production readiness**. Do not uninstall/clear the original `com.sanad.v9test`.
